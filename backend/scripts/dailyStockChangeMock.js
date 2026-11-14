/*
 * Daily stock change mock: every open day (Mon to Sat) of the window has at least one dispensed unit per medicine,
 * so the end-of-day stock snapshot (medicine_daily_stock_snapshots) is different every day.
 *
 * Only past dispensing rows are added (direct_dispensation, ids DSTK-*, one unit of the medicine's usual quantity, on a
 * batch that was live that day), from --from (default 2026-09-01) to yesterday. Today is live and never edited. Sunday is
 * closed: its stock equals Saturday's, unless a restock arrives. Existing rows are not touched.
 * Safe to re-run: DSTK-* rows are deleted first (the backup file lists what was added).
 * After applying, the rebuilt snapshots are dropped so the backend rebuilds them on its next start.
 *
 * Usage (from backend/):  node scripts/dailyStockChangeMock.js            -> dry run, writes ../seed_daily_stock_change_mock.sql
 *                          node scripts/dailyStockChangeMock.js --apply    -> also runs it in ClinicManagementSystem
 *                          options: --from=YYYY-MM-DD  --seed=N
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const APPLY = process.argv.includes('--apply');
const argOf = (name, dflt) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const FROM = argOf('from', '2026-09-01');
const SEED = parseInt(argOf('seed', '20261114'), 10);
const OUT_FILE = path.join(__dirname, '..', '..', 'seed_daily_stock_change_mock.sql');
const BACKUP_FILE = path.join(__dirname, 'dailyStockChangeMock.backup.json');

const pad = (n, w = 2) => String(n).padStart(w, '0');
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dowOf = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();
const sqlStr = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const todayManila = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: 'Yahweh0512', database: 'ClinicManagementSystem',
    dateStrings: true, charset: 'utf8mb4', multipleStatements: true
  });
  await conn.query("SET time_zone = '+08:00'");
  if (APPLY) await conn.query("DELETE FROM direct_dispensation WHERE direct_dispense_id LIKE 'DSTK-%'");   // undo the previous run

  const LAST = addDays(todayManila(), -1);
  const [medicines] = await conn.query('SELECT medicine_id, generic_name, brand_name FROM medicines ORDER BY generic_name, brand_name');
  const [rows] = await conn.query(`
    SELECT b.medicine_id, d.dosage_consumption_unit_value AS qty, d.dosage_consumption_unit_of_measure AS uom,
           DATE_FORMAT(d.dispensed_at, '%Y-%m-%d') AS day, d.nurse_id, d.complaint_id
    FROM direct_dispensation d JOIN medicine_inventory_batches b ON b.batch_id = d.batch_id
    UNION ALL
    SELECT b.medicine_id, c.dosage_consumption_unit_value, c.dosage_consumption_unit_of_measure,
           DATE_FORMAT(c.dispensed_at, '%Y-%m-%d'), NULL, NULL
    FROM consultation_dispensation c JOIN medicine_inventory_batches b ON b.batch_id = c.batch_id`);
  const [batches] = await conn.query("SELECT batch_id, medicine_id, expiration_date, DATE_FORMAT(created_at, '%Y-%m-%d') AS created_day FROM medicine_inventory_batches ORDER BY created_at, batch_id");
  const [students] = await conn.query('SELECT student_id FROM students ORDER BY student_id LIMIT 300');
  const nurseId = rows.find((r) => r.nurse_id)?.nurse_id || (await conn.query('SELECT nurse_id FROM nurses LIMIT 1'))[0][0].nurse_id;

  const sql = []; const added = [];
  for (let mi = 0; mi < medicines.length; mi++) {
    const med = medicines[mi];
    const rand = rng(SEED + 7919 * (mi + 1));
    const mine = rows.filter((r) => r.medicine_id === med.medicine_id).map((r) => ({ ...r, qty: parseFloat(r.qty) || 0 }));
    if (!mine.length) continue;
    const freq = {}; mine.forEach((r) => { freq[r.qty] = (freq[r.qty] || 0) + 1; });
    const unit = parseFloat(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
    const uom = mine[0].uom;
    const hasRow = new Set(mine.map((r) => r.day));
    const medBatches = batches.filter((b) => b.medicine_id === med.medicine_id);
    const complaints = [...new Set(mine.map((r) => r.complaint_id).filter(Boolean))];
    let seq = 0;
    for (let d = FROM; d <= LAST; d = addDays(d, 1)) {
      if (dowOf(d) === 0 || hasRow.has(d)) continue;
      const live = medBatches.filter((b) => b.created_day <= d && String(b.expiration_date).slice(0, 10) >= d);
      const batchId = (live.length ? live[live.length - 1] : medBatches[medBatches.length - 1]).batch_id;
      seq++;
      const id = `DSTK-${pad(mi + 1)}-${pad(seq, 4)}`;
      const minutes = 8 * 60 + Math.floor(rand() * (8.5 * 60));
      const at = `${d} ${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;
      const student = students[Math.floor(rand() * students.length)].student_id;
      const complaint = complaints.length ? complaints[Math.floor(rand() * complaints.length)] : null;
      added.push(id);
      sql.push(`INSERT INTO direct_dispensation (direct_dispense_id, student_id, nurse_id, batch_id, complaint_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at) VALUES (${sqlStr(id)},${sqlStr(student)},${sqlStr(nurseId)},${sqlStr(batchId)},${sqlStr(complaint)},${unit.toFixed(2)},${sqlStr(uom)},${sqlStr(at)});`);
    }
    console.log(`${`${med.generic_name} (${med.brand_name})`.padEnd(38)} +${seq} rows (unit ${unit} ${uom})`);
  }

  const lines = [
    '-- Daily stock change mock (backend/scripts/dailyStockChangeMock.js): one dispensed unit on every open day without one, so the',
    '-- end-of-day stock snapshot differs every day. Undo: DELETE FROM direct_dispensation WHERE direct_dispense_id LIKE \'DSTK-%\';',
    'USE ClinicManagementSystem;', "SET time_zone = '+08:00';", 'START TRANSACTION;',
    "DELETE FROM direct_dispensation WHERE direct_dispense_id LIKE 'DSTK-%';", ...sql, 'COMMIT;'
  ];
  fs.writeFileSync(OUT_FILE, lines.join('\n') + '\n');
  console.log(`\n${sql.length} rows -> ${OUT_FILE}`);

  if (APPLY) {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify({ note: 'Rows added by dailyStockChangeMock.js (undo: delete them).', inserted: added }));
    await conn.beginTransaction();
    try {
      for (const s of sql) await conn.query(s);
      await conn.query("DELETE FROM medicine_daily_stock_snapshots WHERE source = 'rebuilt'");   // the backend rebuilds them on its next start
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; }
    console.log('Applied. Restart the backend so the snapshots are rebuilt.');
  }
  await conn.end();
})().catch((e) => { console.error(e); process.exit(1); });
