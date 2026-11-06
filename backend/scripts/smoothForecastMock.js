/*
 * Smooth the dispensing mock data so the Predictive Medicine Demand snapshots move day by day.
 *
 * Why it jumped: the forecast formula (backend/src/utils/medicineForecast.js, NOT changed) gives every target day a
 * deterministic variation seeded by the target date + the 30-day history. Each new day changes the history, so the
 * same target day was re-rolled at every snapshot (Biogesic: 30-day total 96 on Nov 5, 76 on Nov 6, tomorrow 6.81 -> 3.2).
 *
 * What this does: it only edits the past dispensing rows. Per medicine it walks the days in order and picks, with a
 * beam search, a small row change per day (a few units at most, never on a Sunday) so that, snapshot after snapshot:
 *   - the 30-day predicted total moves by a few units, not by dozens,
 *   - the next days keep close to what the previous snapshot predicted for the same dates,
 *   - the average daily demand and the 30-day volume stay close to the original data (no net drift).
 * Added units are new direct_dispensation rows (DSMTH-*), removed units delete / shrink existing rows.
 * Days after the mock data ended (open days up to yesterday with no rows) get a normal-sized baseline instead of 0.
 * Today is never edited (live data).
 *
 * Usage (from backend/):  node scripts/smoothForecastMock.js              -> dry run: metrics + writes ../seed_smooth_forecast_mock.sql
 *                          node scripts/smoothForecastMock.js --apply      -> also runs it in ClinicManagementSystem
 *                          options: --from=YYYY-MM-DD (first snapshot day smoothed, default 2025-03-01) --beam=80
 * Safe to re-run: before planning, the previous run is undone from scripts/smoothForecastMock.backup.json
 * (re-inserts deleted rows, restores quantities, drops DSMTH-* rows), so the plan always starts from the original data.
 * Same output every run (seeded). Sunday is closed and never touched.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { forecastMedicineDemand } = require('../src/utils/medicineForecast');

const APPLY = process.argv.includes('--apply');
const argOf = (name, dflt) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const FROM = argOf('from', '2025-03-01');
const BEAM = parseInt(argOf('beam', '80'), 10);
const OUT_FILE = path.join(__dirname, '..', '..', 'seed_smooth_forecast_mock.sql');
const BACKUP_FILE = path.join(__dirname, 'smoothForecastMock.backup.json');

// cost weights (tuned on Paracetamol / Biogesic)
const COST = { lo: -4, hi: 5, edit: 0.3, total: 0.02, near: 3, mid: 1.5, far: 0.4, days: 1.5, add: 0.3, net: 1 };

const pad = (n, w = 2) => String(n).padStart(w, '0');
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dowOf = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();
const sqlStr = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const todayManila = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- optimiser
function evalAnchor(hist, a) {
  const f = forecastMedicineDemand(hist, { startDate: a });
  const p = new Array(30); let T = 0;
  for (let i = 0; i < 30; i++) { p[i] = f[i].phase1_prediction.predictedDemand; T += p[i]; }
  return { p, T, add: f[0].phase1_prediction.activeADD };
}

function optimise(base, o) {
  const days = []; for (let d = o.start; d <= o.end; d = addDays(d, 1)) days.push(d);
  const get = (vals, x) => (vals.has(x) ? vals.get(x) : (base[x] || 0));
  const histOf = (vals, d) => Array.from({ length: 30 }, (_, i) => get(vals, addDays(d, -i)));
  const origAdd = {}; for (const d of days) origAdd[d] = evalAnchor(histOf(new Map(), d), d).add;
  const prevDay = addDays(o.start, -1);
  let beam = [{ vals: new Map(), cost: 0, prev: evalAnchor(histOf(new Map(), prevDay), prevDay), deltas: new Map() }];
  for (const d of days) {
    const orig = base[d] || 0;
    const editable = dowOf(d) !== 0 && !o.fixed.has(d);
    const cands = [];
    if (editable) { for (let k = COST.lo; k <= COST.hi; k++) { const v = orig + k * o.unit; if (v >= 0) cands.push([v, k]); } } else cands.push([orig, 0]);
    const next = [];
    for (const st of beam) {
      for (const [v, k] of cands) {
        const vals = new Map(st.vals); vals.set(d, v);
        const e = evalAnchor(histOf(vals, d), d);
        let c = st.cost + COST.edit * Math.abs(k);
        c += ((e.T - st.prev.T) / (COST.total * st.prev.T + 1)) ** 2;
        let cd = 0;
        for (let i = 0; i < 29; i++) {
          const w = i < 3 ? COST.near : i < 7 ? COST.mid : COST.far;
          const x = (e.p[i] - st.prev.p[i + 1]) / (e.add + 0.5);
          cd += w * x * x;
        }
        c += COST.days * cd;
        c += COST.add * ((e.add - origAdd[d]) / (0.06 * origAdd[d] + 0.25)) ** 2;
        let n30 = 0, w30 = 0;
        for (let i = 0; i < 30; i++) { const x = addDays(d, -i); n30 += get(vals, x) - (base[x] || 0); w30 += base[x] || 0; }
        c += COST.net * (n30 / (0.04 * w30 + 2 * o.unit)) ** 2;
        next.push({ vals, cost: c, prev: e, deltas: k ? new Map(st.deltas).set(d, v) : st.deltas });
      }
    }
    next.sort((a, b) => a.cost - b.cost);
    beam = next.slice(0, BEAM);
  }
  return beam[0];
}

function metrics(base, vals, o) {
  const get = (x) => (vals.has(x) ? vals.get(x) : (base[x] || 0));
  let prev = null, sT = 0, mT = 0, n = 0, sp = 0, np = 0;
  for (let d = o.start; d <= o.end; d = addDays(d, 1)) {
    const e = evalAnchor(Array.from({ length: 30 }, (_, i) => get(addDays(d, -i))), d);
    if (prev) { const x = Math.abs(e.T - prev.T); sT += x; mT = Math.max(mT, x); n++; for (let i = 0; i < 3; i++) { sp += Math.abs(e.p[i] - prev.p[i + 1]); np++; } }
    prev = e;
  }
  return { meanT: sT / n, maxT: mT, near3: sp / np };
}

// ---------------------------------------------------------------- DB helpers
const HIST_SQL = `
  SELECT 'C' AS kind, c.consultation_dispense_id AS row_id, c.visit_id, NULL AS student_id, NULL AS nurse_id, c.batch_id, v.complaint_id,
         c.dosage_consumption_unit_value AS qty, c.dosage_consumption_unit_of_measure AS uom,
         DATE_FORMAT(c.dispensed_at, '%Y-%m-%d %H:%i:%s') AS at, b.medicine_id
  FROM consultation_dispensation c
  JOIN medicine_inventory_batches b ON b.batch_id = c.batch_id
  LEFT JOIN clinic_visits v ON v.visit_id = c.visit_id
  UNION ALL
  SELECT 'D', d.direct_dispense_id, NULL, d.student_id, d.nurse_id, d.batch_id, d.complaint_id,
         d.dosage_consumption_unit_value, d.dosage_consumption_unit_of_measure,
         DATE_FORMAT(d.dispensed_at, '%Y-%m-%d %H:%i:%s'), b.medicine_id
  FROM direct_dispensation d JOIN medicine_inventory_batches b ON b.batch_id = d.batch_id`;

async function undoPreviousRun(conn) {
  if (!fs.existsSync(BACKUP_FILE)) return false;
  const bk = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
  if (bk.inserted && bk.inserted.length) await conn.query('DELETE FROM direct_dispensation WHERE direct_dispense_id IN (?)', [bk.inserted]);
  for (const r of bk.updated || []) {
    const t = r.kind === 'C' ? 'consultation_dispensation' : 'direct_dispensation';
    const k = r.kind === 'C' ? 'consultation_dispense_id' : 'direct_dispense_id';
    await conn.query(`UPDATE ${t} SET dosage_consumption_unit_value = ? WHERE ${k} = ?`, [r.qty, r.row_id]);
  }
  for (const r of bk.deleted || []) {
    if (r.kind === 'C') {
      await conn.query('INSERT IGNORE INTO consultation_dispensation (consultation_dispense_id, visit_id, batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at) VALUES (?,?,?,?,?,?)',
        [r.row_id, r.visit_id, r.batch_id, r.qty, r.uom, r.at]);
    } else {
      await conn.query('INSERT IGNORE INTO direct_dispensation (direct_dispense_id, student_id, nurse_id, batch_id, complaint_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at) VALUES (?,?,?,?,?,?,?,?)',
        [r.row_id, r.student_id, r.nurse_id, r.batch_id, r.complaint_id, r.qty, r.uom, r.at]);
    }
  }
  return true;
}

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: 'Yahweh0512', database: 'ClinicManagementSystem',
    dateStrings: true, charset: 'utf8mb4', multipleStatements: true
  });
  await conn.query("SET time_zone = '+08:00'");

  if (APPLY && await undoPreviousRun(conn)) console.log('Previous run undone from backup.');
  else if (!APPLY && fs.existsSync(BACKUP_FILE)) console.log('Note: a previous run exists in the DB; the dry run reads the DB as it is now. Use --apply to undo + redo from the original data.');

  const TODAY = todayManila();
  const END = TODAY;                       // last anchor = today (live), never edited
  const LAST_EDIT = addDays(TODAY, -1);

  const [medicines] = await conn.query('SELECT medicine_id, generic_name, brand_name FROM medicines ORDER BY generic_name, brand_name');
  const [hist] = await conn.query(HIST_SQL);
  const [batches] = await conn.query("SELECT batch_id, medicine_id, expiration_date, DATE_FORMAT(created_at, '%Y-%m-%d') AS created_day FROM medicine_inventory_batches ORDER BY created_at, batch_id");
  const [students] = await conn.query('SELECT student_id FROM students ORDER BY student_id LIMIT 300');
  const nurseRow = (await conn.query('SELECT nurse_id FROM nurses ORDER BY nurse_id LIMIT 1'))[0][0];
  const nurseId = hist.find((r) => r.kind === 'D' && r.nurse_id)?.nurse_id || nurseRow.nurse_id;

  const backup = { note: 'Undo data for smoothForecastMock.js: rows it deleted, quantities it changed and ids it inserted.', deleted: [], updated: [], inserted: [] };
  const sql = [];
  let insertSeq = 0;
  const report = [];

  for (let mi = 0; mi < medicines.length; mi++) {
    const med = medicines[mi];
    const rand = rng(104729 * (mi + 1) + 20261106);
    const rows = hist.filter((r) => r.medicine_id === med.medicine_id).map((r) => ({ ...r, qty: parseFloat(r.qty) || 0, day: r.at.slice(0, 10) }));
    if (!rows.length) continue;
    // unit = most common quantity
    const freq = {}; rows.forEach((r) => { freq[r.qty] = (freq[r.qty] || 0) + 1; });
    const unit = parseFloat(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
    const uom = rows[0].uom;

    const orig = {}; rows.forEach((r) => { orig[r.day] = (orig[r.day] || 0) + r.qty; });
    const base = { ...orig };
    const firstDay = rows.reduce((m, r) => (r.day < m ? r.day : m), '9999-12-31');
    const lastDay = rows.reduce((m, r) => (r.day > m ? r.day : m), '0000-00-00');

    // days after the mock data ended (open days up to yesterday): a normal-sized baseline instead of 0
    const mockEnd = lastDay;
    const recent = []; for (let d = mockEnd, c = 0; c < 21; d = addDays(d, -1), c++) if (dowOf(d) !== 0) recent.push(orig[d] || 0);
    const recentMean = recent.reduce((s, v) => s + v, 0) / (recent.length || 1);
    const baseline = {};
    for (let d = addDays(mockEnd, 1); d <= LAST_EDIT; d = addDays(d, 1)) {
      if (dowOf(d) === 0) continue;
      const v = Math.max(0, Math.round((recentMean * (0.7 + rand() * 0.6)) / unit) * unit);
      base[d] = v; baseline[d] = v;
    }

    const start = FROM > addDays(firstDay, 30) ? FROM : addDays(firstDay, 30);
    const o = { start, end: END, unit, fixed: new Set([TODAY]) };
    const best = optimise(base, o);
    const before = metrics(base, new Map(), o);
    const after = metrics(base, best.vals, o);
    let net = 0; best.deltas.forEach((v, d) => { net += v - (base[d] || 0); });

    // ---- turn the planned day totals into row changes
    const medBatches = batches.filter((b) => b.medicine_id === med.medicine_id);
    const complaints = [...new Set(rows.map((r) => r.complaint_id).filter(Boolean))];
    let adds = 0, removes = 0, shrinks = 0;
    // every planned day whose total differs from the real rows (includes the baseline days after the mock ended)
    const days = [...best.vals.keys()].filter((d) => Math.abs(best.vals.get(d) - (orig[d] || 0)) > 1e-9).sort();
    for (const d of days) {
      const target = best.vals.get(d);
      const have = orig[d] || 0;
      let diff = Math.round((target - have) * 100) / 100;     // units to add (+) or remove (-) against the real rows
      const dayRows = rows.filter((r) => r.day === d);
      if (diff < 0) {
        // remove: direct rows first, then consultation rows, newest first; shrink a row when it is bigger than what is left to remove
        const order = [...dayRows].sort((a, b) => (a.kind === b.kind ? (a.at < b.at ? 1 : -1) : a.kind === 'D' ? -1 : 1));
        let left = -diff;
        for (const r of order) {
          if (left <= 1e-9) break;
          if (r.qty <= left + 1e-9) {
            backup.deleted.push({ kind: r.kind, row_id: r.row_id, visit_id: r.visit_id, student_id: r.student_id, nurse_id: r.nurse_id, batch_id: r.batch_id, complaint_id: r.complaint_id, qty: r.qty, uom: r.uom, at: r.at });
            sql.push(r.kind === 'C' ? `DELETE FROM consultation_dispensation WHERE consultation_dispense_id = ${sqlStr(r.row_id)};` : `DELETE FROM direct_dispensation WHERE direct_dispense_id = ${sqlStr(r.row_id)};`);
            left -= r.qty; removes++;
          } else {
            const nq = Math.round((r.qty - left) * 100) / 100;
            backup.updated.push({ kind: r.kind, row_id: r.row_id, qty: r.qty });
            const t = r.kind === 'C' ? 'consultation_dispensation' : 'direct_dispensation';
            const k = r.kind === 'C' ? 'consultation_dispense_id' : 'direct_dispense_id';
            sql.push(`UPDATE ${t} SET dosage_consumption_unit_value = ${nq.toFixed(2)} WHERE ${k} = ${sqlStr(r.row_id)};`);
            left = 0; shrinks++;
          }
        }
      } else if (diff > 1e-9) {
        // add: new direct dispensations of one unit, on the batch the clinic was using that day
        const live = medBatches.filter((b) => b.created_day <= d && b.expiration_date >= d);
        const sameDayBatch = dayRows.map((r) => r.batch_id).find((id) => live.some((b) => b.batch_id === id));
        const batchId = sameDayBatch || (live.length ? live[live.length - 1].batch_id : medBatches[medBatches.length - 1].batch_id);
        for (let u = 0; u < Math.round(diff / unit); u++) {
          insertSeq++;
          const id = `DSMTH-${pad(mi + 1)}-${pad(insertSeq, 5)}`;
          const minutes = 8 * 60 + Math.floor(rand() * (8.5 * 60));
          const at = `${d} ${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;
          const student = students[Math.floor(rand() * students.length)].student_id;
          const complaint = complaints.length ? complaints[Math.floor(rand() * complaints.length)] : null;
          backup.inserted.push(id);
          sql.push(`INSERT INTO direct_dispensation (direct_dispense_id, student_id, nurse_id, batch_id, complaint_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at) VALUES (${sqlStr(id)},${sqlStr(student)},${sqlStr(nurseId)},${sqlStr(batchId)},${sqlStr(complaint)},${unit.toFixed(2)},${sqlStr(uom)},${sqlStr(at)});`);
          adds++;
        }
      }
    }
    report.push(`${(`${med.generic_name} (${med.brand_name})`).padEnd(38)} +${String(adds).padStart(3)} rows  -${String(removes).padStart(3)} rows  ~${String(shrinks).padStart(2)} shrunk  net ${net >= 0 ? '+' : ''}${net.toFixed(0)}`
      + `   30d total step mean ${before.meanT.toFixed(1)} -> ${after.meanT.toFixed(1)}  max ${before.maxT.toFixed(0)} -> ${after.maxT.toFixed(0)}   next-3-day diff ${before.near3.toFixed(2)} -> ${after.near3.toFixed(2)}`);
    console.log(report[report.length - 1]);
  }

  const lines = [];
  lines.push('-- =====================================================================================');
  lines.push('-- Smooth forecast mock: small row changes in the past dispensing data so the Predictive Medicine Demand');
  lines.push('-- snapshots move day by day (generated by backend/scripts/smoothForecastMock.js, seeded: same output every run).');
  lines.push('-- The forecast formula is NOT changed. Run it AFTER the other seed files (seed_nov_2026_forecast_mock.sql,');
  lines.push('-- seed_snapshot_stock_mock.sql). Added units are direct_dispensation rows DSMTH-*; undo data is in');
  lines.push('-- backend/scripts/smoothForecastMock.backup.json (node scripts/smoothForecastMock.js --apply undoes and redoes it).');
  lines.push('-- Run with: mysql --default-character-set=utf8mb4 -u root -p < seed_smooth_forecast_mock.sql');
  lines.push('-- =====================================================================================');
  lines.push('USE ClinicManagementSystem;', "SET time_zone = '+08:00';", 'SET SQL_SAFE_UPDATES = 0;', 'START TRANSACTION;', '');
  lines.push(`DELETE FROM direct_dispensation WHERE direct_dispense_id LIKE 'DSMTH-%';`, '');
  lines.push(...sql, 'COMMIT;');
  fs.writeFileSync(OUT_FILE, lines.join('\n') + '\n');
  console.log(`\n${sql.length} statements -> ${OUT_FILE}`);

  if (APPLY) {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup));
    await conn.query('SET SQL_SAFE_UPDATES = 0');
    await conn.beginTransaction();
    try {
      await conn.query("DELETE FROM direct_dispensation WHERE direct_dispense_id LIKE 'DSMTH-%'");
      for (let i = 0; i < sql.length; i++) await conn.query(sql[i]);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; }
    console.log('Applied.');
  }
  await conn.end();
})().catch((e) => { console.error(e); process.exit(1); });
