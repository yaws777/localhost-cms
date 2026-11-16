// One-off cleanup: strip leading/trailing spaces from students.student_id (+ names) and every
// column that references it. utf8mb4_0900_ai_ci is PAD NO SPACE, so '0200 ' <> '0200' and
// student lookups by the trimmed id return nothing.
// Usage: node backend/scripts/trimStudentIds.js            (dry run: report + backup only)
//        node backend/scripts/trimStudentIds.js --apply    (backup, then trim)
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const APPLY = process.argv.includes('--apply');
const DB = 'ClinicManagementSystem';

(async () => {
  const c = await mysql.createConnection({ host: 'localhost', user: 'root', password: 'Yahweh0512', database: DB });
  const [refs] = await c.query(
    `SELECT DISTINCT TABLE_NAME t, COLUMN_NAME col FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME = 'students' AND REFERENCED_COLUMN_NAME = 'student_id'`, [DB]);

  const [clash] = await c.query(
    `SELECT TRIM(a.student_id) id FROM students a JOIN students b ON b.student_id = TRIM(a.student_id) AND b.student_id <> a.student_id`);
  if (clash.length) { console.log('ABORT: trimmed id already exists', clash); process.exit(1); }

  const backup = {};
  const [bs] = await c.query(`SELECT * FROM students WHERE student_id <> TRIM(student_id) OR first_name <> TRIM(first_name) OR last_name <> TRIM(last_name)`);
  backup.students = bs;
  for (const { t, col } of refs) {
    const [rows] = await c.query(`SELECT * FROM \`${t}\` WHERE \`${col}\` <> TRIM(\`${col}\`)`);
    if (rows.length) backup[`${t}.${col}`] = rows;
  }
  const file = path.join(__dirname, `trimStudentIds.backup.${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log('backup:', file);
  Object.entries(backup).forEach(([k, v]) => console.log(' ', k, v.length));

  if (!APPLY) { console.log('dry run, nothing changed'); await c.end(); return; }

  await c.query('SET FOREIGN_KEY_CHECKS = 0');
  await c.beginTransaction();
  try {
    await c.query(`UPDATE students SET student_id = TRIM(student_id), first_name = TRIM(first_name), last_name = TRIM(last_name)`);
    for (const { t, col } of refs) {
      const [r] = await c.query(`UPDATE \`${t}\` SET \`${col}\` = TRIM(\`${col}\`) WHERE \`${col}\` <> TRIM(\`${col}\`)`);
      if (r.affectedRows) console.log('trimmed', t, r.affectedRows);
    }
    await c.commit();
  } catch (e) { await c.rollback(); console.log('ROLLED BACK', e.message); }
  await c.query('SET FOREIGN_KEY_CHECKS = 1');
  const [[left]] = await c.query(`SELECT SUM(student_id <> TRIM(student_id)) ids, SUM(first_name <> TRIM(first_name)) fn FROM students`);
  console.log('left with spaces:', left);
  await c.end();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
