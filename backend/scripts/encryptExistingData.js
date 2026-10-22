// One-time, idempotent migration: bcrypt-hash plaintext passwords, encrypt plaintext chat messages,
// and scrub chat text that was copied into the notifications table.
// Back the database up first, then run:  node scripts/encryptExistingData.js
const mysql = require('mysql2/promise');
const { isHashed, hashPassword, isEncrypted, encryptText } = require('../src/utils/security');

(async () => {
  const pool = await mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Yahweh0512',
    database: 'ClinicManagementSystem',
    charset: 'utf8mb4',
  });

  try {
    const [users] = await pool.query('SELECT user_id, password_hash FROM users');
    let hashed = 0;
    for (const u of users) {
      if (!u.password_hash || isHashed(u.password_hash)) continue;
      await pool.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [await hashPassword(u.password_hash), u.user_id]);
      hashed++;
    }

    const [messages] = await pool.query('SELECT message_id, content FROM messages WHERE content IS NOT NULL AND content <> ""');
    let encrypted = 0;
    for (const m of messages) {
      if (isEncrypted(m.content)) continue;
      await pool.query('UPDATE messages SET content = ? WHERE message_id = ?', [encryptText(m.content), m.message_id]);
      encrypted++;
    }

    const [scrub] = await pool.query(
      `UPDATE notifications SET message = 'You have a new message.' WHERE type = 'MESSAGE' AND message <> 'You have a new message.'`
    );

    console.log(`Passwords hashed: ${hashed}/${users.length}`);
    console.log(`Messages encrypted: ${encrypted}/${messages.length}`);
    console.log(`Message notifications scrubbed: ${scrub.affectedRows}`);
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
