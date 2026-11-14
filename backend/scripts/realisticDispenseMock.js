/*
 * Realistic, dynamic dispensing mock for the Predictive Medicine Demand graph.
 *
 * The forecast formula (backend/src/utils/medicineForecast.js) is NOT touched. The forecast reads the same
 * consultation_dispensation + direct_dispensation rows as the Medicine Dispensed Overview, so only those rows change.
 *
 * Problem in the old data: the mock stopped on 2026-11-05 (days after it were 0, so the 30-day average and the forecast
 * sank every day) and the days held 0 / 5 / 10 / 15 jumps, so the measured weekday index swung wildly.
 *
 * What this does, per medicine, for every day from --from (default 2026-09-01) to yesterday (today is live, never edited):
 *   daily units = base rate x weekday weight (Mon high ... Sat low, Sunday closed) x slow wave x small random spread,
 *   stochastically rounded to whole units (same dispense unit the clinic already uses).
 * base rate = the medicine's own mean open-day volume from --from to --refto (2026-11-05, end of the old mock), so totals stay near the original.
 * Consultation rows (linked to clinic visits) are kept; direct_dispensation rows of the window are replaced so each day lands on its target.
 * New rows are DREAL-*; deleted rows are saved in scripts/realisticDispenseMock.backup.json (re-run undoes and redoes).
 *
 * Usage (from backend/):  node scripts/realisticDispenseMock.js            -> dry run, writes ../seed_realistic_dispense_mock.sql
 *                          node scripts/realisticDispenseMock.js --apply    -> also runs it in ClinicManagementSystem
 *                          options: --from=YYYY-MM-DD  --seed=N
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { forecastMedicineDemand } = require('../src/utils/medicineForecast');

const APPLY = process.argv.includes('--apply');
const argOf = (name, dflt) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : dflt; };
const FROM = argOf('from', '2026-09-01');
const REF_TO = argOf('refto', '2026-11-05');   // last day of the original mock data
const SEED = parseInt(argOf('seed', '20261111'), 10);
const OUT_FILE = path.join(__dirname, '..', '..', 'seed_realistic_dispense_mock.sql');
const BACKUP_FILE = path.join(__dirname, 'realisticDispenseMock.backup.json');

// Mon..Sat weights (Sunday closed); rescaled below so the open-day mean is 1
const WEEKDAY = { 1: 1.04, 2: 1.02, 3: 1.0, 4: 1.0, 5: 0.98, 6: 0.92 };
const WEEKDAY_MEAN = Object.values(WEEKDAY).reduce((s, v) => s + v, 0) / 6;

const pad = (n, w = 2) => String(n).padStart(w, '0');
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dowOf = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();
const dayDiff = (a, b) => Math.round((new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / 86400000);
const sqlStr = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const todayManila = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

const HIST_SQL = `
  SELECT 'C' AS kind, c.consultation_dispense_id AS row_id, NULL AS student_id, NULL AS nurse_id, c.batch_id, NULL AS complaint_id,
         c.dosage_consumption_unit_value AS qty, c.dosage_consumption_unit_of_measure AS uom,
         DATE_FORMAT(c.dispensed_at, '%Y-%m-%d %H:%i:%s') AS at, b.medicine_id
  FROM consultation_dispensation c JOIN medicine_inventory_batches b ON b.batch_id = c.batch_id
  UNION ALL
  SELECT 'D', d.direct_dispense_id, d.student_id, d.nurse_id, d.batch_id, d.complaint_id,
         d.dosage_consumption_unit_value, d.dosage_consumption_unit_of_measure,
         DATE_FORMAT(d.dispensed_at, '%Y-%m-%d %H:%i:%s'), b.medicine_id
  FROM direct_dispensation d JOIN medicine_inventory_batches b ON b.batch_id = d.batch_id`;

async function undoPreviousRun(conn) {
  if (!fs.existsSync(BACKUP_FILE)) return false;
  const bk = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
  await conn.query("DELETE FROM direct_dispensation WHERE direct_dispense_id LIKE 'DREAL-%'");
  for (const r of bk.deleted || []) {
    await conn.query('INSERT IGNORE INTO direct_dispensation (direct_dispense_id, student_id, nurse_id, batch_id, complaint_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at) VALUES (?,?,?,?,?,?,?,?)',
      [r.row_id, r.student_id, r.nurse_id, r.batch_id, r.complaint_id, r.qty, r.uom, r.at]);
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

  const TODAY = todayManila();
  const LAST = addDays(TODAY, -1);
  const [medicines] = await conn.query('SELECT medicine_id, generic_name, brand_name FROM medicines ORDER BY generic_name, brand_name');
  const [hist] = await conn.query(HIST_SQL);
  const [batches] = await conn.query("SELECT batch_id, medicine_id, expiration_date, DATE_FORMAT(created_at, '%Y-%m-%d') AS created_day FROM medicine_inventory_batches ORDER BY created_at, batch_id");
  const [students] = await conn.query('SELECT student_id FROM students ORDER BY student_id LIMIT 300');
  const nurseId = hist.find((r) => r.kind === 'D' && r.nurse_id)?.nurse_id || (await conn.query('SELECT nurse_id FROM nurses LIMIT 1'))[0][0].nurse_id;

  const backup = { note: 'Undo data for realisticDispenseMock.js: direct rows it deleted.', deleted: [] };
  const sql = [];
  const days = []; for (let d = FROM; d <= LAST; d = addDays(d, 1)) if (dowOf(d) !== 0) days.push(d);

  for (let mi = 0; mi < medicines.length; mi++) {
    const med = medicines[mi];
    const rand = rng(SEED + 7919 * (mi + 1));
    const rows = hist.filter((r) => r.medicine_id === med.medicine_id).map((r) => ({ ...r, qty: parseFloat(r.qty) || 0, day: r.at.slice(0, 10) }));
    if (!rows.length) continue;
    const freq = {}; rows.forEach((r) => { freq[r.qty] = (freq[r.qty] || 0) + 1; });
    const unit = parseFloat(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
    const uom = rows[0].uom;

    // base rate (units per open day) = the medicine's own mean over the original mock span of the window (FROM .. REF_TO)
    const refQty = rows.filter((r) => r.day >= FROM && r.day <= REF_TO).reduce((s, r) => s + r.qty, 0);
    let refDays = 0; for (let d = FROM; d <= REF_TO; d = addDays(d, 1)) if (dowOf(d) !== 0) refDays++;
    const base = Math.max(0.5, refQty / unit / refDays);
    // Why the old graph repeated every week: the forecast is ADD x weekday index, so only the history's level, weekday
    // shape and trend inside the 30-day window can make later weeks differ. Give each medicine its own swings:
    //  - own weekday profile (each weekday weight +-20%), - two waves (20-35 and 9-14 days), - a drift over the window,
    //  - 2-4 outbreak bursts (3-6 days at 1.5-2.4x) and quiet dips (4-7 days at 0.35-0.6x); rescaled so the volume is unchanged.
    const winRows = rows.filter((r) => r.day >= FROM && r.day <= LAST);
    const cByDay = {}; winRows.filter((r) => r.kind === 'C').forEach((r) => { cByDay[r.day] = (cByDay[r.day] || 0) + r.qty; });

    // One candidate plan = units per open day of the window. Several are tried (seeded) and the one whose forecast moves
    // most from week to week is kept. The forecast module is only READ here to score a plan, never changed.
    const makePlan = () => {
      const wd = {}; for (const k of Object.keys(WEEKDAY)) wd[k] = WEEKDAY[k] * (0.9 + 0.2 * rand());
      const wdMean = Object.values(wd).reduce((s2, v) => s2 + v, 0) / 6;
      // Why the forecast repeats: day k of the forecast = ADD_k x weekday index, and ADD_k only moves because the oldest
      // history days leave the window one by one. So the weeks of the forecast differ only if the weeks of the history
      // differ. Every calendar week (Mon-Sat) gets its own demand level (busy week, quiet week, back to busy ...),
      // like a real clinic: exam weeks, flu spells, holidays.
      const weekLevel = {};
      const levelOf = (d) => {
        const wk = Math.floor(dayDiff(d, FROM) / 7);
        if (weekLevel[wk] === undefined) weekLevel[wk] = Math.min(3, Math.max(0.25, Math.exp((rand() + rand() + rand() - 1.5) * 1.5)));
        return weekLevel[wk];
      };
      const events = [];
      const nBurst = rand() < 0.25 ? 1 : 0, nDip = 0;
      for (let e = 0; e < nBurst + nDip; e++) {
        const burst = e < nBurst;
        events.push({ at: Math.floor(rand() * days.length), len: burst ? 2 + Math.floor(rand() * 3) : 2 + Math.floor(rand() * 3), mul: burst ? 1.4 + rand() * 0.7 : 0.4 + rand() * 0.3 });
      }
      const shape = days.map((d, i) => {
        let m = levelOf(d) * (0.55 + 0.9 * rand());
        events.forEach((ev) => { if (i >= ev.at && i < ev.at + ev.len) m *= ev.mul; });
        return Math.max(0.15, m) * (wd[dowOf(d)] / wdMean);
      });
      const shapeMean = shape.reduce((s2, v) => s2 + v, 0) / shape.length;
      return days.map((d, di) => {
        const mean = base * (shape[di] / shapeMean) * (0.75 + 0.5 * rand());
        const units = Math.floor(mean) + (rand() < mean - Math.floor(mean) ? 1 : 0);
        return Math.max(units, Math.round((cByDay[d] || 0) / unit));
      });
    };
    // Score of one plan seen from one anchor day ("Forecast from"). The formula is only READ here, never changed.
    // Forecast day = ADD_k x weekday index. A repeated weekly shape comes from a strong weekday index, so the history is
    // shaped with a mild index and uneven days: ADD_k then moves with the days that leave the window and the peak day,
    // the runner-up and the lowest day change from week to week (Mon-Sat blocks), and the weekly totals differ too.
    const scoreAnchor = (plan, anchor) => {
      const byDay = {}; days.forEach((d, i) => { byDay[d] = plan[i] * unit; });
      const h = Array.from({ length: 30 }, (_, i) => byDay[addDays(anchor, -i)] || 0);
      const f = forecastMedicineDemand(h, { startDate: anchor });
      const blocks = {};
      f.forEach((x) => { const dow = dowOf(x.targetDate); if (dow === 0) return; const key = Math.floor(dayDiff(x.targetDate, '2026-01-05') / 7); (blocks[key] ??= []).push({ dow, v: x.phase1_prediction.predictedDemand }); });
      const bl = Object.values(blocks).filter((b) => b.length >= 4);
      if (bl.length < 3) return 0;
      const peaks = new Set(), seconds = new Set(), lows = new Set(); let amp = 0;
      const sums = [];
      bl.forEach((b) => {
        const s = [...b].sort((p, q) => q.v - p.v);
        peaks.add(s[0].dow); seconds.add(s[1].dow); lows.add(s[s.length - 1].dow);
        const mean = b.reduce((t, x) => t + x.v, 0) / b.length;
        amp += mean > 0 ? Math.min(1, ((s[0].v - s[s.length - 1].v) / mean) / 0.4) : 0;
        if (b.length === 6) sums.push(b.reduce((t, x) => t + x.v, 0));
      });
      const n = bl.length;
      let weekly = 0;
      if (sums.length >= 3) {
        const m = sums.reduce((x, y) => x + y, 0) / sums.length;
        const steps = sums.slice(1).map((x, i) => (x - sums[i]) / m);
        weekly = m > 0 ? Math.min(Math.min(...steps.map(Math.abs)), 0.1) / 0.1 : 0;
      }
      // Same weekly shape = high correlation between the Mon-Sat blocks once each block's own level is removed.
      const full = bl.filter((b) => b.length === 6).map((b) => { const m = b.reduce((t, x) => t + x.v, 0) / 6; return b.map((x) => x.v - m); });
      let cosSum = 0, cosN = 0;
      for (let a = 0; a < full.length; a++) for (let b = a + 1; b < full.length; b++) {
        const dot = full[a].reduce((t, v, i) => t + v * full[b][i], 0);
        const na = Math.sqrt(full[a].reduce((t, v) => t + v * v, 0)), nb = Math.sqrt(full[b].reduce((t, v) => t + v * v, 0));
        cosSum += na > 1e-9 && nb > 1e-9 ? dot / (na * nb) : 1; cosN++;
      }
      const sim = cosN ? 1 - Math.max(0, Math.min(1, cosSum / cosN)) : 0;
      return 0.35 * sim + 0.2 * (peaks.size / n) + 0.1 * (lows.size / n) + 0.1 * (seconds.size / n) + 0.1 * weekly + 0.15 * (amp / n);
    };
    const ANCHORS = [0, -7, -14, -21];
    const planScore = (cand) => {
      const sc = ANCHORS.map((a) => scoreAnchor(cand, addDays(TODAY, a)));
      return (2 * sc[0] + sc[1] + sc[2] + sc[3]) / 5;   // today counts double
    };
    const believable = (cand, total0) => {
      const meanAll = cand.reduce((x, y) => x + y, 0) / cand.length;
      const meanLast = cand.slice(-6).reduce((x, y) => x + y, 0) / 6;
      const total = cand.reduce((x, y) => x + y, 0);
      return meanLast >= 0.5 * meanAll && meanLast <= 1.7 * meanAll && total >= 0.88 * total0 && total <= 1.12 * total0;
    };
    // 1) best of many random plans, 2) hill-climb it: move one unit between days (or swap two days of a week) and keep the
    // change when the forecast gets more varied. Volume stays within 12% of the original, days stay whole units.
    let plan = null, bestScore = -1;
    for (let attempt = 0; attempt < 400; attempt++) {
      const cand = makePlan();
      const meanAll = cand.reduce((x, y) => x + y, 0) / cand.length;
      const meanLast = cand.slice(-6).reduce((x, y) => x + y, 0) / 6;
      if (meanLast < 0.5 * meanAll || meanLast > 1.7 * meanAll) continue;
      const s0 = planScore(cand);
      if (s0 > bestScore) { bestScore = s0; plan = cand; }
    }
    const total0 = plan.reduce((x, y) => x + y, 0);
    const floorOf = days.map((d) => Math.round((cByDay[d] || 0) / unit));
    const cap = Math.max(4, Math.ceil(base * 4));
    // simulated annealing: a slightly worse plan is sometimes kept so the search can leave a repeating weekly shape
    let curScore = bestScore, bestPlan = plan.slice();
    const ITER = 20000;
    for (let it = 0; it < ITER && bestScore < 0.97; it++) {
      const temp = 0.02 * (1 - it / ITER) + 0.001;
      const cand = plan.slice();
      const i = Math.floor(rand() * days.length);
      if (rand() < 0.5) {
        const j = Math.floor(rand() * days.length);
        if (Math.abs(i - j) > 12) continue;
        [cand[i], cand[j]] = [cand[j], cand[i]];
        if (cand[i] < floorOf[i] || cand[j] < floorOf[j]) continue;
      } else {
        const v = cand[i] + (rand() < 0.5 ? -1 : 1) * (1 + Math.floor(rand() * 2));
        if (v < floorOf[i] || v > cap) continue;
        cand[i] = v;
      }
      if (!believable(cand, total0)) continue;
      const s1 = planScore(cand);
      if (s1 >= curScore || rand() < Math.exp((s1 - curScore) / temp)) {
        curScore = s1; plan = cand;
        if (s1 > bestScore) { bestScore = s1; bestPlan = cand.slice(); }
      }
    }
    plan = bestPlan;

    winRows.filter((r) => r.kind === 'D').forEach((r) => {
      backup.deleted.push({ row_id: r.row_id, student_id: r.student_id, nurse_id: r.nurse_id, batch_id: r.batch_id, complaint_id: r.complaint_id, qty: r.qty, uom: r.uom, at: r.at });
      sql.push(`DELETE FROM direct_dispensation WHERE direct_dispense_id = ${sqlStr(r.row_id)};`);
    });

    const medBatches = batches.filter((b) => b.medicine_id === med.medicine_id);
    const complaints = [...new Set(rows.map((r) => r.complaint_id).filter(Boolean))];
    let seq = 0, total = 0;
    for (let di = 0; di < days.length; di++) {
      const d = days[di];
      const cUnits = Math.round((cByDay[d] || 0) / unit);
      const direct = Math.max(0, plan[di] - cUnits);
      total += plan[di];
      const live = medBatches.filter((b) => b.created_day <= d && b.expiration_date >= d);
      const batchId = (live.length ? live[live.length - 1] : medBatches[medBatches.length - 1]).batch_id;
      for (let u = 0; u < direct; u++) {
        seq++;
        const id = `DREAL-${pad(mi + 1)}-${pad(seq, 5)}`;
        const minutes = 8 * 60 + Math.floor(rand() * (8.5 * 60));
        const at = `${d} ${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;
        const student = students[Math.floor(rand() * students.length)].student_id;
        const complaint = complaints.length ? complaints[Math.floor(rand() * complaints.length)] : null;
        sql.push(`INSERT INTO direct_dispensation (direct_dispense_id, student_id, nurse_id, batch_id, complaint_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at) VALUES (${sqlStr(id)},${sqlStr(student)},${sqlStr(nurseId)},${sqlStr(batchId)},${sqlStr(complaint)},${unit.toFixed(2)},${sqlStr(uom)},${sqlStr(at)});`);
      }
    }
    console.log(`${(`${med.generic_name} (${med.brand_name})`).padEnd(36)} unit ${unit}  base ${base.toFixed(2)}/day  window ${total} units over ${days.length} days  new rows ${seq}  weekly variety score ${(bestScore * 100).toFixed(0)}/100`);
  }

  const lines = [
    '-- Realistic dispensing mock (generated by backend/scripts/realisticDispenseMock.js, seeded). Forecast formula unchanged.',
    '-- Replaces direct_dispensation rows from 2026-09-01 to yesterday; consultation rows stay. Undo data: backend/scripts/realisticDispenseMock.backup.json',
    '-- Run with: mysql --default-character-set=utf8mb4 -u root -p < seed_realistic_dispense_mock.sql',
    'USE ClinicManagementSystem;', "SET time_zone = '+08:00';", 'SET SQL_SAFE_UPDATES = 0;', 'START TRANSACTION;',
    "DELETE FROM direct_dispensation WHERE direct_dispense_id LIKE 'DREAL-%';", ...sql, 'COMMIT;'
  ];
  fs.writeFileSync(OUT_FILE, lines.join('\n') + '\n');
  console.log(`\n${sql.length} statements -> ${OUT_FILE}`);

  if (APPLY) {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup));
    await conn.beginTransaction();
    try {
      await conn.query("DELETE FROM direct_dispensation WHERE direct_dispense_id LIKE 'DREAL-%'");
      for (const s of sql) await conn.query(s);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; }
    console.log('Applied.');
  }
  await conn.end();
})().catch((e) => { console.error(e); process.exit(1); });
