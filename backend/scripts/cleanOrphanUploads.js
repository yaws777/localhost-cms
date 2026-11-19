// Finds files in backend/uploads that no database column points to, and (with --apply) deletes them.
// Dry run by default. Back up uploads/ first, then run:
//   node scripts/cleanOrphanUploads.js            (list only)
//   node scripts/cleanOrphanUploads.js --apply    (delete)
// Every text column of the schema is searched for '/uploads/<name>', so new upload columns are covered without changes here.
// Files younger than 10 minutes are kept (an upload still being saved).
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const apply = process.argv.includes('--apply');
const uploadDir = path.join(__dirname, '..', 'uploads');
const MIN_AGE_MS = 10 * 60 * 1000;

(async () => {
  const pool = await mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Yahweh0512',
    database: 'ClinicManagementSystem',
    charset: 'utf8mb4',
  });

  try {
    const [cols] = await pool.query(
      `SELECT TABLE_NAME t, COLUMN_NAME c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND DATA_TYPE IN ('varchar','char','text','tinytext','mediumtext','longtext','json')
         AND TABLE_NAME IN (SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE')`
    );

    const referenced = new Set();
    for (const { t, c } of cols) {
      const [rows] = await pool.query(`SELECT \`${c}\` AS v FROM \`${t}\` WHERE \`${c}\` LIKE '%/uploads/%'`);
      for (const { v } of rows) {
        for (const m of String(v).matchAll(/\/uploads\/([^\s"'<>?#\\]+)/g)) referenced.add(path.basename(m[1]));
      }
    }

    const now = Date.now();
    let keep = 0;
    const orphans = [];
    for (const name of fs.readdirSync(uploadDir)) {
      const full = path.join(uploadDir, name);
      const stat = fs.statSync(full);
      if (!stat.isFile()) continue;
      if (referenced.has(name) || now - stat.mtimeMs < MIN_AGE_MS) keep += 1;
      else orphans.push({ name, full, size: stat.size });
    }

    const bytes = orphans.reduce((n, f) => n + f.size, 0);
    console.log(`Referenced / recent files kept: ${keep}`);
    console.log(`Orphan files: ${orphans.length} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
    orphans.forEach((f) => console.log(`  ${apply ? 'delete' : 'orphan'}  ${f.name}`));

    if (apply) {
      orphans.forEach((f) => fs.unlinkSync(f.full));
      console.log(`Deleted ${orphans.length} files.`);
    } else if (orphans.length > 0) {
      console.log('Dry run only. Add --apply to delete them.');
    }
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
