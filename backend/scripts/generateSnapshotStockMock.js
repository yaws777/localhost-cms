/*
 * Snapshot stock mock for the Predictive Medicine Demand chart ("Forecast from" date).
 *
 * The snapshot rebuilds the stock of a past day from batches: what is left now + what was dispensed from the batch
 * after that day, for batches that already existed and were not expired. With one big batch per medicine every past
 * day looks the same, so this script gives each medicine a restock history:
 *   - it keeps every consultation_dispensation / direct_dispensation row (same date, same quantity),
 *   - plans a restock every 4 to 7 weeks (random per medicine and cycle, seeded: same result every run),
 *     sized to cover the cycle demand plus a random cushion (a few cycles run close to empty before the next restock),
 *   - re-points each dispensation to the batch it was taken from (oldest batch with enough first),
 *   - keeps today's batches (current_stock / remaining_volume / expiry are NOT changed), only their created_at moves
 *     to the last restock dates; so the live stock, the live forecast and the Predicted Need today stay the same.
 * New batches are SNAP-<medicine no.>-<cycle no.>; they end at 0 stock (fully dispensed).
 *
 * Usage (from backend/):  node scripts/generateSnapshotStockMock.js            -> writes ../seed_snapshot_stock_mock.sql
 *                          node scripts/generateSnapshotStockMock.js --apply   -> also runs it in ClinicManagementSystem
 * Safe to re-run: the plan is rebuilt from the dispensation rows, old SNAP batches are replaced.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const APPLY = process.argv.includes('--apply');
const OUT_FILE = path.join(__dirname, '..', '..', 'seed_snapshot_stock_mock.sql');
const BACKUP_FILE = path.join(__dirname, 'snapshotStockMock.backup.json');

const DISCRETE_UNITS = ['Tablet/s', 'Capsule/s', 'Patch/es', 'Sachet', 'Vial', 'Prefilled Syringe', 'Spray/s', 'Inhaler', 'Box/es'];
const toBase = (v, u) => {
  const x = parseFloat(v) || 0;
  switch ((u || '').toLowerCase().trim()) { case 'g': case 'l': return x * 1000; case 'mcg': return x / 1000; default: return x; }
};
const fromBase = (b, u) => {
  switch ((u || '').toLowerCase().trim()) { case 'g': case 'l': return b / 1000; case 'mcg': return b * 1000; default: return b; }
};
const containerStrength = (sv, su, du) => (DISCRETE_UNITS.includes(du) ? 1 : fromBase(toBase(sv, su), du) || 1);

// seeded random (mulberry32)
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

const pad = (n, w = 2) => String(n).padStart(w, '0');
const dayStr = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const parseDay = (s) => new Date(`${s.slice(0, 10)}T00:00:00Z`);
const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;
const num = (n) => parseFloat(Number(n).toFixed(2));

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: 'Yahweh0512', database: 'ClinicManagementSystem',
    dateStrings: true, charset: 'utf8mb4', multipleStatements: true
  });
  await conn.query("SET time_zone = '+08:00'");

  const [medicines] = await conn.query(`SELECT medicine_id, generic_name, brand_name, dispense_unit_of_measure AS du,
    strength_unit_value AS sv, strength_unit_of_measure AS su FROM medicines ORDER BY generic_name, brand_name`);
  const [allBatches] = await conn.query(`SELECT batch_id, medicine_id, expiration_date, current_stock, remaining_volume,
    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM medicine_inventory_batches ORDER BY created_at, batch_id`);
  const [dispRows] = await conn.query(`
    SELECT 'C' AS kind, c.consultation_dispense_id AS row_id, c.batch_id, c.dosage_consumption_unit_value AS qty,
           DATE_FORMAT(c.dispensed_at, '%Y-%m-%d %H:%i:%s') AS at, b.medicine_id
    FROM consultation_dispensation c JOIN medicine_inventory_batches b ON b.batch_id = c.batch_id
    UNION ALL
    SELECT 'D', d.direct_dispense_id, d.batch_id, d.dosage_consumption_unit_value,
           DATE_FORMAT(d.dispensed_at, '%Y-%m-%d %H:%i:%s'), b.medicine_id
    FROM direct_dispensation d JOIN medicine_inventory_batches b ON b.batch_id = d.batch_id`);

  fs.writeFileSync(BACKUP_FILE, JSON.stringify({
    note: 'Original state before generateSnapshotStockMock.js: batches (incl. created_at) and the batch each dispensation row pointed to.',
    batches: allBatches, dispensations: dispRows.map(r => ({ kind: r.kind, row_id: r.row_id, batch_id: r.batch_id }))
  }));

  const today = new Date(); // restocks stop 10 days before the real today
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  const newBatches = [];   // synthetic batch rows to insert
  const finalUpdates = []; // existing batches: new created_at
  const mapping = [];      // [kind, row_id, batch_id]
  const report = [];

  medicines.forEach((med, mi) => {
    const rand = rng(7919 * (mi + 1) + 20261105);
    const cs = containerStrength(med.sv, med.su, med.du);
    const discrete = DISCRETE_UNITS.includes(med.du);
    const rows = dispRows.filter(r => r.medicine_id === med.medicine_id)
      .map(r => ({ ...r, qty: parseFloat(r.qty) || 0 }))
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : String(a.row_id).localeCompare(String(b.row_id))));
    const finals = allBatches.filter(b => b.medicine_id === med.medicine_id && !String(b.batch_id).startsWith('SNAP-'))
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    if (!rows.length || !finals.length) return;

    // ---- restock dates: first on the first dispensing day, then every 28-49 days, last one >= 10 days before today
    const start = parseDay(rows[0].at);
    const lastAllowed = addDays(todayUtc, -10);
    const events = [start];
    while (true) {
      const next = addDays(events[events.length - 1], 28 + Math.floor(rand() * 22));
      if (next > lastAllowed) break;
      events.push(next);
    }
    // the finals (today's batches) take the last restock dates; make sure there are enough dates for them
    while (events.length < finals.length + 1) events.push(addDays(events[events.length - 1], 28 + Math.floor(rand() * 22)));
    const nSynthetic = events.length - finals.length;

    // ---- batches in date order
    const batches = events.map((d, i) => {
      const isFinal = i >= nSynthetic;
      return {
        id: isFinal ? finals[i - nSynthetic].batch_id : `SNAP-${pad(mi + 1)}-${pad(i + 1, 3)}`,
        isFinal, date: dayStr(d), createdAt: `${dayStr(d)} 07:30:00`, rem: 0, drawn: 0, cap: 0,
        expiry: dayStr(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 18 + Math.floor(rand() * 13), d.getUTCDate())))
      };
    });

    // ---- size the synthetic batches cycle by cycle, then assign each dispensation (oldest batch with enough first)
    let ri = 0;
    batches.forEach((b, i) => {
      const nextDate = i + 1 < batches.length ? batches[i + 1].date : '9999-12-31';
      let cycleDemand = 0;
      for (let j = ri; j < rows.length && rows[j].at.slice(0, 10) < nextDate; j++) cycleDemand += rows[j].qty;

      if (!b.isFinal) {
        const carry = batches.slice(0, i).reduce((s, x) => s + x.rem, 0);
        // cushion: usually 8-40% of the cycle, one cycle in five runs almost dry (2-4%)
        const cushion = rand() < 0.2 ? 0.02 + rand() * 0.02 : 0.08 + rand() * 0.32;
        const need = Math.max(cycleDemand * (1 + cushion) + 3 - carry, cs);
        b.cap = Math.ceil(need / cs - 1e-9) * cs;
        b.rem = b.cap;
      } else {
        b.rem = Infinity; // today's batch: whatever is left unassigned is taken from it, the rest stays as today's stock
      }

      for (; ri < rows.length && rows[ri].at.slice(0, 10) < nextDate; ri++) {
        const r = rows[ri];
        const pool = batches.slice(0, i + 1);
        let pick = pool.find(x => !x.isFinal && x.rem >= r.qty - 1e-9);
        if (!pick) pick = [...pool].reverse().find(x => x.isFinal) || pool[pool.length - 1];
        pick.rem -= r.qty;
        pick.drawn += r.qty;
        mapping.push([r.kind, r.row_id, pick.id]);
      }
    });

    // ---- store the result
    batches.forEach((b) => {
      if (b.isFinal) { finalUpdates.push({ id: b.id, createdAt: b.createdAt }); return; }
      const initial = b.drawn; // never keep unused leftovers: the batch ends at 0
      newBatches.push({ id: b.id, medicine_id: med.medicine_id, expiry: b.expiry, createdAt: b.createdAt, initial, cs, discrete });
    });
    report.push(`${med.generic_name} (${med.brand_name}): ${rows.length} dispensations, ${nSynthetic} new batches + ${finals.length} current, ${batches[0].date} .. ${batches[batches.length - 1].date}`);
  });

  // ---- SQL
  const lines = [];
  lines.push('-- =====================================================================================');
  lines.push('-- Snapshot stock mock for the Predictive Medicine Demand "Forecast from" date.');
  lines.push('-- Generated by backend/scripts/generateSnapshotStockMock.js (seeded: same output every run).');
  lines.push('-- Each medicine gets a restock history (a batch every 4-7 weeks, SNAP-<medicine>-<cycle>), every');
  lines.push('-- consultation_dispensation / direct_dispensation row is pointed at the batch it was taken from, and the');
  lines.push("-- current batches keep their stock and expiry (only created_at moves to the last restock dates), so today's");
  lines.push('-- stock and forecast do not change. Back up first; the original mapping is in backend/scripts/snapshotStockMock.backup.json.');
  lines.push('-- Run with: mysql --default-character-set=utf8mb4 -u root -p < seed_snapshot_stock_mock.sql');
  lines.push('-- =====================================================================================');
  lines.push('USE ClinicManagementSystem;');
  lines.push("SET time_zone = '+08:00';");
  lines.push('START TRANSACTION;');
  lines.push('');
  const batchRows = newBatches.map(b => {
    // stock is 0 once everything is dispensed (current_stock 0, remaining_volume 0)
    return `(${sqlStr(b.id)},${sqlStr(b.medicine_id)},${sqlStr(b.expiry)},0,0.00,${sqlStr(b.createdAt)})`;
  });
  for (let i = 0; i < batchRows.length; i += 200) {
    lines.push('INSERT INTO medicine_inventory_batches (batch_id, medicine_id, expiration_date, current_stock, remaining_volume, created_at) VALUES');
    lines.push(batchRows.slice(i, i + 200).join(',\n'));
    lines.push('ON DUPLICATE KEY UPDATE medicine_id = VALUES(medicine_id), expiration_date = VALUES(expiration_date), current_stock = 0, remaining_volume = 0.00, created_at = VALUES(created_at);');
  }
  lines.push('');
  finalUpdates.forEach(f => lines.push(`UPDATE medicine_inventory_batches SET created_at = ${sqlStr(f.createdAt)} WHERE batch_id = ${sqlStr(f.id)};`));
  lines.push('');
  lines.push('CREATE TEMPORARY TABLE tmp_snap_map (kind CHAR(1) NOT NULL, row_id VARCHAR(45) NOT NULL, batch_id VARCHAR(45) NOT NULL, PRIMARY KEY (kind, row_id));');
  for (let i = 0; i < mapping.length; i += 500) {
    lines.push('INSERT INTO tmp_snap_map (kind, row_id, batch_id) VALUES');
    lines.push(mapping.slice(i, i + 500).map(m => `(${sqlStr(m[0])},${sqlStr(m[1])},${sqlStr(m[2])})`).join(',\n') + ';');
  }
  lines.push('UPDATE consultation_dispensation c JOIN tmp_snap_map t ON t.kind = \'C\' AND t.row_id = c.consultation_dispense_id SET c.batch_id = t.batch_id;');
  lines.push('UPDATE direct_dispensation d JOIN tmp_snap_map t ON t.kind = \'D\' AND t.row_id = d.direct_dispense_id SET d.batch_id = t.batch_id;');
  lines.push('DROP TEMPORARY TABLE tmp_snap_map;');
  lines.push('');
  lines.push("-- old SNAP batches that are no longer in the plan (re-runs)");
  lines.push(`DELETE FROM medicine_inventory_batches WHERE batch_id LIKE 'SNAP-%' AND batch_id NOT IN (${newBatches.map(b => sqlStr(b.id)).join(',') || "''"});`);
  lines.push('COMMIT;');
  fs.writeFileSync(OUT_FILE, lines.join('\n') + '\n');

  console.log(report.join('\n'));
  console.log(`\n${newBatches.length} new batches, ${mapping.length} dispensations mapped -> ${OUT_FILE}`);

  if (APPLY) {
    await conn.query(fs.readFileSync(OUT_FILE, 'utf8'));
    console.log('Applied.');
  }
  await conn.end();
})().catch((e) => { console.error(e); process.exit(1); });
