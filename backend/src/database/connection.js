require('dotenv').config();
const cors = require('cors');
const bodyParser = require('body-parser');  
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid'); // Fix: Added missing uuid import
const express = require('express'); 
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const twilio = require('twilio');
const crypto = require('crypto');
const { todayManilaStr, currentMonthManilaStr, formatDateManila, formatTimeManila, formatDateTimeManila } = require('../utils/time');
const { forecastMedicineDemand } = require('../utils/medicineForecast');

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Passwords are stored as bcrypt hashes; chat message content is stored AES-256-GCM encrypted.
const { hashPassword, verifyPassword, encryptText, decryptMessageRows } = require('../utils/security');

// Initialize Twilio Client
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// 2. Serve the uploads folder statically so the React frontend can actually view/download the files
app.use('/uploads', express.static('uploads'));
app.use(cors());



// 3. Configure Multer Storage Engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Appends a unique suffix timestamp to prevent file collision issues
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const prefix = req.params?.id || req.body?.request_id || req.body?.student_id || 'doc';
        cb(null, prefix + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Anything that changes medicine stock or the stock levels re-checks the stock status shortly afterwards
// (restock alerts + report). scheduleStockCheck() is defined with the restock report code further down.
app.use((req, res, next) => {
  if (req.method !== 'GET' && /^\/api\/(batches|dispensation|clinic-visits|medicines)/.test(req.path)) {
    res.on('finish', () => {
      if (res.statusCode < 400) scheduleStockCheck();
    });
  }
  next();
});

/*
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    dateStrings: true
});
*/

    const pool = mysql.createPool({
        host: "localhost",
        user: "root",
        password: "Yahweh0512",
        database: "ClinicManagementSystem",
        dateStrings: true,
        charset: 'utf8mb4', // Forces UTF-8 encoding on client connections
        timezone: '+08:00', // Philippine Standard Time, regardless of host/MySQL server default
});

// Ensure every pooled connection's session is also pinned to PH time, so
// MySQL-side NOW()/CURRENT_TIMESTAMP calls are correct even if the MySQL
// server's own global time_zone is not configured for Asia/Manila.
pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+08:00'");
});

const cron = require('node-cron');

// Runs at 23:59 on the 28th, 29th, 30th, and 31st of every month
cron.schedule('59 23 28-31 * *', async () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // Check if today is truly the last day of the month
  if (tomorrow.getDate() === 1) {
    try {
      console.log('Running monthly stock snapshot process...');

      await pool.query(`
        INSERT INTO medicine_monthly_stock_snapshots (medicine_id, snapshot_period, snapshot_date, total_stock)
        SELECT 
          m.medicine_id,
          DATE_FORMAT(LAST_DAY(CURRENT_DATE()), '%Y-%m') AS snapshot_period,
          LAST_DAY(CURRENT_DATE()) AS snapshot_date,
          COALESCE(SUM(mib.current_stock), 0) AS total_stock
        FROM medicines m
        LEFT JOIN medicine_inventory_batches mib ON m.medicine_id = mib.medicine_id
        GROUP BY m.medicine_id
        ON DUPLICATE KEY UPDATE 
          total_stock = VALUES(total_stock),
          captured_at = CURRENT_TIMESTAMP;
      `);

      console.log('Monthly stock snapshot successfully saved.');
    } catch (error) {
      console.error('Error saving monthly stock snapshot:', error);
    }
  }
});

const webpush = require('web-push');

// Configuration
const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || 'YOUR_PUBLIC_VAPID_KEY_HERE',
    privateKey: process.env.VAPID_PRIVATE_KEY || 'YOUR_PRIVATE_VAPID_KEY_HERE'
};

webpush.setVapidDetails(
    'mailto:support@yourdomain.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

//legit system notification and push notification
// Example helper: Pass an optional activeUserIds Set (e.g., from Socket.io active connections)
async function notifyUsers({ sender_id, recipient_ids, title, message, type, payloadData = {}, activeUserIds = new Set() }) {
    if (!recipient_ids || recipient_ids.length === 0) return;

    // Sanitize and deduplicate user IDs
    const uniqueRecipients = [...new Set(recipient_ids.filter(Boolean))];
    if (uniqueRecipients.length === 0) return;

    // 1. FAST PATH: Insert system notifications into DB synchronously
    try {
        const notifValues = uniqueRecipients.map((recipient_id) => [
            uuidv4(),
            sender_id || null,
            recipient_id,
            title,
            type === 'MESSAGE' ? 'You have a new message.' : message,
            type || 'SYSTEM',
            0 // is_read = false
        ]);

        await pool.query(
            `INSERT INTO notifications (notification_id, sender_id, recipient_id, title, message, type, is_read) VALUES ?`,
            [notifValues]
        );
    } catch (err) {
        console.error('[Notification DB Error]:', err);
    }

    // 2. CHECK "NOT CURRENTLY IN THE SYSTEM":
    // Filter out users who are currently active/connected in the app
    const targetRecipients = uniqueRecipients.filter((userId) => !activeUserIds.has(userId));

    if (targetRecipients.length === 0) {
        return; // All target recipients are currently using the system
    }

    // 3. NON-BLOCKING EXECUTION: Dispatch push in background without awaiting
    setImmediate(async () => {
        try {
            // Query push subscriptions ONLY for subscribed & offline users
            const [subscriptions] = await pool.query(
                `SELECT * FROM push_subscriptions WHERE user_id IN (?)`,
                [targetRecipients]
            );

            if (!subscriptions || subscriptions.length === 0) return;

            const pushPayload = JSON.stringify({
                title,
                body: message,
                data: payloadData,
            });

            // Send push notifications asynchronously
            const pushPromises = subscriptions.map(async (sub) => {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                    },
                };

                try {
                    await webpush.sendNotification(pushSubscription, pushPayload);
                } catch (err) {
                    // Clean up unsubscribed or expired tokens (404/410)
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await pool.query('DELETE FROM push_subscriptions WHERE subscription_id = ?', [sub.subscription_id]);
                    }
                }
            });

            await Promise.allSettled(pushPromises);
        } catch (err) {
            console.error('[WebPush Background Error]:', err);
        }
    });
}

// 1. Get Public VAPID Key
app.get('/api/push/public-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// 2. Subscribe / Save Web Push Subscription
app.post('/api/push/subscribe', async (req, res) => {
    try {
        const { user_id, subscription } = req.body;

        // Support both nested subscription objects and flat key structures
        const endpoint = subscription?.endpoint || req.body.endpoint;
        const p256dh = subscription?.keys?.p256dh || req.body.keys?.p256dh;
        const auth = subscription?.keys?.auth || req.body.keys?.auth;

        if (!user_id || !endpoint || !p256dh || !auth) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing required push subscription fields (user_id, endpoint, p256dh, auth)." 
            });
        }

        // Resolve user_id if an entity-specific ID (student_id, parent_id, nurse_id) was passed
        const resolveUserSql = `
            SELECT user_id FROM (
                SELECT user_id FROM users WHERE user_id = ?
                UNION
                SELECT user_id FROM students WHERE student_id = ?
                UNION
                SELECT user_id FROM parents WHERE parent_id = ?
                UNION
                SELECT user_id FROM nurses WHERE nurse_id = ?
            ) AS resolved LIMIT 1
        `;

        const [userRows] = await pool.execute(resolveUserSql, [user_id, user_id, user_id, user_id]);

        if (userRows.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: `User reference '${user_id}' not found in database.` 
            });
        }

        const validUserId = userRows[0].user_id;

        // Upsert subscription into push_subscriptions table
        const upsertSql = `
            INSERT INTO push_subscriptions (subscription_id, user_id, endpoint, p256dh, auth, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
                user_id = VALUES(user_id), 
                p256dh = VALUES(p256dh), 
                auth = VALUES(auth)
        `;

        await pool.execute(upsertSql, [uuidv4(), validUserId, endpoint, p256dh, auth]);

        return res.status(201).json({ 
            success: true, 
            message: "Push subscription saved successfully." 
        });
    } catch (error) {
        console.error("Error saving push subscription:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Failed to save push subscription." 
        });
    }
});

// 3. Unsubscribe / Remove Web Push Subscription
app.post('/api/push/unsubscribe', async (req, res) => {
    try {
        const { user_id, endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({ success: false, message: "Endpoint is required." });
        }

        await pool.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);

        return res.json({ success: true, message: "Push subscription deleted successfully." });
    } catch (error) {
        console.error("Error deleting push subscription:", error);
        return res.status(500).json({ success: false, message: "Failed to remove push subscription." });
    }
});

// 4. Send Test Notification Endpoint
app.post('/api/push/send-test', async (req, res) => {
    try {
        const { userId, title, message } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required." });
        }

        const [subscriptions] = await pool.query(
            'SELECT * FROM push_subscriptions WHERE user_id = ?',
            [userId]
        );

        if (subscriptions.length === 0) {
            return res.status(404).json({ success: false, message: "No active push subscription found for this user." });
        }

        const payload = JSON.stringify({
            title: title || 'Test Notification',
            body: message || 'Web push notifications are configured correctly!'
        });

        const sendPromises = subscriptions.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
            };

            try {
                await webpush.sendNotification(pushSubscription, payload);
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await pool.query('DELETE FROM push_subscriptions WHERE subscription_id = ?', [sub.subscription_id]);
                }
            }
        });

        await Promise.allSettled(sendPromises);

        return res.json({ success: true, message: "Test notification dispatched." });
    } catch (error) {
        console.error("Error sending test notification:", error);
        return res.status(500).json({ success: false, message: "Failed to send test push notification." });
    }
});

// ==========================================
// PHILSMS API HELPER FUNCTIONS
// ==========================================

/**
 * Format phone number to standard international format
 * @param {string} phone - Input phone string
 * @returns {string|null} Formatted phone string or null
 */
function formatPhoneNumber(phone) {
    if (!phone) return null;
    let cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
    
    // Replace leading local '0' with default country code
    if (cleaned.startsWith('0')) {
        const countryCode = process.env.DEFAULT_COUNTRY_CODE || '+63';
        cleaned = countryCode + cleaned.substring(1);
    } else if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }
    return cleaned;
}

/**
 * Helper function to send SMS via PhilSMS API v3[cite: 4]
 * @param {string} recipient - Target phone number (e.g. "+639123456789" or "09123456789")[cite: 4]
 * @param {string} message - Message body content[cite: 4]
 * @returns {Promise<{ success: boolean, responseTimeMs: number, data?: object, error?: any }>}[cite: 4]
 */
async function sendPhilSms(recipient, message) {
    const startTime = performance.now();

    try {
        const apiUrl = process.env.PHILSMS_API_URL;

        if (!apiUrl) {
            throw new Error('PHILSMS_API_URL environment variable is not defined.');
        }

        // Format recipient to 639XXXXXXXXX standard
        const formattedRecipient = recipient.startsWith('0')
            ? '63' + recipient.slice(1)
            : recipient.replace('+', '');

        const payload = {
            recipient: formattedRecipient,
            message: message,
            type: 'plain'
        };

        // Attach sender_id only if explicitly set in .env[cite: 4]
        if (process.env.PHILSMS_SENDER_ID && process.env.PHILSMS_SENDER_ID.trim() !== '') {
            payload.sender_id = process.env.PHILSMS_SENDER_ID.trim();
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.PHILSMS_API_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseTimeMs = Math.round(performance.now() - startTime);
        const data = await response.json();

        if (!response.ok) {
            console.error(`[PhilSMS Error] (${responseTimeMs}ms):`, data);
            return { success: false, responseTimeMs, error: data };
        }

        const isSuccess = Boolean(
            data && (data.status === 'success' || data.code === 200 || data.code === '200' || data.status === 200)
        );

        if (isSuccess) {
            console.log(`[PhilSMS Success]: Sent to ${formattedRecipient} in ${responseTimeMs}ms`);
        }

        return { success: isSuccess, responseTimeMs, data };
    } catch (error) {
        const responseTimeMs = Math.round(performance.now() - startTime);
        console.error(`[PhilSMS Fetch Error] (${responseTimeMs}ms):`, error.message);
        return { success: false, responseTimeMs, error: error.message };
    }
}





// Philippine mobile number as 09XXXXXXXXX ('' when it is not a valid one). Accepts 09.., +639.. and 639..
function normalizePhPhone(phone) {
    let p = String(phone || '').replace(/[\s\-()]/g, '');
    if (p.startsWith('+63')) p = '0' + p.slice(3);
    else if (p.startsWith('63') && p.length === 12) p = '0' + p.slice(2);
    return /^09\d{9}$/.test(p) ? p : '';
}

// Usernames are stored as name@baliuag.sti.edu.ph. People often type only the part before the @ (the create-account
// dialog shows the domain next to the field) or leave a space at the end, so both are accepted when logging in.
function normalizeUsername(username) {
    const u = String(username || '').trim();
    return u && !u.includes('@') ? `${u}@baliuag.sti.edu.ph` : u;
}

// Doctor accounts recover their password with the phone number they confirmed on first login
async function doctorPhoneMatches(userId, identifier) {
    const [rows] = await pool.execute(`SELECT contact_number, phone_confirmed_at FROM doctors WHERE user_id = ?`, [userId]);
    if (rows.length === 0 || !rows[0].phone_confirmed_at) return { ok: false, reason: 'no-phone' };
    const onFile = normalizePhPhone(rows[0].contact_number);
    if (!onFile) return { ok: false, reason: 'no-phone' };
    return { ok: onFile === normalizePhPhone(identifier), reason: 'mismatch' };
}

//Access role and Management api
// 1. LOGIN ENDPOINT
// ==================== 1. LOGIN ENDPOINT ====================
app.post('/api/login', async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const { password } = req.body;

    try {
        // 1. Check if user exists
        const [users] = await pool.execute(`
            SELECT u.user_id, u.username, u.password_hash, u.is_active, u.role_id, r.role_name 
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE u.username = ?
        `, [username]);

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid username or password." });
        }

        const user = users[0];

        // 2. Validate password
        const { ok: passwordOk, needsRehash } = await verifyPassword(password, user.password_hash);
        if (!passwordOk) {
            return res.status(401).json({ success: false, message: "Invalid username or password." });
        }

        // Legacy plaintext row: store the hash now that the password is confirmed
        if (needsRehash) {
            await pool.execute(`UPDATE users SET password_hash = ? WHERE user_id = ?`, [await hashPassword(password), user.user_id]);
        }

        // 3. Check account active status
        if (!user.is_active) {
            return res.status(403).json({ success: false, message: "Account is not Active" });
        }

        // 4. Check if using default password ("123")
        const isDefaultPassword = (password === "123");

        const userData = {
            id: user.user_id,
            username: user.username,
            role_id: user.role_id,
            role: user.role_name.toLowerCase() 
        };

        let isFormCompleted = false;
        let students = [];
        let isProfileIncomplete = false;
        let isPhoneRequired = false;

        // --- ADMIN ROLE LOGIC ---
        if (userData.role_id === 'ADMN' || userData.role === 'admin') {
            const [adminRows] = await pool.execute(
                `SELECT admin_id FROM admin WHERE user_id = ?`,
                [userData.id]
            );

            if (adminRows.length > 0) {
                userData.admin_id = adminRows[0].admin_id;
            }
        }
        // --- STUDENT ROLE LOGIC ---
        else if (userData.role === 'student') {
            const [studentRows] = await pool.execute(
                `SELECT student_id FROM students WHERE user_id = ?`, 
                [userData.id]
            );

            if (studentRows.length > 0) {
                const studentId = studentRows[0].student_id; 

                const checkFormsQuery = `
                    SELECT 
                        (SELECT COUNT(*) FROM student_personal_information WHERE student_id = ?) AS personal_count,
                        (SELECT COUNT(*) FROM student_health_information WHERE student_id = ?) AS health_count
                `;

                const [rows] = await pool.execute(checkFormsQuery, [studentId, studentId]);
                const counts = rows[0];

                if (counts.personal_count > 0 && counts.health_count > 0) {
                    isFormCompleted = true;
                }
            }
        } 
        // --- PARENT ROLE LOGIC ---
        else if (userData.role === 'parent') {
            const [parentRows] = await pool.execute(
                `SELECT parent_id, first_name, last_name, primary_phone FROM parents WHERE user_id = ?`,
                [userData.id]
            );

            if (parentRows.length === 0) {
                return res.status(404).json({ success: false, message: "Parent profile setup not found." });
            }

            const parent = parentRows[0];
            userData.parent_id = parent.parent_id;
            userData.first_name = parent.first_name;
            userData.last_name = parent.last_name;
            userData.primary_phone = parent.primary_phone;

            // Check if profile details are missing
            if (!parent.first_name || !parent.last_name || !parent.primary_phone) {
                isProfileIncomplete = true;
            }

            const mappingQuery = `
                SELECT s.student_id, s.first_name, s.last_name 
                FROM parent_student_mapping psm
                JOIN students s ON psm.student_id = s.student_id
                WHERE psm.parent_id = ?
            `;

            const [studentRows] = await pool.execute(mappingQuery, [parent.parent_id]);
            students = studentRows;
        }
        // --- DOCTOR ROLE LOGIC ---
        else if (userData.role === 'doctor') {
            const [doctorRows] = await pool.execute(
                `SELECT doctor_id, first_name, last_name, specialization, contact_number, phone_confirmed_at FROM doctors WHERE user_id = ?`,
                [userData.id]
            );
            if (doctorRows.length === 0) {
                return res.status(404).json({ success: false, message: "Doctor profile not found for this account." });
            }
            const doctor = doctorRows[0];
            userData.doctor_id = doctor.doctor_id;
            userData.first_name = doctor.first_name;
            userData.last_name = doctor.last_name;
            // a new doctor account must give a phone number (used for password recovery) before anything else
            isPhoneRequired = !doctor.phone_confirmed_at || !normalizePhPhone(doctor.contact_number);
            userData.contact_number = doctor.contact_number || '';
        }

        // Send consolidated payload including default password and profile status
        res.json({
            success: true,
            user: userData,
            isDefaultPassword,
            isProfileIncomplete,
            isPhoneRequired,
            isFormCompleted,
            students
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "Database error during login." });
    }
});

// ==================== 2. CHANGE PASSWORD ENDPOINT ====================
app.post('/api/change-password', async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const { newPassword } = req.body;

    try {
        const [result] = await pool.execute(
            `UPDATE users SET password_hash = ? WHERE username = ?`,
            [await hashPassword(newPassword), username]
        );

        if (result.affectedRows > 0) {
            res.json({ success: true, message: "Password changed successfully. Please log in again." });
        } else {
            res.status(400).json({ success: false, message: "Failed to update password. User not found." });
        }
    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ success: false, message: "Database error while updating password." });
    }
});

// ==================== 4. CHECK USERNAME (STEP 1) ====================
app.post('/api/check-username', async (req, res) => {
    const username = normalizeUsername(req.body.username);

    if (!username) {
        return res.status(400).json({ success: false, message: "Username is required." });
    }

    try {
        const [users] = await pool.execute(`
            SELECT u.user_id, u.username, u.role_id, r.role_name 
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE u.username = ?
        `, [username]);

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Username not found." });
        }

        const user = users[0];

        res.json({
            success: true,
            role_id: user.role_id,
            role_name: user.role_name
        });

    } catch (error) {
        console.error("Check Username Error:", error);
        res.status(500).json({ success: false, message: "Database error during username verification." });
    }
});

// ==================== 5. VERIFY IDENTIFIER IN DATABASE (STEP 2) ====================
app.post('/api/verify-identifier', async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const { identifier } = req.body;

    if (!username || !identifier) {
        return res.status(400).json({ success: false, message: "Username and verification identifier are required." });
    }

    try {
        const [users] = await pool.execute(`
            SELECT u.user_id, u.username, u.role_id, r.role_name 
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE u.username = ?
        `, [username]);

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Account not found." });
        }

        const user = users[0];
        const roleId = user.role_id;
        let isMatched = false;

        // 1. Student Role: Match student_id
        if (roleId === 'STDNT' || user.role_name.toLowerCase() === 'student') {
            const [rows] = await pool.execute(
                `SELECT student_id FROM students WHERE user_id = ? AND student_id = ?`,
                [user.user_id, identifier.trim()]
            );
            isMatched = rows.length > 0;

            if (!isMatched) {
                return res.status(400).json({ success: false, message: "Student ID does not match records for this account." });
            }

        // 2. Parent Role: Match primary_phone
        } else if (roleId === 'PRNT' || user.role_name.toLowerCase() === 'parent') {
            const cleanInputPhone = identifier.replace(/[\s\-\(\)]/g, '');

            const [rows] = await pool.execute(
                `SELECT parent_id FROM parents 
                 WHERE user_id = ? 
                 AND REPLACE(REPLACE(REPLACE(REPLACE(primary_phone, ' ', ''), '-', ''), '(', ''), ')', '') = ?`,
                [user.user_id, cleanInputPhone]
            );
            isMatched = rows.length > 0;

            if (!isMatched) {
                return res.status(400).json({ success: false, message: "Primary phone number does not match records for this account." });
            }

        // 3. Nurse Role: Match nurse_id
        } else if (roleId === 'NRS' || user.role_name.toLowerCase() === 'nurse') {
            const [rows] = await pool.execute(
                `SELECT nurse_id FROM nurses WHERE user_id = ? AND nurse_id = ?`,
                [user.user_id, identifier.trim()]
            );
            isMatched = rows.length > 0;

            if (!isMatched) {
                return res.status(400).json({ success: false, message: "Nurse ID does not match records for this account." });
            }

        // 4. Doctor Role: Match the phone number confirmed on first login
        } else if (roleId === 'DCTR' || user.role_name.toLowerCase() === 'doctor') {
            const result = await doctorPhoneMatches(user.user_id, identifier);
            if (!result.ok) {
                return res.status(400).json({
                    success: false,
                    message: result.reason === 'no-phone'
                        ? "No phone number is registered for this account yet. Log in once and add your phone number, or ask the nurse to reset your account."
                        : "Phone number does not match the number registered for this account."
                });
            }

        } else {
            return res.status(400).json({ success: false, message: "Password recovery is not permitted for this account role." });
        }

        res.json({ success: true, message: "Verification successful." });

    } catch (error) {
        console.error("Verify Identifier Error:", error);
        res.status(500).json({ success: false, message: "Database error during identifier verification." });
    }
});

// ==================== 6. RESET FORGOT PASSWORD (STEP 3) ====================
app.post('/api/forgot-password', async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const { identifier, newPassword } = req.body;

    if (!username || !identifier || !newPassword) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    try {
        const [users] = await pool.execute(`
            SELECT u.user_id, u.role_id, r.role_name 
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE u.username = ?
        `, [username]);

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "User account not found." });
        }

        const user = users[0];
        const roleId = user.role_id;
        let isMatched = false;

        // Re-verify identifier for security
        if (roleId === 'STDNT' || user.role_name.toLowerCase() === 'student') {
            const [rows] = await pool.execute(
                `SELECT student_id FROM students WHERE user_id = ? AND student_id = ?`,
                [user.user_id, identifier.trim()]
            );
            isMatched = rows.length > 0;
        } else if (roleId === 'PRNT' || user.role_name.toLowerCase() === 'parent') {
            const cleanInputPhone = identifier.replace(/[\s\-\(\)]/g, '');
            const [rows] = await pool.execute(
                `SELECT parent_id FROM parents 
                 WHERE user_id = ? 
                 AND REPLACE(REPLACE(REPLACE(REPLACE(primary_phone, ' ', ''), '-', ''), '(', ''), ')', '') = ?`,
                [user.user_id, cleanInputPhone]
            );
            isMatched = rows.length > 0;
        } else if (roleId === 'NRS' || user.role_name.toLowerCase() === 'nurse') {
            const [rows] = await pool.execute(
                `SELECT nurse_id FROM nurses WHERE user_id = ? AND nurse_id = ?`,
                [user.user_id, identifier.trim()]
            );
            isMatched = rows.length > 0;
        } else if (roleId === 'DCTR' || user.role_name.toLowerCase() === 'doctor') {
            isMatched = (await doctorPhoneMatches(user.user_id, identifier)).ok;
        }

        if (!isMatched) {
            return res.status(400).json({ success: false, message: "Security match failed. Password not updated." });
        }

        // Update password hash
        const [updateResult] = await pool.execute(
            `UPDATE users SET password_hash = ? WHERE user_id = ?`,
            [await hashPassword(newPassword), user.user_id]
        );

        if (updateResult.affectedRows > 0) {
            res.json({ success: true, message: "Password changed successfully! You may now log in with your new password." });
        } else {
            res.status(500).json({ success: false, message: "Failed to update password. Try again." });
        }

    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ success: false, message: "Database error during password reset." });
    }
});

// ==================== UPDATE PARENT PROFILE ENDPOINT ====================
app.post('/api/update-parent-profile', async (req, res) => {
    const { parentId, firstName, lastName, primaryPhone } = req.body;

    if (!primaryPhone) {
        return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    // Remove spaces, hyphens, and parentheses
    const cleanPhone = primaryPhone.replace(/[\s\-\(\)]/g, '');

    // Validate Philippine Phone Number Regex
    const phPhoneRegex = /^(09|\+639)\d{9}$/;
    if (!phPhoneRegex.test(cleanPhone)) {
        return res.status(400).json({ 
            success: false, 
            message: "Invalid Philippine phone number format. Must start with 09 or +639 followed by 9 digits." 
        });
    }

    try {
        const [result] = await pool.execute(
            `UPDATE parents SET first_name = ?, last_name = ?, primary_phone = ? WHERE parent_id = ?`,
            [firstName, lastName, cleanPhone, parentId]
        );

        if (result.affectedRows > 0) {
            res.json({ success: true, message: "Parent details saved successfully." });
        } else {
            res.status(400).json({ success: false, message: "Failed to update parent profile." });
        }
    } catch (error) {
        console.error("Update Parent Profile Error:", error);
        res.status(500).json({ success: false, message: "Database error while updating profile." });
    }
});

// ==================== GET ADMIN PROFILE ENDPOINT ====================
app.get('/api/get-admin/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const query = `
            SELECT a.admin_id, a.user_id, a.first_name, a.last_name, u.username
            FROM admin a
            JOIN users u ON a.user_id = u.user_id
            WHERE a.user_id = ?
        `;

        const [rows] = await pool.execute(query, [userId]);

        if (rows.length > 0) {
            res.json({ success: true, admin: rows[0] });
        } else {
            res.status(404).json({ success: false, message: "Admin profile not found." });
        }
    } catch (error) {
        console.error("Get Admin Profile Error:", error);
        res.status(500).json({ success: false, message: "Database error fetching admin data." });
    }
});



// (Removed duplicate POST /api/forgot-password that returned the stored password; passwords are hashed and never readable. See the reset route above.)

// 3. Get Student ID based on Logged-in User ID
// Fix: Converted from callback to async/await to work with mysql2/promise
// Get student profiles along with their username based on user_id
app.get('/api/get-student/:userId', async (req, res) => {
    const { userId } = req.params;

    const query = `
        SELECT 
            s.student_id AS student_id, 
            s.first_name AS first_name, 
            s.last_name AS last_name, 
            s.program_id AS program_id, 
            s.year_level AS year_level, 
            u.username AS username
        FROM students s
        INNER JOIN users u ON s.user_id = u.user_id
        WHERE s.user_id = ?
    `;

    try {
        // Query the database using async/await
        const [studentRows] = await pool.execute(query, [userId]);

        // Check if a student record was found
        if (studentRows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Student records not found for this user." 
            });
        }

        // Return the student data
        res.json({
            success: true,
            student: studentRows[0] // Contains all mapped aliases
        });

    } catch (error) {
        console.error("Error fetching student data:", error);
        res.status(500).json({ success: false, message: "Database error." });
    }
});

//get by studentId
app.get('/api/get-student-by-studentId/:studentId', async (req, res) => {
    // 1. Read the studentId from the URL parameters
    const { studentId } = req.params;

    // 2. FIX: Change 'WHERE s.user_id = ?' to 'WHERE s.student_id = ?'
    const query = `
        SELECT 
            s.student_id AS student_id, 
            s.first_name AS first_name, 
            s.last_name AS last_name, 
            s.program_id AS program_id, 
            s.year_level AS year_level, 
            u.username AS username
        FROM students s
        INNER JOIN users u ON s.user_id = u.user_id
        WHERE s.student_id = ?
    `;

    try {
        // Query the database using the incoming student ID
        const [studentRows] = await pool.execute(query, [studentId]);

        // Check if a student record was found
        if (studentRows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Student records not found for this Student ID." 
            });
        }

        // Return the student data
        res.json({
            success: true,
            student: studentRows[0] 
        });

    } catch (error) {
        console.error("Error fetching student data:", error);
        res.status(500).json({ success: false, message: "Database error." });
    }
});

app.get('/api/get-parent/:userId', async (req, res) => {
    const { userId } = req.params;

    const query = `
        SELECT 
            p.parent_id, 
            p.user_id, 
            p.first_name, 
            p.last_name, 
            p.primary_phone,
            p.is_sms_verified,
            u.username
        FROM parents p
        INNER JOIN users u ON p.user_id = u.user_id
        WHERE p.user_id = ?
    `;

    try {
        const [parentRows] = await pool.execute(query, [userId]);

        if (parentRows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Parent profile not found for this user." 
            });
        }

        res.json({
            success: true,
            parent: parentRows[0] 
        });

    } catch (error) {
        console.error("Error fetching parent data:", error);
        res.status(500).json({ success: false, message: "Database error." });
    }
});

// 4. Route to get nurse details by user_id
app.get('/api/get-nurse/:userId', async (req, res) => {
    const { userId } = req.params;

    const query = `
        SELECT 
            n.nurse_id, 
            n.user_id, 
            n.first_name, 
            n.last_name, 
            u.username
        FROM nurses n
        INNER JOIN users u ON n.user_id = u.user_id
        WHERE n.user_id = ?
    `;

    try {
        // Query the database using async/await with the table join
        const [nurseRows] = await pool.execute(query, [userId]);

        // Check if a nurse record was found
        if (nurseRows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "Nurse profile not found for this user." 
            });
        }

        // Return the combined nurse and user data
        res.json({
            success: true,
            nurse: nurseRows[0] // Contains nurse_id, user_id, first_name, last_name, AND username
        });

    } catch (error) {
        console.error("Error fetching nurse data:", error);
        res.status(500).json({ success: false, message: "Database error." });
    }
});

// 4. Submit Health History Form
// Optional proof per condition: files arrive as `proof_<has_* flag>` (multipart);
// personalInfo / healthInfo are JSON strings in that case.
const HEALTH_PROOF_CONDITIONS = [
    'has_allergies', 'has_asthma', 'has_other_respiratory', 'has_blood_disorders',
    'has_chicken_pox', 'has_digestive_disorders', 'has_heart_problems',
    'has_kidney_bladder_problems', 'has_measles', 'has_metabolic_diseases',
    'has_muscle_bone_disorder', 'has_seizure_episode', 'has_surgery',
    'has_vision_problem', 'has_hearing_problem', 'has_other_condition'
];

// Same DDL as migration_health_history_proofs.sql, so the form works even if the
// migration has not been run yet (CREATE TABLE IF NOT EXISTS is a no-op afterwards).
let healthProofsTableReady = null;
const ensureHealthProofsTable = () => {
    if (!healthProofsTableReady) {
        healthProofsTableReady = pool.query(`
            CREATE TABLE IF NOT EXISTS student_health_proofs (
                proof_id        varchar(45)  NOT NULL,
                student_id      varchar(45)  NOT NULL,
                condition_key   varchar(64)  NOT NULL COMMENT 'has_* flag in student_health_information',
                file_url        varchar(512) NOT NULL,
                original_name   varchar(255) DEFAULT NULL,
                uploaded_at     timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (proof_id),
                UNIQUE KEY uq_student_condition (student_id, condition_key),
                CONSTRAINT student_health_proofs_ibfk_1 FOREIGN KEY (student_id)
                    REFERENCES students (student_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `).catch(err => { healthProofsTableReady = null; throw err; });
    }
    return healthProofsTableReady;
};

app.post('/api/submit-health-form', upload.any(), async (req, res) => {
    const parseJsonField = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
    let student_id, personalInfo, healthInfo;
    try {
        student_id = req.body.student_id;
        personalInfo = parseJsonField(req.body.personalInfo);
        healthInfo = parseJsonField(req.body.healthInfo);
    } catch (parseErr) {
        return res.status(400).json({ success: false, message: 'Invalid form data.' });
    }
    const proofFiles = (req.files || []).filter(f =>
        f.fieldname.startsWith('proof_') &&
        HEALTH_PROOF_CONDITIONS.includes(f.fieldname.slice('proof_'.length)) &&
        healthInfo?.[f.fieldname.slice('proof_'.length)]
    );
    const removeUploadedFiles = () => (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // A. Insert Personal Information
        const personalQuery = `
            INSERT INTO student_personal_information 
            (student_id, gender, birth_date, age, address, contact_number, height_cm, weight_kg, father_name, mother_name) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const personalValues = [
            student_id, personalInfo.gender, personalInfo.birth_date, personalInfo.age, 
            personalInfo.address, personalInfo.contact_number, personalInfo.height_cm, 
            personalInfo.weight_kg, personalInfo.father_name, personalInfo.mother_name
        ];
        await connection.execute(personalQuery, personalValues);

        // Helper function for empty strings/dates
        const parseEmpty = (val) => val === '' ? null : val;

        // B. Insert Health Information (Expanded to Schema)
        const healthQuery = `
            INSERT INTO student_health_information (
                health_info_id, student_id, 
                has_allergies, allergy_food, allergy_medicine, allergy_insect_sting, allergy_environmental, allergy_others, 
                reaction_diarrhea, reaction_hives, reaction_local, reaction_rash, reaction_swelling, reaction_trouble_breathing, reaction_others, allergy_medication_taken, 
                has_asthma, asthma_triggers, asthma_medication_taken, 
                has_other_respiratory, other_respiratory_specify, other_respiratory_medication, 
                has_blood_disorders, blood_disorder_anemia, blood_disorder_leukopenia, blood_disorder_thrombocytopenia, 
                has_chicken_pox, chicken_pox_age, 
                has_digestive_disorders, digestive_ulcer, digestive_appendicitis, digestive_gastritis, digestive_hemorrhoids, digestive_medication_taken, 
                has_heart_problems, heart_problems_specify, heart_problems_medication, 
                has_kidney_bladder_problems, kidney_bladder_specify, kidney_bladder_medication, 
                has_measles, measles_age, 
                has_metabolic_diseases, metabolic_hyperglycemia, metabolic_hypoglycemia, 
                has_muscle_bone_disorder, muscle_bone_specify, 
                has_seizure_episode, seizure_last_episode_date, seizure_medication_taken, 
                has_surgery, surgery_specify, surgery_date, 
                has_vision_problem, vision_specify, vision_with_eyeglasses, vision_with_contact_lens, 
                has_hearing_problem, hearing_specify, 
                has_other_condition, other_condition_specify
            ) VALUES (
                ?, ?, 
                ?, ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, ?, ?, ?, ?, 
                ?, ?, ?, 
                ?, ?, ?, 
                ?, ?, ?, ?, 
                ?, ?, 
                ?, ?, ?, ?, ?, ?, 
                ?, ?, ?, 
                ?, ?, ?, 
                ?, ?, 
                ?, ?, ?, 
                ?, ?, 
                ?, ?, ?, 
                ?, ?, ?, 
                ?, ?, ?, ?, 
                ?, ?, 
                ?, ?
            )
        `;
        const health_info_id = uuidv4();
        const healthValues = [
            health_info_id, student_id,
            healthInfo.has_allergies ? 1 : 0, healthInfo.allergy_food, healthInfo.allergy_medicine, healthInfo.allergy_insect_sting, healthInfo.allergy_environmental, healthInfo.allergy_others,
            healthInfo.reaction_diarrhea ? 1 : 0, healthInfo.reaction_hives ? 1 : 0, healthInfo.reaction_local ? 1 : 0, healthInfo.reaction_rash ? 1 : 0, healthInfo.reaction_swelling ? 1 : 0, healthInfo.reaction_trouble_breathing ? 1 : 0, healthInfo.reaction_others, healthInfo.allergy_medication_taken,
            healthInfo.has_asthma ? 1 : 0, healthInfo.asthma_triggers, healthInfo.asthma_medication_taken,
            healthInfo.has_other_respiratory ? 1 : 0, healthInfo.other_respiratory_specify, healthInfo.other_respiratory_medication,
            healthInfo.has_blood_disorders ? 1 : 0, healthInfo.blood_disorder_anemia ? 1 : 0, healthInfo.blood_disorder_leukopenia ? 1 : 0, healthInfo.blood_disorder_thrombocytopenia ? 1 : 0,
            healthInfo.has_chicken_pox ? 1 : 0, parseEmpty(healthInfo.chicken_pox_age),
            healthInfo.has_digestive_disorders ? 1 : 0, healthInfo.digestive_ulcer ? 1 : 0, healthInfo.digestive_appendicitis ? 1 : 0, healthInfo.digestive_gastritis ? 1 : 0, healthInfo.digestive_hemorrhoids ? 1 : 0, healthInfo.digestive_medication_taken,
            healthInfo.has_heart_problems ? 1 : 0, healthInfo.heart_problems_specify, healthInfo.heart_problems_medication,
            healthInfo.has_kidney_bladder_problems ? 1 : 0, healthInfo.kidney_bladder_specify, healthInfo.kidney_bladder_medication,
            healthInfo.has_measles ? 1 : 0, parseEmpty(healthInfo.measles_age),
            healthInfo.has_metabolic_diseases ? 1 : 0, healthInfo.metabolic_hyperglycemia ? 1 : 0, healthInfo.metabolic_hypoglycemia ? 1 : 0,
            healthInfo.has_muscle_bone_disorder ? 1 : 0, healthInfo.muscle_bone_specify,
            healthInfo.has_seizure_episode ? 1 : 0, parseEmpty(healthInfo.seizure_last_episode_date), healthInfo.seizure_medication_taken,
            healthInfo.has_surgery ? 1 : 0, healthInfo.surgery_specify, parseEmpty(healthInfo.surgery_date),
            healthInfo.has_vision_problem ? 1 : 0, healthInfo.vision_specify, healthInfo.vision_with_eyeglasses ? 1 : 0, healthInfo.vision_with_contact_lens ? 1 : 0,
            healthInfo.has_hearing_problem ? 1 : 0, healthInfo.hearing_specify,
            healthInfo.has_other_condition ? 1 : 0, healthInfo.other_condition_specify
        ];
        await connection.execute(healthQuery, healthValues);

        // C. Save optional per-condition proofs
        if (proofFiles.length > 0) await ensureHealthProofsTable();
        for (const f of proofFiles) {
            await connection.execute(
                `INSERT INTO student_health_proofs (proof_id, student_id, condition_key, file_url, original_name)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE file_url = VALUES(file_url), original_name = VALUES(original_name)`,
                [uuidv4(), student_id, f.fieldname.slice('proof_'.length), `/uploads/${f.filename}`, f.originalname]
            );
        }

        await connection.commit();
        (req.files || []).filter(f => !proofFiles.includes(f)).forEach(f => fs.unlink(f.path, () => {}));
        res.json({ success: true, message: 'Form submitted successfully' });

    } catch (error) {
        await connection.rollback();
        removeUploadedFiles();
        console.error("Transaction error:", error);
        res.status(500).json({ success: false, message: 'Transaction error', error: error.message });
    } finally {
        connection.release();
    }
});

// Helper function to handle empty strings for date/number columns
const parseEmpty = (val) => val === '' || val === undefined ? null : val;

//healthRecordsProfile API
// --- GET PROFILE DATA ---
app.get('/api/profile/:studentId', async (req, res) => {
    const { studentId } = req.params;
    try {
        const [personal] = await pool.execute('SELECT * FROM student_personal_information WHERE student_id = ?', [studentId]);
        const [health] = await pool.execute('SELECT * FROM student_health_information WHERE student_id = ?', [studentId]);

        // Optional per-condition proofs (table may not exist until the migration is run)
        let healthProofs = {};
        try {
            const [proofRows] = await pool.execute(
                'SELECT condition_key, file_url, original_name FROM student_health_proofs WHERE student_id = ?',
                [studentId]
            );
            proofRows.forEach(r => { healthProofs[r.condition_key] = { file_url: r.file_url, original_name: r.original_name }; });
        } catch (proofErr) {
            if (proofErr.code !== 'ER_NO_SUCH_TABLE') throw proofErr;
        }

        res.json({
            success: true,
            personalInfo: personal[0] || null,
            healthInfo: health[0] || null,
            healthProofs
        });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ success: false, message: "Database error." });
    }
});

// --- UPDATE PROFILE DATA ---
app.put('/api/update-profile', async (req, res) => {
    const { student_id, personalInfo, healthInfo } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Update Personal Information
        if (personalInfo) {
            const personalQuery = `
                UPDATE student_personal_information SET 
                gender=?, birth_date=?, age=?, address=?, contact_number=?, 
                height_cm=?, weight_kg=?, father_name=?, mother_name=?
                WHERE student_id=?
            `;
            const p = personalInfo;
            await connection.execute(personalQuery, [
                p.gender, parseEmpty(p.birth_date), p.age, p.address, p.contact_number, 
                p.height_cm, p.weight_kg, p.father_name, p.mother_name, student_id
            ]);
        }

        // 2. Update Health Information (Complete Mapping)
        if (healthInfo) {
            const healthQuery = `
                UPDATE student_health_information SET 
                has_allergies=?, allergy_food=?, allergy_medicine=?, allergy_insect_sting=?, allergy_environmental=?, allergy_others=?, 
                reaction_diarrhea=?, reaction_hives=?, reaction_local=?, reaction_rash=?, reaction_swelling=?, reaction_trouble_breathing=?, reaction_others=?, allergy_medication_taken=?, 
                has_asthma=?, asthma_triggers=?, asthma_medication_taken=?, 
                has_other_respiratory=?, other_respiratory_specify=?, other_respiratory_medication=?, 
                has_blood_disorders=?, blood_disorder_anemia=?, blood_disorder_leukopenia=?, blood_disorder_thrombocytopenia=?, 
                has_chicken_pox=?, chicken_pox_age=?, 
                has_digestive_disorders=?, digestive_ulcer=?, digestive_appendicitis=?, digestive_gastritis=?, digestive_hemorrhoids=?, digestive_medication_taken=?, 
                has_heart_problems=?, heart_problems_specify=?, heart_problems_medication=?, 
                has_kidney_bladder_problems=?, kidney_bladder_specify=?, kidney_bladder_medication=?, 
                has_measles=?, measles_age=?, 
                has_metabolic_diseases=?, metabolic_hyperglycemia=?, metabolic_hypoglycemia=?, 
                has_muscle_bone_disorder=?, muscle_bone_specify=?, 
                has_seizure_episode=?, seizure_last_episode_date=?, seizure_medication_taken=?, 
                has_surgery=?, surgery_specify=?, surgery_date=?, 
                has_vision_problem=?, vision_specify=?, vision_with_eyeglasses=?, vision_with_contact_lens=?, 
                has_hearing_problem=?, hearing_specify=?, 
                has_other_condition=?, other_condition_specify=?
                WHERE student_id=?
            `;
            const h = healthInfo;
            await connection.execute(healthQuery, [
                h.has_allergies ? 1 : 0, h.allergy_food, h.allergy_medicine, h.allergy_insect_sting, h.allergy_environmental, h.allergy_others,
                h.reaction_diarrhea ? 1 : 0, h.reaction_hives ? 1 : 0, h.reaction_local ? 1 : 0, h.reaction_rash ? 1 : 0, h.reaction_swelling ? 1 : 0, h.reaction_trouble_breathing ? 1 : 0, h.reaction_others, h.allergy_medication_taken,
                h.has_asthma ? 1 : 0, h.asthma_triggers, h.asthma_medication_taken,
                h.has_other_respiratory ? 1 : 0, h.other_respiratory_specify, h.other_respiratory_medication,
                h.has_blood_disorders ? 1 : 0, h.blood_disorder_anemia ? 1 : 0, h.blood_disorder_leukopenia ? 1 : 0, h.blood_disorder_thrombocytopenia ? 1 : 0,
                h.has_chicken_pox ? 1 : 0, parseEmpty(h.chicken_pox_age),
                h.has_digestive_disorders ? 1 : 0, h.digestive_ulcer ? 1 : 0, h.digestive_appendicitis ? 1 : 0, h.digestive_gastritis ? 1 : 0, h.digestive_hemorrhoids ? 1 : 0, h.digestive_medication_taken,
                h.has_heart_problems ? 1 : 0, h.heart_problems_specify, h.heart_problems_medication,
                h.has_kidney_bladder_problems ? 1 : 0, h.kidney_bladder_specify, h.kidney_bladder_medication,
                h.has_measles ? 1 : 0, parseEmpty(h.measles_age),
                h.has_metabolic_diseases ? 1 : 0, h.metabolic_hyperglycemia ? 1 : 0, h.metabolic_hypoglycemia ? 1 : 0,
                h.has_muscle_bone_disorder ? 1 : 0, h.muscle_bone_specify,
                h.has_seizure_episode ? 1 : 0, parseEmpty(h.seizure_last_episode_date), h.seizure_medication_taken,
                h.has_surgery ? 1 : 0, h.surgery_specify, parseEmpty(h.surgery_date),
                h.has_vision_problem ? 1 : 0, h.vision_specify, h.vision_with_eyeglasses ? 1 : 0, h.vision_with_contact_lens ? 1 : 0,
                h.has_hearing_problem ? 1 : 0, h.hearing_specify,
                h.has_other_condition ? 1 : 0, h.other_condition_specify,
                student_id
            ]);
        }

        await connection.commit();
        res.json({ success: true, message: "Profile updated successfully!" });
    } catch (error) {
        await connection.rollback();
        console.error("Update error:", error);
        res.status(500).json({ success: false, message: "Failed to update profile." });
    } finally {
        connection.release();
    }
});

// =========================================================================
// REQUIREMENT MANAGEMENT API
// =========================================================================

// =========================================================================
// REQUIREMENT MANAGEMENT API
// =========================================================================

// =========================================================================
// REQUIREMENT MANAGEMENT API
// =========================================================================
// Helper function to fetch user_id(s) of connected active parents for student_id(s)
async function getConnectedParentUserIds(studentIds) {
    if (!studentIds) return [];
    const ids = Array.isArray(studentIds) ? studentIds.filter(Boolean) : [studentIds];
    if (ids.length === 0) return [];

    try {
        const [rows] = await pool.query(
            `SELECT DISTINCT p.user_id 
             FROM parent_student_mapping psm
             JOIN parents p ON psm.parent_id = p.parent_id
             JOIN users u ON p.user_id = u.user_id
             WHERE psm.student_id IN (?) AND u.is_active = 1`,
            [ids]
        );
        return rows.map(r => r.user_id).filter(Boolean);
    } catch (err) {
        console.error("[Notify] Error fetching connected parent user IDs:", err.message);
        return [];
    }
}

// =========================================================================
// REQUIREMENT MANAGEMENT API
// =========================================================================

// 1. Get all active students with dynamic metric auto-evaluation pipeline
app.get('/api/students', async (req, res) => {
    try {
        const [students] = await pool.query(`
            SELECT s.* 
            FROM students s
            JOIN users u ON s.user_id = u.user_id
            WHERE u.is_active = 1
        `);
        const now = new Date();
        
        const enrichedStudents = await Promise.all(students.map(async (student) => {
            const [progReqs] = await pool.query(
                `SELECT prc.requirement_name, 
                        COALESCE(sdo.override_deadline, prc.submission_deadline) AS submission_deadline,
                        COALESCE(sdo.override_allow_late_submission, prc.allow_late_submission) AS allow_late_submission
                 FROM program_requirements_config prc
                 LEFT JOIN student_deadline_overrides sdo ON sdo.student_id = ? AND sdo.config_id = prc.config_id
                 WHERE prc.program_id = ? 
                   AND (prc.year_level IS NULL 
                        OR ? LIKE CONCAT('%', prc.year_level, '%') 
                        OR prc.year_level = ? )`, 
                [student.student_id, student.program_id, student.year_level, student.year_level]
            );
            
            const [specReqs] = await pool.query(
                `SELECT requirement_name, submission_deadline, allow_late_submission FROM student_special_requirements WHERE student_id = ?`, 
                [student.student_id]
            );
            
            const [submissions] = await pool.query(
                `SELECT requirement_name, status, file_url, submitted_at FROM student_requirement_submissions WHERE student_id = ?`, 
                [student.student_id]
            );
            
            let completedCount = 0;
            let submittedCount = 0;
            let rejectedCount = 0;
            let pendingCount = 0;
            let lateCount = 0;
            let noSubmissionCount = 0;
            let resubmitCount = 0;
            let overdueCount = 0;

            const allExpected = [
                ...progReqs.map(req => ({ ...req, type: 'Program' })),
                ...specReqs.map(req => ({ ...req, type: 'Special' }))
            ];

            allExpected.forEach(req => {
                const sub = submissions.find(s => s.requirement_name === req.requirement_name) || {};
                let currentStatus = (sub.status || 'Pending').toLowerCase().trim();
                const fileUrl = sub.file_url || null;
                const deadlineDate = req.submission_deadline ? new Date(req.submission_deadline) : null;
                const allowsLate = req.allow_late_submission === 1 || req.allow_late_submission === true || req.allow_late_submission === '1';

                if (['pending', 'submitted', 'submitted late', 'not submitted'].includes(currentStatus)) {
                    if (!fileUrl) {
                        if (deadlineDate && deadlineDate < now && !allowsLate) {
                            currentStatus = 'not submitted';
                        } else {
                            currentStatus = 'pending';
                        }
                    } else {
                        const subTimestamp = sub.submitted_at ? new Date(sub.submitted_at) : now;
                        const isLate = deadlineDate && subTimestamp > deadlineDate;

                        if (isLate && allowsLate) {
                            currentStatus = 'submitted late';
                        } else {
                            currentStatus = 'submitted';
                        }
                    }
                }
                
                if (currentStatus === 'completed') completedCount++;
                else if (currentStatus === 'submitted') submittedCount++;
                else if (currentStatus === 'rejected') rejectedCount++;
                else if (currentStatus === 'submitted late') lateCount++;
                else if (currentStatus === 'not submitted') noSubmissionCount++; 
                else if (currentStatus === 'resubmit') resubmitCount++;
                else pendingCount++;

                if (!['completed', 'submitted', 'submitted late'].includes(currentStatus)) {
                    if (deadlineDate && deadlineDate < now) {
                        overdueCount++;
                    }
                }
            });

            return {
                ...student,
                stats: {
                    total: allExpected.length,
                    completed: completedCount,
                    submitted: submittedCount,
                    rejected: rejectedCount,
                    pending: pendingCount,
                    late: lateCount,
                    noSubmission: noSubmissionCount,
                    resubmit: resubmitCount,
                    overdue: overdueCount
                }
            };
        }));
        
        res.json(enrichedStudents);
    } catch (err) {
        console.error("Dashboard metric error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 2. Get combined requirements list matching all statuses for a specific student
app.get('/api/students/:id/full-requirements', async (req, res) => {
    const studentId = req.params.id; 
    try {
        const [studentRow] = await pool.query(`
            SELECT s.program_id, s.year_level, u.is_active 
            FROM students s
            JOIN users u ON s.user_id = u.user_id
            WHERE s.student_id = ?
        `, [studentId]); 
        
        if (studentRow.length === 0 || studentRow[0].is_active === 0) {
            return res.status(403).json({ error: 'Student account is inactive or not found.' }); 
        }
        
        const programId = studentRow[0].program_id; 
        const studentYearLevel = studentRow[0].year_level; 
        const now = new Date();

        const [progReqs] = await pool.query(
            `SELECT 
                prc.config_id, 
                prc.requirement_name, 
                COALESCE(sdo.override_deadline, prc.submission_deadline) AS submission_deadline, 
                COALESCE(sdo.override_allow_late_submission, prc.allow_late_submission) AS allow_late_submission, 
                'Program' as type 
             FROM program_requirements_config prc
             LEFT JOIN student_deadline_overrides sdo ON sdo.student_id = ? AND sdo.config_id = prc.config_id
             WHERE prc.program_id = ? 
               AND (prc.year_level IS NULL 
                    OR ? LIKE CONCAT('%', prc.year_level, '%') 
                    OR prc.year_level = ? )`, 
            [studentId, programId, studentYearLevel, studentYearLevel] 
        );
        
        const [specReqs] = await pool.query(
            `SELECT NULL as config_id, requirement_name, submission_deadline, allow_late_submission, 'Special' as type 
             FROM student_special_requirements WHERE student_id = ?`, [studentId]
        ); 
        
        const [submissions] = await pool.query(
            `SELECT submission_id, requirement_name, status, file_url, nurse_remarks, submitted_at 
             FROM student_requirement_submissions WHERE student_id = ?`, [studentId]
        ); 

        const totalRequirements = progReqs.length + specReqs.length; 
        const combinedReqs = [...progReqs, ...specReqs];

        const allReqs = await Promise.all(combinedReqs.map(async (req) => { 
            const sub = submissions.find(s => s.requirement_name === req.requirement_name) || {}; 
            let currentStatus = (sub.status || 'Pending').toLowerCase().trim();
            const fileUrl = sub.file_url || null;
            
            const deadlineDate = req.submission_deadline && !isNaN(new Date(req.submission_deadline).getTime()) 
                ? new Date(req.submission_deadline) 
                : null;
                
            const allowsLate = req.allow_late_submission === 1 || req.allow_late_submission === true || req.allow_late_submission === '1';

            if (['pending', 'submitted', 'submitted late', 'not submitted'].includes(currentStatus)) {
                if (!fileUrl) {
                    if (deadlineDate && deadlineDate < now && !allowsLate) {
                        currentStatus = 'not submitted';
                    } else {
                        currentStatus = 'pending';
                    }
                } else {
                    const subTimestamp = sub.submitted_at && !isNaN(new Date(sub.submitted_at).getTime()) 
                        ? new Date(sub.submitted_at) 
                        : now;
                    const isLate = deadlineDate && subTimestamp > deadlineDate;

                    if (isLate && allowsLate) {
                        currentStatus = 'submitted late';
                    } else {
                        currentStatus = 'submitted';
                    }
                }
            }

            const dbStatusMap = {
                'pending': 'Pending',
                'submitted': 'Submitted',
                'completed': 'Completed',
                'rejected': 'Rejected',
                'submitted late': 'Submitted Late',
                'not submitted': 'Not Submitted',
                'resubmit': 'Resubmit'
            };
            const targetDbStatus = dbStatusMap[currentStatus] || 'Pending';

            try {
                if ((sub.status || 'Pending') !== targetDbStatus) {
                    await pool.query(
                        `INSERT IGNORE INTO medical_requirements (requirement_name) VALUES (?)`,
                        [req.requirement_name]
                    );

                    const [checkExisting] = await pool.query(
                        `SELECT submission_id FROM student_requirement_submissions WHERE student_id = ? AND requirement_name = ?`,
                        [studentId, req.requirement_name]
                    );

                    if (checkExisting.length > 0) {
                        await pool.query(
                            `UPDATE student_requirement_submissions SET status = ? WHERE student_id = ? AND requirement_name = ?`,
                            [targetDbStatus, studentId, req.requirement_name]
                        );
                    } else {
                        await pool.query(
                            `INSERT INTO student_requirement_submissions (submission_id, student_id, requirement_name, status, submitted_at) VALUES (UUID(), ?, ?, ?, NULL)`,
                            [studentId, req.requirement_name, targetDbStatus]
                        );
                    }
                    sub.status = targetDbStatus;
                }
            } catch (syncError) {
                console.error(`Row synchronization bypassed for ${req.requirement_name}:`, syncError.message);
                sub.status = targetDbStatus;
            }

            return {
                ...req, 
                submission_id: sub.submission_id || null,
                status: sub.status, 
                file_url: fileUrl, 
                nurse_remarks: sub.nurse_remarks || '', 
                submitted_at: sub.submitted_at || null, 
                total_requirements: totalRequirements, 
                program_total: progReqs.length, 
                special_total: specReqs.length 
            };
        }));

        res.json(allReqs); 
    } catch (err) {
        console.error("Critical API 2 Error:", err.message); 
        res.status(500).json({ error: err.message }); 
    }
});

// 3. Add Special Requirement & notify student + connected parent(s) via System DB + Web Push
app.post('/api/students/:id/special-requirements', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const studentId = req.params.id;
        const { requirement_name, submission_deadline, allow_late_submission, nurse_id } = req.body;

        if (!requirement_name || !submission_deadline) {
            return res.status(400).json({ success: false, error: "Requirement Name and Deadline are required parameters." });
        }

        const [studentRows] = await connection.query(
            `SELECT s.student_id, s.user_id AS student_user_id, s.first_name, s.last_name, COALESCE(ap.program_name, s.program_id) AS course, u.is_active
             FROM students s
             JOIN users u ON s.user_id = u.user_id
             LEFT JOIN academic_programs ap ON s.program_id = ap.program_id
             WHERE s.student_id = ? AND u.is_active = 1`,
            [studentId]
        );

        if (studentRows.length === 0) {
            await connection.rollback();
            return res.status(403).json({ success: false, error: "Cannot assign requirement. Student account is inactive or does not exist." });
        }

        const student = studentRows[0];

        let senderUserId = null;
        if (nurse_id) {
            const [nurseRows] = await connection.query(
                `SELECT user_id FROM nurses WHERE nurse_id = ? OR user_id = ?`,
                [nurse_id, nurse_id]
            );
            if (nurseRows.length > 0) senderUserId = nurseRows[0].user_id;
        }

        const lateOverrideValue = allow_late_submission ? 1 : 0;
        const assignedNurseId = nurse_id || 'UNKNOWN_NURSE'; 

        await connection.query(`INSERT IGNORE INTO medical_requirements (requirement_name) VALUES (?)`, [requirement_name]);

        const [existsSpecial] = await connection.query(
            `SELECT 1 FROM student_special_requirements WHERE student_id = ? AND requirement_name = ?`,
            [studentId, requirement_name]
        );

        if (existsSpecial.length > 0) {
            await connection.query(
                `UPDATE student_special_requirements 
                 SET submission_deadline = ?, allow_late_submission = ?, assigned_by_nurse_id = ?
                 WHERE student_id = ? AND requirement_name = ?`,
                [submission_deadline, lateOverrideValue, assignedNurseId, studentId, requirement_name]
            );
        } else {
            await connection.query(
                `INSERT INTO student_special_requirements (student_id, requirement_name, submission_deadline, allow_late_submission, assigned_by_nurse_id) 
                 VALUES (?, ?, ?, ?, ?)`,
                [studentId, requirement_name, submission_deadline, lateOverrideValue, assignedNurseId]
            );
        }

        const [existsSubmission] = await connection.query(
            `SELECT submission_id FROM student_requirement_submissions WHERE student_id = ? AND requirement_name = ?`,
            [studentId, requirement_name]
        );

        if (existsSubmission.length === 0) {
            await connection.query(
                `INSERT INTO student_requirement_submissions (submission_id, student_id, requirement_name, status, nurse_remarks, file_url, submitted_at) 
                 VALUES (UUID(), ?, ?, 'Pending', '', NULL, NULL)`,
                [studentId, requirement_name]
            );
        }

        await connection.commit();

        // Retrieve connected active parent user IDs
        const parentUserIds = await getConnectedParentUserIds(studentId);
        const recipientIds = [...new Set([student.student_user_id, ...parentUserIds].filter(Boolean))];

        if (recipientIds.length > 0) {
            await notifyUsers({
                sender_id: senderUserId,
                recipient_ids: recipientIds,
                title: 'Special Requirement Assigned',
                message: `Special requirement assigned for ${student.first_name} ${student.last_name}: "${requirement_name}". Deadline: ${submission_deadline}`,
                type: 'special_requirement',
                payloadData: { url: '/student/requirements', requirement_name }
            });
        }

        res.json({ success: true, message: "Special requirement assigned and push notification delivered to student and parent." });

    } catch (err) {
        await connection.rollback();
        console.error("CRITICAL ERROR RECORDING SPECIAL REQUIREMENT:", err);
        res.status(500).json({ success: false, error: "Database execution fault: " + err.message });
    } finally {
        connection.release();
    }
});

// 4. Update requirement submission & notify student + connected parent(s)
app.put('/api/students/:id/requirements/:reqName', async (req, res) => {
    try {
        const studentId = req.params.id;
        const reqName = req.params.reqName;
        const now = new Date();

        const { 
            status = 'Pending', 
            nurse_remarks = '', 
            submission_deadline = null, 
            type = 'Program', 
            config_id = null, 
            override_allow_late_submission = false,
            nurse_id = null 
        } = req.body || {};

        const [studentRows] = await pool.query(
            `SELECT s.student_id, s.user_id AS student_user_id, s.first_name, s.last_name, COALESCE(ap.program_name, s.program_id) AS course, u.is_active
             FROM students s
             JOIN users u ON s.user_id = u.user_id
             LEFT JOIN academic_programs ap ON s.program_id = ap.program_id
             WHERE s.student_id = ? AND u.is_active = 1`,
            [studentId]
        );

        if (studentRows.length === 0) {
            return res.status(403).json({ success: false, error: `Student ID "${studentId}" was not found or account is inactive.` });
        }

        const student = studentRows[0];

        let senderUserId = null;
        if (nurse_id) {
            const [nurseRows] = await pool.query(`SELECT user_id FROM nurses WHERE nurse_id = ? OR user_id = ?`, [nurse_id, nurse_id]);
            if (nurseRows.length > 0) senderUserId = nurseRows[0].user_id;
        }

        const targetStatusClean = String(status).toLowerCase().trim();
        const incomingAllowLate = !!override_allow_late_submission;
        const incomingDeadline = submission_deadline && !isNaN(new Date(submission_deadline).getTime()) ? new Date(submission_deadline) : null;
        const isExtendedToFuture = incomingDeadline && incomingDeadline > now;

        const [currentSub] = await pool.query(
            `SELECT status, file_url FROM student_requirement_submissions WHERE student_id = ? AND requirement_name = ?`,
            [studentId, reqName]
        );
        const existingStatus = currentSub.length > 0 ? String(currentSub[0].status).toLowerCase().trim() : 'pending';
        const fileIsPresent = currentSub.length > 0 && currentSub[0].file_url !== null;

        if (targetStatusClean === 'completed' && !fileIsPresent) {
            return res.status(400).json({ success: false, error: "Completion Guard: Cannot set status to Completed when no file is present." });
        }

        if (existingStatus === 'not submitted' && targetStatusClean === 'pending' && !isExtendedToFuture && !incomingAllowLate) {
            return res.status(400).json({ success: false, error: "Cannot reset 'Not Submitted' to Pending without deadline extension." });
        }

        if (['submitted late', 'late submitted'].includes(existingStatus) && targetStatusClean === 'pending' && !isExtendedToFuture) {
            return res.status(400).json({ success: false, error: "Cannot reset 'Late Submitted' record without extending deadline." });
        }

        if (targetStatusClean === 'resubmit' && !isExtendedToFuture && !incomingAllowLate) {
            return res.status(400).json({ success: false, error: "Setting status to 'Resubmit' requires extending deadline." });
        }

        const clearFilePayload = ['rejected', 'resubmit'].includes(targetStatusClean) ? 1 : 0;
        const lateOverrideValue = incomingAllowLate ? 1 : 0;

        if (currentSub.length > 0) {
            await pool.query(
                `UPDATE student_requirement_submissions 
                 SET status = ?, 
                     nurse_remarks = ?, 
                     file_url = CASE WHEN ? = 1 THEN NULL ELSE file_url END,
                     submitted_at = CASE WHEN ? = 1 THEN NULL ELSE submitted_at END
                 WHERE student_id = ? AND requirement_name = ?`,
                [status, nurse_remarks, clearFilePayload, clearFilePayload, studentId, reqName]
            );
        } else {
            await pool.query(
                `INSERT INTO student_requirement_submissions (submission_id, student_id, requirement_name, status, nurse_remarks, file_url, submitted_at) 
                 VALUES (UUID(), ?, ?, ?, ?, NULL, NULL)`,
                [studentId, reqName, status, nurse_remarks]
            );
        }

        if (type === 'Special') {
            await pool.query(
                `UPDATE student_special_requirements SET submission_deadline = ?, allow_late_submission = ? WHERE student_id = ? AND requirement_name = ?`, 
                [submission_deadline || null, lateOverrideValue, studentId, reqName]
            );
        } else if (config_id) {
            const [existingOverride] = await pool.query(
                `SELECT override_id FROM student_deadline_overrides WHERE student_id = ? AND config_id = ?`,
                [studentId, config_id]
            );

            let formattedDeadline = null;
            if (submission_deadline && !isNaN(new Date(submission_deadline).getTime())) {
                formattedDeadline = new Date(submission_deadline).toISOString().split('T')[0];
            }

            if (existingOverride.length > 0) {
                await pool.query(
                    `UPDATE student_deadline_overrides SET override_deadline = ?, override_allow_late_submission = ? WHERE student_id = ? AND config_id = ?`,
                    [formattedDeadline, lateOverrideValue, studentId, config_id]
                );
            } else {
                await pool.query(
                    `INSERT INTO student_deadline_overrides (override_id, student_id, config_id, override_deadline, override_allow_late_submission) 
                     VALUES (UUID(), ?, ?, ?, ?)`,
                    [studentId, config_id, formattedDeadline, lateOverrideValue]
                );
            }
        }

        // Retrieve connected active parent user IDs
        const parentUserIds = await getConnectedParentUserIds(studentId);
        const recipientIds = [...new Set([student.student_user_id, ...parentUserIds].filter(Boolean))];

        if (recipientIds.length > 0) {
            await notifyUsers({
                sender_id: senderUserId,
                recipient_ids: recipientIds,
                title: 'Requirement Status Updated',
                message: `Requirement "${reqName}" for ${student.first_name} ${student.last_name} status was updated to "${status}". Remarks: ${nurse_remarks || 'None'}`,
                type: 'requirement_update',
                payloadData: { url: '/student/requirements', reqName, status }
            });
        }

        res.json({ success: true, message: "Requirement updated and push notification delivered to student and parent." });

    } catch (err) {
        console.error("CRITICAL BACKEND UPDATE FAILURE:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Delete Special Requirement & notify student + connected parent(s)
app.delete('/api/students/:id/special-requirements/:reqName', async (req, res) => {
    const studentId = req.params.id;
    const reqName = req.params.reqName;
    const nurse_id = req.body?.nurse_id || req.query?.nurse_id || null;

    try {
        const [studentRows] = await pool.query(
            `SELECT s.student_id, s.user_id AS student_user_id, s.first_name, s.last_name
             FROM students s
             JOIN users u ON s.user_id = u.user_id
             WHERE s.student_id = ? AND u.is_active = 1`,
            [studentId]
        );

        if (studentRows.length === 0) {
            return res.status(403).json({ success: false, error: "Student record not found or account is inactive." });
        }

        const student = studentRows[0];

        let senderUserId = null;
        if (nurse_id) {
            const [nurseRows] = await pool.query(`SELECT user_id FROM nurses WHERE nurse_id = ? OR user_id = ?`, [nurse_id, nurse_id]);
            if (nurseRows.length > 0) senderUserId = nurseRows[0].user_id;
        }

        await pool.query(`DELETE FROM student_special_requirements WHERE student_id = ? AND requirement_name = ?`, [studentId, reqName]);
        await pool.query(`DELETE FROM student_requirement_submissions WHERE student_id = ? AND requirement_name = ?`, [studentId, reqName]);

        // Retrieve connected active parent user IDs
        const parentUserIds = await getConnectedParentUserIds(studentId);
        const recipientIds = [...new Set([student.student_user_id, ...parentUserIds].filter(Boolean))];

        if (recipientIds.length > 0) {
            await notifyUsers({
                sender_id: senderUserId,
                recipient_ids: recipientIds,
                title: 'Special Requirement Removed',
                message: `The special requirement "${reqName}" for ${student.first_name} ${student.last_name} has been removed.`,
                type: 'special_requirement_deleted',
                payloadData: { url: '/student/requirements', reqName }
            });
        }

        res.json({ success: true, message: "Special requirement removed and notifications sent." });
    } catch (err) {
        console.error("Error deleting special requirement:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 6. Get all academic programs
app.get('/api/programs', async (req, res) => {
    try {
        const [programs] = await pool.query(`SELECT * FROM academic_programs`);
        res.json(programs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. GET ALL PROGRAM REQUIREMENT CONFIGURATIONS
app.get('/api/program-requirements-config', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM program_requirements_config`);
        res.json(rows);
    } catch (error) {
        console.error("Error reading configurations:", error);
        res.status(500).json({ error: "Failed to retrieve configurations" });
    }
});

// 8. ADD REQUIREMENT RULE ARCHITECTURE & notify affected students + connected parent(s)
app.post('/api/programs/:programId/requirements', async (req, res) => {
    const { programId } = req.params;
    const { requirement_name, year_level, submission_deadline, allow_late_submission, nurse_id } = req.body;

    if (!requirement_name || !submission_deadline) {
        return res.status(400).json({ error: "Requirement name and deadline are required fields." });
    }

    const trimmedReqName = requirement_name.trim();
    const targetYearLevel = year_level || null;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        let senderUserId = null;
        if (nurse_id) {
            const [nurseRows] = await connection.query(`SELECT user_id FROM nurses WHERE nurse_id = ? OR user_id = ?`, [nurse_id, nurse_id]);
            if (nurseRows.length > 0) senderUserId = nurseRows[0].user_id;
        }

        const checkBaseQuery = `SELECT requirement_name FROM medical_requirements WHERE requirement_name = ?`;
        const [baseExists] = await connection.query(checkBaseQuery, [trimmedReqName]);

        if (baseExists.length === 0) {
            const insertBaseQuery = `INSERT INTO medical_requirements (requirement_name) VALUES (?)`;
            await connection.query(insertBaseQuery, [trimmedReqName]);
        }

        const checkMappingQuery = `
            SELECT config_id 
            FROM program_requirements_config 
            WHERE program_id = ? 
              AND requirement_name = ?
              AND (
                  year_level IS NULL 
                  OR ? IS NULL 
                  OR year_level = ?
              )
        `;
        const [mappingExists] = await connection.query(checkMappingQuery, [
            programId, 
            trimmedReqName, 
            targetYearLevel, 
            targetYearLevel
        ]);

        if (mappingExists.length > 0) {
            await connection.rollback();
            return res.status(400).json({ 
                error: `Requirement "${trimmedReqName}" is already configured for ${targetYearLevel ? `Year Level ${targetYearLevel}` : 'all year levels'} in this program.` 
            });
        }

        const newConfigId = `CFG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const insertConfigQuery = `
            INSERT INTO program_requirements_config 
            (config_id, program_id, requirement_name, year_level, submission_deadline, allow_late_submission) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        await connection.query(insertConfigQuery, [
            newConfigId, 
            programId, 
            trimmedReqName, 
            targetYearLevel,
            submission_deadline, 
            allow_late_submission ? 1 : 0
        ]);

        const seedSubmissionsQuery = `
            INSERT INTO student_requirement_submissions (submission_id, student_id, requirement_name, status, nurse_remarks, file_url, submitted_at)
            SELECT UUID(), s.student_id, ?, 'Pending', '', NULL, NULL
            FROM students s
            JOIN users u ON s.user_id = u.user_id
            WHERE s.program_id = ?
              AND u.is_active = 1
              AND (? IS NULL OR s.year_level = ? OR s.year_level LIKE CONCAT('%', ?, '%'))
              AND NOT EXISTS (
                  SELECT 1 FROM student_requirement_submissions srs 
                  WHERE srs.student_id = s.student_id AND srs.requirement_name = ?
              )
        `;

        await connection.query(seedSubmissionsQuery, [
            trimmedReqName,
            programId,
            targetYearLevel,
            targetYearLevel,
            targetYearLevel,
            trimmedReqName
        ]);

        // Get matching active student user IDs & student IDs
        const [matchingStudents] = await connection.query(
            `SELECT s.student_id, s.user_id AS student_user_id
             FROM students s
             JOIN users u ON s.user_id = u.user_id
             WHERE s.program_id = ?
               AND u.is_active = 1
               AND (? IS NULL OR s.year_level = ? OR s.year_level LIKE CONCAT('%', ?, '%'))`,
            [programId, targetYearLevel, targetYearLevel, targetYearLevel]
        );

        const studentUserIds = matchingStudents.map(s => s.student_user_id).filter(Boolean);
        const studentIds = matchingStudents.map(s => s.student_id);

        let parentUserIds = [];
        if (studentIds.length > 0) {
            parentUserIds = await getConnectedParentUserIds(studentIds);
        }

        await connection.commit();

        const recipientIds = [...new Set([...studentUserIds, ...parentUserIds])];

        if (recipientIds.length > 0) {
            await notifyUsers({
                sender_id: senderUserId,
                recipient_ids: recipientIds,
                title: 'New Program Requirement Assigned',
                message: `A new requirement "${trimmedReqName}" has been assigned to course track (${programId}). Deadline: ${submission_deadline}`,
                type: 'program_requirement_created',
                payloadData: { url: '/student/requirements', requirement_name: trimmedReqName }
            });
        }

        res.status(201).json({ 
            success: true, 
            message: "Program requirement configured and synchronized with notifications delivered.", 
            config_id: newConfigId 
        });

    } catch (error) {
        await connection.rollback();
        console.error("Critical processing error on configuration pipeline:", error);
        res.status(500).json({ error: "Database transaction failure handling data insertions: " + error.message });
    } finally {
        connection.release();
    }
});

// 9. UPDATE PROGRAM REQUIREMENT CONFIGURATION & notify affected students + connected parent(s)
app.put('/api/programs/:programId/requirements/:configId', async (req, res) => {
    const { programId, configId } = req.params;
    const { requirement_name, year_level, submission_deadline, allow_late_submission, nurse_id } = req.body;

    try {
        let senderUserId = null;
        if (nurse_id) {
            const [nurseRows] = await pool.query(`SELECT user_id FROM nurses WHERE nurse_id = ? OR user_id = ?`, [nurse_id, nurse_id]);
            if (nurseRows.length > 0) senderUserId = nurseRows[0].user_id;
        }

        const trimmedReqName = requirement_name.trim();
        const targetYearLevel = year_level || null;

        const checkBaseQuery = `SELECT requirement_name FROM medical_requirements WHERE requirement_name = ?`;
        const [baseExists] = await pool.query(checkBaseQuery, [trimmedReqName]);

        if (baseExists.length === 0) {
            const insertBaseQuery = `INSERT INTO medical_requirements (requirement_name) VALUES (?)`;
            await pool.query(insertBaseQuery, [trimmedReqName]);
        }

        const updateConfigQuery = `
            UPDATE program_requirements_config 
            SET requirement_name = ?, year_level = ?, submission_deadline = ?, allow_late_submission = ? 
            WHERE config_id = ? AND program_id = ?
        `;
        
        await pool.query(updateConfigQuery, [
            trimmedReqName, 
            targetYearLevel,
            submission_deadline, 
            allow_late_submission ? 1 : 0, 
            configId, 
            programId
        ]);

        // Get matching active students & connected parents
        const [matchingStudents] = await pool.query(
            `SELECT s.student_id, s.user_id AS student_user_id
             FROM students s
             JOIN users u ON s.user_id = u.user_id
             WHERE s.program_id = ?
               AND u.is_active = 1
               AND (? IS NULL OR s.year_level = ? OR s.year_level LIKE CONCAT('%', ?, '%'))`,
            [programId, targetYearLevel, targetYearLevel, targetYearLevel]
        );

        const studentUserIds = matchingStudents.map(s => s.student_user_id).filter(Boolean);
        const studentIds = matchingStudents.map(s => s.student_id);

        let parentUserIds = [];
        if (studentIds.length > 0) {
            parentUserIds = await getConnectedParentUserIds(studentIds);
        }

        const recipientIds = [...new Set([...studentUserIds, ...parentUserIds])];

        if (recipientIds.length > 0) {
            await notifyUsers({
                sender_id: senderUserId,
                recipient_ids: recipientIds,
                title: 'Program Requirement Updated',
                message: `Requirement "${trimmedReqName}" schedule/settings for course track (${programId}) have been updated. Deadline: ${submission_deadline}`,
                type: 'program_requirement_updated',
                payloadData: { url: '/student/requirements', requirement_name: trimmedReqName }
            });
        }

        res.json({ message: "Requirement rules modification successfully applied and notifications sent." });
    } catch (error) {
        console.error("Failed executing configuration update parameters:", error);
        res.status(500).json({ error: "Database exception error routing updates." });
    }
});

// 10. REMOVE CONFIGURATION RULE & notify affected students + connected parent(s)
app.delete('/api/programs/:programId/requirements/:configId', async (req, res) => {
    const { programId, configId } = req.params;
    const nurse_id = req.body?.nurse_id || req.query?.nurse_id || null;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        let senderUserId = null;
        if (nurse_id) {
            const [nurseRows] = await connection.query(`SELECT user_id FROM nurses WHERE nurse_id = ? OR user_id = ?`, [nurse_id, nurse_id]);
            if (nurseRows.length > 0) senderUserId = nurseRows[0].user_id;
        }

        const [configRows] = await connection.query(
            `SELECT requirement_name, year_level FROM program_requirements_config WHERE config_id = ? AND program_id = ?`,
            [configId, programId]
        );

        if (configRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, error: "Program requirement configuration not found." });
        }

        const { requirement_name, year_level } = configRows[0];

        // Fetch affected student user IDs and student IDs before deletion
        const [matchingStudents] = await connection.query(
            `SELECT s.student_id, s.user_id AS student_user_id
             FROM students s
             JOIN users u ON s.user_id = u.user_id
             WHERE s.program_id = ?
               AND u.is_active = 1
               AND (? IS NULL OR s.year_level = ? OR s.year_level LIKE CONCAT('%', ?, '%'))`,
            [programId, year_level, year_level, year_level]
        );

        const studentUserIds = matchingStudents.map(s => s.student_user_id).filter(Boolean);
        const studentIds = matchingStudents.map(s => s.student_id);

        let parentUserIds = [];
        if (studentIds.length > 0) {
            parentUserIds = await getConnectedParentUserIds(studentIds);
        }

        await connection.query(
            `DELETE srs FROM student_requirement_submissions srs
             INNER JOIN students s ON srs.student_id = s.student_id
             WHERE s.program_id = ? 
               AND srs.requirement_name = ?
               AND (? IS NULL OR s.year_level = ? OR s.year_level LIKE CONCAT('%', ?, '%'))`,
            [programId, requirement_name, year_level, year_level, year_level]
        );

        await connection.query(
            `DELETE FROM student_deadline_overrides WHERE config_id = ?`,
            [configId]
        );

        await connection.query(
            `DELETE FROM program_requirements_config WHERE config_id = ? AND program_id = ?`,
            [configId, programId]
        );

        await connection.commit();

        const recipientIds = [...new Set([...studentUserIds, ...parentUserIds])];

        if (recipientIds.length > 0) {
            await notifyUsers({
                sender_id: senderUserId,
                recipient_ids: recipientIds,
                title: 'Program Requirement Removed',
                message: `Requirement "${requirement_name}" was removed from course track (${programId}).`,
                type: 'program_requirement_deleted',
                payloadData: { url: '/student/requirements', requirement_name }
            });
        }

        res.json({ success: true, message: "Configuration removed and matching records cleaned up." });

    } catch (error) {
        await connection.rollback();
        console.error("Failed executing configuration deletion parameters:", error);
        res.status(500).json({ error: "Database exception error deleting requirement." });
    } finally {
        connection.release();
    }
});

// 11. Student Upload Requirement & send notification with navigate_id (submission_id)
// 11. Student Upload Requirement & send notification (Active Accounts Only)
app.post('/api/students/:id/requirements/:reqName/submit', upload.single('file'), async (req, res) => {
    const studentId = req.params.id;
    const reqName = req.params.reqName;

    if (!req.file) {
        return res.status(400).json({ success: false, error: "A local file upload stream is required." });
    }

    const file_url = `http://localhost:3001/uploads/${req.file.filename}`;

    try {
        const [studentRows] = await pool.query(
            `SELECT s.student_id, s.user_id AS student_user_id, s.first_name, s.last_name, s.program_id, s.year_level, COALESCE(ap.program_name, s.program_id) AS course, u.is_active
             FROM students s
             JOIN users u ON s.user_id = u.user_id
             LEFT JOIN academic_programs ap ON s.program_id = ap.program_id
             WHERE s.student_id = ? AND u.is_active = 1`,
            [studentId]
        );

        if (studentRows.length === 0) {
            return res.status(403).json({ success: false, error: 'Student record could not be verified or account is inactive.' }); 
        }

        const student = studentRows[0];
        const studentUserId = student.student_user_id;
        const studentYearLevel = student.year_level; 
        const now = new Date();

        const [progReqs] = await pool.query(
            `SELECT 
                COALESCE(sdo.override_deadline, prc.submission_deadline) AS submission_deadline, 
                COALESCE(sdo.override_allow_late_submission, prc.allow_late_submission) AS allow_late_submission
             FROM program_requirements_config prc
             LEFT JOIN student_deadline_overrides sdo ON sdo.student_id = ? AND sdo.config_id = prc.config_id
             WHERE prc.program_id = ? AND prc.requirement_name = ?
               AND (prc.year_level IS NULL OR ? LIKE CONCAT('%', prc.year_level, '%') OR prc.year_level = ?)`, 
            [studentId, student.program_id, reqName, studentYearLevel, studentYearLevel] 
        );

        let deadline = null;
        let allowLate = false;

        if (progReqs.length > 0) {
            deadline = progReqs[0].submission_deadline;
            allowLate = progReqs[0].allow_late_submission === 1 || progReqs[0].allow_late_submission === true || progReqs[0].allow_late_submission === '1';
        } else {
            const [specReqs] = await pool.query(
                `SELECT submission_deadline, allow_late_submission FROM student_special_requirements WHERE student_id = ? AND requirement_name = ?`,
                [studentId, reqName]
            );
            if (specReqs.length > 0) {
                deadline = specReqs[0].submission_deadline;
                allowLate = specReqs[0].allow_late_submission === 1 || specReqs[0].allow_late_submission === true || specReqs[0].allow_late_submission === '1';
            } else {
                return res.status(404).json({ success: false, error: "The targeted requirement mapping index does not exist." });
            }
        }

        const deadlineDate = deadline && !isNaN(new Date(deadline).getTime()) ? new Date(deadline) : null;
        const isLate = deadlineDate && now > deadlineDate;

        if (isLate && !allowLate) {
            return res.status(400).json({ 
                success: false, 
                error: `Submission rejected. The deadline (${formatDateManila(deadlineDate)}) has passed and late submissions are locked.` 
            });
        }

        const targetStatus = isLate ? 'Submitted Late' : 'Submitted';
        const isLateTinyInt = isLate ? 1 : 0;

        const [checkExisting] = await pool.query(
            `SELECT submission_id FROM student_requirement_submissions WHERE student_id = ? AND requirement_name = ?`,
            [studentId, reqName]
        );

        let activeSubmissionId;

        if (checkExisting.length > 0) {
            activeSubmissionId = checkExisting[0].submission_id;
            await pool.query(
                `UPDATE student_requirement_submissions 
                 SET file_url = ?, status = ?, is_late = ?, submitted_at = NOW() 
                 WHERE student_id = ? AND requirement_name = ?`,
                [file_url, targetStatus, isLateTinyInt, studentId, reqName]
            );
        } else {
            activeSubmissionId = `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await pool.query(
                `INSERT INTO student_requirement_submissions 
                 (submission_id, student_id, requirement_name, file_url, status, is_late, submitted_at, nurse_remarks) 
                 VALUES (?, ?, ?, ?, ?, ?, NOW(), '')`,
                [activeSubmissionId, studentId, reqName, file_url, targetStatus, isLateTinyInt]
            );
        }

        const [nurses] = await pool.query(`SELECT user_id FROM nurses WHERE user_id IS NOT NULL`);
        const nurseUserIds = nurses.map(nurse => nurse.user_id);

        if (nurseUserIds.length > 0) {
            await notifyUsers({
                sender_id: studentUserId,
                recipient_ids: nurseUserIds,
                title: 'New Student Submission',
                message: `${student.first_name} ${student.last_name} (${student.course}) submitted "${reqName}".`,
                type: 'requirement_submission',
                navigate_id: activeSubmissionId,
                payloadData: { url: `/RequirementManagement`, submission_id: activeSubmissionId }
            });
        }

        res.json({ 
            success: true, 
            message: "Requirement uploaded and push notification delivered!", 
            status: targetStatus,
            submission_id: activeSubmissionId 
        });

    } catch (err) {
        console.error("Critical student submission channel fault:", err.message);
        res.status(500).json({ success: false, error: "Internal processing error: " + err.message });
    }
});

// 12. GET SUBMISSION & STUDENT DETAILS BY SUBMISSION_ID FOR DIRECT DEEP LINKING
app.get('/api/submissions/:submissionId', async (req, res) => {
    const { submissionId } = req.params;
    try {
        const [rows] = await pool.query(
            `SELECT srs.submission_id, srs.requirement_name, srs.status, srs.file_url, srs.nurse_remarks, srs.submitted_at,
                    s.student_id, s.first_name, s.last_name, s.program_id, s.year_level, s.section, u.is_active
             FROM student_requirement_submissions srs
             JOIN students s ON srs.student_id = s.student_id
             JOIN users u ON s.user_id = u.user_id
             WHERE srs.submission_id = ? AND u.is_active = 1`,
            [submissionId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: "Submission record not found or student account is inactive." });
        }

        res.json({ success: true, submission: rows[0] });
    } catch (err) {
        console.error("Error retrieving submission details:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET all medical requirements masterlist
app.get('/api/medical-requirements', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT requirement_name FROM medical_requirements ORDER BY requirement_name ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create medical requirement (checks for duplicates & auto-adds to facility_services for facility "Others")
app.post('/api/medical-requirements', async (req, res) => {
    const { requirement_name } = req.body;
    if (!requirement_name || !requirement_name.trim()) {
        return res.status(400).json({ success: false, error: 'Requirement name cannot be blank.' });
    }
    const trimmed = requirement_name.trim();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [exists] = await connection.query('SELECT requirement_name FROM medical_requirements WHERE requirement_name = ?', [trimmed]);
        if (exists.length > 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, error: `Duplicate Error: Medical requirement "${trimmed}" already exists.` });
        }

        // 1. Insert into medical_requirements
        await connection.query('INSERT INTO medical_requirements (requirement_name) VALUES (?)', [trimmed]);

        // 2. Automatically insert into facility_services under facility_name = "Others"
        const [othersFacility] = await connection.query('SELECT facility_id FROM partner_facilities WHERE facility_name = "Others"');
        if (othersFacility.length > 0) {
            const facilityId = othersFacility[0].facility_id;
            const newServiceId = `FS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await connection.query(
                `INSERT INTO facility_services (service_id, facility_id, requirement_name, description, created_at) VALUES (?, ?, ?, ?, NOW())`,
                [newServiceId, facilityId, trimmed, 'Auto-generated service for new medical requirement']
            );
        }

        await connection.commit();
        res.status(201).json({ success: true, message: 'Medical requirement created and synced to facility services.' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ success: false, error: err.message });
    } finally {
        connection.release();
    }
});

// PUT update medical requirement name across all dependent tables (program_requirements_config, student_requirement_submissions, facility_services)
app.put('/api/medical-requirements/:reqName', async (req, res) => {
    const oldName = req.params.reqName;
    const { requirement_name } = req.body;
    if (!requirement_name || !requirement_name.trim()) {
        return res.status(400).json({ success: false, error: 'Requirement name cannot be blank.' });
    }
    const newName = requirement_name.trim();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [exists] = await connection.query('SELECT requirement_name FROM medical_requirements WHERE requirement_name = ? AND requirement_name != ?', [newName, oldName]);
        if (exists.length > 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, error: `Duplicate Error: Medical requirement "${newName}" already exists.` });
        }

        await connection.query('INSERT IGNORE INTO medical_requirements (requirement_name) VALUES (?)', [newName]);
        
        // Update in program_requirements_config table
        await connection.query('UPDATE program_requirements_config SET requirement_name = ? WHERE requirement_name = ?', [newName, oldName]);
        
        // Update in student_special_requirements table
        await connection.query('UPDATE student_special_requirements SET requirement_name = ? WHERE requirement_name = ?', [newName, oldName]);
        
        // Update in student_requirement_submissions table
        await connection.query('UPDATE student_requirement_submissions SET requirement_name = ? WHERE requirement_name = ?', [newName, oldName]);
        
        // Update in facility_services table
        await connection.query('UPDATE facility_services SET requirement_name = ? WHERE requirement_name = ?', [newName, oldName]);
        
        // Remove old master requirement entry
        await connection.query('DELETE FROM medical_requirements WHERE requirement_name = ?', [oldName]);

        await connection.commit();
        res.json({ success: true, message: 'Medical requirement updated successfully across all connected tables.' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ success: false, error: err.message });
    } finally {
        connection.release();
    }
});

// DELETE medical requirement with cascade check & confirmation support for program_id, submission_id, service_id
app.delete('/api/medical-requirements/:reqName', async (req, res) => {
    const reqName = req.params.reqName;
    const confirmCascade = req.query.confirmCascade === 'true' || req.body?.confirmCascade === true;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Query active connections across dependent tables
        const [progRows] = await connection.query('SELECT DISTINCT program_id FROM program_requirements_config WHERE requirement_name = ?', [reqName]);
        const [subRows] = await connection.query('SELECT submission_id FROM student_requirement_submissions WHERE requirement_name = ?', [reqName]);
        const [facRows] = await connection.query('SELECT service_id FROM facility_services WHERE requirement_name = ?', [reqName]);

        const programIds = progRows.map(r => r.program_id);
        const submissionIds = subRows.map(r => r.submission_id);
        const serviceIds = facRows.map(r => r.service_id);

        const hasConnections = programIds.length > 0 || submissionIds.length > 0 || serviceIds.length > 0;

        // Return warning with connected IDs if confirmation flag was not supplied
        if (hasConnections && !confirmCascade) {
            await connection.rollback();
            return res.status(200).json({
                requiresConfirmation: true,
                message: `Warning: "${reqName}" is connected to existing records in the system.`,
                connections: {
                    program_ids: programIds,
                    submission_ids: submissionIds,
                    service_ids: serviceIds,
                    program_count: programIds.length,
                    submission_count: submissionIds.length,
                    service_count: serviceIds.length
                }
            });
        }

        // Complete cascading deletions across connected tables upon confirmation
        if (programIds.length > 0) {
            await connection.query('DELETE FROM program_requirements_config WHERE requirement_name = ?', [reqName]);
        }
        if (submissionIds.length > 0) {
            await connection.query('DELETE FROM student_requirement_submissions WHERE requirement_name = ?', [reqName]);
        }
        if (serviceIds.length > 0) {
            // Remove foreign keys in referral_request_services if applicable
            await connection.query('DELETE FROM referral_request_services WHERE service_id IN (?)', [serviceIds]);
            await connection.query('DELETE FROM facility_services WHERE requirement_name = ?', [reqName]);
        }
        
        await connection.query('DELETE FROM student_special_requirements WHERE requirement_name = ?', [reqName]);
        await connection.query('DELETE FROM medical_requirements WHERE requirement_name = ?', [reqName]);

        await connection.commit();
        res.json({ success: true, message: `Medical requirement "${reqName}" and all connected records were successfully deleted.` });
    } catch (err) {
        await connection.rollback();
        console.error("Error deleting medical requirement:", err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        connection.release();
    }
});

//Health Record Api
// 1. GET ALL STUDENTS WITH SEARCH FILTERS
// GET ALL STUDENTS WITH SEARCH & DROPDOWN FILTERS
app.get('/api/health-records/students', async (req, res) => {
    const { search, program, section, year_level } = req.query;
    
    let query = `
        SELECT 
            student_id, 
            first_name, 
            last_name, 
            program_id, 
            year_level,
            section
        FROM students 
        WHERE 1=1
    `;
    const params = [];

    // Global Search Filter
    if (search && search.trim() !== '') {
        const searchWildcard = `%${search.trim()}%`;
        query += ` AND (
            first_name LIKE ? 
            OR last_name LIKE ? 
            OR student_id LIKE ? 
            OR program_id LIKE ?
        )`;
        params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard);
    }

    // Program Filter
    if (program && program !== 'all') {
        query += ` AND program_id = ?`;
        params.push(program);
    }

    // Section Filter
    if (section && section !== 'all') {
        query += ` AND section = ?`;
        params.push(section);
    }

    // Year Level Filter
    if (year_level && year_level !== 'all') {
        query += ` AND year_level = ?`;
        params.push(year_level);
    }

    query += ` ORDER BY last_name ASC, first_name ASC`;

    try {
        const [rows] = await pool.execute(query, params);
        res.json({ success: true, students: rows });
    } catch (error) {
        console.error("Error searching student records:", error);
        res.status(500).json({ success: false, message: "Database search execution failure." });
    }
});

// Backend API: GET student header with account status and connected parent info
app.get('/api/health-records/student-header/:studentId', async (req, res) => {
    const { studentId } = req.params;
    try {
        const query = `
            SELECT 
                s.student_id, 
                s.first_name, 
                s.last_name, 
                s.program_id, 
                s.year_level, 
                s.section,
                u.is_active,
                p.first_name AS parent_first_name,
                p.last_name AS parent_last_name,
                p.primary_phone AS parent_phone
            FROM students s
            LEFT JOIN users u ON s.user_id = u.user_id
            LEFT JOIN parent_student_mapping psm ON s.student_id = psm.student_id
            LEFT JOIN parents p ON psm.parent_id = p.parent_id
            WHERE s.student_id = ?
        `;
        const [rows] = await pool.execute(query, [studentId]);

        if (rows.length > 0) {
            res.json({ success: true, student: rows[0] });
        } else {
            res.status(404).json({ success: false, message: "Student not found." });
        }
    } catch (error) {
        console.error("Error fetching student header:", error);
        res.status(500).json({ success: false, message: "Database error." });
    }
});


//Get Connected Parent Account
// GET Connected Parent Profile for a Student
app.get('/api/health-records/parent-profile/:studentId', async (req, res) => {
    const { studentId } = req.params;
    try {
        const query = `
            SELECT 
                p.parent_id,
                p.user_id,
                p.first_name,
                p.last_name,
                p.primary_phone,
                p.is_sms_verified,
                u.username,
                u.is_active
            FROM parent_student_mapping psm
            JOIN parents p ON psm.parent_id = p.parent_id
            LEFT JOIN users u ON p.user_id = u.user_id
            WHERE psm.student_id = ?
        `;
        const [rows] = await pool.execute(query, [studentId]);

        if (rows.length > 0) {
            res.json({ success: true, parent: rows[0] });
        } else {
            res.status(404).json({ success: false, message: "No connected parent account found for this student." });
        }
    } catch (error) {
        console.error("Error fetching parent profile:", error);
        res.status(500).json({ success: false, message: "Database error fetching parent profile." });
    }
});


// GET ALL ACADEMIC PROGRAMS
app.get('/api/academic-programs', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT program_id, program_name, type FROM academic_programs ORDER BY program_name ASC`
        );
        res.json({ success: true, programs: rows });
    } catch (error) {
        console.error("Error fetching academic programs:", error);
        res.status(500).json({ success: false, message: "Database read failure." });
    }
});


// GET /api/health-records/students
app.get('/students', async (req, res) => {
    try {
        const { search, program, section, year_level } = req.query;

        let query = `
            SELECT 
                s.student_id,
                s.user_id,
                s.first_name,
                s.last_name,
                s.program_id,
                s.year_level,
                s.section,
                -- All Health Information Fields from student_health_information
                h.health_info_id,
                h.has_allergies,
                h.allergy_food,
                h.allergy_medicine,
                h.allergy_insect_sting,
                h.allergy_environmental,
                h.allergy_others,
                h.reaction_diarrhea,
                h.reaction_hives,
                h.reaction_local,
                h.reaction_rash,
                h.reaction_swelling,
                h.reaction_trouble_breathing,
                h.reaction_others,
                h.allergy_medication_taken,
                h.has_asthma,
                h.asthma_triggers,
                h.asthma_medication_taken,
                h.has_other_respiratory,
                h.other_respiratory_specify,
                h.other_respiratory_medication,
                h.has_blood_disorders,
                h.blood_disorder_anemia,
                h.blood_disorder_leukopenia,
                h.blood_disorder_thrombocytopenia,
                h.has_chicken_pox,
                h.chicken_pox_age,
                h.has_digestive_disorders,
                h.digestive_ulcer,
                h.digestive_appendicitis,
                h.digestive_gastritis,
                h.digestive_hemorrhoids,
                h.digestive_medication_taken,
                h.has_heart_problems,
                h.heart_problems_specify,
                h.heart_problems_medication,
                h.has_kidney_bladder_problems,
                h.kidney_bladder_specify,
                h.kidney_bladder_medication,
                h.has_measles,
                h.measles_age,
                h.has_metabolic_diseases,
                h.metabolic_hyperglycemia,
                h.metabolic_hypoglycemia,
                h.has_muscle_bone_disorder,
                h.muscle_bone_specify,
                h.has_seizure_episode,
                h.seizure_last_episode_date,
                h.seizure_medication_taken,
                h.has_surgery,
                h.surgery_specify,
                h.surgery_date,
                h.has_vision_problem,
                h.vision_specify,
                h.vision_with_eyeglasses,
                h.vision_with_contact_lens,
                h.has_hearing_problem,
                h.hearing_specify,
                h.has_other_condition,
                h.other_condition_specify,
                h.updated_at
            FROM students s
            LEFT JOIN student_health_information h 
                   ON (s.student_id = h.student_id OR (s.user_id IS NOT NULL AND s.user_id = h.user_id))
            WHERE 1=1
        `;

        const queryParams = [];

        if (search && search.trim() !== '') {
            query += ` AND (s.student_id LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)`;
            const term = `%${search.trim()}%`;
            queryParams.push(term, term, term);
        }

        if (program && program !== 'all') {
            query += ` AND s.program_id = ?`;
            queryParams.push(program);
        }

        if (section && section !== 'all') {
            query += ` AND s.section = ?`;
            queryParams.push(section);
        }

        if (year_level && year_level !== 'all') {
            query += ` AND s.year_level = ?`;
            queryParams.push(year_level);
        }

        query += ` ORDER BY s.last_name ASC, s.first_name ASC`;

        const [rows] = await db.query(query, queryParams);

        // Helper to evaluate MySQL 1/0, true/false, '1', or Buffer <01>
        const parseBool = (val) => {
            if (val === null || val === undefined) return false;
            if (typeof val === 'boolean') return val;
            if (typeof val === 'number') return val === 1;
            if (typeof val === 'string') return val === '1' || val.toLowerCase() === 'true';
            if (Buffer.isBuffer(val)) return val[0] === 1;
            return Boolean(val);
        };

        const studentsWithHealthHistory = rows.map((student) => {
            // Check if health record exists for student
            if (!student.health_info_id) {
                return {
                    ...student,
                    health_history: 'No Record Submitted'
                };
            }

            const conditions = [];

            if (parseBool(student.has_allergies)) {
                const allergyTypes = [
                    student.allergy_food && `Food (${student.allergy_food})`,
                    student.allergy_medicine && `Meds (${student.allergy_medicine})`,
                    student.allergy_insect_sting && `Sting (${student.allergy_insect_sting})`,
                    student.allergy_environmental && `Env (${student.allergy_environmental})`,
                    student.allergy_others
                ].filter(Boolean);
                conditions.push(allergyTypes.length > 0 ? `Allergies: ${allergyTypes.join(', ')}` : 'Allergies');
            }

            if (parseBool(student.has_asthma)) {
                conditions.push(student.asthma_triggers ? `Asthma (${student.asthma_triggers})` : 'Asthma');
            }

            if (parseBool(student.has_other_respiratory)) {
                conditions.push(student.other_respiratory_specify ? `Respiratory: ${student.other_respiratory_specify}` : 'Respiratory Issue');
            }

            if (parseBool(student.has_blood_disorders)) {
                const bloodTypes = [
                    parseBool(student.blood_disorder_anemia) && 'Anemia',
                    parseBool(student.blood_disorder_leukopenia) && 'Leukopenia',
                    parseBool(student.blood_disorder_thrombocytopenia) && 'Thrombocytopenia'
                ].filter(Boolean);
                conditions.push(bloodTypes.length > 0 ? `Blood Disorder: ${bloodTypes.join(', ')}` : 'Blood Disorder');
            }

            if (parseBool(student.has_chicken_pox)) conditions.push('Chicken Pox');
            if (parseBool(student.has_measles)) conditions.push('Measles');

            if (parseBool(student.has_digestive_disorders)) {
                const digestiveTypes = [
                    parseBool(student.digestive_ulcer) && 'Ulcer',
                    parseBool(student.digestive_appendicitis) && 'Appendicitis',
                    parseBool(student.digestive_gastritis) && 'Gastritis',
                    parseBool(student.digestive_hemorrhoids) && 'Hemorrhoids'
                ].filter(Boolean);
                conditions.push(digestiveTypes.length > 0 ? `Digestive: ${digestiveTypes.join(', ')}` : 'Digestive Disorder');
            }

            if (parseBool(student.has_heart_problems)) {
                conditions.push(student.heart_problems_specify ? `Heart: ${student.heart_problems_specify}` : 'Heart Problem');
            }

            if (parseBool(student.has_kidney_bladder_problems)) {
                conditions.push(student.kidney_bladder_specify ? `Kidney/Bladder: ${student.kidney_bladder_specify}` : 'Kidney/Bladder Problem');
            }

            if (parseBool(student.has_metabolic_diseases)) {
                const metabolic = [
                    parseBool(student.metabolic_hyperglycemia) && 'Hyperglycemia',
                    parseBool(student.metabolic_hypoglycemia) && 'Hypoglycemia'
                ].filter(Boolean);
                conditions.push(metabolic.length > 0 ? `Metabolic: ${metabolic.join(', ')}` : 'Metabolic Disease');
            }

            if (parseBool(student.has_muscle_bone_disorder)) {
                conditions.push(student.muscle_bone_specify ? `Muscle/Bone: ${student.muscle_bone_specify}` : 'Muscle/Bone Disorder');
            }

            if (parseBool(student.has_seizure_episode)) conditions.push('Seizures');

            if (parseBool(student.has_surgery)) {
                conditions.push(student.surgery_specify ? `Surgery (${student.surgery_specify})` : 'Surgery History');
            }

            if (parseBool(student.has_vision_problem)) {
                conditions.push(student.vision_specify ? `Vision: ${student.vision_specify}` : 'Vision Problem');
            }

            if (parseBool(student.has_hearing_problem)) {
                conditions.push(student.hearing_specify ? `Hearing: ${student.hearing_specify}` : 'Hearing Problem');
            }

            if (parseBool(student.has_other_condition)) {
                conditions.push(student.other_condition_specify || 'Other Condition');
            }

            return {
                ...student,
                health_history: conditions.length > 0 ? conditions.join('; ') : 'No Known Conditions'
            };
        });

        console.log(`[API Debug] Retrieved ${studentsWithHealthHistory.length} student records.`);

        return res.status(200).json({
            success: true,
            count: studentsWithHealthHistory.length,
            students: studentsWithHealthHistory
        });

    } catch (error) {
        console.error("Error retrieving student health records:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error querying health records index.",
            error: error.message
        });
    }
});

//Medicine Inventory Api
const DISCRETE_UNITS = [
  'Tablet/s', 'Capsule/s', 'Patch/es', 'Sachet', 
  'Vial', 'Prefilled Syringe', 'Spray/s', 'Inhaler', 'Box/es'
];

const autoConvertUnit = (val, unit) => {
  let num = parseFloat(val);
  if (isNaN(num)) return { value: val, unit };
  if (unit === 'mcg' && num >= 1000) return autoConvertUnit(num / 1000, 'mg');
  if (unit === 'mg' && num >= 1000) return autoConvertUnit(num / 1000, 'g');
  if (unit === 'mL' && num >= 1000) return autoConvertUnit(num / 1000, 'L');
  return { value: Number(num.toFixed(2)), unit };
};

// Strength (value + unit) only describes the package. The "dispense_limit / dispense_unit_of_measure" columns now hold
// the dispense limit (max quantity per dispensation) and the dispense unit of measure (Tablet/s, mL, ...).
const normalizeMedicinePayload = (body) => {
  const isLegacyDiscreteStrength = DISCRETE_UNITS.includes(body.strength_unit_of_measure);
  const isDiscreteDispense = DISCRETE_UNITS.includes(body.dispense_unit_of_measure);
  const strengthValue = parseFloat(body.strength_unit_value);
  const dispenseLimit = parseFloat(body.dispense_limit);

  return {
    ...body,
    strength_unit_value: isLegacyDiscreteStrength ? 1.00 : strengthValue,
    dispense_limit: isDiscreteDispense
      ? Math.max(1, Math.round(dispenseLimit) || 1)
      : (dispenseLimit > 0 ? dispenseLimit : 0.00)
  };
};

const validateMedicinePayload = (payload) => {
  if (!payload.dispense_unit_of_measure) return 'Dispense unit of measure is required.';
  if (!(payload.dispense_limit > 0)) return 'Dispense limit must be greater than 0.';
  if (!(payload.strength_unit_value > 0)) return 'Strength unit value must be greater than 0.';
  return null;
};

// A medicine is dispensed per piece (stock count) when its dispense unit is a discrete unit.
const isDiscreteDispenseUnit = (unit) => DISCRETE_UNITS.includes(unit);

// A medicine may only be dispensed for a medical condition it is linked to via medicine_indications.
const isMedicineLinkedToComplaint = async (connection, medicineId, complaintId) => {
  const [rows] = await connection.execute(
    'SELECT 1 FROM medicine_indications WHERE medicine_id = ? AND complaint_id = ? LIMIT 1',
    [medicineId, complaintId]
  );
  return rows.length > 0;
};

// Auto-depletion helper (extracts 1 stock unit when volume reaches 0 and refills remaining_volume)
const syncDepletedBatches = async (connection) => {
  const [depletedBatches] = await connection.execute(`
    SELECT b.batch_id, b.current_stock, b.remaining_volume, m.strength_unit_value 
    FROM medicine_inventory_batches b
    JOIN medicines m ON b.medicine_id = m.medicine_id
    WHERE b.remaining_volume <= 0 AND b.current_stock > 0
  `);

  for (const batch of depletedBatches) {
    const updatedStock = batch.current_stock - 1;
    const refilledVolume = updatedStock > 0 ? parseFloat(batch.strength_unit_value) : 0.00;
    
    await connection.execute(
      `UPDATE medicine_inventory_batches 
       SET current_stock = ?, remaining_volume = ? 
       WHERE batch_id = ?`,
      [updatedStock, refilledVolume, batch.batch_id]
    );
  }
};

// Reusable Dispensation Helper for continuous/capacity units (including 'pcs.')
const dispenseMedicineBatch = async (connection, batchId, amountToDeduct) => {
  const [rows] = await connection.execute(
    `SELECT b.batch_id, b.current_stock, b.remaining_volume, m.strength_unit_value, m.dispense_unit_of_measure
     FROM medicine_inventory_batches b
     JOIN medicines m ON b.medicine_id = m.medicine_id
     WHERE b.batch_id = ?`,
    [batchId]
  );

  if (!rows.length) throw new Error('Batch not found');

  const isDiscrete = isDiscreteDispenseUnit(rows[0].dispense_unit_of_measure);

  let current_stock = parseInt(rows[0].current_stock) || 0;
  let remaining_volume = parseFloat(rows[0].remaining_volume) || 0;
  let maxVal = parseFloat(rows[0].strength_unit_value) || 1;

  if (isDiscrete) {
    current_stock = Math.max(0, current_stock - parseInt(amountToDeduct));
    remaining_volume = current_stock > 0 ? 1.00 : 0.00;
  } else {
    remaining_volume -= parseFloat(amountToDeduct);

    // Roll over stock deduction if dispensed amount exhausts the active volume capacity
    while (remaining_volume <= 0 && current_stock > 0) {
      current_stock -= 1;
      if (current_stock > 0) {
        remaining_volume += maxVal;
      } else {
        remaining_volume = 0;
        break;
      }
    }
  }

  await connection.execute(
    `UPDATE medicine_inventory_batches 
     SET current_stock = ?, remaining_volume = ? 
     WHERE batch_id = ?`,
    [current_stock, Math.max(0, remaining_volume), batchId]
  );

  return { current_stock, remaining_volume: Math.max(0, remaining_volume) };
};

// 1. Fetch complaints
app.get('/api/complaints', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM chief_complaints');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Fetch medicines (includes specify_complaint_text in indication data)
app.get('/api/medicines', async (req, res) => {
  try {
    const query = `
      SELECT m.*, 
        GROUP_CONCAT(mi.complaint_id SEPARATOR ',') AS complaint_ids,
        GROUP_CONCAT(CONCAT_WS(':', mi.complaint_id, COALESCE(mi.specify_complaint_text, '')) SEPARATOR '||') AS indication_details,
        GROUP_CONCAT(
          CONCAT(c.complaint_name, IF(mi.specify_complaint_text IS NOT NULL AND mi.specify_complaint_text != '', CONCAT(' (', mi.specify_complaint_text, ')'), '')) 
          SEPARATOR ', '
        ) AS connected_complaints
      FROM medicines m
      LEFT JOIN medicine_indications mi ON m.medicine_id = mi.medicine_id
      LEFT JOIN chief_complaints c ON mi.complaint_id = c.complaint_id
      GROUP BY m.medicine_id
      ORDER BY m.generic_name ASC
    `;
    const [rows] = await pool.execute(query);
    
    const formattedRows = rows.map(row => {
      const convertedStrength = autoConvertUnit(row.strength_unit_value, row.strength_unit_of_measure);
      const convertedAvg = autoConvertUnit(row.dispense_limit, row.dispense_unit_of_measure);
      
      const indications = row.indication_details 
        ? row.indication_details.split('||').map(item => {
            const idx = item.indexOf(':');
            if (idx === -1) return { complaint_id: item, specify_complaint_text: '' };
            return {
              complaint_id: item.substring(0, idx),
              specify_complaint_text: item.substring(idx + 1)
            };
          })
        : [];

      return {
        ...row,
        display_strength_value: convertedStrength.value,
        display_strength_unit: convertedStrength.unit,
        display_avg_value: convertedAvg.value,
        display_avg_unit: convertedAvg.unit,
        complaint_ids: row.complaint_ids ? row.complaint_ids.split(',') : [],
        indications: indications
      };
    });
    
    res.json(formattedRows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Low / Critical / Adequate is judged on the medicine's total usable stock (all of its non-expired batches
// added together, same rule as getMedicineStockStatuses), never on a single batch. Needs the alias `b` for the batch row.
const MEDICINE_TOTAL_STOCK_SQL = `(
  SELECT CAST(COALESCE(SUM(bt.current_stock), 0) AS SIGNED)
  FROM medicine_inventory_batches bt
  WHERE bt.medicine_id = b.medicine_id AND bt.expiration_date >= CURDATE()
)`;

// 3. Fetch inventory (joins medicine indications and specify_complaint_text)
app.get('/api/inventory', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await syncDepletedBatches(connection);
    await connection.commit();

    const query = `
      SELECT 
        b.batch_id, b.medicine_id, b.expiration_date, b.current_stock, b.remaining_volume,
        m.generic_name, m.brand_name, m.dosage_form, m.strength_unit_value, m.strength_unit_of_measure,
        m.dispense_limit, m.dispense_unit_of_measure,
        m.low_stock_level, m.critical_stock_level, m.adequate_stock_level,
        ${MEDICINE_TOTAL_STOCK_SQL} AS medicine_total_stock,
        GROUP_CONCAT(
          CONCAT(c.complaint_name, IF(mi.specify_complaint_text IS NOT NULL AND mi.specify_complaint_text != '', CONCAT(' (', mi.specify_complaint_text, ')'), '')) 
          SEPARATOR ', '
        ) AS connected_complaints
      FROM medicine_inventory_batches b
      JOIN medicines m ON b.medicine_id = m.medicine_id
      LEFT JOIN medicine_indications mi ON m.medicine_id = mi.medicine_id
      LEFT JOIN chief_complaints c ON mi.complaint_id = c.complaint_id
      GROUP BY b.batch_id
      ORDER BY b.expiration_date ASC
    `;
    
    const [rows] = await connection.execute(query);
    const formatted = rows.map(item => {
      const convStrength = autoConvertUnit(item.strength_unit_value, item.strength_unit_of_measure);
      const convVol = autoConvertUnit(item.remaining_volume, item.strength_unit_of_measure);
      return {
        ...item,
        display_strength: `${convStrength.value} ${convStrength.unit}`,
        display_remaining: `${convVol.value} ${convVol.unit}`
      };
    });

    res.json(formatted);
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// 4. Create medicine with indications and specify_complaint_text
app.post('/api/medicines', async (req, res) => {
  const payload = normalizeMedicinePayload(req.body);
  const {
    generic_name, brand_name, dosage_form,
    strength_unit_value, strength_unit_of_measure,
    dispense_limit, dispense_unit_of_measure,
    low_stock_level, critical_stock_level, adequate_stock_level,
    indications, complaint_ids
  } = payload;

  const targetIndications = indications || (complaint_ids || []).map(id => ({
    complaint_id: id,
    specify_complaint_text: null
  }));

  const validationError = validateMedicinePayload(payload);
  if (validationError) return res.status(400).json({ error: validationError });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const medicine_id = uuidv4().substring(0, 45);

    await connection.execute(
      `INSERT INTO medicines (
        medicine_id, generic_name, brand_name, dosage_form,
        strength_unit_value, strength_unit_of_measure,
        dispense_limit, dispense_unit_of_measure,
        low_stock_level, critical_stock_level, adequate_stock_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        medicine_id, generic_name.trim(), brand_name.trim(), dosage_form,
        strength_unit_value, strength_unit_of_measure,
        dispense_limit, dispense_unit_of_measure,
        low_stock_level || 0, critical_stock_level || 0, adequate_stock_level || 0
      ]
    );

    if (targetIndications?.length) {
      for (const ind of targetIndications) {
        const indication_id = uuidv4().substring(0, 45);
        await connection.execute(
          `INSERT INTO medicine_indications (indication_id, medicine_id, complaint_id, specify_complaint_text) 
           VALUES (?, ?, ?, ?)`,
          [indication_id, medicine_id, ind.complaint_id, ind.specify_complaint_text || null]
        );
      }
    }

    await connection.commit();
    res.status(201).json({ message: 'Medicine created successfully!', medicine_id });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// 5. Update medicine with indications and specify_complaint_text
app.put('/api/medicines/:id', async (req, res) => {
  const { id } = req.params;
  const payload = normalizeMedicinePayload(req.body);
  const {
    generic_name, brand_name, dosage_form,
    strength_unit_value, strength_unit_of_measure,
    dispense_limit, dispense_unit_of_measure,
    low_stock_level, critical_stock_level, adequate_stock_level,
    indications, complaint_ids
  } = payload;

  const targetIndications = indications || (complaint_ids || []).map(cid => ({
    complaint_id: cid,
    specify_complaint_text: null
  }));

  const validationError = validateMedicinePayload(payload);
  if (validationError) return res.status(400).json({ error: validationError });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE medicines SET
        generic_name = ?, brand_name = ?, dosage_form = ?,
        strength_unit_value = ?, strength_unit_of_measure = ?,
        dispense_limit = ?, dispense_unit_of_measure = ?,
        low_stock_level = ?, critical_stock_level = ?, adequate_stock_level = ?
      WHERE medicine_id = ?`,
      [
        generic_name.trim(), brand_name.trim(), dosage_form,
        strength_unit_value, strength_unit_of_measure,
        dispense_limit, dispense_unit_of_measure,
        low_stock_level || 0, critical_stock_level || 0, adequate_stock_level || 0,
        id
      ]
    );

    await connection.execute('DELETE FROM medicine_indications WHERE medicine_id = ?', [id]);

    if (targetIndications?.length) {
      for (const ind of targetIndications) {
        const indication_id = uuidv4().substring(0, 45);
        await connection.execute(
          `INSERT INTO medicine_indications (indication_id, medicine_id, complaint_id, specify_complaint_text) 
           VALUES (?, ?, ?, ?)`,
          [indication_id, id, ind.complaint_id, ind.specify_complaint_text || null]
        );
      }
    }

    await connection.commit();
    res.json({ message: 'Medicine updated successfully!' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// 6. Add batch
app.post('/api/batches', async (req, res) => {
  const { medicine_id, expiration_date, current_stock, remaining_volume } = req.body;

  try {
    const [meds] = await pool.execute(
      'SELECT strength_unit_value, strength_unit_of_measure, dispense_unit_of_measure FROM medicines WHERE medicine_id = ?',
      [medicine_id]
    );
    if (meds.length === 0) return res.status(404).json({ error: 'Medicine reference not found.' });

    const { strength_unit_value, strength_unit_of_measure, dispense_unit_of_measure } = meds[0];
    const isDiscrete = isDiscreteDispenseUnit(dispense_unit_of_measure);

    let finalVolume;
    if (isDiscrete) {
      finalVolume = 1.00;
    } else {
      const maxVal = parseFloat(strength_unit_value);
      finalVolume = remaining_volume !== undefined && remaining_volume !== '' ? parseFloat(remaining_volume) : maxVal;

      if (isNaN(finalVolume) || finalVolume <= 0 || finalVolume > maxVal) {
        return res.status(400).json({ 
          error: `Please provide a valid volume in ${strength_unit_of_measure} (must be between > 0 and ${maxVal} ${strength_unit_of_measure}).` 
        });
      }
    }

    const batch_id = uuidv4().substring(0, 45);
    await pool.execute(
      `INSERT INTO medicine_inventory_batches 
       (batch_id, medicine_id, expiration_date, current_stock, remaining_volume, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [batch_id, medicine_id, expiration_date, current_stock, finalVolume]
    );

    res.status(201).json({ message: 'Batch added successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Update batch
app.put('/api/batches/:id', async (req, res) => {
  const { id } = req.params;
  let { current_stock, expiration_date, remaining_volume } = req.body;

  try {
    const [meds] = await pool.execute(
      `SELECT m.strength_unit_value, m.strength_unit_of_measure, m.dispense_unit_of_measure FROM medicine_inventory_batches b
       JOIN medicines m ON b.medicine_id = m.medicine_id WHERE b.batch_id = ?`,
      [id]
    );

    if (meds.length > 0) {
      const { strength_unit_value, dispense_unit_of_measure } = meds[0];
      const isDiscrete = isDiscreteDispenseUnit(dispense_unit_of_measure);
      let vol = isDiscrete ? 1.00 : parseFloat(remaining_volume);

      if (!isDiscrete) {
        const maxVal = parseFloat(strength_unit_value);
        if (vol <= 0 && current_stock > 0) {
          current_stock = current_stock - 1;
          vol = current_stock > 0 ? maxVal : 0;
        } else if (vol > maxVal) {
          return res.status(400).json({ error: `Remaining volume cannot exceed ${maxVal}` });
        }
      }

      await pool.execute(
        `UPDATE medicine_inventory_batches 
         SET current_stock = ?, expiration_date = ?, remaining_volume = ? 
         WHERE batch_id = ?`,
        [current_stock, expiration_date, vol, id]
      );
      res.json({ message: 'Batch updated successfully!' });
    } else {
      res.status(404).json({ error: 'Batch record not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Delete batch
app.delete('/api/batches/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute('DELETE FROM medicine_inventory_batches WHERE batch_id = ?', [id]);
    res.json({ message: 'Batch deleted successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Direct Medicine Dispensed api
// Helper for continuous unit conversions (g/mg/mcg and L/mL)
const convertUnit = (val, fromUnit, toUnit) => {
  if (fromUnit === toUnit) return val;
  const toBase = (v, u) => {
    switch (u) {
      case 'g': return v * 1000000;
      case 'mg': return v * 1000;
      case 'mcg': return v;
      case 'L': return v * 1000;
      case 'mL': return v;
      case 'pcs.': return v;
      default: return v;
    }
  };
  const fromBase = (v, u) => {
    switch (u) {
      case 'g': return v / 1000000;
      case 'mg': return v / 1000;
      case 'mcg': return v;
      case 'L': return v / 1000;
      case 'mL': return v;
      case 'pcs.': return v;
      default: return v;
    }
  };
  return fromBase(toBase(val, fromUnit), toUnit);
};

// Search active students for direct dispensation
// Search ONLY ACTIVE students for direct dispensation (Excludes u.is_active = 0)
app.get('/api/students/direct', async (req, res) => {
  const { search } = req.query;
  try {
    if (!search || !search.trim()) return res.json([]);
    
    const queryStr = `
      SELECT s.student_id, s.first_name, s.last_name 
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      WHERE u.is_active = 1
        AND (
          CONCAT(s.first_name, ' ', s.last_name) LIKE ? 
          OR CONCAT(s.last_name, ' ', s.first_name) LIKE ? 
          OR s.student_id LIKE ?
        )
      LIMIT 10
    `;
    const wildcard = `%${search.trim()}%`;
    const [rows] = await pool.execute(queryStr, [wildcard, wildcard, wildcard]);
    res.json(rows);
  } catch (error) {
    console.error("Error on /api/students/direct:", error);
    res.status(500).json({ error: 'Database querying error encountered.' });
  }
});

// Search ONLY ACTIVE students
app.get('/api/students/search', async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json([]);
    try {
        const sql = `
            SELECT s.student_id, s.first_name, s.last_name, s.program_id, s.year_level 
            FROM students s
            JOIN users u ON s.user_id = u.user_id
            WHERE u.is_active = 1
              AND (s.student_id LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?)
            LIMIT 10
        `;
        const searchVal = `%${query}%`;
        const [rows] = await pool.execute(sql, [searchVal, searchVal, searchVal]);
        res.json(rows);
    } catch (error) {
        console.error("Error on /api/students/search:", error);
        res.status(500).json({ error: "Failed to search active students" });
    }
});

// Fetch active inventory batches aligned with updated medicines schema
app.get('/api/inventory/batches', async (req, res) => {
  try {
    const queryStr = `
      SELECT 
        b.batch_id, 
        b.medicine_id, 
        CONCAT(m.brand_name, ' (', m.generic_name, ')') AS medicine_name,
        b.current_stock, 
        b.remaining_volume,
        b.expiration_date, 
        b.created_at,
        m.dosage_form,
        m.strength_unit_value,
        m.strength_unit_of_measure,
        m.dispense_limit,
        m.dispense_unit_of_measure,
        m.low_stock_level, m.critical_stock_level, m.adequate_stock_level,
        ${MEDICINE_TOTAL_STOCK_SQL} AS medicine_total_stock,
        (SELECT GROUP_CONCAT(DISTINCT mi.complaint_id SEPARATOR ',')
           FROM medicine_indications mi
          WHERE mi.medicine_id = m.medicine_id) AS complaint_ids
      FROM medicine_inventory_batches b
      JOIN medicines m ON b.medicine_id = m.medicine_id
      ORDER BY m.brand_name ASC, b.expiration_date ASC
    `;
    const [rows] = await pool.execute(queryStr);
    res.json(rows);
  } catch (error) {
    console.error("Error on /api/inventory/batches:", error);
    res.status(500).json({ error: 'Failed fetching item metrics.' });
  }
});

// Fetch historical dispensation logs across both direct and consultation tables
app.get('/api/dispensation/history', async (req, res) => {
  const { fromDate, toDate, date, student, medicine } = req.query;
  try {
    const whereClauses = [];
    const params = [];

    if (fromDate && toDate) {
      whereClauses.push(`DATE(dispensed_at) BETWEEN ? AND ?`);
      params.push(fromDate, toDate);
    } else if (fromDate) {
      whereClauses.push(`DATE(dispensed_at) >= ?`);
      params.push(fromDate);
    } else if (toDate) {
      whereClauses.push(`DATE(dispensed_at) <= ?`);
      params.push(toDate);
    } else if (date) {
      whereClauses.push(`DATE(dispensed_at) = ?`);
      params.push(date);
    }

    if (student && student.trim()) {
      const studentTerm = `%${student.trim()}%`;
      whereClauses.push(
        `(first_name LIKE ? OR last_name LIKE ? OR CONCAT(first_name, ' ', last_name) LIKE ? OR CONCAT(last_name, ' ', first_name) LIKE ? OR student_id LIKE ?)`
      );
      params.push(studentTerm, studentTerm, studentTerm, studentTerm, studentTerm);
    }

    if (medicine && medicine.trim()) {
      const medicineTerm = `%${medicine.trim()}%`;
      whereClauses.push(`medicine_name LIKE ?`);
      params.push(medicineTerm);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const masterQuery = `
      SELECT * FROM (
        SELECT 
          d.direct_dispense_id AS id, 
          d.student_id, 
          s.first_name, 
          s.last_name, 
          CONCAT(m.brand_name, ' (', m.generic_name, ')') AS medicine_name, 
          d.dosage_consumption_unit_value, 
          d.dosage_consumption_unit_of_measure,
          d.dispensed_at,
          'Direct Dispensation' AS dispensation_type,
          cc.complaint_name
        FROM direct_dispensation d
        JOIN students s ON d.student_id = s.student_id
        JOIN medicine_inventory_batches b ON d.batch_id = b.batch_id
        JOIN medicines m ON b.medicine_id = m.medicine_id
        LEFT JOIN chief_complaints cc ON d.complaint_id = cc.complaint_id

        UNION ALL

        SELECT 
          c.consultation_dispense_id AS id, 
          v.student_id, 
          s.first_name, 
          s.last_name, 
          CONCAT(m.brand_name, ' (', m.generic_name, ')') AS medicine_name, 
          c.dosage_consumption_unit_value, 
          c.dosage_consumption_unit_of_measure,
          c.dispensed_at,
          'Consultation Dispensation' AS dispensation_type,
          cc.complaint_name
        FROM consultation_dispensation c
        JOIN clinic_visits v ON c.visit_id = v.visit_id
        JOIN students s ON v.student_id = s.student_id
        JOIN medicine_inventory_batches b ON c.batch_id = b.batch_id
        JOIN medicines m ON b.medicine_id = m.medicine_id
        LEFT JOIN chief_complaints cc ON v.complaint_id = cc.complaint_id
      ) AS combined_history
      ${whereSql}
      ORDER BY dispensed_at DESC
    `;

    const [rows] = await pool.query(masterQuery, params);
    res.json(rows);
  } catch (error) {
    console.error("Database Error on /api/dispensation/history:", error.message);
    res.status(500).json({ error: 'Failed accessing logs.', details: error.message });
  }
});

// Core Dispensation POST Handler with Unit Normalization & Push/System Notifications
app.post('/api/dispensation', async (req, res) => {
  const { 
    student_id, 
    nurse_id, 
    batch_id,
    complaint_id,
    dosage_consumption_unit_value,
    dosage_consumption_unit_of_measure
  } = req.body;

  const numericVal = parseFloat(dosage_consumption_unit_value);

  if (!complaint_id) {
    return res.status(400).json({ error: 'Medical condition is required for dispensation.' });
  }

  if (isNaN(numericVal) || numericVal <= 0) {
    return res.status(400).json({ error: 'Dosage value must be greater than zero.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [batchRows] = await connection.execute(
      `SELECT mib.medicine_id, mib.current_stock, mib.remaining_volume, mib.expiration_date,
              m.strength_unit_value, m.strength_unit_of_measure,
              m.dispense_limit, m.dispense_unit_of_measure,
              m.brand_name, m.generic_name
       FROM medicine_inventory_batches mib
       JOIN medicines m ON mib.medicine_id = m.medicine_id 
       WHERE mib.batch_id = ? FOR UPDATE`,
      [batch_id]
    );

    if (batchRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Target medicine batch info not found.' });
    }

    let currentStock = parseInt(batchRows[0].current_stock, 10);
    let remainingVolume = parseFloat(batchRows[0].remaining_volume);
    const strengthUnitVal = parseFloat(batchRows[0].strength_unit_value);
    const strengthUnitMeasure = batchRows[0].strength_unit_of_measure;
    const expirationDate = new Date(batchRows[0].expiration_date);
    const dispenseUnit = batchRows[0].dispense_unit_of_measure;
    const dispenseLimit = parseFloat(batchRows[0].dispense_limit) || 0;
    const isMeasured = !isDiscreteDispenseUnit(dispenseUnit);

    // Get formatted medicine name for notifications
    const brandName = batchRows[0].brand_name;
    const genericName = batchRows[0].generic_name;
    const medicineName = brandName ? `${brandName} (${genericName})` : genericName;

    if (expirationDate < new Date()) {
      await connection.rollback();
      return res.status(400).json({ error: 'Cannot dispense medicine from an expired batch.' });
    }

    if (!(await isMedicineLinkedToComplaint(connection, batchRows[0].medicine_id, complaint_id))) {
      await connection.rollback();
      return res.status(400).json({ error: `${medicineName} is not indicated for the selected medical condition.` });
    }

    if (dosage_consumption_unit_of_measure !== dispenseUnit) {
      await connection.rollback();
      return res.status(400).json({ error: `This medicine must be dispensed in ${dispenseUnit}.` });
    }

    if (!isMeasured && !Number.isInteger(numericVal)) {
      await connection.rollback();
      return res.status(400).json({ error: 'Quantity for discrete items (e.g. tablets, capsules) must be a whole integer.' });
    }

    if (dispenseLimit > 0 && numericVal > dispenseLimit) {
      await connection.rollback();
      return res.status(400).json({ error: `Dispense limit exceeded. Maximum is ${dispenseLimit} ${dispenseUnit} per dispensation.` });
    }

    let newStock = currentStock;
    let newRemaining = remainingVolume;

    if (isMeasured) {
      const requestedInBatchUnit = convertUnit(numericVal, dosage_consumption_unit_of_measure, strengthUnitMeasure);

      const totalAvailableVolume = currentStock > 0 
        ? remainingVolume + (currentStock - 1) * strengthUnitVal 
        : 0;

      if (requestedInBatchUnit > totalAvailableVolume) {
        await connection.rollback();
        const availableInDispenseUnit = convertUnit(totalAvailableVolume, strengthUnitMeasure, dosage_consumption_unit_of_measure);
        return res.status(400).json({ 
          error: `Insufficient available count. Requested ${numericVal} ${dosage_consumption_unit_of_measure}, but total available is ${availableInDispenseUnit.toFixed(2)} ${dosage_consumption_unit_of_measure}.` 
        });
      }

      // Deduct pieces directly from remaining_volume
      newRemaining = remainingVolume - requestedInBatchUnit;

      // Automatically decrement box stock (current_stock) when remaining_volume exhausts active box
      while (newRemaining <= 0 && newStock > 0) {
        newStock -= 1;
        if (newRemaining === 0) {
          if (newStock >= 1) {
            newRemaining = strengthUnitVal;
          }
          break;
        } else {
          if (newStock >= 1) {
            newRemaining = strengthUnitVal + newRemaining;
          } else {
            newRemaining = 0;
            break;
          }
        }
      }
    } else {
      if (numericVal > currentStock) {
        await connection.rollback();
        return res.status(400).json({ 
          error: `Insufficient stock quantity. Requested ${numericVal}, but only ${currentStock} left.` 
        });
      }
      newStock = currentStock - numericVal;
    }

    await connection.execute(
      'UPDATE medicine_inventory_batches SET current_stock = ?, remaining_volume = ? WHERE batch_id = ?',
      [newStock, newRemaining, batch_id]
    );

    // --- Generate Custom Sequential Direct Dispense ID (DISP-MMDDYYXXX) ---
    const now = new Date();
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const dayStr = String(now.getDate()).padStart(2, '0');
    const yearStr = String(now.getFullYear()).slice(-2);
    const datePrefix = `${monthStr}${dayStr}${yearStr}`;

    const [dispenseCountRows] = await connection.execute(
      `SELECT COUNT(*) AS totalToday FROM direct_dispensation WHERE DATE(dispensed_at) = CURDATE() FOR UPDATE`
    );
    const sequenceNum = String(dispenseCountRows[0].totalToday + 1).padStart(3, '0');
    const direct_dispense_id = `DISP-${datePrefix}${sequenceNum}`;

    await connection.execute(
      `INSERT INTO direct_dispensation 
       (direct_dispense_id, student_id, nurse_id, batch_id, complaint_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        direct_dispense_id,
        student_id,
        nurse_id,
        batch_id,
        complaint_id,
        numericVal,
        dosage_consumption_unit_of_measure
      ]
    );

    await connection.commit();

    // ------------------------------------------------------------------
    // DISPATCH NOTIFICATIONS (STUDENT & PARENTS)
    // ------------------------------------------------------------------
    try {
      const [studentRows] = await pool.query(
        `SELECT s.user_id AS student_user_id, s.first_name, s.last_name, n.user_id AS nurse_user_id
         FROM students s
         LEFT JOIN nurses n ON n.nurse_id = ?
         WHERE s.student_id = ?`,
        [nurse_id, student_id]
      );

      const [parentRows] = await pool.query(
        `SELECT p.user_id 
         FROM parents p
         INNER JOIN parent_student_mapping psm ON p.parent_id = psm.parent_id
         WHERE psm.student_id = ?`,
        [student_id]
      );

      const sender_id = studentRows[0]?.nurse_user_id || null;
      const student_user_id = studentRows[0]?.student_user_id;
      const studentName = studentRows[0] ? `${studentRows[0].first_name} ${studentRows[0].last_name}` : 'Your child';
      const parentUserIds = parentRows.map(p => p.user_id).filter(Boolean);

      // Notify Student
      if (student_user_id) {
        await notifyUsers({
          sender_id,
          recipient_ids: [student_user_id],
          title: 'Medicine Dispensed',
          message: `Dispensed ${numericVal} ${dosage_consumption_unit_of_measure} of ${medicineName}.`,
          type: 'MEDICINE_DISPENSE',
          payloadData: { direct_dispense_id, student_id, batch_id }
        });
      }

      // Notify Parents
      if (parentUserIds.length > 0) {
        await notifyUsers({
          sender_id,
          recipient_ids: parentUserIds,
          title: 'Child Medicine Dispensing',
          message: `${studentName} was dispensed ${numericVal} ${dosage_consumption_unit_of_measure} of ${medicineName}.`,
          type: 'MEDICINE_DISPENSE_PARENT',
          payloadData: { direct_dispense_id, student_id, batch_id }
        });
      }
    } catch (notifErr) {
      console.error('Failed to dispatch dispensation notifications:', notifErr);
    }

    res.status(201).json({ 
      success: true, 
      message: 'Transaction posted successfully.', 
      direct_dispense_id: direct_dispense_id,
      updatedStock: newStock,
      updatedVolume: newRemaining 
    });

  } catch (err) {
    await connection.rollback();
    console.error("Dispensation Transaction Error: ", err);
    res.status(500).json({ error: 'Internal system transaction failure processing order.' });
  } finally {
    connection.release();
  }
});

// Helper for Semaphore SMS
const sendSemaphoreSms = async (phoneNumber, message) => {
    const apiKey = process.env.SEMAPHORE_API_KEY;
    const senderName = process.env.SEMAPHORE_SENDER_NAME;

    if (!apiKey) {
        console.warn('[SMS Warning] SEMAPHORE_API_KEY is not defined in environment variables.');
        return false;
    }

    try {
        const payload = new URLSearchParams({
            apikey: apiKey,
            number: phoneNumber,
            message: message
        });

        if (senderName) {
            payload.append('sendername', senderName);
        }

        const response = await fetch('https://api.semaphore.co/api/v4/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: payload.toString()
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`[SMS Success] Sent to ${phoneNumber}:`, data);
            return true;
        } else {
            console.error(`[SMS Error] Failed to send to ${phoneNumber}:`, data);
            return false;
        }
    } catch (error) {
        console.error(`[SMS Exception] Semaphore API Error for ${phoneNumber}:`, error.message);
        return false;
    }
};

// GET: Search students
app.get('/api/students/search', async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json([]);
    try {
        const sql = `
            SELECT student_id, first_name, last_name, program_id, year_level 
            FROM students 
            WHERE student_id LIKE ? OR first_name LIKE ? OR last_name LIKE ?
            LIMIT 10
        `;
        const searchVal = `%${query}%`;
        const [rows] = await pool.execute(sql, [searchVal, searchVal, searchVal]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to search students" });
    }
});

// GET: Retrieve all active chief complaints
app.get('/api/chief-complaints', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT complaint_id, complaint_name FROM chief_complaints');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch chief complaints" });
    }
});

// GET: Retrieve available medicine batches
app.get('/api/medicines/batches', async (req, res) => {
    try {
        const sql = `
            SELECT 
                b.batch_id, 
                b.medicine_id, 
                CONCAT(m.brand_name, ' (', m.generic_name, ')') AS medicine_name, 
                b.expiration_date, 
                b.current_stock,
                b.remaining_volume,
                m.dosage_form,
                m.strength_unit_value,
                m.strength_unit_of_measure,
                m.dispense_limit,
                m.dispense_unit_of_measure,
                (SELECT GROUP_CONCAT(DISTINCT mi.complaint_id SEPARATOR ',')
                   FROM medicine_indications mi
                  WHERE mi.medicine_id = m.medicine_id) AS complaint_ids
            FROM medicine_inventory_batches b
            JOIN medicines m ON b.medicine_id = m.medicine_id
            WHERE b.current_stock > 0 AND b.expiration_date >= CURDATE()
            ORDER BY b.expiration_date ASC
        `;
        const [rows] = await pool.execute(sql);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch medicine batches" });
    }
});



//VisitLogConsultation api
// GET: Search students by query (Include user account active status)
app.get('/api/students/search-visit', async (req, res) => {
    const { query } = req.query;
    if (!query || !query.trim()) {
        return res.json([]);
    }

    try {
        const searchTerm = `%${query.trim()}%`;
        const sql = `
            SELECT 
                s.student_id,
                s.user_id,
                s.first_name,
                s.last_name,
                s.program_id,
                s.year_level,
                s.section,
                u.is_active
            FROM students s
            JOIN users u ON s.user_id = u.user_id
            WHERE s.student_id LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ?
        `;
        const [rows] = await pool.execute(sql, [searchTerm, searchTerm, searchTerm]);
        res.json(rows);
    } catch (error) {
        console.error("Error searching students:", error);
        res.status(500).json({ error: "Failed to search students" });
    }
});

// GET: Retrieve history of all clinic visits (Latest Check-In First)
app.get('/api/clinic-visits', async (req, res) => {
    try {
        const sql = `
            SELECT 
                cv.*, 
                s.first_name, s.last_name, s.program_id, s.year_level, 
                cc.complaint_name,
                cd.batch_id, cd.dosage_consumption_unit_value, cd.dosage_consumption_unit_of_measure, cd.dispensed_at,
                CONCAT(m.brand_name, ' (', m.generic_name, ')') AS medicine_name
            FROM clinic_visits cv
            JOIN students s ON cv.student_id = s.student_id
            LEFT JOIN chief_complaints cc ON cv.complaint_id = cc.complaint_id
            LEFT JOIN consultation_dispensation cd ON cv.visit_id = cd.visit_id
            LEFT JOIN medicine_inventory_batches mib ON cd.batch_id = mib.batch_id
            LEFT JOIN medicines m ON mib.medicine_id = m.medicine_id
            ORDER BY cv.visit_date DESC, cv.time_in DESC, cv.visit_id DESC
        `;
        const [rows] = await pool.execute(sql);
        res.json(rows);
    } catch (error) {
        console.error("Error fetching clinic visits:", error);
        res.status(500).json({ error: "Failed to fetch clinic visits" });
    }
});

// POST: Add a new Visit Log Consultation
// POST: Add a new Visit Log Consultation
// ==========================================
// CLINIC VISIT API ENDPOINTS
// ==========================================

// Helper function: Convert "HH:mm:ss" or "HH:mm" to 12-hour AM/PM format without seconds
function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${minutes} ${ampm}`;
}

// POST: Add a new Visit Log Consultation
app.post('/api/clinic-visits', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const {
            student_id,
            nurse_id,
            complaint_id,
            specify_complaint_text,
            specify_complaints_text,
            visit_date,
            time_in,
            time_out,
            temperature,
            respiratory_rate,
            pulse_rate,
            blood_pressure,
            nursing_intervention,
            assessment,
            batch_id,
            dosage_consumption_unit_value,
            dosage_consumption_unit_of_measure
        } = req.body;

        const specifyText = specify_complaint_text || specify_complaints_text || null;

        const [activeVisits] = await connection.execute(
            `SELECT visit_id FROM clinic_visits 
             WHERE student_id = ? AND visit_date = ? AND (time_out IS NULL OR time_out = '') 
             FOR UPDATE`,
            [student_id, visit_date]
        );

        if (activeVisits.length > 0) {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                error: "Student currently has an active, untimed-out clinic visit for today." 
            });
        }

        // Generate Custom Sequential Visit ID (VISIT-MMDDYYXXX)
        const [yearStr, monthStr, dayStr] = visit_date.split('-');
        const datePrefix = `${monthStr}${dayStr}${yearStr.slice(-2)}`;

        const [countRows] = await connection.execute(
            `SELECT COUNT(*) AS totalToday FROM clinic_visits WHERE visit_date = ? FOR UPDATE`,
            [visit_date]
        );

        const sequenceNum = String(countRows[0].totalToday + 1).padStart(3, '0');
        const visit_id = `VISIT-${datePrefix}${sequenceNum}`;

        const visitSql = `
            INSERT INTO clinic_visits (
                visit_id, student_id, nurse_id, complaint_id, specify_complaint_text, visit_date, 
                time_in, time_out, temperature, respiratory_rate, pulse_rate, 
                blood_pressure, nursing_intervention, assessment
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.execute(visitSql, [
            visit_id, student_id, nurse_id || null, complaint_id || null, specifyText, visit_date,
            time_in || null, time_out || null, temperature || null, respiratory_rate || null,
            pulse_rate || null, blood_pressure || null, nursing_intervention || null, assessment || null
        ]);

        // Medicine Dispensation
        if (batch_id && dosage_consumption_unit_value) {
            const numericVal = parseInt(dosage_consumption_unit_value, 10);

            if (isNaN(numericVal) || numericVal <= 0) {
                throw new Error('Dosage value must be a whole integer greater than zero.');
            }

            const volumeUnits = ['mg', 'g', 'mcg', 'mL', 'L', 'pcs.'];
            const usesVolume = volumeUnits.includes(dosage_consumption_unit_of_measure);

            const [batchRows] = await connection.execute(
                `SELECT mib.current_stock, mib.remaining_volume, mib.expiration_date, m.strength_unit_value 
                 FROM medicine_inventory_batches mib 
                 JOIN medicines m ON mib.medicine_id = m.medicine_id 
                 WHERE mib.batch_id = ? FOR UPDATE`,
                [batch_id]
            );

            if (batchRows.length === 0) throw new Error("Target medicine batch not found.");

            let currentStock = parseInt(batchRows[0].current_stock, 10);
            let remainingVolume = parseFloat(batchRows[0].remaining_volume);
            const strengthUnitVal = parseFloat(batchRows[0].strength_unit_value);
            const expirationDate = new Date(batchRows[0].expiration_date);

            if (expirationDate < new Date()) {
                throw new Error("Cannot dispense medicine from an expired batch.");
            }

            if (usesVolume) {
                const totalAvailableVolume = currentStock > 0 
                    ? remainingVolume + (currentStock - 1) * strengthUnitVal 
                    : 0;

                if (numericVal > totalAvailableVolume) {
                    throw new Error(`Insufficient quantity. Requested ${numericVal} ${dosage_consumption_unit_of_measure}, but total available is ${totalAvailableVolume} ${dosage_consumption_unit_of_measure}.`);
                }

                let newRemaining = remainingVolume - numericVal;
                let newStock = currentStock;

                while (newRemaining <= 0 && newStock > 0) {
                    newStock -= 1;
                    if (newRemaining === 0) {
                        if (newStock >= 1) newRemaining = strengthUnitVal;
                        break;
                    } else {
                        if (newStock >= 1) newRemaining = strengthUnitVal + newRemaining;
                        else { newRemaining = 0; break; }
                    }
                }

                await connection.execute(
                    'UPDATE medicine_inventory_batches SET current_stock = ?, remaining_volume = ? WHERE batch_id = ?',
                    [newStock, newRemaining, batch_id]
                );
            } else {
                if (numericVal > currentStock) {
                    throw new Error(`Insufficient stock quantity. Requested ${numericVal}, but only ${currentStock} left.`);
                }
                await connection.execute(
                    'UPDATE medicine_inventory_batches SET current_stock = current_stock - ? WHERE batch_id = ?',
                    [numericVal, batch_id]
                );
            }

            // Generate Custom Sequential Consultation Dispensation ID (DISP-MMDDYYXXX)
            const now = new Date();
            const dispMonthStr = String(now.getMonth() + 1).padStart(2, '0');
            const dispDayStr = String(now.getDate()).padStart(2, '0');
            const dispYearStr = String(now.getFullYear()).slice(-2);
            const dispDatePrefix = `${dispMonthStr}${dispDayStr}${dispYearStr}`;

            const [dispCountRows] = await connection.execute(
                `SELECT COUNT(*) AS totalToday FROM consultation_dispensation WHERE DATE(dispensed_at) = CURDATE() FOR UPDATE`
            );
            const dispSeq = String(dispCountRows[0].totalToday + 1).padStart(3, '0');
            const dispensation_id = `DISP-${dispDatePrefix}${dispSeq}`;

            await connection.execute(
                `INSERT INTO consultation_dispensation 
                 (consultation_dispense_id, visit_id, batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at) 
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [dispensation_id, visit_id, batch_id, numericVal, dosage_consumption_unit_of_measure]
            );
        }

        await connection.commit();

        // --- System, Push, and PhilSMS Notification Logic (Time In) ---
        // Runs after commit so the DB locks held above are released before
        // we wait on the (unbounded) outbound SMS/push network calls.
        let smsNotificationSent = false;
        try {
            const detailsSql = `
                SELECT
                    s.user_id AS student_user_id,
                    s.first_name AS student_first_name,
                    s.last_name AS student_last_name,
                    p.user_id AS parent_user_id,
                    p.primary_phone,
                    n.user_id AS nurse_user_id,
                    cv.time_in
                FROM clinic_visits cv
                JOIN students s ON cv.student_id = s.student_id
                LEFT JOIN nurses n ON cv.nurse_id = n.nurse_id
                LEFT JOIN parent_student_mapping psm ON s.student_id = psm.student_id
                LEFT JOIN parents p ON psm.parent_id = p.parent_id
                WHERE cv.visit_id = ?
            `;

            const [detailsRows] = await connection.execute(detailsSql, [visit_id]);

            if (detailsRows.length > 0) {
                const info = detailsRows[0];
                const studentFullName = `${info.student_first_name} ${info.student_last_name}`;

                const formattedTimeIn = formatTime(info.time_in);
                const notifMessage = `${studentFullName} visited the clinic at ${formattedTimeIn}.`;
                const notifTitle = `Clinic Visit: ${studentFullName}`;

                const recipient_ids = [info.parent_user_id, info.student_user_id].filter(Boolean);

                await notifyUsers({
                    sender_id: info.nurse_user_id || null,
                    recipient_ids: recipient_ids,
                    title: notifTitle,
                    message: notifMessage,
                    type: 'clinic_visit',
                    payloadData: { visit_id }
                });

                if (info.primary_phone) {
                    const formattedPhone = formatPhoneNumber(info.primary_phone);
                    if (formattedPhone) {
                        const smsResult = await sendPhilSms(formattedPhone, notifMessage);
                        smsNotificationSent = smsResult.success;
                    }
                }
            }
        } catch (notifError) {
            console.error('[Notification Error] System/Push/SMS failed:', notifError.message);
        }

        res.status(201).json({
            success: true,
            message: "Consultation logged and notifications processed!",
            visit_id: visit_id,
            smsSent: smsNotificationSent
        });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(400).json({ success: false, error: error.message || "Failed to log consultation" });
    } finally {
        connection.release();
    }
});


// PATCH: Edit / Update Time Out field ONLY
app.patch('/api/clinic-visits/:id/timeout', async (req, res) => {
    const { id } = req.params;
    const { time_out } = req.body;

    if (!time_out) {
        return res.status(400).json({ success: false, error: "Time Out is required" });
    }

    try {
        const [rows] = await pool.execute('SELECT time_out FROM clinic_visits WHERE visit_id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: "Visit record not found" });
        }

        if (rows[0].time_out !== null && rows[0].time_out !== '') {
            return res.status(400).json({ success: false, error: "Once 'Time Out' is set, it cannot be modified." });
        }

        await pool.execute('UPDATE clinic_visits SET time_out = ? WHERE visit_id = ?', [time_out, id]);

        // --- System, Push & PhilSMS Notification Logic (Time Out) ---
        let smsNotificationSent = false;
        try {
            const notifSql = `
                SELECT 
                    s.user_id AS student_user_id,
                    s.first_name AS student_first_name,
                    s.last_name AS student_last_name,
                    p.user_id AS parent_user_id,
                    p.primary_phone,
                    n.user_id AS nurse_user_id
                FROM clinic_visits cv
                JOIN students s ON cv.student_id = s.student_id
                LEFT JOIN nurses n ON cv.nurse_id = n.nurse_id
                LEFT JOIN parent_student_mapping psm ON s.student_id = psm.student_id
                LEFT JOIN parents p ON psm.parent_id = p.parent_id
                WHERE cv.visit_id = ?
            `;
            const [notifRows] = await pool.execute(notifSql, [id]);

            if (notifRows.length > 0) {
                const info = notifRows[0];
                const studentFullName = `${info.student_first_name} ${info.student_last_name}`;

                const formattedTimeOut = formatTime(time_out);
                const notifMessage = `${studentFullName} left the clinic at ${formattedTimeOut}.`;
                const notifTitle = `Clinic Time Out: ${studentFullName}`;

                await notifyUsers({
                    sender_id: info.nurse_user_id || null,
                    recipient_ids: [info.parent_user_id, info.student_user_id].filter(Boolean),
                    title: notifTitle,
                    message: notifMessage,
                    type: 'clinic_timeout',
                    payloadData: { visit_id: id, time_out }
                });

                if (info.primary_phone) {
                    const formattedPhone = formatPhoneNumber(info.primary_phone);
                    if (formattedPhone) {
                        const smsResult = await sendPhilSms(formattedPhone, notifMessage);
                        smsNotificationSent = smsResult.success;
                    }
                }
            }
        } catch (notifError) {
            console.error('[Notification Error] Time out notification failed:', notifError.message);
        }

        res.json({ success: true, message: "Time out updated successfully!", smsSent: smsNotificationSent });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update time out" });
    }
});


// PUT: Update visit documentation and process dispensation
app.put('/api/clinic-visits/:id', async (req, res) => {
    const { id } = req.params;
    const {
        time_in,
        time_out,
        complaint_id,
        specify_complaint_text,
        specify_complaints_text,
        temperature,
        respiratory_rate,
        pulse_rate,
        blood_pressure,
        nursing_intervention,
        assessment,
        batch_id,
        dosage_consumption_unit_value,
        dosage_consumption_unit_of_measure
    } = req.body;

    const specifyText = specify_complaint_text || specify_complaints_text || null;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const visitQuery = `
            UPDATE clinic_visits 
            SET 
                time_in = COALESCE(?, time_in),
                time_out = ?,
                complaint_id = ?,
                specify_complaint_text = ?,
                temperature = ?,
                respiratory_rate = ?,
                pulse_rate = ?,
                blood_pressure = ?,
                nursing_intervention = ?,
                assessment = ?
            WHERE visit_id = ?
        `;

        await connection.execute(visitQuery, [
            time_in,
            time_out || null,
            complaint_id || null,
            specifyText,
            temperature || null,
            respiratory_rate || null,
            pulse_rate || null,
            blood_pressure || null,
            nursing_intervention || null,
            assessment || null,
            id
        ]);

        if (batch_id && dosage_consumption_unit_value) {
            const numericVal = parseInt(dosage_consumption_unit_value, 10);

            if (isNaN(numericVal) || numericVal <= 0) {
                throw new Error('Dosage value must be a whole integer greater than zero.');
            }

            const [existingDisp] = await connection.execute(
                `SELECT consultation_dispense_id FROM consultation_dispensation WHERE visit_id = ?`,
                [id]
            );

            if (existingDisp.length === 0) {
                const [batchRows] = await connection.execute(
                    `SELECT mib.medicine_id, mib.current_stock, mib.remaining_volume, mib.expiration_date,
                            m.strength_unit_value, m.strength_unit_of_measure,
                            m.dispense_limit, m.dispense_unit_of_measure
                     FROM medicine_inventory_batches mib
                     JOIN medicines m ON mib.medicine_id = m.medicine_id
                     WHERE mib.batch_id = ? FOR UPDATE`,
                    [batch_id]
                );

                if (batchRows.length === 0) throw new Error("Target medicine batch not found.");

                let currentStock = parseInt(batchRows[0].current_stock, 10);
                let remainingVolume = parseFloat(batchRows[0].remaining_volume);
                const strengthUnitVal = parseFloat(batchRows[0].strength_unit_value);
                const strengthUnitMeasure = batchRows[0].strength_unit_of_measure;
                const expirationDate = new Date(batchRows[0].expiration_date);

                // The medicine's own dispense unit/limit is authoritative, not the client's.
                const dispenseUnit = batchRows[0].dispense_unit_of_measure;
                const dispenseLimit = parseFloat(batchRows[0].dispense_limit) || 0;
                const usesVolume = !isDiscreteDispenseUnit(dispenseUnit);

                if (expirationDate < new Date()) {
                    throw new Error("Cannot dispense medicine from an expired batch.");
                }

                if (!complaint_id || !(await isMedicineLinkedToComplaint(connection, batchRows[0].medicine_id, complaint_id))) {
                    throw new Error("Selected medicine is not indicated for the selected medical condition.");
                }

                if (dosage_consumption_unit_of_measure !== dispenseUnit) {
                    throw new Error(`This medicine must be dispensed in ${dispenseUnit}.`);
                }

                if (dispenseLimit > 0 && numericVal > dispenseLimit) {
                    throw new Error(`Dispense limit exceeded. Maximum is ${dispenseLimit} ${dispenseUnit} per dispensation.`);
                }

                if (usesVolume) {
                    const totalAvailableVolume = currentStock > 0 
                        ? remainingVolume + (currentStock - 1) * strengthUnitVal 
                        : 0;

                    const requestedInBatchUnit = convertUnit(numericVal, dispenseUnit, strengthUnitMeasure);

                    if (requestedInBatchUnit > totalAvailableVolume) {
                        const availableInDispenseUnit = convertUnit(totalAvailableVolume, strengthUnitMeasure, dispenseUnit);
                        throw new Error(`Insufficient quantity. Requested ${numericVal} ${dispenseUnit}, but total available is ${availableInDispenseUnit.toFixed(2)} ${dispenseUnit}.`);
                    }

                    let newRemaining = remainingVolume - requestedInBatchUnit;
                    let newStock = currentStock;

                    while (newRemaining <= 0 && newStock > 0) {
                        newStock -= 1;
                        if (newRemaining === 0) {
                            if (newStock >= 1) newRemaining = strengthUnitVal;
                            break;
                        } else {
                            if (newStock >= 1) newRemaining = strengthUnitVal + newRemaining;
                            else { newRemaining = 0; break; }
                        }
                    }

                    await connection.execute(
                        'UPDATE medicine_inventory_batches SET current_stock = ?, remaining_volume = ? WHERE batch_id = ?',
                        [newStock, newRemaining, batch_id]
                    );
                } else {
                    if (numericVal > currentStock) {
                        throw new Error(`Insufficient stock quantity. Requested ${numericVal}, but only ${currentStock} left.`);
                    }
                    await connection.execute(
                        'UPDATE medicine_inventory_batches SET current_stock = current_stock - ? WHERE batch_id = ?',
                        [numericVal, batch_id]
                    );
                }

                // Generate Custom Sequential Consultation Dispensation ID (DISP-MMDDYYXXX)
                const now = new Date();
                const dispMonthStr = String(now.getMonth() + 1).padStart(2, '0');
                const dispDayStr = String(now.getDate()).padStart(2, '0');
                const dispYearStr = String(now.getFullYear()).slice(-2);
                const dispDatePrefix = `${dispMonthStr}${dispDayStr}${dispYearStr}`;

                const [dispCountRows] = await connection.execute(
                    `SELECT COUNT(*) AS totalToday FROM consultation_dispensation WHERE DATE(dispensed_at) = CURDATE() FOR UPDATE`
                );
                const dispSeq = String(dispCountRows[0].totalToday + 1).padStart(3, '0');
                const dispensation_id = `DISP-${dispDatePrefix}${dispSeq}`;

                await connection.execute(
                    `INSERT INTO consultation_dispensation 
                     (consultation_dispense_id, visit_id, batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at) 
                     VALUES (?, ?, ?, ?, ?, NOW())`,
                    [dispensation_id, id, batch_id, numericVal, dispenseUnit]
                );
            }
        }

        await connection.commit();

        // --- System, Push & PhilSMS Notification Logic (Document) ---
        // Runs after commit so the DB locks held above are released before
        // we wait on the (unbounded) outbound SMS/push network calls.
        let smsNotificationSent = false;
        try {
            const detailsSql = `
                SELECT
                    s.user_id AS student_user_id,
                    s.first_name AS student_first_name,
                    s.last_name AS student_last_name,
                    p.user_id AS parent_user_id,
                    p.primary_phone,
                    n.user_id AS nurse_user_id,
                    cc.complaint_name,
                    cv.specify_complaint_text,
                    cv.assessment,
                    m.brand_name AS medicine_name,
                    cd.dosage_consumption_unit_value,
                    cd.dosage_consumption_unit_of_measure
                FROM clinic_visits cv
                JOIN students s ON cv.student_id = s.student_id
                LEFT JOIN nurses n ON cv.nurse_id = n.nurse_id
                LEFT JOIN parent_student_mapping psm ON s.student_id = psm.student_id
                LEFT JOIN parents p ON psm.parent_id = p.parent_id
                LEFT JOIN chief_complaints cc ON cv.complaint_id = cc.complaint_id
                LEFT JOIN consultation_dispensation cd ON cv.visit_id = cd.visit_id
                LEFT JOIN medicine_inventory_batches mib ON cd.batch_id = mib.batch_id
                LEFT JOIN medicines m ON mib.medicine_id = m.medicine_id
                WHERE cv.visit_id = ?
            `;

            const [detailsRows] = await connection.execute(detailsSql, [id]);

            if (detailsRows.length > 0) {
                const info = detailsRows[0];
                const studentFullName = `${info.student_first_name} ${info.student_last_name}`;
                const complaintText = info.specify_complaint_text || info.complaint_name || 'General Checkup';
                const assessmentText = info.assessment || 'N/A';

                const formattedDosageVal = info.dosage_consumption_unit_value
                    ? Math.round(info.dosage_consumption_unit_value)
                    : '';

                const medicineText = info.medicine_name
                    ? `${info.medicine_name} (${formattedDosageVal} ${info.dosage_consumption_unit_of_measure || ''})`.trim()
                    : 'None';

                const notifMessage = `${studentFullName} visited the clinic with a medical condition of ${complaintText}. Assessment: ${assessmentText}. Medicine given: ${medicineText}.`;
                const notifTitle = `Clinic Visit Documented: ${studentFullName}`;

                const recipient_ids = [info.parent_user_id, info.student_user_id].filter(Boolean);

                await notifyUsers({
                    sender_id: info.nurse_user_id || null,
                    recipient_ids: recipient_ids,
                    title: notifTitle,
                    message: notifMessage,
                    type: 'clinic_visit_update',
                    payloadData: { visit_id: id }
                });

                if (info.primary_phone) {
                    const formattedPhone = formatPhoneNumber(info.primary_phone);
                    if (formattedPhone) {
                        const smsResult = await sendPhilSms(formattedPhone, notifMessage);
                        smsNotificationSent = smsResult.success;
                    }
                }
            }
        } catch (notifError) {
            console.error('[Notification Error] System/Push/SMS failed:', notifError.message);
        }
        res.status(200).json({ 
            success: true, 
            message: "Visit documentation updated successfully!",
            smsSent: smsNotificationSent
        });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(400).json({ success: false, error: error.message || "Failed to update visit documentation" });
    } finally {
        connection.release();
    }
});

//Health Trends API 
const { format, startOfMonth, endOfMonth, startOfYear, endOfYear } = require('date-fns');

// ==========================================
// UNIFIED HELPER FUNCTIONS (Single Source of Truth)
// ==========================================

// Standardized Date Formatter
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Unit Helpers
function toBaseValue(value, unit) {
  const val = parseFloat(value) || 0;
  switch ((unit || '').toLowerCase().trim()) {
    case 'g':
    case 'l':
      return val * 1000;
    case 'mcg':
      return val / 1000;
    default:
      return val;
  }
}

// Inverse of toBaseValue: converts a base value (mg / mL) into the given measured unit.
function fromBaseValue(baseVal, unit) {
  switch ((unit || '').toLowerCase().trim()) {
    case 'g':
    case 'l':
      return baseVal / 1000;
    case 'mcg':
      return baseVal * 1000;
    default:
      return baseVal;
  }
}

// Converts a dispensed quantity into the medicine's dispense unit of measure
// (medicines.dispense_unit_of_measure, set in Medicine Inventory) so the dashboard
// charts show the unit the nurse configured. Rows must select dispense_unit, strength_value / strength_unit.
function dispensedInDispenseUnit(row) {
  const qty = parseFloat(row.dosage_consumption_unit_value) || 0;
  const rowUnit = row.dosage_consumption_unit_of_measure;
  const dispenseUnit = row.dispense_unit || rowUnit;
  if (rowUnit === dispenseUnit) return qty;

  // Bridge through the package-strength base unit (mg / mL) for piece <-> measured conversions
  const packageBase = toBaseValue(row.strength_value, row.strength_unit) || 1;
  const baseQty = DISCRETE_UNITS.includes(rowUnit) ? qty * packageBase : toBaseValue(qty, rowUnit);
  return DISCRETE_UNITS.includes(dispenseUnit) ? baseQty / packageBase : fromBaseValue(baseQty, dispenseUnit);
}

// Size of one stock container (bottle, box, tablet, ...) expressed in the dispense unit.
function containerStrengthInDispenseUnit(strengthValue, strengthUnit, dispenseUnit) {
  if (DISCRETE_UNITS.includes(dispenseUnit)) return 1;
  return fromBaseValue(toBaseValue(strengthValue, strengthUnit), dispenseUnit) || 1;
}

function getBaseUnitLabel(unit, dosageForm) {
  if (!unit) return dosageForm || 'units';
  const u = unit.toLowerCase().trim();
  if (['g', 'mg', 'mcg'].includes(u)) return 'mg';
  if (['l', 'ml'].includes(u)) return 'mL';
  return unit;
}

// Label shown on the charts: the dispense unit, falling back to the strength base unit.
function getDispenseUnitLabel(dispenseUnit, strengthUnit, dosageForm) {
  return dispenseUnit || getBaseUnitLabel(strengthUnit, dosageForm);
}

// Decimal places kept per dispense unit: pieces are whole numbers, g / L need finer precision.
function dispenseUnitDecimals(unit) {
  if (!unit || DISCRETE_UNITS.includes(unit)) return 0;
  return ['g', 'l'].includes(unit.toLowerCase().trim()) ? 3 : 2;
}

// Daily dispense history (in each medicine's dispense unit) for the 30 days ending on anchorStr (YYYY-MM-DD).
// Single source of truth for both the Medicine Dispensed Overview "Last 30 Days" view
// and the Predictive Medicine Demand forecast.
// days[0] = anchor day (newest) ... days[29] = oldest; per-medicine arrays use the same order.
async function getDailyDispenseHistory(anchorStr) {
  const anchorDate = new Date(`${anchorStr}T00:00:00Z`);
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(anchorDate.getTime());
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().slice(0, 10);
  });
  const dayIndex = {};
  days.forEach((d, i) => { dayIndex[d] = i; });

  const [rows] = await pool.query(`
    SELECT
      m.medicine_id,
      CONCAT(m.generic_name, ' (', m.brand_name, ')') AS medicine_name,
      DATE_FORMAT(d.dispensed_at, '%Y-%m-%d') AS dispensed_day,
      d.dosage_consumption_unit_value,
      d.dosage_consumption_unit_of_measure,
      m.dispense_unit_of_measure AS dispense_unit,
      m.strength_unit_value AS strength_value,
      m.strength_unit_of_measure AS strength_unit
    FROM (
      SELECT batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at FROM consultation_dispensation
      UNION ALL
      SELECT batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at FROM direct_dispensation
    ) d
    JOIN medicine_inventory_batches mib ON d.batch_id = mib.batch_id
    JOIN medicines m ON mib.medicine_id = m.medicine_id
    WHERE d.dispensed_at BETWEEN ? AND ?
  `, [`${days[29]} 00:00:00`, `${days[0]} 23:59:59`]);

  const byMedicineId = {};
  const byMedicineName = {};
  rows.forEach(row => {
    const idx = dayIndex[row.dispensed_day];
    if (idx === undefined) return;
    const val = dispensedInDispenseUnit(row);
    if (!byMedicineId[row.medicine_id]) byMedicineId[row.medicine_id] = new Array(30).fill(0);
    if (!byMedicineName[row.medicine_name]) byMedicineName[row.medicine_name] = new Array(30).fill(0);
    byMedicineId[row.medicine_id][idx] += val;
    byMedicineName[row.medicine_name][idx] += val;
  });
  return { days, byMedicineId, byMedicineName };
}

// Calculate dynamic baseline average date range (Jan 1 to last day of previous completed month)
function getAverageDateWindow(referenceDate = new Date()) {
  const realTimeDate = new Date();
  
  // Cap target date to real-time date to prevent future month calculations
  const evalDate = referenceDate > realTimeDate ? realTimeDate : referenceDate;
  const year = evalDate.getFullYear();
  const month = evalDate.getMonth(); // 0-indexed (Jan = 0, Feb = 1, etc.)

  let avgStartDate, avgEndDate, avgDivisor, averagesLabel;
  const fullMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (month === 0) {
    // January: Use full previous year (12 full months)
    const prevYear = year - 1;
    avgStartDate = `${prevYear}-01-01`;
    avgEndDate = `${prevYear}-12-31`;
    avgDivisor = 12;
    averagesLabel = `Average per Month (January to December ${prevYear})`;
  } else if (month === 1) {
    // February: Use January of current year (1 full month)
    avgStartDate = `${year}-01-01`;
    avgEndDate = `${year}-01-31`;
    avgDivisor = 1;
    averagesLabel = `Average per Month (January ${year})`;
  } else {
    // March to December: Jan 1 to last day of previous month of current year
    avgStartDate = `${year}-01-01`;
    const lastDayOfPreviousMonth = new Date(year, month, 0);
    avgEndDate = formatDate(lastDayOfPreviousMonth);
    avgDivisor = month;
    averagesLabel = `Average per Month (January to ${fullMonthNames[month - 1]} ${year})`;
  }

  return { avgStartDate, avgEndDate, avgDivisor, averagesLabel };
}


// ==========================================
// API ENDPOINTS
// ==========================================

// ==========================================
// HEALTH TRENDS, ILLNESS SUMMARY
// ==========================================
// Every clinic visit is counted (a student who comes three times for a cough is three cases) and the number of
// DISTINCT students is shown next to it. Doctor-visit diagnoses are added as a second source of health issues.
// There is no lab results table yet, so lab-based conditions cannot be included.

const TREND_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TREND_MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const NO_FINDING_DIAGNOSIS = /^(no |normal|none|n\/a|nil|not applicable|no significant)/i;

const pad2 = (n) => String(n).padStart(2, '0');
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12

// Builds the buckets (day / week / month) of a period. Each bucket: { name, start, end } (inclusive dates).
function buildTrendBuckets(granularity, year, month) {
  if (granularity === 'monthly') {
    return TREND_MONTHS.map((name, i) => ({
      name, start: `${year}-${pad2(i + 1)}-01`, end: `${year}-${pad2(i + 1)}-${pad2(daysInMonth(year, i + 1))}`
    }));
  }
  const last = daysInMonth(year, month);
  if (granularity === 'daily') {
    return Array.from({ length: last }, (_, i) => {
      const d = `${year}-${pad2(month)}-${pad2(i + 1)}`;
      return { name: String(i + 1), start: d, end: d };
    });
  }
  // weekly: Monday to Sunday weeks, clipped to the month
  const buckets = [];
  let startDay = 1;
  while (startDay <= last) {
    const startStr = `${year}-${pad2(month)}-${pad2(startDay)}`;
    const dow = dayOfWeekOf(startStr); // 0 = Sunday
    const daysToSunday = dow === 0 ? 0 : 7 - dow;
    const endDay = Math.min(startDay + daysToSunday, last);
    buckets.push({
      name: `W${buckets.length + 1} (${TREND_MONTHS[month - 1]}${month === 5 ? '' : '.'} ${startDay}-${endDay})`,
      start: startStr,
      end: `${year}-${pad2(month)}-${pad2(endDay)}`
    });
    startDay = endDay + 1;
  }
  return buckets;
}

// Buckets of a custom From -> To window (YYYY-MM-DD strings): one per day up to 31 days, otherwise one per month.
// The first and last bucket are clipped to the window.
function buildRangeBuckets(fromStr, toStr) {
  const toUtc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const fromMs = toUtc(fromStr);
  const toMs = toUtc(toStr);
  const dayCount = Math.round((toMs - fromMs) / 86400000) + 1;
  const fmt = (ms) => new Date(ms).toISOString().slice(0, 10);

  if (dayCount <= 31) {
    return Array.from({ length: dayCount }, (_, i) => {
      const d = fmt(fromMs + i * 86400000);
      const [, m, day] = d.split('-').map(Number);
      return { name: `${TREND_MONTHS[m - 1]} ${day}`, start: d, end: d };
    });
  }

  const buckets = [];
  let [y, m] = fromStr.split('-').map(Number);
  const [endY, endM] = toStr.split('-').map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    const monthStart = `${y}-${pad2(m)}-01`;
    const monthEnd = `${y}-${pad2(m)}-${pad2(daysInMonth(y, m))}`;
    buckets.push({
      name: `${TREND_MONTHS[m - 1]} ${y}`,
      start: monthStart < fromStr ? fromStr : monthStart,
      end: monthEnd > toStr ? toStr : monthEnd
    });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return buckets;
}

// Doctor diagnoses of a period grouped by (normalized) name: [{ name, count, students }]
async function getDoctorDiagnosisCounts(startStr, endStr) {
  const [rows] = await pool.query(
    `SELECT TRIM(a.diagnosis) AS diagnosis, COUNT(*) AS cnt, COUNT(DISTINCT a.student_id) AS students
     FROM doctor_assessments a
     WHERE DATE(a.assessment_date) BETWEEN ? AND ? AND a.diagnosis IS NOT NULL AND TRIM(a.diagnosis) <> ''
     GROUP BY LOWER(TRIM(a.diagnosis)), TRIM(a.diagnosis)`,
    [startStr, endStr]
  );
  const merged = new Map();
  rows.forEach((r) => {
    if (NO_FINDING_DIAGNOSIS.test(r.diagnosis)) return;
    let name = r.diagnosis.length > 80 ? `${r.diagnosis.slice(0, 77)}...` : r.diagnosis;
    name = name.charAt(0).toUpperCase() + name.slice(1);
    const key = name.toLowerCase();
    const prev = merged.get(key) || { name, count: 0, students: 0 };
    prev.count += Number(r.cnt);
    prev.students += Number(r.students);
    merged.set(key, prev);
  });
  return [...merged.values()];
}

// Clinic-visit conditions of a period: [{ name, count, students }]
async function getClinicConditionCounts(startStr, endStr) {
  const [rows] = await pool.query(
    `SELECT cc.complaint_name AS name, COUNT(*) AS cnt, COUNT(DISTINCT cv.student_id) AS students
     FROM clinic_visits cv JOIN chief_complaints cc ON cv.complaint_id = cc.complaint_id
     WHERE cv.visit_date BETWEEN ? AND ?
     GROUP BY cc.complaint_id, cc.complaint_name`,
    [startStr, endStr]
  );
  return rows.map((r) => ({ name: r.name.trim(), count: Number(r.cnt), students: Number(r.students) }));
}

// Combined ranking of health issues from both sources, with the share of all cases
async function getTopConditions(startStr, endStr) {
  const [clinic, doctor] = await Promise.all([getClinicConditionCounts(startStr, endStr), getDoctorDiagnosisCounts(startStr, endStr)]);
  const all = [
    ...clinic.map((c) => ({ ...c, source: 'Clinic visits' })),
    ...doctor.map((c) => ({ ...c, source: 'Doctor visits' }))
  ].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const total = all.reduce((sum, c) => sum + c.count, 0);
  return { total, conditions: all.map((c) => ({ ...c, percent: total > 0 ? Math.round((c.count / total) * 1000) / 10 : 0 })) };
}

// 1. Health Trends API: ?granularity=daily|weekly|monthly&date=YYYY-MM-DD (or YYYY-MM / YYYY)
//    daily and weekly show one month; monthly shows one year. The old filterType values still work.
app.get('/api/health-trends', async (req, res) => {
  try {
    const legacy = { current: 'weekly', weekly: 'weekly', yearly: 'monthly' };
    const granularity = req.query.granularity || legacy[req.query.filterType] || 'weekly';
    if (!['daily', 'weekly', 'monthly', 'range'].includes(granularity)) {
      return res.status(400).json({ error: 'granularity must be daily, weekly, monthly or range.' });
    }

    const today = todayManilaStr();
    let [year, month] = today.split('-').map(Number);
    const rawDate = String(req.query.date || '');
    if (/^\d{4}(-\d{2})?(-\d{2})?$/.test(rawDate)) {
      const parts = rawDate.split('-').map(Number);
      year = parts[0];
      if (parts[1] >= 1 && parts[1] <= 12) month = parts[1];
      else if (parts.length === 1) month = 1;
    }
    // the "current" legacy mode always meant today
    if (req.query.filterType === 'current' && !req.query.granularity) [year, month] = today.split('-').map(Number);

    let rangeFrom = null;
    let rangeTo = null;
    if (granularity === 'range') {
      const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(new Date(`${v}T00:00:00Z`).getTime());
      rangeFrom = isDate(req.query.from) ? req.query.from : `${today.slice(0, 7)}-01`;
      rangeTo = isDate(req.query.to) ? req.query.to : today;
      if (rangeFrom > rangeTo) [rangeFrom, rangeTo] = [rangeTo, rangeFrom];
      const spanDays = Math.round((Date.parse(`${rangeTo}T00:00:00Z`) - Date.parse(`${rangeFrom}T00:00:00Z`)) / 86400000) + 1;
      if (spanDays > 3660) {
        return res.status(400).json({ error: 'Date range is too large. Choose a range of 10 years or less.' });
      }
    }

    const buckets = granularity === 'range' ? buildRangeBuckets(rangeFrom, rangeTo) : buildTrendBuckets(granularity, year, month);
    const startStr = buckets[0].start;
    const endStr = buckets[buckets.length - 1].end;

    const [complaints] = await pool.query('SELECT complaint_name FROM chief_complaints ORDER BY complaint_name ASC');
    const complaintNames = complaints.map((c) => c.complaint_name);

    const data = buckets.map((b) => {
      const row = { name: b.name, start: b.start, end: b.end };
      complaintNames.forEach((n) => { row[n] = 0; });
      return row;
    });

    // every visit counts (no de-duplication per student)
    const [visits] = await pool.query(
      `SELECT cc.complaint_name, DATE_FORMAT(cv.visit_date, '%Y-%m-%d') AS d, COUNT(*) AS cnt
       FROM clinic_visits cv JOIN chief_complaints cc ON cv.complaint_id = cc.complaint_id
       WHERE cv.visit_date BETWEEN ? AND ?
       GROUP BY cc.complaint_name, cv.visit_date`,
      [startStr, endStr]
    );
    visits.forEach((v) => {
      const bucket = data.find((b) => v.d >= b.start && v.d <= b.end);
      if (bucket && v.complaint_name in bucket) bucket[v.complaint_name] += Number(v.cnt);
    });

    const rangeIsDaily = granularity === 'range' && buckets.length > 0 && buckets[0].start === buckets[0].end;
    const unit = granularity === 'daily' || rangeIsDaily ? 'day' : granularity === 'weekly' ? 'week' : 'month';
    const periodWord = granularity === 'range'
      ? `${rangeFrom} to ${rangeTo}`
      : granularity === 'monthly' ? `${year}` : `${TREND_MONTHS_LONG[month - 1]} ${year}`;
    const elapsed = Math.max(1, buckets.filter((b) => b.start <= today).length);

    const averages = {};
    complaintNames.forEach((n) => {
      const total = data.reduce((sum, b) => sum + b[n], 0);
      averages[n] = Math.round((total / elapsed) * 10) / 10;
    });

    const top = await getTopConditions(startStr, endStr);

    res.json({
      granularity,
      periodLabel: granularity === 'range'
        ? `Custom Range Overview: ${periodWord}`
        : `${granularity === 'daily' ? 'Daily' : granularity === 'weekly' ? 'Weekly' : 'Monthly'} Overview: ${periodWord}`,
      timelineLabel: granularity === 'range'
        ? `${rangeIsDaily ? 'Day-by-day' : 'Month-by-month'} breakdown of medical conditions from ${periodWord}`
        : granularity === 'monthly'
        ? `Month-by-month breakdown of medical conditions for ${year}`
        : `${granularity === 'daily' ? 'Day-by-day' : 'Week-by-week (Monday to Sunday)'} breakdown of medical conditions for ${periodWord}`,
      averagesLabel: `Average per ${unit} (${periodWord}, ${elapsed} ${unit}${elapsed === 1 ? '' : 's'} so far)`,
      averageUnit: unit,
      complaintsList: complaintNames,
      data,
      averages,
      topConditions: top.conditions,
      totalCases: top.total,
      startDate: startStr,
      endDate: endStr
    });
  } catch (error) {
    console.error('Error fetching health trends:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Illness summary of the last N days (default 30) compared with the N days before
app.get('/api/illness-summary', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 90);
    const endStr = todayManilaStr();
    const startStr = addDaysStr(endStr, -(days - 1));
    const prevEndStr = addDaysStr(startStr, -1);
    const prevStartStr = addDaysStr(prevEndStr, -(days - 1));

    const [current, previous] = await Promise.all([getTopConditions(startStr, endStr), getTopConditions(prevStartStr, prevEndStr)]);
    const prevByKey = new Map(previous.conditions.map((c) => [`${c.source}|${c.name.toLowerCase()}`, c.count]));

    const rows = current.conditions.map((c, i) => {
      const prev = prevByKey.get(`${c.source}|${c.name.toLowerCase()}`) || 0;
      const delta = c.count - prev;
      return {
        rank: i + 1,
        name: c.name,
        source: c.source,
        count: c.count,
        students: c.students,
        percent: c.percent,
        previousCount: prev,
        delta,
        changePercent: prev > 0 ? Math.round((delta / prev) * 100) : null,
        trend: prev === 0 ? 'new' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'
      };
    });

    res.json({
      days,
      period: { start: startStr, end: endStr },
      previousPeriod: { start: prevStartStr, end: prevEndStr },
      total: current.total,
      previousTotal: previous.total,
      changePercent: previous.total > 0 ? Math.round(((current.total - previous.total) / previous.total) * 100) : null,
      rows
    });
  } catch (error) {
    console.error('Error building the illness summary:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// 2. Medicine Dispensed Overview API
app.get('/api/medicine-dispensed-overview', async (req, res) => {
  try {
    // daily = one bar per day of a month, weekly = per week of a month, monthly = per month of a year, range = custom From -> To
    const filterType = req.query.filterType === 'monthly' ? 'yearly' : (req.query.filterType || 'current');
    let targetDate = new Date();

    if (req.query.date) {
      const dateParts = req.query.date.split('-');
      if (dateParts.length === 3) {
        const tempDate = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
        if (!isNaN(tempDate.getTime())) targetDate = tempDate;
      } else if (dateParts.length === 2) {
        const tempDate = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, 1);
        if (!isNaN(tempDate.getTime())) targetDate = tempDate;
      }
    }

    const targetYear = targetDate.getFullYear();

    const [medicines] = await pool.query(`
      SELECT 
        CONCAT(generic_name, ' (', brand_name, ')') AS medicine_name,
        dosage_form,
        strength_unit_of_measure,
        dispense_unit_of_measure AS dispense_unit
      FROM medicines
      ORDER BY generic_name ASC
    `);

    const medicinesList = medicines.map(m => m.medicine_name);
    const medicineUnits = {};
    medicines.forEach(m => {
      medicineUnits[m.medicine_name] = getDispenseUnitLabel(m.dispense_unit, m.strength_unit_of_measure, m.dosage_form);
    });

    let startDate, endDate, periodLabel, timelineLabel = '';
    let graphData = [];
    let averages = {};

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (filterType === 'current' || filterType === 'weekly') {
      startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
      
      const monthFormatted = targetDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      periodLabel = `Weekly Overview: ${monthFormatted}`;
      timelineLabel = `Week-by-week breakdown of medicine dispensations for ${monthFormatted}`;

      const totalDays = endDate.getDate();
      const numWeeks = totalDays > 28 ? 5 : 4;
      const monthAbbr = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'][targetDate.getMonth()];

      for (let i = 1; i <= numWeeks; i++) {
        const startDay = (i - 1) * 7 + 1;
        const endDay = i === numWeeks ? totalDays : i * 7;
        const weekLabel = `W${i} (${monthAbbr} ${startDay}-${endDay})`;

        const monthPrefix = `${targetDate.getFullYear()}-${pad2(targetDate.getMonth() + 1)}`;
        const weekObj = { name: weekLabel, start: `${monthPrefix}-${pad2(startDay)}`, end: `${monthPrefix}-${pad2(endDay)}` };
        medicinesList.forEach(name => { weekObj[name] = 0; });
        graphData.push(weekObj);
      }

      const [dispensations] = await pool.query(`
        SELECT 
          d.dispensed_at,
          CONCAT(m.generic_name, ' (', m.brand_name, ')') AS medicine_name,
          d.dosage_consumption_unit_value,
          d.dosage_consumption_unit_of_measure,
          m.dispense_unit_of_measure AS dispense_unit,
          m.strength_unit_value AS strength_value,
          m.strength_unit_of_measure AS strength_unit
        FROM (
          SELECT batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at FROM consultation_dispensation
          UNION ALL
          SELECT batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at FROM direct_dispensation
        ) d
        JOIN medicine_inventory_batches mib ON d.batch_id = mib.batch_id
        JOIN medicines m ON mib.medicine_id = m.medicine_id
        WHERE d.dispensed_at BETWEEN ? AND ?
      `, [`${formatDate(startDate)} 00:00:00`, `${formatDate(endDate)} 23:59:59`]);

      dispensations.forEach(item => {
        const day = new Date(item.dispensed_at).getDate();
        let weekIndex = Math.floor((day - 1) / 7);
        if (weekIndex >= numWeeks) weekIndex = numWeeks - 1;

        const name = item.medicine_name;
        const baseVal = dispensedInDispenseUnit(item);
        if (graphData[weekIndex] && name in graphData[weekIndex]) {
          graphData[weekIndex][name] = parseFloat((graphData[weekIndex][name] + baseVal).toFixed(3));
        }
      });
    } else if (filterType === 'range' || filterType === 'daily') {
      // Daily: every day of the chosen month. Range: custom From -> To window, one bar per day up to 31 days, otherwise one bar per month.
      const parseRangeDate = (value) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
        if (!m) return null;
        const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
        return isNaN(d.getTime()) ? null : d;
      };
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (filterType === 'daily') {
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
      } else {
        startDate = parseRangeDate(req.query.from) || new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = parseRangeDate(req.query.to) || today;
        if (startDate > endDate) [startDate, endDate] = [endDate, startDate];
      }

      const dayCount = Math.round((endDate - startDate) / 86400000) + 1;
      if (dayCount > 3660) {
        return res.status(400).json({ error: 'Date range is too large. Choose a range of 10 years or less.' });
      }
      const isDaily = dayCount <= 31;
      const rangeText = `${formatDate(startDate)} to ${formatDate(endDate)}`;
      if (filterType === 'daily') {
        const monthFormatted = targetDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        periodLabel = `Daily Overview: ${monthFormatted}`;
        timelineLabel = `Day-by-day breakdown of medicine dispensations for ${monthFormatted}`;
      } else {
        periodLabel = `Custom Range Overview: ${rangeText}`;
        timelineLabel = isDaily
          ? `Day-by-day breakdown of medicine dispensations (${dayCount} day${dayCount === 1 ? '' : 's'})`
          : `Month-by-month breakdown of medicine dispensations (${dayCount} days)`;
      }

      const bucketKeys = [];
      const bucketIndex = {};
      const cursor = isDaily
        ? new Date(startDate)
        : new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (cursor <= endDate) {
        const key = isDaily ? formatDate(cursor) : formatDate(cursor).slice(0, 7);
        const label = isDaily
          ? (filterType === 'daily' ? String(cursor.getDate()) : `${monthNames[cursor.getMonth()]} ${cursor.getDate()}`)
          : `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;
        const bucket = { name: label };
        if (isDaily) {
          bucket.start = key;
          bucket.end = key;
        } else {
          const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
          const monthStartStr = `${key}-01`;
          const monthEndStr = formatDate(monthEnd);
          bucket.start = monthStartStr < formatDate(startDate) ? formatDate(startDate) : monthStartStr;
          bucket.end = monthEndStr > formatDate(endDate) ? formatDate(endDate) : monthEndStr;
        }
        medicinesList.forEach(name => { bucket[name] = 0; });
        bucketIndex[key] = graphData.length;
        graphData.push(bucket);
        bucketKeys.push(key);
        if (isDaily) cursor.setDate(cursor.getDate() + 1);
        else cursor.setMonth(cursor.getMonth() + 1);
      }

      const [dispensations] = await pool.query(`
        SELECT
          d.dispensed_at,
          CONCAT(m.generic_name, ' (', m.brand_name, ')') AS medicine_name,
          d.dosage_consumption_unit_value,
          d.dosage_consumption_unit_of_measure,
          m.dispense_unit_of_measure AS dispense_unit,
          m.strength_unit_value AS strength_value,
          m.strength_unit_of_measure AS strength_unit
        FROM (
          SELECT batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at FROM consultation_dispensation
          UNION ALL
          SELECT batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at FROM direct_dispensation
        ) d
        JOIN medicine_inventory_batches mib ON d.batch_id = mib.batch_id
        JOIN medicines m ON mib.medicine_id = m.medicine_id
        WHERE d.dispensed_at BETWEEN ? AND ?
      `, [`${formatDate(startDate)} 00:00:00`, `${formatDate(endDate)} 23:59:59`]);

      dispensations.forEach(item => {
        const stamp = formatDate(item.dispensed_at);
        const idx = bucketIndex[isDaily ? stamp : stamp.slice(0, 7)];
        const name = item.medicine_name;
        if (idx !== undefined && name in graphData[idx]) {
          graphData[idx][name] = parseFloat((graphData[idx][name] + dispensedInDispenseUnit(item)).toFixed(3));
        }
      });
    } else if (filterType === 'yearly') {
      startDate = new Date(targetYear, 0, 1);
      endDate = new Date(targetYear, 11, 31);
      periodLabel = `Monthly Overview: ${targetYear}`;
      timelineLabel = `Month-by-month breakdown of medicine dispensations for ${targetYear}`;

      for (let i = 0; i < 12; i++) {
        const monthObj = {
          name: monthNames[i],
          start: `${targetYear}-${pad2(i + 1)}-01`,
          end: `${targetYear}-${pad2(i + 1)}-${pad2(daysInMonth(targetYear, i + 1))}`
        };
        medicinesList.forEach(name => { monthObj[name] = 0; });
        graphData.push(monthObj);
      }

      const [dispensations] = await pool.query(`
        SELECT 
          d.dispensed_at,
          CONCAT(m.generic_name, ' (', m.brand_name, ')') AS medicine_name,
          d.dosage_consumption_unit_value,
          d.dosage_consumption_unit_of_measure,
          m.dispense_unit_of_measure AS dispense_unit,
          m.strength_unit_value AS strength_value,
          m.strength_unit_of_measure AS strength_unit
        FROM (
          SELECT batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at FROM consultation_dispensation
          UNION ALL
          SELECT batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at FROM direct_dispensation
        ) d
        JOIN medicine_inventory_batches mib ON d.batch_id = mib.batch_id
        JOIN medicines m ON mib.medicine_id = m.medicine_id
        WHERE d.dispensed_at BETWEEN ? AND ?
      `, [`${formatDate(startDate)} 00:00:00`, `${formatDate(endDate)} 23:59:59`]);

      dispensations.forEach(item => {
        const m = new Date(item.dispensed_at).getMonth();
        const name = item.medicine_name;
        const baseVal = dispensedInDispenseUnit(item);
        if (graphData[m] && name in graphData[m]) {
          graphData[m][name] = parseFloat((graphData[m][name] + baseVal).toFixed(3));
        }
      });
    }

    // Shared Average Date Window
    const { avgStartDate, avgEndDate, avgDivisor, averagesLabel } = getAverageDateWindow(targetDate);

    const avgStartDateTime = `${avgStartDate} 00:00:00`;
    const avgEndDateTime = `${avgEndDate} 23:59:59`;

    const [avgDispenseRows] = await pool.query(`
      SELECT 
        CONCAT(m.generic_name, ' (', m.brand_name, ')') AS medicine_name,
        d.dosage_consumption_unit_value,
        d.dosage_consumption_unit_of_measure,
        m.dispense_unit_of_measure AS dispense_unit,
        m.strength_unit_value AS strength_value,
        m.strength_unit_of_measure AS strength_unit
      FROM (
        SELECT batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at FROM consultation_dispensation
        UNION ALL
        SELECT batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at FROM direct_dispensation
      ) d
      JOIN medicine_inventory_batches mib ON d.batch_id = mib.batch_id
      JOIN medicines m ON mib.medicine_id = m.medicine_id
      WHERE d.dispensed_at BETWEEN ? AND ?
    `, [avgStartDateTime, avgEndDateTime]);

    const totalBaseDispensedMap = {};
    avgDispenseRows.forEach(row => {
      const baseVal = dispensedInDispenseUnit(row);
      const key = row.medicine_name.trim();
      totalBaseDispensedMap[key] = (totalBaseDispensedMap[key] || 0) + baseVal;
    });

    medicinesList.forEach(name => {
      const key = name.trim();
      const totalBase = totalBaseDispensedMap[key] || 0;
      averages[name] = parseFloat((totalBase / avgDivisor).toFixed(2));
    });

    res.json({
      periodLabel,
      timelineLabel,
      averagesLabel,
      medicinesList,
      medicineUnits,
      data: graphData,
      averages: Object.keys(averages).length > 0 ? averages : null
    });

  } catch (error) {
    console.error("Error fetching medicine dispensed overview:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// 3. Predictive Medicine Demand API
// 3. Predictive Medicine Demand API (Dynamic Query-Only Historical Stock)
// 3. Predictive Medicine Demand API (Dynamic Query-Only Historical & Baseline Stock)
// Predictive medicine demand: ONE method, the rolling 30-day forecast.
// History = the last 30 days of dispensing (the same data as the Medicine Dispensed Overview "Last 30 Days" view),
// forecast = the next 30 days, stock = the live usable stock (all batches, expired ones left out).
// There is no monthly baseline any more; the "Predicted Need" (suggestedRestock / suggested_qty) is
//   forecast demand for the next 30 days - current stock (never below 0).
app.get('/api/predictive-medicine', async (req, res) => {
  try {
    const parsedTrend = parseFloat(req.query.trendFactor);
    const trendFactor = Number.isFinite(parsedTrend) ? parsedTrend : 0;

    const medicines = await getMedicineStockStatuses({ includeSeries: true, trendFactor });
    const anchorStr = todayManilaStr();
    const firstDay = medicines.find((m) => m.forecast_days && m.forecast_days.length)?.forecast_days[0]?.targetDate;
    const lastDay = medicines.find((m) => m.forecast_days && m.forecast_days.length)?.forecast_days.slice(-1)[0]?.targetDate;

    const data = medicines.map((m) => ({
      id: m.medicine_id,
      name: m.name,
      dosageForm: m.dosage_form || 'N/A',
      unitOfMeasure: m.unit_label,
      packageStrength: m.package_strength,
      currentStock: m.usable_stock,
      stockUnit: m.dosage_form,
      status: m.status,
      lowStockLevel: m.low_stock_level,
      criticalStockLevel: m.critical_stock_level,
      adequateStockLevel: m.adequate_stock_level,
      // 30-day rolling forecast (history is newest-first: [D_0 ... D_29])
      history: m.history,
      containerStrength: m.container_strength,
      forecast: m.forecast_days,
      forecast30d: m.forecast_30d,
      suggestedRestock: m.suggested_qty,
      toAdequate: m.to_adequate_qty
    }));

    res.json({
      graphTitle: 'Next 30 Days Predictive Medicine Demand Forecast',
      periodLabel: firstDay && lastDay ? `${formatDateManila(firstDay)} - ${formatDateManila(lastDay)}` : '',
      forecastStartDate: anchorStr,
      trendFactor,
      data
    });
  } catch (error) {
    console.error("Error generating predictive medicine data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ==========================================
// MEDICINE STOCK STATUS + AUTOMATED RESTOCK REPORTS
// ==========================================
// One per-medicine source of truth (all batches added together, expired batches left out of the usable stock)
// used by the dashboard alert, the Restock Report page and the automatic notifications.

const EXPIRING_SOON_DAYS = 30;
const STOCK_ALERT_RANK = { 'Out of stock': 3, 'Critical': 2, 'Low': 1 };

const stockStatusOf = (usable, low, critical) => {
  if (usable <= 0) return 'Out of stock';
  if (usable <= critical) return 'Critical';
  if (usable <= low) return 'Low';
  return 'Adequate';
};

// Per-medicine stock status with expiry information, the 30-day forecast demand and a restock suggestion.
async function getMedicineStockStatuses({ includeSeries = false, trendFactor = 0 } = {}) {
  const [rows] = await pool.query(`
    SELECT m.medicine_id, m.generic_name, m.brand_name, m.dosage_form, m.strength_unit_value, m.strength_unit_of_measure,
           m.dispense_unit_of_measure, m.low_stock_level, m.critical_stock_level, m.adequate_stock_level,
           CAST(COALESCE(SUM(b.current_stock), 0) AS SIGNED) AS total_stock,
           CAST(COALESCE(SUM(CASE WHEN b.expiration_date >= CURDATE() THEN b.current_stock ELSE 0 END), 0) AS SIGNED) AS usable_stock,
           CAST(COALESCE(SUM(CASE WHEN b.expiration_date < CURDATE() THEN b.current_stock ELSE 0 END), 0) AS SIGNED) AS expired_stock,
           CAST(COALESCE(SUM(CASE WHEN b.expiration_date >= CURDATE() AND b.expiration_date <= DATE_ADD(CURDATE(), INTERVAL ${EXPIRING_SOON_DAYS} DAY) THEN b.current_stock ELSE 0 END), 0) AS SIGNED) AS expiring_stock,
           MIN(CASE WHEN b.expiration_date >= CURDATE() AND b.current_stock > 0 THEN b.expiration_date END) AS nearest_expiry
    FROM medicines m
    LEFT JOIN medicine_inventory_batches b ON b.medicine_id = m.medicine_id
    GROUP BY m.medicine_id
    ORDER BY m.generic_name ASC, m.brand_name ASC
  `);

  const todayStr = todayManilaStr();
  const { byMedicineId } = await getDailyDispenseHistory(todayStr);

  return rows.map((m) => {
    const usable = Number(m.usable_stock);
    const low = Number(m.low_stock_level);
    const critical = Number(m.critical_stock_level);
    const adequate = Number(m.adequate_stock_level);
    const status = stockStatusOf(usable, low, critical);

    // forecast demand for the next 30 days, converted to stock units (containers of the dosage form)
    const containerStrength = containerStrengthInDispenseUnit(m.strength_unit_value, m.strength_unit_of_measure, m.dispense_unit_of_measure) || 1;
    const history = byMedicineId[m.medicine_id] || new Array(30).fill(0);
    const days = forecastMedicineDemand(history, { startDate: todayStr, trendFactor, decimals: dispenseUnitDecimals(m.dispense_unit_of_measure) });
    const demand = days.reduce((sum, d) => sum + d.phase1_prediction.predictedDemand, 0) / containerStrength;
    const forecast30 = Math.round(demand * 100) / 100;

    // Predicted Need = 30-day forecast - current stock, rounded up from the exact demand (not the 2-decimal display value)
    const suggested = Math.max(0, Math.ceil(parseFloat((demand - usable).toFixed(6))));
    const toAdequate = Math.max(0, adequate - usable);
    const needsAttention = status !== 'Adequate' || Number(m.expired_stock) > 0 || Number(m.expiring_stock) > 0;

    return {
      medicine_id: m.medicine_id,
      generic_name: m.generic_name,
      brand_name: m.brand_name,
      name: `${m.generic_name} (${m.brand_name})`,
      dosage_form: m.dosage_form,
      unit_label: getDispenseUnitLabel(m.dispense_unit_of_measure, m.strength_unit_of_measure, m.dosage_form),
      usable_stock: usable,
      total_stock: Number(m.total_stock),
      low_stock_level: low,
      critical_stock_level: critical,
      adequate_stock_level: adequate,
      status,
      nearest_expiry: m.nearest_expiry || null,
      expiring_stock: Number(m.expiring_stock),
      expired_stock: Number(m.expired_stock),
      package_strength: `${m.strength_unit_value || 1} ${m.strength_unit_of_measure || ''}`.trim(),
      forecast_30d: forecast30,
      suggested_qty: suggested,
      to_adequate_qty: toAdequate,
      needs_attention: needsAttention,
      ...(includeSeries ? {
        history,
        container_strength: containerStrength,
        // demand in the dispense unit converted to containers of the dosage form, e.g. 140 mL of a 100 mL bottle = 1.4 -> 2 bottles
        forecast_days: days.map((day) => {
          const rawContainers = day.phase1_prediction.predictedDemand / containerStrength;
          return { ...day, predictedContainers: parseFloat(rawContainers.toFixed(2)), containersNeeded: Math.ceil(parseFloat(rawContainers.toFixed(6))) };
        })
      } : {})
    };
  });
}

const summarizeStockStatuses = (list) => ({
  total: list.length,
  out: list.filter((m) => m.status === 'Out of stock').length,
  critical: list.filter((m) => m.status === 'Critical').length,
  low: list.filter((m) => m.status === 'Low').length,
  adequate: list.filter((m) => m.status === 'Adequate').length,
  expiring: list.filter((m) => m.expiring_stock > 0).length,
  expired: list.filter((m) => m.expired_stock > 0).length
});

// Live per-medicine status (dashboard alert + Restock Report page)
app.get('/api/medicine-stock-status', async (req, res) => {
  try {
    const all = await getMedicineStockStatuses();
    const attentionOnly = req.query.attention === '1';
    const stockAlertsOnly = req.query.alerts === '1';
    let medicines = all;
    if (stockAlertsOnly) medicines = all.filter((m) => m.status !== 'Adequate');
    else if (attentionOnly) medicines = all.filter((m) => m.needs_attention);
    res.json({ success: true, generated_at: nowManilaStr(), summary: summarizeStockStatuses(all), medicines });
  } catch (error) {
    console.error('Error fetching medicine stock status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch medicine stock status' });
  }
});

// ---------- report generation ----------
async function createRestockReport(statuses, trigger, userId = null) {
  const summary = summarizeStockStatuses(statuses);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const reportId = await generateCustomId('RESTOCK', 'medicine_restock_reports', 'report_id', connection);
    await connection.query(
      `INSERT INTO medicine_restock_reports (report_id, trigger_source, generated_by, total_medicines, out_count, critical_count, low_count, expiring_count, expired_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reportId, trigger, userId, summary.total, summary.out, summary.critical, summary.low, summary.expiring, summary.expired]
    );

    const items = statuses.filter((m) => m.needs_attention);
    if (items.length > 0) {
      await connection.query(
        `INSERT INTO medicine_restock_report_items
           (report_id, medicine_id, medicine_name, dosage_form, unit_label, status, usable_stock, total_stock, low_level, critical_level, adequate_level,
            forecast_30d, suggested_qty, to_adequate_qty, nearest_expiry, expiring_stock, expired_stock)
         VALUES ?`,
        [items.map((m) => [reportId, m.medicine_id, m.name, m.dosage_form, m.unit_label, m.status, m.usable_stock, m.total_stock, m.low_stock_level,
          m.critical_stock_level, m.adequate_stock_level, m.forecast_30d, m.suggested_qty, m.to_adequate_qty, m.nearest_expiry, m.expiring_stock, m.expired_stock])]
      );
    }
    await connection.commit();
    return reportId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const getInventoryRecipientIds = async () => {
  const [rows] = await pool.query(`SELECT user_id FROM users WHERE role_id IN ('NRS', 'ADMN') AND is_active = 1`);
  return rows.map((r) => r.user_id).filter(Boolean);
};

let stockCheckRunning = null;
let stockCheckTimer = null;

// Compares every medicine with its last known status. A medicine that got WORSE (Low -> Critical -> Out of stock)
// notifies once; improving or staying the same does not. Saves a report on the daily run, on manual runs and
// whenever there is something new to tell.
async function runStockCheck({ trigger = 'Stock change', userId = null } = {}) {
  if (stockCheckRunning) return stockCheckRunning;
  stockCheckRunning = (async () => {
    try {
      const statuses = await getMedicineStockStatuses();
      const [stateRows] = await pool.query('SELECT * FROM medicine_stock_state');
      const state = Object.fromEntries(stateRows.map((r) => [r.medicine_id, r]));

      const newAlerts = [];
      for (const m of statuses) {
        const prev = state[m.medicine_id];
        const rank = STOCK_ALERT_RANK[m.status] || 0;
        const notifiedRank = STOCK_ALERT_RANK[prev?.last_notified_status] || 0;
        let notifiedStatus = prev?.last_notified_status || null;

        if (rank > notifiedRank) {
          newAlerts.push(m);
          notifiedStatus = m.status;
        } else if (rank === 0) {
          notifiedStatus = null; // back to adequate: the next drop notifies again
        } else if (rank < notifiedRank) {
          notifiedStatus = m.status; // improved but still short: a later worsening notifies again
        }

        const statusChanged = !prev || prev.last_status !== m.status;
        await pool.query(
          `INSERT INTO medicine_stock_state (medicine_id, last_status, last_notified_status, last_notified_at)
           VALUES (?, ?, ?, ${newAlerts.includes(m) ? 'NOW()' : 'NULL'})
           ON DUPLICATE KEY UPDATE
             status_since = IF(?, NOW(), status_since),
             last_status = VALUES(last_status),
             last_notified_status = VALUES(last_notified_status),
             last_notified_at = IF(? , NOW(), last_notified_at)`,
          [m.medicine_id, m.status, notifiedStatus, statusChanged ? 1 : 0, newAlerts.includes(m) ? 1 : 0]
        );
      }

      let reportId = null;
      if (newAlerts.length > 0 || trigger === 'Scheduled' || trigger === 'Manual') {
        reportId = await createRestockReport(statuses, trigger, userId);
      }

      if (newAlerts.length > 0) {
        const lines = newAlerts
          .sort((a, b) => STOCK_ALERT_RANK[b.status] - STOCK_ALERT_RANK[a.status])
          .map((m) => `${m.name}: ${m.status} (${m.usable_stock} left, low level ${m.low_stock_level})`);
        const shown = lines.slice(0, 4).join('; ') + (lines.length > 4 ? `; and ${lines.length - 4} more` : '');
        try {
          await notifyUsers({
            sender_id: null,
            recipient_ids: await getInventoryRecipientIds(),
            title: newAlerts.length === 1 ? `Restock needed: ${newAlerts[0].name}` : `${newAlerts.length} medicines need restocking`,
            message: `${shown}. Open the Restock Report for the predicted need.`,
            type: 'RESTOCK_ALERT',
            payloadData: { report_id: reportId }
          });
        } catch (e) {
          console.error('Restock notification failed:', e.message);
        }
      }

      return { reportId, newAlerts: newAlerts.map((m) => ({ medicine_id: m.medicine_id, name: m.name, status: m.status })) };
    } finally {
      stockCheckRunning = null;
    }
  })();
  return stockCheckRunning;
}

// Called after anything that changes stock (see the middleware near the top): waits a moment so a burst of changes is one check.
function scheduleStockCheck() {
  clearTimeout(stockCheckTimer);
  stockCheckTimer = setTimeout(() => {
    runStockCheck({ trigger: 'Stock change' }).catch((err) => console.error('Stock check failed:', err.message));
  }, 3000);
}

// daily report at 7:00 AM, plus a safety net every 15 minutes (covers stock that changed by any other route)
cron.schedule('0 7 * * *', () => {
  runStockCheck({ trigger: 'Scheduled' }).catch((err) => console.error('Daily restock report failed:', err.message));
}, { timezone: 'Asia/Manila' });
cron.schedule('*/15 * * * *', () => {
  runStockCheck({ trigger: 'Stock change' }).catch((err) => console.error('Stock check failed:', err.message));
}, { timezone: 'Asia/Manila' });

const reportWithItems = async (reportId) => {
  const [[report]] = await pool.query('SELECT * FROM medicine_restock_reports WHERE report_id = ?', [reportId]);
  if (!report) return null;
  const [items] = await pool.query(
    `SELECT * FROM medicine_restock_report_items WHERE report_id = ?
     ORDER BY FIELD(status, 'Out of stock', 'Critical', 'Low', 'Adequate'), medicine_name ASC`,
    [reportId]
  );
  return { ...report, items };
};

app.get('/api/restock-reports', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 200);
    const [rows] = await pool.query('SELECT * FROM medicine_restock_reports ORDER BY generated_at DESC, report_id DESC LIMIT ?', [limit]);
    res.json({ success: true, reports: rows });
  } catch (error) {
    console.error('Error fetching restock reports:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch restock reports' });
  }
});

app.get('/api/restock-reports/latest', async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT report_id FROM medicine_restock_reports ORDER BY generated_at DESC, report_id DESC LIMIT 1');
    res.json({ success: true, report: row ? await reportWithItems(row.report_id) : null });
  } catch (error) {
    console.error('Error fetching latest restock report:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch the latest restock report' });
  }
});

app.get('/api/restock-reports/:id', async (req, res) => {
  try {
    const report = await reportWithItems(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    res.json({ success: true, report });
  } catch (error) {
    console.error('Error fetching restock report:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch the restock report' });
  }
});

// Generate a report right now (always saved)
app.post('/api/restock-reports/generate', async (req, res) => {
  try {
    const result = await runStockCheck({ trigger: 'Manual', userId: req.body?.user_id || null });
    // a check that was already running may not have saved a report: make sure the manual one exists
    const reportId = result.reportId || await createRestockReport(await getMedicineStockStatuses(), 'Manual', req.body?.user_id || null);
    res.json({ success: true, message: 'Restock report generated.', report: await reportWithItems(reportId), new_alerts: result.newAlerts });
  } catch (error) {
    console.error('Error generating restock report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate the restock report' });
  }
});

//Frequent Visits API
// Automatic advice mapping matched exactly to your chief_complaints database records
// Automatic advice mapping written in the concise clinical format
const AUTOMATIC_COMPLAINT_ADVICE = {
  'Asthma Attack': 'Assist student with prescribed inhaler and monitor breathing. Refer to physician if symptoms persist.',
  'Body Pain': 'Advise student to rest and apply warm compress. Refer to physician if symptoms persist.',
  'Cough': 'Advise student to increase warm fluid intake and rest. Refer to physician if symptoms persist.',
  'Difficulty of Breathing': 'Advise student to monitor vital signs closely. Refer to physician if symptoms persist.',
  'Dizziness': 'Advise student to stay hydrated. Refer to physician if symptoms persist.',
  'Fever': 'Advise student to rest, hydrate, and monitor temperature. Refer to physician if symptoms persist.',
  'Gastrointestinal Issues': 'Advise student to check food and water intake. Refer to physician if symptoms persist.',
  'Headache': 'Advise student to hydrate, rest in a quiet area, and limit screen time. Refer to physician if symptoms persist.',
  'Heartburn': 'Advise student to remain upright and sip water slowly. Refer to physician if symptoms persist.',
  'High Blood': 'Instruct student to rest quietly and re-check blood pressure. Refer to physician if symptoms persist.',
  'Injury': 'Apply first aid and rest affected area. Refer to physician if symptoms persist.',
  'Insect Bites': 'Clean affected area and apply cold compress. Refer to physician if symptoms persist.',
  'Lost Consciousness': 'Place student in recovery position and check airway. Refer to physician immediately.',
  'Menstrual Cramps': 'Advise student to rest and apply warm compress to lower abdomen. Refer to physician if symptoms persist.',
  'Nausea/Vomiting': 'Advise student to sip clear fluids and avoid solid food temporarily. Refer to physician if symptoms persist.',
  'Runny Nose': 'Advise student to increase fluid intake and rest. Refer to physician if symptoms persist.',
  'Sore Throat': 'Advise student to gargle warm salt water and stay hydrated. Refer to physician if symptoms persist.',
  'Tootaches': 'Advise student to rinse with warm salt water. Refer to dentist/physician if symptoms persist.'
};

/**
 * Helper function to resolve automatic advice based on complaint string
 */
const getAutomaticAdvice = (complaint) => {
  if (!complaint) {
    return 'Advise student to rest and monitor symptoms. Refer to physician if symptoms persist.';
  }
  
  return (
    AUTOMATIC_COMPLAINT_ADVICE[complaint] || 
    `Advise student to rest and monitor ${complaint.toLowerCase()} symptoms. Refer to physician if symptoms persist.`
  );
};

// Express Route
app.get('/api/frequent-complaints', async (req, res) => {
  try {
    // Default to current year-month (e.g., "2026-07") if not provided
    const targetMonth = req.query.month || currentMonthManilaStr();

    // SQL Query without DB recommendations
    const query = `
      SELECT 
        cv.student_id AS studentId,
        CONCAT(s.first_name, ' ', s.last_name) AS studentName,
        CONCAT(s.program_id, ' - Year ', s.year_level) AS gradeSection,
        cc.complaint_name AS complaint,
        COUNT(cv.visit_id) AS visitCount,
        MAX(DATE_FORMAT(cv.visit_date, '%Y-%m-%d')) AS date
      FROM clinic_visits cv
      INNER JOIN students s ON cv.student_id = s.student_id
      INNER JOIN chief_complaints cc ON cv.complaint_id = cc.complaint_id
      WHERE DATE_FORMAT(cv.visit_date, '%Y-%m') = ?
      GROUP BY 
        cv.student_id, 
        cv.complaint_id, 
        s.first_name, 
        s.last_name, 
        s.program_id, 
        s.year_level, 
        cc.complaint_name
      HAVING COUNT(cv.visit_id) >= 3
      ORDER BY visitCount DESC, date DESC;
    `;

    const [rows] = await pool.query(query, [targetMonth]);

    // Attach automatic recommendation based on DB complaint name
    const dataWithAutomaticAdvice = rows.map((row) => ({
      ...row,
      advice: getAutomaticAdvice(row.complaint)
    }));

    return res.status(200).json({
      success: true,
      month: targetMonth,
      totalAlerts: dataWithAutomaticAdvice.length,
      data: dataWithAutomaticAdvice
    });
  } catch (error) {
    console.error('Error fetching frequent complaints:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve frequent complaint alerts.',
      error: error.message
    });
  }
});

// 1. GET Frequent Complaint Details (All visits for a specific student & complaint within the month)
app.get('/api/frequent-complaints/details', async (req, res) => {
  try {
    const { studentId, complaint, month } = req.query;

    if (!studentId || !complaint) {
      return res.status(400).json({
        success: false,
        message: 'studentId and complaint parameters are required.'
      });
    }

    const targetMonth = month || currentMonthManilaStr();

    const query = `
      SELECT 
        cv.visit_id AS visitId,
        cv.student_id AS studentId,
        CONCAT(s.first_name, ' ', s.last_name) AS studentName,
        CONCAT(s.program_id, ' - Year ', s.year_level) AS gradeSection,
        cc.complaint_name AS complaint,
        DATE_FORMAT(cv.visit_date, '%Y-%m-%d') AS visitDate,
        cv.time_in AS timeIn,
        cv.time_out AS timeOut,
        cv.temperature,
        cv.respiratory_rate AS respiratoryRate,
        cv.pulse_rate AS pulseRate,
        cv.blood_pressure AS bloodPressure,
        cv.nursing_intervention AS nursingIntervention,
        cv.assessment AS assessment
      FROM clinic_visits cv
      INNER JOIN students s ON cv.student_id = s.student_id
      INNER JOIN chief_complaints cc ON cv.complaint_id = cc.complaint_id
      WHERE cv.student_id = ? 
        AND cc.complaint_name = ?
        AND DATE_FORMAT(cv.visit_date, '%Y-%m') = ?
      ORDER BY cv.visit_date DESC, cv.time_in DESC;
    `;

    const [rows] = await pool.query(query, [studentId, complaint, targetMonth]);

    return res.status(200).json({
      success: true,
      month: targetMonth,
      totalVisits: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching frequent visit details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve visit details.',
      error: error.message
    });
  }
});

// 2. DELETE Dismiss Frequent Complaint Alert
app.delete('/api/frequent-complaints/dismiss', async (req, res) => {
  try {
    const { studentId, complaint } = req.body;

    if (!studentId || !complaint) {
      return res.status(400).json({ success: false, message: 'studentId and complaint are required.' });
    }

    // Optional DB persistent dismissal table sync can be done here if needed.
    return res.status(200).json({
      success: true,
      message: 'Alert dismissed successfully.'
    });
  } catch (error) {
    console.error('Error dismissing alert:', error);
    return res.status(500).json({ success: false, message: 'Failed to dismiss alert.' });
  }
});


// GET Frequent Illness Alerts for Parent's Linked Students
app.get('/api/parent/frequent-complaints/:parentId', async (req, res) => {
  try {
    const { parentId } = req.params;
    const targetMonth = req.query.month || currentMonthManilaStr();

    if (!parentId) {
      return res.status(400).json({ success: false, message: 'parentId is required.' });
    }

    const query = `
      SELECT 
        cv.student_id AS studentId,
        CONCAT(s.first_name, ' ', s.last_name) AS studentName,
        CONCAT(s.program_id, ' - Year ', s.year_level) AS gradeSection,
        cc.complaint_name AS complaint,
        COUNT(cv.visit_id) AS visitCount,
        MAX(DATE_FORMAT(cv.visit_date, '%Y-%m-%d')) AS lastVisitDate
      FROM clinic_visits cv
      INNER JOIN students s ON cv.student_id = s.student_id
      INNER JOIN chief_complaints cc ON cv.complaint_id = cc.complaint_id
      INNER JOIN parent_student_mapping psm ON s.student_id = psm.student_id
      WHERE psm.parent_id = ?
        AND DATE_FORMAT(cv.visit_date, '%Y-%m') = ?
      GROUP BY 
        cv.student_id, 
        cv.complaint_id, 
        s.first_name, 
        s.last_name, 
        s.program_id, 
        s.year_level, 
        cc.complaint_name
      HAVING COUNT(cv.visit_id) >= 3
      ORDER BY visitCount DESC, lastVisitDate DESC;
    `;

    const [rows] = await pool.query(query, [parentId, targetMonth]);

    const alertsWithAdvice = rows.map((row) => ({
      ...row,
      advice: getAutomaticAdvice(row.complaint)
    }));

    return res.status(200).json({
      success: true,
      month: targetMonth,
      totalAlerts: alertsWithAdvice.length,
      data: alertsWithAdvice
    });
  } catch (error) {
    console.error('Error fetching parent frequent complaints:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving alerts.' });
  }
});


// Reports & Analytics for a period (a day, a week or a month): GET /api/reports-analytics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// One response feeds every tab of the Reports & Analytics page:
//   overview (KPIs vs the previous period + trend), health (conditions, programs), medicine (dispensing),
//   incidents, services (slips, doctor appointments, requirements) and inventory (live stock, not period based).
app.get('/api/reports-analytics', async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!isDateStr(startDate) || !isDateStr(endDate)) {
    return res.status(400).json({ error: 'startDate and endDate (YYYY-MM-DD) are required.' });
  }
  if (endDate < startDate) return res.status(400).json({ error: 'endDate cannot be before startDate.' });
  const lengthDays = Math.round((new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / 86400000) + 1;
  if (lengthDays > 400) return res.status(400).json({ error: 'The report period is too long (400 days at most).' });

  // the same-length period right before this one, for the comparison
  const prevEnd = addDaysStr(startDate, -1);
  const prevStart = addDaysStr(prevEnd, -(lengthDays - 1));

  // TIMESTAMP columns need full bounds
  const from = `${startDate} 00:00:00`;
  const to = `${endDate} 23:59:59`;
  const prevFrom = `${prevStart} 00:00:00`;
  const prevTo = `${prevEnd} 23:59:59`;

  const DISPENSED_UNION = `(
    SELECT batch_id, 'direct' AS src, dispensed_at FROM direct_dispensation WHERE dispensed_at >= ? AND dispensed_at <= ?
    UNION ALL
    SELECT batch_id, 'consultation' AS src, dispensed_at FROM consultation_dispensation WHERE dispensed_at >= ? AND dispensed_at <= ?
  )`;

  try {
    const countVisits = async (d1, d2) => {
      const [[row]] = await pool.query('SELECT COUNT(*) AS n, COUNT(DISTINCT student_id) AS students FROM clinic_visits WHERE visit_date >= ? AND visit_date <= ?', [d1, d2]);
      return { visits: Number(row.n), students: Number(row.students) };
    };
    const countIncidents = async (t1, t2) => {
      const [[row]] = await pool.query('SELECT COUNT(*) AS n FROM incident_reports WHERE incident_datetime >= ? AND incident_datetime <= ?', [t1, t2]);
      return Number(row.n);
    };
    const countDispensed = async (t1, t2) => {
      const [[row]] = await pool.query(`SELECT COUNT(*) AS n FROM ${DISPENSED_UNION} d`, [t1, t2, t1, t2]);
      return Number(row.n);
    };
    const complaintRows = async (d1, d2) => {
      const [rows] = await pool.query(
        `SELECT cc.complaint_name AS name, COUNT(cv.visit_id) AS total_count, COUNT(DISTINCT cv.student_id) AS students
         FROM clinic_visits cv JOIN chief_complaints cc ON cv.complaint_id = cc.complaint_id
         WHERE cv.visit_date >= ? AND cv.visit_date <= ?
         GROUP BY cc.complaint_id, cc.complaint_name
         ORDER BY total_count DESC, cc.complaint_name ASC`,
        [d1, d2]
      );
      return rows;
    };
    const statusCounts = async (table, col, t1, t2) => {
      const [rows] = await pool.query(`SELECT COALESCE(status, 'Unknown') AS label, COUNT(*) AS n FROM ${table} WHERE ${col} >= ? AND ${col} <= ? GROUP BY status ORDER BY n DESC`, [t1, t2]);
      return rows.map((r) => ({ label: r.label, count: Number(r.n) }));
    };

    const current = await countVisits(startDate, endDate);
    const previous = await countVisits(prevStart, prevEnd);
    const totalIncidents = await countIncidents(from, to);
    const previousIncidents = await countIncidents(prevFrom, prevTo);
    const totalDispensed = await countDispensed(from, to);
    const previousDispensed = await countDispensed(prevFrom, prevTo);

    // ---- Health: medical conditions (every visit counts) with the change since the previous period
    const complaintsNow = await complaintRows(startDate, endDate);
    const previousByName = new Map((await complaintRows(prevStart, prevEnd)).map((r) => [r.name.trim(), Number(r.total_count)]));
    const complaints = complaintsNow.map((row) => {
      const name = row.name.trim();
      const count = Number(row.total_count);
      const before = previousByName.get(name) || 0;
      return {
        name,
        count,
        students: Number(row.students),
        percent: current.visits > 0 ? Math.round((count / current.visits) * 1000) / 10 : 0,
        previousCount: before,
        delta: count - before,
        trend: before === 0 ? 'new' : count > before ? 'up' : count < before ? 'down' : 'same'
      };
    });

    const [programRows] = await pool.query(
      `SELECT COALESCE(ap.program_name, 'Unassigned') AS name, COUNT(*) AS total_count, COUNT(DISTINCT cv.student_id) AS students
       FROM clinic_visits cv
       JOIN students s ON cv.student_id = s.student_id
       LEFT JOIN academic_programs ap ON s.program_id = ap.program_id
       WHERE cv.visit_date >= ? AND cv.visit_date <= ?
       GROUP BY ap.program_id, ap.program_name
       ORDER BY total_count DESC, name ASC
       LIMIT 10`,
      [startDate, endDate]
    );
    const programs = programRows.map((r) => ({ name: r.name, count: Number(r.total_count), students: Number(r.students) }));

    const [repeatRows] = await pool.query(
      `SELECT cv.student_id, CONCAT(s.first_name, ' ', s.last_name) AS name, COUNT(*) AS total_count
       FROM clinic_visits cv JOIN students s ON cv.student_id = s.student_id
       WHERE cv.visit_date >= ? AND cv.visit_date <= ?
       GROUP BY cv.student_id, s.first_name, s.last_name
       HAVING total_count > 1
       ORDER BY total_count DESC, name ASC
       LIMIT 5`,
      [startDate, endDate]
    );
    const frequentVisitors = repeatRows.map((r) => ({ studentId: r.student_id, name: r.name, count: Number(r.total_count) }));

    // ---- Medicine dispensed (direct + consultation)
    const [medicineRows] = await pool.query(
      `SELECT CONCAT(m.generic_name, ' (', m.brand_name, ')') AS name,
              COUNT(*) AS total_count,
              SUM(d.src = 'direct') AS direct_count,
              SUM(d.src = 'consultation') AS consultation_count
       FROM ${DISPENSED_UNION} d
       JOIN medicine_inventory_batches b ON d.batch_id = b.batch_id
       JOIN medicines m ON b.medicine_id = m.medicine_id
       GROUP BY m.medicine_id, m.generic_name, m.brand_name
       ORDER BY total_count DESC, name ASC`,
      [from, to, from, to]
    );
    const medicines = medicineRows.map((r) => ({
      name: r.name,
      count: Number(r.total_count),
      direct: Number(r.direct_count),
      consultation: Number(r.consultation_count),
      percent: totalDispensed > 0 ? Math.round((Number(r.total_count) / totalDispensed) * 1000) / 10 : 0
    }));
    const dispenseSplit = {
      direct: medicines.reduce((sum, m) => sum + m.direct, 0),
      consultation: medicines.reduce((sum, m) => sum + m.consultation, 0)
    };

    // ---- Incidents
    const [locationRows] = await pool.query(
      `SELECT incident_location AS name, COUNT(*) AS total_count FROM incident_reports
       WHERE incident_datetime >= ? AND incident_datetime <= ?
       GROUP BY incident_location ORDER BY total_count DESC, name ASC LIMIT 8`,
      [from, to]
    );
    const incidentLocations = locationRows.map((r) => ({
      name: r.name,
      count: Number(r.total_count),
      percent: totalIncidents > 0 ? Math.round((Number(r.total_count) / totalIncidents) * 1000) / 10 : 0
    }));
    const [recentIncidentRows] = await pool.query(
      `SELECT ir.incident_id, DATE_FORMAT(ir.incident_datetime, '%Y-%m-%d %H:%i') AS happened_at, ir.incident_location,
              ir.incident_description, ir.first_aid_administered, ir.current_physical_situation,
              CONCAT(s.first_name, ' ', s.last_name) AS student_name
       FROM incident_reports ir LEFT JOIN students s ON ir.student_id = s.student_id
       WHERE ir.incident_datetime >= ? AND ir.incident_datetime <= ?
       ORDER BY ir.incident_datetime DESC LIMIT 10`,
      [from, to]
    );
    const recentIncidents = recentIncidentRows.map((r) => ({
      id: r.incident_id,
      happenedAt: r.happened_at,
      location: r.incident_location,
      student: r.student_name || 'Unknown student',
      description: r.incident_description,
      firstAid: r.first_aid_administered,
      situation: r.current_physical_situation
    }));

    // ---- Services: slips, doctor appointments, requirement submissions
    const excuseSlips = await statusCounts('excuse_slip_requests', 'created_at', from, to);
    const referralSlips = await statusCounts('referral_slip_requests', 'created_at', from, to);
    const appointments = await statusCounts('doctor_appointments', 'start_time', from, to);
    const [visitTypeRows] = await pool.query(
      `SELECT visit_type AS label, COUNT(*) AS n FROM doctor_appointments
       WHERE start_time >= ? AND start_time <= ? GROUP BY visit_type ORDER BY n DESC`,
      [from, to]
    );
    const appointmentTypes = visitTypeRows.map((r) => ({ label: r.label, count: Number(r.n) }));
    const [requirementRows] = await pool.query('SELECT status AS label, COUNT(*) AS n FROM student_requirement_submissions GROUP BY status ORDER BY n DESC');
    const requirements = requirementRows.map((r) => ({ label: r.label, count: Number(r.n) }));

    // ---- Inventory (live: not tied to the period)
    const stock = await getMedicineStockStatuses();
    const stockAttention = stock
      .filter((m) => m.needs_attention)
      .sort((a, b) => (STOCK_ALERT_RANK[b.status] || 0) - (STOCK_ALERT_RANK[a.status] || 0) || b.expiring_stock - a.expiring_stock || a.name.localeCompare(b.name))
      .slice(0, 15)
      .map((m) => ({
        name: m.name,
        status: m.status,
        unit: m.unit_label,
        stock: m.usable_stock,
        lowLevel: m.low_stock_level,
        criticalLevel: m.critical_stock_level,
        expiringStock: m.expiring_stock,
        expiredStock: m.expired_stock,
        nearestExpiry: m.nearest_expiry,
        forecast30d: m.forecast_30d,
        suggestedRestock: m.suggested_qty
      }));

    // ---- Trend of visits, incidents and dispensing inside the period
    let unit = 'day';
    if (lengthDays === 1) unit = 'hour';
    else if (lengthDays > 62) unit = 'month';

    const keyOf = (col) => (unit === 'hour' ? `HOUR(${col})` : `DATE_FORMAT(${col}, '${unit === 'day' ? '%Y-%m-%d' : '%Y-%m'}')`);
    const [visitSeries] = await pool.query(`SELECT ${keyOf(unit === 'hour' ? 'time_in' : 'visit_date')} AS k, COUNT(*) AS n FROM clinic_visits WHERE visit_date >= ? AND visit_date <= ? GROUP BY k`, [startDate, endDate]);
    const [incidentSeries] = await pool.query(`SELECT ${keyOf('incident_datetime')} AS k, COUNT(*) AS n FROM incident_reports WHERE incident_datetime >= ? AND incident_datetime <= ? GROUP BY k`, [from, to]);
    const [dispensedSeries] = await pool.query(`SELECT ${keyOf('dispensed_at')} AS k, COUNT(*) AS n FROM ${DISPENSED_UNION} d GROUP BY k`, [from, to, from, to]);

    const toMap = (rows) => Object.fromEntries(rows.map((r) => [r.k === null ? 'none' : r.k, Number(r.n)]));
    const visitMap = toMap(visitSeries);
    const incidentMap = toMap(incidentSeries);
    const dispensedMap = toMap(dispensedSeries);
    const pointAt = (key) => ({ visits: visitMap[key] || 0, incidents: incidentMap[key] || 0, dispensed: dispensedMap[key] || 0 });

    const points = [];
    if (unit === 'hour') {
      const hourLabel = (h) => `${h % 12 || 12}${h >= 12 ? 'PM' : 'AM'}`;
      const usedHours = [visitMap, incidentMap, dispensedMap].flatMap((m) => Object.keys(m)).filter((k) => k !== 'none').map(Number);
      const firstHour = Math.min(7, ...usedHours);
      const lastHour = Math.max(17, ...usedHours);
      for (let h = firstHour; h <= lastHour; h++) points.push({ label: hourLabel(h), ...pointAt(h) });
      if (visitMap.none) points.push({ label: 'No time', visits: visitMap.none, incidents: 0, dispensed: 0 });
    } else if (unit === 'day') {
      for (let d = startDate; d <= endDate; d = addDaysStr(d, 1)) {
        const [, m, dd] = d.split('-');
        points.push({ label: `${TREND_MONTHS[Number(m) - 1]} ${Number(dd)}`, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeekOf(d)], ...pointAt(d) });
      }
    } else {
      for (let k = startDate.slice(0, 7); k <= endDate.slice(0, 7);) {
        const [y, m] = k.split('-').map(Number);
        points.push({ label: `${TREND_MONTHS[m - 1]} ${y}`, ...pointAt(k) });
        k = m === 12 ? `${y + 1}-01` : `${y}-${pad2(m + 1)}`;
      }
    }

    const changePercent = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

    res.json({
      period: { startDate, endDate, days: lengthDays },
      overview: {
        totalVisits: current.visits,
        distinctStudents: current.students,
        totalIncidents,
        totalDispensed,
        previousVisits: previous.visits,
        previousIncidents,
        previousDispensed,
        visitsChangePercent: changePercent(current.visits, previous.visits),
        incidentsChangePercent: changePercent(totalIncidents, previousIncidents),
        dispensedChangePercent: changePercent(totalDispensed, previousDispensed),
        topComplaint: complaints.length > 0 ? complaints[0].name : 'None',
        topMedicine: medicines.length > 0 ? medicines[0].name : 'None',
        topIncidentLocation: incidentLocations.length > 0 ? incidentLocations[0].name : 'None'
      },
      trend: { unit, points },
      health: { conditions: complaints, programs, frequentVisitors },
      medicine: { items: medicines, split: dispenseSplit },
      incidents: { locations: incidentLocations, recent: recentIncidents },
      services: { excuseSlips, referralSlips, appointments, appointmentTypes, requirements },
      inventory: { summary: summarizeStockStatuses(stock), attention: stockAttention }
    });
  } catch (error) {
    console.error('Error building the reports and analytics:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

async function generateRequestId(pool, prefix, tableName) {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = String(today.getFullYear()).slice(-2);

    const dateStr = `${month}${day}${year}`; // e.g., 100126
    const prefixWithDate = `${prefix}-${dateStr}`;

    // Get the highest existing request ID for today
    const [rows] = await pool.query(
        `SELECT request_id FROM ${tableName} WHERE request_id LIKE ? ORDER BY request_id DESC LIMIT 1`,
        [`${prefixWithDate}%`]
    );

    let nextNumber = 1;
    if (rows.length > 0) {
        const lastId = rows[0].request_id;
        const lastSeq = parseInt(lastId.slice(-3), 10);
        if (!isNaN(lastSeq)) {
            nextNumber = lastSeq + 1;
        }
    }

    const paddedIncrement = String(nextNumber).padStart(3, '0');
    return `${prefixWithDate}${paddedIncrement}`;
}


// document request api
// =========================================================================
// 1. POST: Submit Excuse Slip Request (Notifies All Nurses)
// =========================================================================
app.post('/api/requests/excuse-slip', upload.single('proof'), async (req, res) => {
    try {
        const { student_id, reason_for_excuse, valid_absence_start, valid_absence_end } = req.body;
        
        // Generate formatted request ID: EXC-DDMMYY001
        const request_id = await generateRequestId(pool, 'EXC', 'excuse_slip_requests');
        const student_proof_url = req.file ? `/uploads/${req.file.filename}` : null;

        const query = `
            INSERT INTO excuse_slip_requests 
            (request_id, student_id, reason_for_excuse, valid_absence_start, valid_absence_end, student_proof_url, status) 
            VALUES (?, ?, ?, ?, ?, ?, 'Pending')
        `;

        await pool.query(query, [
            request_id,
            student_id,
            reason_for_excuse,
            valid_absence_start,
            valid_absence_end,
            student_proof_url
        ]);

        // Fetch student details to build notification
        const [studentRows] = await pool.query(
            `SELECT user_id, CONCAT(first_name, ' ', last_name) AS full_name FROM students WHERE student_id = ?`,
            [student_id]
        );

        if (studentRows.length > 0) {
            const student = studentRows[0];
            const notifTitle = `New Excuse Slip Request`;
            const notifMsg = `${student.full_name} submitted an Excuse Slip request for ${valid_absence_start} to ${valid_absence_end}. Reason: ${reason_for_excuse}`;

            // Fetch all clinic nurses using users.user_id
            const [nurses] = await pool.query(`
                SELECT DISTINCT u.user_id 
                FROM users u 
                LEFT JOIN roles r ON u.role_id = r.role_id 
                LEFT JOIN nurses n ON (u.user_id = n.user_id OR u.user_id = n.nurse_id)
                WHERE (LOWER(r.role_name) = 'nurse' OR n.nurse_id IS NOT NULL) 
                  AND u.user_id IS NOT NULL
            `);
            const nurseUserIds = nurses.map(n => n.user_id).filter(Boolean);

            // Send System + Web Push Notification to all Nurses
            if (nurseUserIds.length > 0) {
                await notifyUsers({
                    sender_id: student.user_id,
                    recipient_ids: nurseUserIds,
                    title: notifTitle,
                    message: notifMsg,
                    type: 'excuse_slip_request',
                    payloadData: { request_id, type: 'Excuse Slip' }
                });
            }
        }

        res.status(201).json({ message: 'Excuse slip request submitted successfully', request_id });
    } catch (error) {
        console.error('Error submitting excuse slip:', error);
        res.status(500).json({ error: 'Failed to submit excuse slip request' });
    }
});

// ==========================================
// 2. GET PARTNER FACILITIES & SERVICES (Unified & Robust)
// ==========================================
app.get('/api/partner-facilities', async (req, res) => {
    try {
        if (typeof syncOthersFacilityServices === 'function') {
            await syncOthersFacilityServices();
        }

        const [facilities] = await pool.query('SELECT * FROM partner_facilities ORDER BY facility_name ASC');
        const [services] = await pool.query('SELECT * FROM facility_services ORDER BY requirement_name ASC');

        const combined = facilities.map(facility => ({
            ...facility,
            services: services.filter(service => 
                service.facility_id && 
                facility.facility_id && 
                String(service.facility_id).trim() === String(facility.facility_id).trim()
            )
        }));

        res.status(200).json({ success: true, facilities: combined });
    } catch (error) {
        console.error('Error fetching partner facilities:', error);
        res.status(500).json({ success: false, message: 'Server Error fetching facilities' });
    }
});

// ==========================================
// GET MEDICAL REQUIREMENTS (For Dropdown)
// ==========================================
app.get('/api/medical-requirements', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT DISTINCT requirement_name FROM medical_requirements WHERE requirement_name IS NOT NULL AND TRIM(requirement_name) != "" ORDER BY requirement_name ASC'
        );
        
        const requirements = rows.map(row => row.requirement_name).filter(Boolean);
        
        res.status(200).json({ 
            success: true, 
            requirements, 
            data: rows 
        });
    } catch (error) {
        console.error('Error fetching medical requirements:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server Error fetching medical requirements' 
        });
    }
});

// ==========================================
// CREATE FACILITY SERVICE
// ==========================================
app.post('/api/partner-facilities/:facilityId/services', async (req, res) => {
    const { facilityId } = req.params;
    const { requirement_name, description } = req.body;

    if (!requirement_name || !requirement_name.trim()) {
        return res.status(400).json({ success: false, message: 'Requirement name is required.' });
    }

    try {
        const [existing] = await pool.query(
            'SELECT * FROM facility_services WHERE facility_id = ? AND LOWER(TRIM(requirement_name)) = LOWER(?)',
            [facilityId, requirement_name.trim()]
        );

        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'This requirement/service is already added for the selected partner facility.' 
            });
        }

        const service_id = `SRV-${uuidv4().substring(0, 8)}`;
        await pool.query(
            'INSERT INTO facility_services (service_id, facility_id, requirement_name, description) VALUES (?, ?, ?, ?)',
            [service_id, facilityId, requirement_name.trim(), description || null]
        );
        res.status(201).json({ success: true, message: 'Service created successfully.', service_id });
    } catch (error) {
        console.error('Error creating facility service:', error);
        res.status(500).json({ success: false, message: 'Failed to create service' });
    }
});

// ==========================================
// UPDATE FACILITY SERVICE
// ==========================================
app.put('/api/facility-services/:serviceId', async (req, res) => {
    const { serviceId } = req.params;
    const { requirement_name, description } = req.body;

    if (!requirement_name || !requirement_name.trim()) {
        return res.status(400).json({ success: false, message: 'Requirement name is required.' });
    }

    try {
        const [currentService] = await pool.query(
            'SELECT facility_id FROM facility_services WHERE service_id = ?',
            [serviceId]
        );

        if (currentService.length === 0) {
            return res.status(404).json({ success: false, message: 'Service not found.' });
        }

        const facilityId = currentService[0].facility_id;

        const [existing] = await pool.query(
            'SELECT * FROM facility_services WHERE facility_id = ? AND LOWER(TRIM(requirement_name)) = LOWER(?) AND service_id != ?',
            [facilityId, requirement_name.trim(), serviceId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Another service with this requirement name already exists for this facility.' 
            });
        }

        await pool.query(
            'UPDATE facility_services SET requirement_name = ?, description = ? WHERE service_id = ?',
            [requirement_name.trim(), description || null, serviceId]
        );
        res.status(200).json({ success: true, message: 'Service updated successfully.' });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({ success: false, message: 'Failed to update service' });
    }
});

// ==========================================
// DELETE FACILITY SERVICE
// ==========================================
app.delete('/api/facility-services/:serviceId', async (req, res) => {
    const { serviceId } = req.params;
    try {
        await pool.query('DELETE FROM facility_services WHERE service_id = ?', [serviceId]);
        res.status(200).json({ success: true, message: 'Service deleted successfully.' });
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({ success: false, message: 'Failed to delete service' });
    }
});

// =========================================================================
// 3. POST: Submit Referral Slip Request (Notifies All Nurses)
// =========================================================================
app.post('/api/requests/referral-slip', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { student_id, reason_for_referral, facility_id, service_ids } = req.body;

        if (!facility_id) {
            return res.status(400).json({ error: 'Partner facility is required.' });
        }
        if (!service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
            return res.status(400).json({ error: 'At least one service must be selected.' });
        }

        await connection.beginTransaction();

        // Generate formatted request ID inside transaction: REF-DDMMYY001
        const request_id = await generateRequestId(connection, 'REF', 'referral_slip_requests');

        const insertRequestQuery = `
            INSERT INTO referral_slip_requests 
            (request_id, student_id, facility_id, reason_for_referral, status) 
            VALUES (?, ?, ?, ?, 'Pending')
        `;
        await connection.query(insertRequestQuery, [
            request_id,
            student_id,
            facility_id,
            reason_for_referral
        ]);

        const insertServiceQuery = `
            INSERT INTO referral_request_services (request_id, service_id) 
            VALUES ?
        `;
        const serviceValues = service_ids.map((serviceId) => [request_id, serviceId]);
        await connection.query(insertServiceQuery, [serviceValues]);

        await connection.commit();

        // Fetch Student & Facility Info for Notifications
        const [studentRows] = await pool.query(
            `SELECT user_id, CONCAT(first_name, ' ', last_name) AS full_name FROM students WHERE student_id = ?`,
            [student_id]
        );
        const [facilityRows] = await pool.query(
            `SELECT facility_name FROM partner_facilities WHERE facility_id = ?`,
            [facility_id]
        );

        if (studentRows.length > 0) {
            const student = studentRows[0];
            const facilityName = facilityRows[0]?.facility_name || 'Partner Facility';
            const notifTitle = `New Referral Slip Request`;
            const notifMsg = `${student.full_name} submitted a Referral Slip request for ${facilityName}. Reason: ${reason_for_referral}`;

            // Fetch all clinic nurses using users.user_id
            const [nurses] = await pool.query(`
                SELECT DISTINCT u.user_id 
                FROM users u 
                LEFT JOIN roles r ON u.role_id = r.role_id 
                LEFT JOIN nurses n ON (u.user_id = n.user_id OR u.user_id = n.nurse_id)
                WHERE (LOWER(r.role_name) = 'nurse' OR n.nurse_id IS NOT NULL) 
                  AND u.user_id IS NOT NULL
            `);
            const nurseUserIds = nurses.map(n => n.user_id).filter(Boolean);

            // Send System + Web Push Notification to all Nurses
            if (nurseUserIds.length > 0) {
                await notifyUsers({
                    sender_id: student.user_id,
                    recipient_ids: nurseUserIds,
                    title: notifTitle,
                    message: notifMsg,
                    type: 'referral_slip_request',
                    payloadData: { request_id, type: 'Referral Slip' }
                });
            }
        }

        res.status(201).json({ message: 'Referral slip request submitted successfully', request_id });
    } catch (error) {
        await connection.rollback();
        console.error('Error submitting referral slip:', error);
        res.status(500).json({ error: 'Failed to submit referral slip request' });
    } finally {
        connection.release();
    }
});

// =========================================================================
// 4. POST: Nurse Issues/Processes Document Request (Notifies Student & Parent)
// =========================================================================
app.post('/api/requests/issue', upload.single('issued_slip'), async (req, res) => {
    try {
        const { request_id, request_type, status, nurse_id, remarks } = req.body;

        if (!request_id || !request_type || !status || !nurse_id) {
            return res.status(400).json({ error: 'Missing required fields for document issuance.' });
        }

        const tableName = request_type === 'Excuse Slip' ? 'excuse_slip_requests' : 'referral_slip_requests';
        const issued_slip_url = req.file ? `/uploads/${req.file.filename}` : null;

        let updateSql = `UPDATE ${tableName} SET status = ?, issued_by = ?, issued_at = NOW()`;
        const params = [status, nurse_id];

        if (issued_slip_url) {
            updateSql += `, issued_slip_url = ?`;
            params.push(issued_slip_url);
        }

        updateSql += ` WHERE request_id = ?`;
        params.push(request_id);

        await pool.query(updateSql, params);

        // Map nurse_id to users.user_id
        const [nurseUser] = await pool.query(
            `SELECT u.user_id 
             FROM users u 
             LEFT JOIN nurses n ON (u.user_id = n.user_id OR u.user_id = n.nurse_id)
             WHERE n.nurse_id = ? OR n.user_id = ? OR u.user_id = ?
             LIMIT 1`,
            [nurse_id, nurse_id, nurse_id]
        );
        const nurseUserId = nurseUser[0]?.user_id || nurse_id;

        const targetSql = `
            SELECT 
                req.student_id,
                s.user_id AS student_user_id,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                p.user_id AS parent_user_id
            FROM ${tableName} req
            JOIN students s ON req.student_id = s.student_id
            LEFT JOIN parent_student_mapping psm ON s.student_id = psm.student_id
            LEFT JOIN parents p ON psm.parent_id = p.parent_id
            WHERE req.request_id = ?
        `;
        const [targetRows] = await pool.query(targetSql, [request_id]);

        if (targetRows.length > 0) {
            const target = targetRows[0];
            const recipientIds = [target.student_user_id, target.parent_user_id].filter(Boolean);

            const notifTitle = `${request_type} Issued / Updated`;
            const notifMsg = `Your ${request_type} (${request_id}) has been ${status.toLowerCase()}.${remarks ? ` Remarks: ${remarks}` : ''}`;

            // Notify Student and Parent via System DB + Web Push
            if (recipientIds.length > 0) {
                await notifyUsers({
                    sender_id: nurseUserId,
                    recipient_ids: recipientIds,
                    title: notifTitle,
                    message: notifMsg,
                    type: 'document_issued',
                    payloadData: { request_id, type: request_type, status }
                });
            }
        }

        res.status(200).json({ message: `Document request updated to ${status} successfully.` });
    } catch (error) {
        console.error('Error issuing document:', error);
        res.status(500).json({ error: 'Failed to issue document request' });
    }
});

// =========================================================================
// 5. GET: Fetch All Requests for a Student (Fixed Column Name)
// =========================================================================
app.get('/api/requests/student/:student_id', async (req, res) => {
    try {
        const { student_id } = req.params;

        const [excuseRequests] = await pool.query(
            `SELECT *, 'Excuse Slip' AS request_type FROM excuse_slip_requests WHERE student_id = ? ORDER BY created_at DESC`,
            [student_id]
        );

        const [referralRequests] = await pool.query(
            `SELECT 
                r.*, 
                pf.facility_name AS partner_facility_name,
                GROUP_CONCAT(fs.requirement_name SEPARATOR ', ') AS requested_services,
                'Referral Slip' AS request_type 
            FROM referral_slip_requests r
            LEFT JOIN partner_facilities pf ON r.facility_id = pf.facility_id
            LEFT JOIN referral_request_services rrs ON r.request_id = rrs.request_id
            LEFT JOIN facility_services fs ON rrs.service_id = fs.service_id
            WHERE r.student_id = ? 
            GROUP BY r.request_id 
            ORDER BY r.created_at DESC`,
            [student_id]
        );

        const allRequests = [...excuseRequests, ...referralRequests].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        res.json(allRequests);
    } catch (error) {
        console.error('Error fetching request history:', error);
        res.status(500).json({ error: 'Failed to fetch request history' });
    }
});

// =========================================================================
// 6. GET & POST: Notes / Messages for a Specific Request
// =========================================================================
app.get('/api/requests/:type/:request_id/notes', async (req, res) => {
    try {
        const { type, request_id } = req.params;
        const tableName = type === 'Excuse Slip' ? 'excuse_slip_notes' : 'referral_slip_notes';

        const [notes] = await pool.query(
            `SELECT * FROM ${tableName} WHERE request_id = ? ORDER BY created_at ASC`,
            [request_id]
        );

        res.json(notes);
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

app.post('/api/requests/:type/:request_id/notes', async (req, res) => {
    try {
        const { type, request_id } = req.params;
        const { sender_type, sender_id, message } = req.body;
        const note_id = `NOTE-${uuidv4().substring(0, 8)}`;
        const tableName = type === 'Excuse Slip' ? 'excuse_slip_notes' : 'referral_slip_notes';
        const requestTable = type === 'Excuse Slip' ? 'excuse_slip_requests' : 'referral_slip_requests';

        await pool.query(
            `INSERT INTO ${tableName} (note_id, request_id, sender_type, sender_id, message) VALUES (?, ?, ?, ?, ?)`,
            [note_id, request_id, sender_type, sender_id, message]
        );

        // Resolve Sender User ID to users.user_id
        const [senderRows] = await pool.query(
            `SELECT user_id FROM (
                SELECT user_id FROM users WHERE user_id = ?
                UNION
                SELECT user_id FROM students WHERE student_id = ?
                UNION
                SELECT u.user_id FROM nurses n JOIN users u ON (u.user_id = n.user_id OR u.user_id = n.nurse_id) WHERE n.nurse_id = ?
            ) AS resolved LIMIT 1`,
            [sender_id, sender_id, sender_id]
        );
        const senderUserId = senderRows[0]?.user_id || null;

        // If Nurse sent the note -> Notify Student
        if (sender_type === 'Nurse') {
            const [studentRows] = await pool.query(
                `SELECT s.user_id FROM ${requestTable} req JOIN students s ON req.student_id = s.student_id WHERE req.request_id = ?`,
                [request_id]
            );

            if (studentRows.length > 0 && studentRows[0].user_id) {
                await notifyUsers({
                    sender_id: senderUserId,
                    recipient_ids: [studentRows[0].user_id],
                    title: `New Message on ${type}`,
                    message: `A nurse sent a message regarding ${type} (${request_id}): "${message.trim()}"`,
                    type: 'request_note',
                    payloadData: { request_id, type }
                });
            }
        } 
        // If Student sent the note -> Notify all Nurses
        else {
            const [nurses] = await pool.query(`
                SELECT DISTINCT u.user_id 
                FROM users u 
                LEFT JOIN roles r ON u.role_id = r.role_id 
                LEFT JOIN nurses n ON (u.user_id = n.user_id OR u.user_id = n.nurse_id)
                WHERE (LOWER(r.role_name) = 'nurse' OR n.nurse_id IS NOT NULL) 
                  AND u.user_id IS NOT NULL
            `);
            const nurseUserIds = nurses.map(n => n.user_id).filter(Boolean);

            if (nurseUserIds.length > 0) {
                await notifyUsers({
                    sender_id: senderUserId,
                    recipient_ids: nurseUserIds,
                    title: `New Message on ${type}`,
                    message: `A student sent a message regarding ${type} (${request_id}): "${message.trim()}"`,
                    type: 'request_note',
                    payloadData: { request_id, type }
                });
            }
        }

        res.status(201).json({ message: 'Note added successfully' });
    } catch (error) {
        console.error('Error adding note:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

//Document Issuance
const syncOthersFacilityServices = async () => {
    try {
        // 1. Find facility named "Others" (case-insensitive)
        const [othersRows] = await pool.query(
            `SELECT facility_id FROM partner_facilities WHERE LOWER(TRIM(facility_name)) = 'others' LIMIT 1`
        );

        if (othersRows.length === 0) return;
        const othersFacilityId = othersRows[0].facility_id;

        // 2. Fetch all medical requirement names from medical_requirements
        const [reqRows] = await pool.query(
            `SELECT DISTINCT requirement_name FROM medical_requirements WHERE requirement_name IS NOT NULL AND TRIM(requirement_name) != ''`
        );

        // 3. Fetch existing services under "Others" facility using requirement_name
        const [existingServices] = await pool.query(
            `SELECT LOWER(TRIM(requirement_name)) as requirement_name FROM facility_services WHERE facility_id = ?`,
            [othersFacilityId]
        );
        const existingMap = new Set(existingServices.map(s => s.requirement_name));

        // 4. Insert any missing requirement names into facility_services for "Others"
        for (const req of reqRows) {
            const reqName = req.requirement_name.trim();
            if (!existingMap.has(reqName.toLowerCase())) {
                const service_id = `SRV-OTH-${uuidv4().substring(0, 8)}`;
                await pool.query(
                    `INSERT INTO facility_services (service_id, facility_id, requirement_name, description) VALUES (?, ?, ?, ?)`,
                    [service_id, othersFacilityId, reqName, 'Medical Requirement Service']
                );
            }
        }
    } catch (err) {
        console.error('Error syncing Others facility services:', err);
    }
};

// ==========================================
// 1. GET ALL DOCUMENT REQUESTS (Updated for fs.requirement_name)
// ==========================================
app.get('/api/document-requests', async (req, res) => {
    try {
        const query = `
            SELECT 
                es.request_id,
                es.student_id,
                'Excuse Slip' AS request_type,
                es.reason_for_excuse AS reason,
                es.valid_absence_start,
                es.valid_absence_end,
                NULL AS partner_facility_name,
                NULL AS facility_id,
                NULL AS requested_services,
                es.student_proof_url,
                es.status,
                es.issued_by,
                es.issued_at,
                es.issued_slip_url,
                es.created_at,
                s.first_name,
                s.last_name,
                s.program_id,
                s.year_level
            FROM excuse_slip_requests es
            JOIN students s ON es.student_id = s.student_id

            UNION ALL

            SELECT 
                rs.request_id,
                rs.student_id,
                'Referral Slip' AS request_type,
                rs.reason_for_referral AS reason,
                NULL AS valid_absence_start,
                NULL AS valid_absence_end,
                pf.facility_name AS partner_facility_name,
                rs.facility_id,
                GROUP_CONCAT(fs.requirement_name SEPARATOR ', ') AS requested_services,
                NULL AS student_proof_url,
                rs.status,
                rs.issued_by,
                rs.issued_at,
                rs.issued_slip_url,
                rs.created_at,
                s.first_name,
                s.last_name,
                s.program_id,
                s.year_level
            FROM referral_slip_requests rs
            JOIN students s ON rs.student_id = s.student_id
            LEFT JOIN partner_facilities pf ON rs.facility_id = pf.facility_id
            LEFT JOIN referral_request_services rrs ON rs.request_id = rrs.request_id
            LEFT JOIN facility_services fs ON rrs.service_id = fs.service_id
            GROUP BY 
                rs.request_id, 
                rs.student_id, 
                rs.reason_for_referral, 
                pf.facility_name, 
                rs.facility_id, 
                rs.status, 
                rs.issued_by, 
                rs.issued_at, 
                rs.issued_slip_url, 
                rs.created_at, 
                s.first_name, 
                s.last_name, 
                s.program_id, 
                s.year_level

            ORDER BY created_at DESC;
        `;

        const [rows] = await pool.query(query);
        res.status(200).json({ success: true, requests: rows });
    } catch (error) {
        console.error('Error fetching document requests:', error);
        res.status(500).json({ success: false, message: 'Server Error fetching requests' });
    }
});

// ==========================================
// 2. CREATE EXCUSE SLIP REQUEST
// ==========================================
app.post('/api/document-requests/excuse-slip', upload.single('student_proof'), async (req, res) => {
    const { student_id, reason_for_excuse, valid_absence_start, valid_absence_end } = req.body;

    if (!student_id || !reason_for_excuse) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const request_id = `EXC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const student_proof_url = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        await pool.query(
            `INSERT INTO excuse_slip_requests 
            (request_id, student_id, reason_for_excuse, valid_absence_start, valid_absence_end, student_proof_url, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'Pending', NOW())`,
            [request_id, student_id, reason_for_excuse, valid_absence_start || null, valid_absence_end || null, student_proof_url]
        );

        const [studentRows] = await pool.query(
            `SELECT user_id, CONCAT(first_name, ' ', last_name) AS full_name FROM students WHERE student_id = ?`,
            [student_id]
        );
        const studentUserId = studentRows[0]?.user_id || null;
        const studentName = studentRows[0]?.full_name || 'A student';

        const [nurses] = await pool.query(`SELECT user_id FROM nurses WHERE user_id IS NOT NULL`);
        const nurseUserIds = nurses.map(n => n.user_id).filter(Boolean);

        if (nurseUserIds.length > 0) {
            await notifyUsers({
                sender_id: studentUserId,
                recipient_ids: nurseUserIds,
                title: 'New Excuse Slip Request',
                message: `${studentName} submitted a new Excuse Slip request (${request_id}).`,
                type: 'new_document_request',
                payloadData: { request_id, request_type: 'Excuse Slip' }
            });
        }

        res.status(201).json({ success: true, message: 'Excuse slip request submitted successfully.', request_id });
    } catch (error) {
        console.error('Error submitting excuse slip request:', error);
        res.status(500).json({ success: false, message: 'Failed to submit excuse slip request.' });
    }
});

// ==========================================
// 3. CREATE REFERRAL SLIP REQUEST
// ==========================================
app.post('/api/document-requests/referral-slip', async (req, res) => {
    const { student_id, facility_id, reason_for_referral, service_ids } = req.body;

    if (!student_id || !reason_for_referral) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const request_id = `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
        await pool.query(
            `INSERT INTO referral_slip_requests 
            (request_id, student_id, facility_id, reason_for_referral, status, created_at)
            VALUES (?, ?, ?, ?, 'Pending', NOW())`,
            [request_id, student_id, facility_id || null, reason_for_referral]
        );

        if (service_ids && Array.isArray(service_ids) && service_ids.length > 0) {
            const serviceValues = service_ids.map(sId => [request_id, sId]);
            await pool.query(
                `INSERT INTO referral_request_services (request_id, service_id) VALUES ?`,
                [serviceValues]
            );
        }

        const [studentRows] = await pool.query(
            `SELECT user_id, CONCAT(first_name, ' ', last_name) AS full_name FROM students WHERE student_id = ?`,
            [student_id]
        );
        const studentUserId = studentRows[0]?.user_id || null;
        const studentName = studentRows[0]?.full_name || 'A student';

        const [nurses] = await pool.query(`SELECT user_id FROM nurses WHERE user_id IS NOT NULL`);
        const nurseUserIds = nurses.map(n => n.user_id).filter(Boolean);

        if (nurseUserIds.length > 0) {
            await notifyUsers({
                sender_id: studentUserId,
                recipient_ids: nurseUserIds,
                title: 'New Referral Slip Request',
                message: `${studentName} submitted a new Referral Slip request (${request_id}).`,
                type: 'new_document_request',
                payloadData: { request_id, request_type: 'Referral Slip' }
            });
        }

        res.status(201).json({ success: true, message: 'Referral slip request submitted successfully.', request_id });
    } catch (error) {
        console.error('Error submitting referral slip request:', error);
        res.status(500).json({ success: false, message: 'Failed to submit referral slip request.' });
    }
});

// ==========================================
// 4. GET NOTES FOR A SPECIFIC REQUEST
// ==========================================
app.get('/api/document-requests/notes/:requestType/:requestId', async (req, res) => {
    const { requestType, requestId } = req.params;
    const tableName = requestType === 'Excuse Slip' ? 'excuse_slip_notes' : 'referral_slip_notes';

    try {
        const query = `
            SELECT note_id, request_id, sender_type, sender_id, message, created_at 
            FROM ${tableName} 
            WHERE request_id = ? 
            ORDER BY created_at ASC
        `;
        const [notes] = await pool.query(query, [requestId]);
        res.status(200).json({ success: true, notes });
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ success: false, message: 'Server Error fetching notes' });
    }
});

// ==========================================
// 5. ACTION ENDPOINT: APPROVE / DENY & NOTE
// ==========================================
app.post('/api/document-requests/action', upload.single('issued_slip'), async (req, res) => {
    const { request_id, request_type, action, nurse_id, message } = req.body;
    
    if (!request_id || !request_type || !action || !nurse_id) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const isExcuse = request_type === 'Excuse Slip';
    const requestTable = isExcuse ? 'excuse_slip_requests' : 'referral_slip_requests';
    const notesTable = isExcuse ? 'excuse_slip_notes' : 'referral_slip_notes';

    const issued_slip_url = req.file ? `/uploads/${req.file.filename}` : null;
    const status = action === 'Approve' ? 'Completed' : 'Denied';

    try {
        let updateQuery = `
            UPDATE ${requestTable} 
            SET status = ?, issued_by = ?, issued_at = NOW()
        `;
        const params = [status, nurse_id];

        if (issued_slip_url) {
            updateQuery += `, issued_slip_url = ?`;
            params.push(issued_slip_url);
        }

        updateQuery += ` WHERE request_id = ?`;
        params.push(request_id);

        await pool.query(updateQuery, params);

        if (message && message.trim() !== '') {
            const noteId = `NOTE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const insertNoteQuery = `
                INSERT INTO ${notesTable} (note_id, request_id, sender_type, sender_id, message, created_at)
                VALUES (?, ?, 'Nurse', ?, ?, NOW())
            `;
            await pool.query(insertNoteQuery, [noteId, request_id, nurse_id, message.trim()]);
        }

        const [nurseRows] = await pool.query(`SELECT user_id FROM nurses WHERE nurse_id = ?`, [nurse_id]);
        const nurseUserId = nurseRows[0]?.user_id || null;

        const detailsSql = `
            SELECT 
                req.student_id,
                s.user_id AS student_user_id,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                p.user_id AS parent_user_id
            FROM ${requestTable} req
            JOIN students s ON req.student_id = s.student_id
            LEFT JOIN parent_student_mapping psm ON s.student_id = psm.student_id
            LEFT JOIN parents p ON psm.parent_id = p.parent_id
            WHERE req.request_id = ?
        `;
        const [reqDetails] = await pool.query(detailsSql, [request_id]);

        if (reqDetails.length > 0) {
            const target = reqDetails[0];
            const notifTitle = `${request_type} Request ${status}`;
            const notifMsg = `Your ${request_type} (ID: ${request_id}) has been ${status.toLowerCase()}.${message ? ` Note: ${message}` : ''}`;

            if (target.student_user_id) {
                await notifyUsers({
                    sender_id: nurseUserId,
                    recipient_ids: [target.student_user_id],
                    title: notifTitle,
                    message: notifMsg,
                    type: 'document_request_action',
                    payloadData: { request_id, request_type }
                });
            }

            if (target.parent_user_id) {
                await notifyUsers({
                    sender_id: nurseUserId,
                    recipient_ids: [target.parent_user_id],
                    title: `Update on ${target.student_name}'s Request`,
                    message: `The ${request_type} requested for ${target.student_name} was ${status.toLowerCase()}.${message ? ` Note: ${message}` : ''}`,
                    type: 'document_request_action',
                    payloadData: { request_id, request_type }
                });
            }
        }

        res.status(200).json({ 
            success: true, 
            message: `Request successfully marked as ${status}.` 
        });
    } catch (error) {
        console.error('Error processing request action:', error);
        res.status(500).json({ success: false, message: 'Failed to process request action.' });
    }
});

// ==========================================
// 6. POST A NEW NOTE / MESSAGE
// ==========================================
app.post('/api/document-requests/notes', async (req, res) => {
    const { request_id, request_type, sender_id, sender_type, message } = req.body;

    if (!request_id || !request_type || !sender_id || !sender_type || !message) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const isExcuse = request_type === 'Excuse Slip';
    const notesTable = isExcuse ? 'excuse_slip_notes' : 'referral_slip_notes';
    const requestTable = isExcuse ? 'excuse_slip_requests' : 'referral_slip_requests';

    try {
        const noteId = `NOTE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const query = `
            INSERT INTO ${notesTable} (note_id, request_id, sender_type, sender_id, message, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `;

        await pool.query(query, [noteId, request_id, sender_type, sender_id, message.trim()]);

        const senderUserSql = `
            SELECT user_id FROM (
                SELECT user_id FROM users WHERE user_id = ?
                UNION
                SELECT user_id FROM students WHERE student_id = ?
                UNION
                SELECT user_id FROM nurses WHERE nurse_id = ?
            ) AS resolved LIMIT 1
        `;
        const [senderUserRows] = await pool.query(senderUserSql, [sender_id, sender_id, sender_id]);
        const senderUserId = senderUserRows[0]?.user_id || null;

        if (sender_type === 'Nurse') {
            const [studentRows] = await pool.query(
                `SELECT s.user_id FROM ${requestTable} req JOIN students s ON req.student_id = s.student_id WHERE req.request_id = ?`,
                [request_id]
            );

            if (studentRows.length > 0 && studentRows[0].user_id) {
                await notifyUsers({
                    sender_id: senderUserId,
                    recipient_ids: [studentRows[0].user_id],
                    title: `New Note on ${request_type}`,
                    message: `A nurse sent a message regarding your ${request_type}: "${message.trim()}"`,
                    type: 'request_note',
                    payloadData: { request_id, request_type }
                });
            }
        } else {
            const [nurses] = await pool.query(`SELECT user_id FROM nurses WHERE user_id IS NOT NULL`);
            const nurseUserIds = nurses.map(n => n.user_id).filter(Boolean);

            if (nurseUserIds.length > 0) {
                await notifyUsers({
                    sender_id: senderUserId,
                    recipient_ids: nurseUserIds,
                    title: `New Note on ${request_type}`,
                    message: `A student sent a message regarding ${request_type} (${request_id}): "${message.trim()}"`,
                    type: 'request_note',
                    payloadData: { request_id, request_type }
                });
            }
        }

        res.status(200).json({ 
            success: true, 
            message: 'Message sent successfully.' 
        });
    } catch (error) {
        console.error('Error posting note:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server Error posting note.' 
        });
    }
});

// ==========================================
// PARTNER FACILITIES & SERVICES CRUD API
// ==========================================

// ==========================================
// 1. GET MEDICAL REQUIREMENTS (For Dropdown)
// ==========================================
app.get('/api/medical-requirements', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT requirement_name FROM medical_requirements WHERE requirement_name IS NOT NULL AND requirement_name != "" ORDER BY requirement_name ASC'
        );
        const requirements = rows.map(row => row.requirement_name);
        res.status(200).json({ success: true, requirements });
    } catch (error) {
        console.error('Error fetching medical requirements:', error);
        res.status(500).json({ success: false, message: 'Server Error fetching medical requirements' });
    }
});

// ==========================================
// 2. GET PARTNER FACILITIES & SERVICES
// ==========================================
app.get('/api/partner-facilities', async (req, res) => {
    try {
        const [facilities] = await pool.query('SELECT * FROM partner_facilities ORDER BY facility_name ASC');
        const [services] = await pool.query('SELECT * FROM facility_services ORDER BY requirement_name ASC');

        const combined = facilities.map(facility => ({
            ...facility,
            services: services.filter(service => service.facility_id === facility.facility_id)
        }));

        res.status(200).json({ success: true, facilities: combined });
    } catch (error) {
        console.error('Error fetching partner facilities:', error);
        res.status(500).json({ success: false, message: 'Server Error fetching facilities' });
    }
});

// ==========================================
// 3. CREATE PARTNER FACILITY
// ==========================================
app.post('/api/partner-facilities', async (req, res) => {
    const { facility_name, address, contact_number } = req.body;
    if (!facility_name || !facility_name.trim()) {
        return res.status(400).json({ success: false, message: 'Facility name is required.' });
    }

    const facility_id = `FAC-${uuidv4().substring(0, 8)}`;
    try {
        await pool.query(
            'INSERT INTO partner_facilities (facility_id, facility_name, address, contact_number) VALUES (?, ?, ?, ?)',
            [facility_id, facility_name.trim(), address || null, contact_number || null]
        );
        res.status(201).json({ success: true, message: 'Facility created successfully.', facility_id });
    } catch (error) {
        console.error('Error creating facility:', error);
        res.status(500).json({ success: false, message: 'Failed to create facility' });
    }
});

// ==========================================
// 4. UPDATE PARTNER FACILITY
// ==========================================
app.put('/api/partner-facilities/:id', async (req, res) => {
    const { id } = req.params;
    const { facility_name, address, contact_number } = req.body;
    try {
        await pool.query(
            'UPDATE partner_facilities SET facility_name = ?, address = ?, contact_number = ? WHERE facility_id = ?',
            [facility_name.trim(), address || null, contact_number || null, id]
        );
        res.status(200).json({ success: true, message: 'Facility updated successfully.' });
    } catch (error) {
        console.error('Error updating facility:', error);
        res.status(500).json({ success: false, message: 'Failed to update facility' });
    }
});

// ==========================================
// 5. DELETE PARTNER FACILITY (AND CONNECTED SERVICES)
// ==========================================
app.delete('/api/partner-facilities/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM facility_services WHERE facility_id = ?', [id]);
        await pool.query('DELETE FROM partner_facilities WHERE facility_id = ?', [id]);
        
        res.status(200).json({ success: true, message: 'Facility and associated services deleted successfully.' });
    } catch (error) {
        console.error('Error deleting facility:', error);
        res.status(500).json({ success: false, message: 'Failed to delete facility' });
    }
});

// ==========================================
// 6. CREATE FACILITY SERVICE (WITH REQUIREMENT NAME & DUPLICATE CHECK)
// ==========================================
app.post('/api/partner-facilities/:facilityId/services', async (req, res) => {
    const { facilityId } = req.params;
    const { requirement_name, description } = req.body;

    if (!requirement_name || !requirement_name.trim()) {
        return res.status(400).json({ success: false, message: 'Requirement name is required.' });
    }

    try {
        // Prevent duplicate requirement_name for the same facility
        const [existing] = await pool.query(
            'SELECT * FROM facility_services WHERE facility_id = ? AND LOWER(requirement_name) = LOWER(?)',
            [facilityId, requirement_name.trim()]
        );

        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'This requirement/service is already added for the selected partner facility.' 
            });
        }

        const service_id = `SRV-${uuidv4().substring(0, 8)}`;
        await pool.query(
            'INSERT INTO facility_services (service_id, facility_id, requirement_name, description) VALUES (?, ?, ?, ?)',
            [service_id, facilityId, requirement_name.trim(), description || null]
        );
        res.status(201).json({ success: true, message: 'Service created successfully.', service_id });
    } catch (error) {
        console.error('Error creating facility service:', error);
        res.status(500).json({ success: false, message: 'Failed to create service' });
    }
});

// ==========================================
// 7. UPDATE FACILITY SERVICE (WITH REQUIREMENT NAME & DUPLICATE CHECK)
// ==========================================
app.put('/api/facility-services/:serviceId', async (req, res) => {
    const { serviceId } = req.params;
    const { requirement_name, description } = req.body;

    if (!requirement_name || !requirement_name.trim()) {
        return res.status(400).json({ success: false, message: 'Requirement name is required.' });
    }

    try {
        const [currentService] = await pool.query(
            'SELECT facility_id FROM facility_services WHERE service_id = ?',
            [serviceId]
        );

        if (currentService.length === 0) {
            return res.status(404).json({ success: false, message: 'Service not found.' });
        }

        const facilityId = currentService[0].facility_id;

        const [existing] = await pool.query(
            'SELECT * FROM facility_services WHERE facility_id = ? AND LOWER(requirement_name) = LOWER(?) AND service_id != ?',
            [facilityId, requirement_name.trim(), serviceId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Another service with this requirement name already exists for this facility.' 
            });
        }

        await pool.query(
            'UPDATE facility_services SET requirement_name = ?, description = ? WHERE service_id = ?',
            [requirement_name.trim(), description || null, serviceId]
        );
        res.status(200).json({ success: true, message: 'Service updated successfully.' });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({ success: false, message: 'Failed to update service' });
    }
});

// ==========================================
// 8. DELETE FACILITY SERVICE
// ==========================================
app.delete('/api/facility-services/:serviceId', async (req, res) => {
    const { serviceId } = req.params;
    try {
        await pool.query('DELETE FROM facility_services WHERE service_id = ?', [serviceId]);
        res.status(200).json({ success: true, message: 'Service deleted successfully.' });
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({ success: false, message: 'Failed to delete service' });
    }
});

// ==========================================
// UPDATED HEALTH SCREENING API ENDPOINTS
// ==========================================

// ==========================================
// HEALTH SCREENING API ENDPOINTS
// ==========================================

/**
 * Generates formatted IDs in the pattern: PREFIX-MMDDYYXXX
 * @param {string} prefix - e.g., 'HSSCHED', 'BMI', 'VSN', 'DENT'
 * @param {string} tableName - Database table to check
 * @param {string} idColumn - Column name holding the custom ID
 * @returns {Promise<string>} e.g., 'HSSCHED-100226001'
 */
async function generateCustomId(prefix, tableName, idColumn) {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  
  const dateStr = `${mm}${dd}${yy}`;
  const searchPattern = `${prefix}-${dateStr}%`;

  const [rows] = await pool.query(
    `SELECT ${idColumn} FROM ${tableName} WHERE ${idColumn} LIKE ? ORDER BY ${idColumn} DESC LIMIT 1`,
    [searchPattern]
  );

  let nextSequence = 1;

  if (rows.length > 0) {
    const lastId = rows[0][idColumn];
    const lastSeqStr = lastId.slice(-3);
    const parsedSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(parsedSeq)) {
      nextSequence = parsedSeq + 1;
    }
  }

  const paddedSeq = String(nextSequence).padStart(3, '0');
  return `${prefix}-${dateStr}${paddedSeq}`;
}

// 1. Get Academic Programs
app.get('/api/programs', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM academic_programs ORDER BY program_name ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Filtered Students
app.get('/api/filtered-students', async (req, res) => {
  try {
    const { program_id, year_level, section } = req.query;
    let query = `
      SELECT s.student_id, s.user_id, s.first_name, s.last_name, s.year_level, s.section, s.program_id, p.program_name 
      FROM students s
      LEFT JOIN academic_programs p ON s.program_id = p.program_id
      WHERE 1=1
    `;
    const params = [];

    if (program_id) {
      query += ' AND s.program_id = ?';
      params.push(program_id);
    }
    if (year_level) {
      query += ' AND s.year_level = ?';
      params.push(year_level);
    }
    if (section && section.trim() !== '') {
      query += ' AND s.section LIKE ?';
      params.push(`%${section.trim()}%`);
    }

    query += ' ORDER BY s.last_name ASC, s.first_name ASC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// HEALTH SCREENING API
// ==========================================

// One result table per screening type. Dental / Vision are legacy (read-only): they are doctor visits now.
const SCREENING_RESULT_TABLES = {
  'BMI': { table: 'bmi_monitoring_logs', idCol: 'bmi_log_id' },
  'Vital Signs': { table: 'vital_signs_records', idCol: 'vital_record_id' },
  'Hearing': { table: 'hearing_screening_records', idCol: 'hearing_record_id' },
  'Dental': { table: 'dental_assessment_records', idCol: 'dental_record_id' },
  'Vision': { table: 'vision_screening_records', idCol: 'vision_record_id' }
};

const toHms = (t) => (/^\d{2}:\d{2}$/.test(String(t || '')) ? `${t}:00` : String(t || ''));
const scheduleStartStr = (s) => `${String(s.scheduled_date).slice(0, 10)} ${s.start_time}`;
const scheduleEndStr = (s) => `${String(s.scheduled_date).slice(0, 10)} ${s.end_time}`;

const bmiFrom = (heightCm, weightKg) => {
  const h = Number(heightCm) / 100;
  const w = Number(weightKg);
  const bmi = Math.round((w / (h * h)) * 10) / 10;
  let category = 'Normal';
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi >= 30) category = 'Obese';
  else if (bmi >= 25) category = 'Overweight';
  return { bmi, category };
};

const countScreeningResults = async (conn, scheduleId) => {
  const parts = Object.values(SCREENING_RESULT_TABLES).map((t) => `(SELECT COUNT(*) FROM ${t.table} WHERE screening_schedule_id = ?)`);
  const [[row]] = await conn.query(`SELECT ${parts.join(' + ')} AS n`, Object.values(SCREENING_RESULT_TABLES).map(() => scheduleId));
  return Number(row.n);
};

const screeningResultSummary = (type, r) => {
  if (!r) return '';
  if (type === 'BMI') return `BMI ${r.bmi_value} (${r.bmi_category}), ${r.height_cm} cm, ${r.weight_kg} kg`;
  if (type === 'Vital Signs') {
    const bits = [];
    if (r.bp_systolic != null) bits.push(`BP ${r.bp_systolic}/${r.bp_diastolic}${r.bp_flag ? ` (${r.bp_flag})` : ''}`);
    if (r.pulse_rate != null) bits.push(`Pulse ${r.pulse_rate}${r.pulse_flag ? ` (${r.pulse_flag})` : ''}`);
    if (r.temperature_c != null) bits.push(`Temp ${r.temperature_c} C${r.temperature_flag ? ` (${r.temperature_flag})` : ''}`);
    if (r.respiratory_rate != null) bits.push(`Resp ${r.respiratory_rate}${r.respiratory_flag ? ` (${r.respiratory_flag})` : ''}`);
    return bits.join(', ');
  }
  if (type === 'Hearing') return `Left ear ${r.left_ear_result}, Right ear ${r.right_ear_result}`;
  if (type === 'Dental') return r.dental_findings || '';
  if (type === 'Vision') return `VA Left ${r.visual_acuity_left || '-'} / Right ${r.visual_acuity_right || '-'}`;
  return '';
};

// Participants still PENDING after the screening ended become ABSENT. Same rule as the page (end date + time),
// run by a job instead of as a hidden write inside GET requests.
const markExpiredScreeningsAbsent = async () => {
  const [result] = await pool.query(`
    UPDATE screening_schedule_participants p
    JOIN screening_schedules s ON s.screening_schedule_id = p.screening_schedule_id
    SET p.attendance_status = 'ABSENT'
    WHERE p.attendance_status = 'PENDING' AND s.status <> 'Cancelled' AND TIMESTAMP(s.scheduled_date, s.end_time) < NOW()
  `);
  return result.affectedRows;
};
cron.schedule('*/5 * * * *', () => {
  markExpiredScreeningsAbsent().catch((err) => console.error('Screening auto-absent job failed:', err.message));
}, { timezone: 'Asia/Manila' });
markExpiredScreeningsAbsent().catch((err) => console.error('Screening auto-absent job failed:', err.message));

// 3. Screening schedules with attendance and result counts
const screeningListSql = (whereSql = '', orderSql = 'ORDER BY s.scheduled_date DESC, s.start_time ASC') => {
  const resultCount = Object.values(SCREENING_RESULT_TABLES)
    .map((t) => `(SELECT COUNT(*) FROM ${t.table} WHERE screening_schedule_id = s.screening_schedule_id)`).join(' + ');
  const abnormalCount = ['bmi_monitoring_logs', 'vital_signs_records', 'hearing_screening_records']
    .map((t) => `COALESCE((SELECT SUM(is_abnormal) FROM ${t} WHERE screening_schedule_id = s.screening_schedule_id), 0)`).join(' + ');

  return `
    SELECT s.*, p.program_name,
      (SELECT COUNT(*) FROM screening_schedule_participants WHERE screening_schedule_id = s.screening_schedule_id) AS total_students,
      (SELECT COUNT(*) FROM screening_schedule_participants WHERE screening_schedule_id = s.screening_schedule_id AND attendance_status = 'PRESENT') AS present_count,
      (SELECT COUNT(*) FROM screening_schedule_participants WHERE screening_schedule_id = s.screening_schedule_id AND attendance_status = 'ABSENT') AS absent_count,
      (SELECT COUNT(*) FROM screening_schedule_participants WHERE screening_schedule_id = s.screening_schedule_id AND attendance_status = 'PENDING') AS pending_count,
      CAST(${resultCount} AS UNSIGNED) AS result_count,
      CAST(${abnormalCount} AS UNSIGNED) AS abnormal_count,
      (SELECT COUNT(*) FROM screening_schedules m WHERE m.makeup_of = s.screening_schedule_id AND m.status <> 'Cancelled') AS makeup_count
    FROM screening_schedules s
    LEFT JOIN academic_programs p ON s.target_program_id = p.program_id
    ${whereSql}
    ${orderSql}`;
};

app.get('/api/screenings', async (req, res) => {
  try {
    const [rows] = await pool.query(screeningListSql());
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Folders (Program > Year-Section) and paginated list ----------
// A screening shows up in the folder of every section it has participants from (many are created for "All Programs").
const screeningCte = (type) => ({
  sql: `
    sc AS (
      SELECT s.*, TIMESTAMP(s.scheduled_date, s.start_time) AS start_at, TIMESTAMP(s.scheduled_date, s.end_time) AS end_at,
             CASE WHEN s.status = 'Cancelled' OR NOW() > TIMESTAMP(s.scheduled_date, s.end_time) THEN 'past'
                  WHEN NOW() >= TIMESTAMP(s.scheduled_date, s.start_time) THEN 'ongoing'
                  ELSE 'upcoming' END AS tab
      FROM screening_schedules s
      ${type ? 'WHERE s.screening_type = ?' : ''}
    ),
    pp AS (
      SELECT p.screening_schedule_id, p.student_id, st.program_id, st.year_level, st.section
      FROM screening_schedule_participants p JOIN students st ON st.student_id = p.student_id
    ),
    res AS (
      SELECT student_id, screening_schedule_id, is_abnormal FROM bmi_monitoring_logs
      UNION ALL SELECT student_id, screening_schedule_id, is_abnormal FROM vital_signs_records
      UNION ALL SELECT student_id, screening_schedule_id, is_abnormal FROM hearing_screening_records
    )`,
  params: type ? [type] : []
});

const screeningFolderSql = (groupBy, extraSelect = '') => `
  SELECT ${extraSelect}
         COUNT(DISTINCT sc.screening_schedule_id) AS total,
         COUNT(DISTINCT CASE WHEN sc.tab = 'upcoming' THEN sc.screening_schedule_id END) AS upcoming,
         COUNT(DISTINCT CASE WHEN sc.tab = 'ongoing' THEN sc.screening_schedule_id END) AS ongoing,
         COUNT(DISTINCT CASE WHEN sc.tab = 'past' THEN sc.screening_schedule_id END) AS past,
         CAST(COALESCE(SUM(r.is_abnormal), 0) AS UNSIGNED) AS abnormal
  FROM pp
  JOIN sc ON sc.screening_schedule_id = pp.screening_schedule_id
  LEFT JOIN res r ON r.screening_schedule_id = pp.screening_schedule_id AND r.student_id = pp.student_id
  GROUP BY ${groupBy}`;

app.get('/api/screenings/folders', async (req, res) => {
  try {
    const type = textOrNull(req.query.type);
    const cte = screeningCte(type);
    const [programRows] = await pool.query(`WITH ${cte.sql} ${screeningFolderSql('pp.program_id', 'pp.program_id,')}`, cte.params);
    const [sectionRows] = await pool.query(`WITH ${cte.sql} ${screeningFolderSql('pp.program_id, pp.year_level, pp.section', 'pp.program_id, pp.year_level, pp.section,')}`, cte.params);
    const [names] = await pool.query('SELECT program_id, program_name FROM academic_programs');
    const nameOf = Object.fromEntries(names.map((n) => [n.program_id, n.program_name]));

    const num = (r) => ({ total: Number(r.total), upcoming: Number(r.upcoming), ongoing: Number(r.ongoing), past: Number(r.past), abnormal: Number(r.abnormal) });
    const programs = programRows.map((p) => ({
      program_id: p.program_id,
      program_name: nameOf[p.program_id] || p.program_id || 'No program',
      ...num(p),
      sections: sectionRows
        .filter((s) => s.program_id === p.program_id)
        .map((s) => ({ year_level: s.year_level, section: s.section, ...num(s) }))
        .sort((a, b) => (Number(a.year_level) - Number(b.year_level)) || String(a.section).localeCompare(String(b.section)))
    })).sort((a, b) => String(a.program_id).localeCompare(String(b.program_id)));

    res.json({ programs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/screenings/page', async (req, res) => {
  try {
    const { tab, type, program_id, year_level, section, q, from, to } = req.query;
    if (!['upcoming', 'ongoing', 'past'].includes(tab)) return res.status(400).json({ error: 'tab must be upcoming, ongoing or past.' });
    const { page, pageSize, offset } = pageParams(req.query);

    const cte = screeningCte(textOrNull(type));
    const where = ['sc.tab = ?'];
    const params = [...cte.params, tab];

    if (program_id) {
      const parts = ['pf.screening_schedule_id = sc.screening_schedule_id', 'pf.program_id = ?'];
      params.push(program_id);
      if (year_level) { parts.push('pf.year_level = ?'); params.push(year_level); }
      if (section) { parts.push('pf.section = ?'); params.push(section); }
      where.push(`EXISTS (SELECT 1 FROM pp pf WHERE ${parts.join(' AND ')})`);
    }
    const search = textOrNull(q);
    if (search) {
      where.push(`(sc.title LIKE ? OR EXISTS (SELECT 1 FROM pp pq JOIN students sq ON sq.student_id = pq.student_id
                    WHERE pq.screening_schedule_id = sc.screening_schedule_id AND (CONCAT(sq.first_name, ' ', sq.last_name) LIKE ? OR sq.student_id LIKE ?)))`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (isDateStr(from)) { where.push('sc.scheduled_date >= ?'); params.push(from); }
    if (isDateStr(to)) { where.push('sc.scheduled_date <= ?'); params.push(to); }

    const [[countRow]] = await pool.query(`WITH ${cte.sql} SELECT COUNT(*) AS n FROM sc WHERE ${where.join(' AND ')}`, params);
    const total = Number(countRow.n);

    const [ids] = await pool.query(
      `WITH ${cte.sql} SELECT sc.screening_schedule_id FROM sc WHERE ${where.join(' AND ')}
       ORDER BY sc.scheduled_date ${tab === 'past' ? 'DESC' : 'ASC'}, sc.start_time ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    let schedules = [];
    if (ids.length > 0) {
      [schedules] = await pool.query(
        screeningListSql('WHERE s.screening_schedule_id IN (?)', `ORDER BY s.scheduled_date ${tab === 'past' ? 'DESC' : 'ASC'}, s.start_time ASC`),
        [ids.map((r) => r.screening_schedule_id)]
      );
    }

    res.json({ schedules, total, page, pageSize, pageCount: Math.max(Math.ceil(total / pageSize), 1) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shared validation of the schedule fields (create + edit + make-up). Returns { error } or { data }.
const validateScreeningFields = (input) => {
  const title = textOrNull(input.title);
  if (!title) return { error: 'A screening title is required.' };
  if (title.length > 150) return { error: 'The title is too long (150 characters max).' };
  const type = input.screening_type;
  if (!isDateStr(input.scheduled_date)) return { error: 'A valid scheduled date is required.' };
  const start = toHms(input.start_time);
  const end = toHms(input.end_time);
  if (!isTimeStr(start) || !isTimeStr(end)) return { error: 'Start and end time are required.' };
  if (end <= start) return { error: 'End time must be after start time.' };
  return {
    data: {
      title, screening_type: type, scheduled_date: input.scheduled_date, start_time: start, end_time: end,
      announcement: textOrNull(input.announcement)
    }
  };
};

// 4. Create New Screening Schedule (schedule + participants in one transaction)
app.post('/api/screenings', async (req, res) => {
  const { sender_id, target_program_id, target_year_level, target_section, student_ids } = req.body;

  if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
    return res.status(400).json({ error: 'At least one participant must be selected.' });
  }

  if (LEGACY_SCREENING_TYPES.includes(req.body.screening_type)) {
    return res.status(400).json({ error: `${req.body.screening_type} examinations are now Doctor Visits. Schedule a "${req.body.screening_type} Examination" under Doctor Visits.` });
  }
  if (!HEALTH_SCREENING_TYPES.includes(req.body.screening_type)) {
    return res.status(400).json({ error: `Screening type must be one of: ${HEALTH_SCREENING_TYPES.join(', ')}.` });
  }

  const validated = validateScreeningFields(req.body);
  if (validated.error) return res.status(400).json({ error: validated.error });
  const f = validated.data;
  if (f.scheduled_date < todayManilaStr()) return res.status(400).json({ error: 'The scheduled date cannot be in the past.' });

  const uniqueIds = [...new Set(student_ids)];
  const connection = await pool.getConnection();
  let scheduleId;
  let recipientUserIds = [];
  try {
    await connection.beginTransaction();

    const [users] = await connection.query('SELECT student_id, user_id FROM students WHERE student_id IN (?)', [uniqueIds]);
    if (users.length !== uniqueIds.length) {
      await connection.rollback();
      return res.status(400).json({ error: 'One or more selected students no longer exist.' });
    }
    recipientUserIds = users.map((u) => u.user_id).filter(Boolean);

    scheduleId = await generateCustomId('HSSCHED', 'screening_schedules', 'screening_schedule_id', connection);

    await connection.query(
      `INSERT INTO screening_schedules
      (screening_schedule_id, title, screening_type, target_program_id, target_year_level, target_section, scheduled_date, start_time, end_time, announcement)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [scheduleId, f.title, f.screening_type, target_program_id || null, target_year_level || null, target_section || null, f.scheduled_date, f.start_time, f.end_time, f.announcement]
    );

    const participantValues = uniqueIds.map((sId) => [uuidv4(), scheduleId, sId, 'PENDING']);
    await connection.query(
      'INSERT INTO screening_schedule_participants (participant_id, screening_schedule_id, student_id, attendance_status) VALUES ?',
      [participantValues]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    connection.release();
    return res.status(500).json({ error: err.message });
  }
  connection.release();

  try {
    await notifyUsers({
      sender_id: sender_id || req.user?.user_id,
      recipient_ids: recipientUserIds,
      title: `Scheduled: ${f.title}`,
      message: `${f.screening_type} Screening on ${formatDateManila(f.scheduled_date)} from ${formatTimeManila(`${f.scheduled_date} ${f.start_time}`)} to ${formatTimeManila(`${f.scheduled_date} ${f.end_time}`)}.${f.announcement ? ` ${f.announcement}` : ''}`,
      type: 'SCREENING_SCHEDULED',
      payloadData: { screening_schedule_id: scheduleId, screening_type: f.screening_type, scheduled_date: f.scheduled_date, start_time: f.start_time, end_time: f.end_time }
    });
  } catch (e) {
    console.error('Screening notification failed:', e.message);
  }

  res.json({ message: 'Screening scheduled successfully!', scheduleId });
});

const loadScreening = async (conn, id, forUpdate = false) => {
  const [[row]] = await conn.query(`SELECT * FROM screening_schedules WHERE screening_schedule_id = ? ${forUpdate ? 'FOR UPDATE' : ''}`, [id]);
  return row || null;
};

const getScreeningRecipients = async (scheduleId, includeParents = false) => {
  const [rows] = await pool.query(
    `SELECT s.student_id, s.user_id FROM screening_schedule_participants p JOIN students s ON p.student_id = s.student_id WHERE p.screening_schedule_id = ?`,
    [scheduleId]
  );
  let ids = rows.map((r) => r.user_id).filter(Boolean);
  if (includeParents && rows.length > 0) {
    try { ids = [...new Set([...ids, ...await getConnectedParentUserIds(rows.map((r) => r.student_id))])]; } catch (_) {}
  }
  return ids;
};

// 5. Edit a schedule: title, type, date, times and announcement
app.put('/api/screenings/:id', async (req, res) => {
  const { id } = req.params;
  const { sender_id } = req.body;

  try {
    const existing = await loadScreening(pool, id);
    if (!existing) return res.status(404).json({ error: 'Schedule not found.' });
    if (existing.status === 'Cancelled') return res.status(409).json({ error: 'A cancelled screening cannot be edited.' });
    if (scheduleEndStr(existing) < nowManilaStr()) return res.status(409).json({ error: 'This screening has already ended, so its schedule can no longer be edited.' });

    const merged = { ...existing, ...req.body, scheduled_date: String(req.body.scheduled_date || existing.scheduled_date).slice(0, 10) };
    const validated = validateScreeningFields(merged);
    if (validated.error) return res.status(400).json({ error: validated.error });
    const f = validated.data;

    if (f.scheduled_date !== String(existing.scheduled_date).slice(0, 10) && f.scheduled_date < todayManilaStr()) {
      return res.status(400).json({ error: 'The scheduled date cannot be in the past.' });
    }

    if (f.screening_type !== existing.screening_type) {
      if (!HEALTH_SCREENING_TYPES.includes(f.screening_type)) return res.status(400).json({ error: `Screening type must be one of: ${HEALTH_SCREENING_TYPES.join(', ')}.` });
      if (await countScreeningResults(pool, id) > 0) return res.status(409).json({ error: 'Results were already recorded, so the screening type cannot be changed.' });
    }

    await pool.query(
      `UPDATE screening_schedules SET title = ?, screening_type = ?, scheduled_date = ?, start_time = ?, end_time = ?, announcement = ? WHERE screening_schedule_id = ?`,
      [f.title, f.screening_type, f.scheduled_date, f.start_time, f.end_time, f.announcement, id]
    );

    try {
      const recipients = await getScreeningRecipients(id);
      if (recipients.length > 0) {
        await notifyUsers({
          sender_id: sender_id || req.user?.user_id,
          recipient_ids: recipients,
          title: `Updated: ${f.title}`,
          message: `${f.screening_type} Screening is now on ${formatDateManila(f.scheduled_date)} from ${formatTimeManila(`${f.scheduled_date} ${f.start_time}`)} to ${formatTimeManila(`${f.scheduled_date} ${f.end_time}`)}.`,
          type: 'SCREENING_UPDATED',
          payloadData: { screening_schedule_id: id, scheduled_date: f.scheduled_date, start_time: f.start_time, end_time: f.end_time }
        });
      }
    } catch (e) { console.error('Screening update notification failed:', e.message); }

    res.json({ message: 'Schedule updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6a. Cancel (soft): the schedule and any results stay on record
app.put('/api/screenings/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const reason = textOrNull(req.body?.reason);

  try {
    const schedule = await loadScreening(pool, id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found.' });
    if (schedule.status === 'Cancelled') return res.status(409).json({ error: 'This screening is already cancelled.' });
    if (scheduleEndStr(schedule) < nowManilaStr()) return res.status(409).json({ error: 'This screening has already ended and cannot be cancelled.' });

    await pool.query(
      `UPDATE screening_schedules SET status = 'Cancelled', cancelled_reason = ?, cancelled_at = NOW() WHERE screening_schedule_id = ?`,
      [reason ? reason.slice(0, 255) : null, id]
    );

    try {
      const recipients = await getScreeningRecipients(id);
      if (recipients.length > 0) {
        await notifyUsers({
          sender_id: req.body?.sender_id || req.user?.user_id,
          recipient_ids: recipients,
          title: `Cancelled: ${schedule.title}`,
          message: `The ${schedule.screening_type} Screening on ${formatDateManila(schedule.scheduled_date)} was cancelled.${reason ? ` Reason: ${reason}` : ''}`,
          type: 'SCREENING_CANCELLED',
          payloadData: { screening_schedule_id: id }
        });
      }
    } catch (e) { console.error('Screening cancel notification failed:', e.message); }

    res.json({ message: 'Screening cancelled. Its record is kept.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6b. Delete: only when nothing was recorded
app.delete('/api/screenings/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const schedule = await loadScreening(pool, id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found.' });
    if (await countScreeningResults(pool, id) > 0) {
      return res.status(409).json({ error: 'This screening has recorded results, so it cannot be deleted. Cancel it instead to keep the history.' });
    }

    const stillActive = schedule.status !== 'Cancelled' && scheduleEndStr(schedule) >= nowManilaStr();
    const recipients = stillActive ? await getScreeningRecipients(id) : [];

    await pool.query('DELETE FROM screening_schedules WHERE screening_schedule_id = ?', [id]);

    if (recipients.length > 0) {
      try {
        await notifyUsers({
          sender_id: req.body?.sender_id || req.user?.user_id,
          recipient_ids: recipients,
          title: `Cancelled: ${schedule.title}`,
          message: `The ${schedule.screening_type} Screening on ${formatDateManila(schedule.scheduled_date)} was cancelled.`,
          type: 'SCREENING_CANCELLED',
          payloadData: { screening_schedule_id: id }
        });
      } catch (e) { console.error('Screening delete notification failed:', e.message); }
    }

    res.json({ message: 'Screening deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Start Batch Screening Notification (Triggered when staff starts the batch)
app.post('/api/screenings/:id/start', async (req, res) => {
  const { id } = req.params;
  const sender_id = req.body?.sender_id || req.user?.user_id;

  try {
    const schedule = await loadScreening(pool, id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found.' });
    if (schedule.status === 'Cancelled') return res.status(409).json({ error: 'This screening was cancelled.' });

    const [students] = await pool.query(
      `SELECT s.user_id FROM screening_schedule_participants p JOIN students s ON p.student_id = s.student_id
       WHERE p.screening_schedule_id = ? AND p.attendance_status = 'PENDING'`,
      [id]
    );

    if (students.length > 0) {
      await notifyUsers({
        sender_id,
        recipient_ids: students.map((st) => st.user_id).filter(Boolean),
        title: `Batch Started: ${schedule.title}`,
        message: `Your ${schedule.screening_type} Screening is starting now. Please proceed to the clinic area.`,
        type: 'SCREENING_BATCH_STARTED',
        payloadData: { screening_schedule_id: id }
      });
    }

    res.json({ message: students.length > 0 ? `Notified ${students.length} student(s) who have not checked in yet.` : 'Everyone has already checked in. No notification was needed.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Reminders (1 day before and same day). Used by the button and the daily job, at most once per schedule per day.
const sentScreeningReminders = new Set();

const sendScreeningReminders = async () => {
  const today = todayManilaStr();
  for (const key of sentScreeningReminders) {
    if (!key.endsWith(`|${today}`)) sentScreeningReminders.delete(key);
  }

  const rounds = [
    { offset: 1, type: 'SCREENING_REMINDER_1DAY', title: 'Reminder', when: 'tomorrow', pendingOnly: false },
    { offset: 0, type: 'SCREENING_REMINDER_SAMEDAY', title: 'Today', when: 'today', pendingOnly: true }
  ];

  let sent = 0;
  for (const round of rounds) {
    const [schedules] = await pool.query(
      `SELECT screening_schedule_id, title, screening_type, scheduled_date, start_time
       FROM screening_schedules WHERE scheduled_date = CURDATE() + INTERVAL ? DAY AND status = 'Scheduled'`,
      [round.offset]
    );

    for (const schedule of schedules) {
      const key = `${round.type}|${schedule.screening_schedule_id}|${today}`;
      if (sentScreeningReminders.has(key)) continue;

      const [students] = await pool.query(
        `SELECT s.student_id, s.user_id FROM screening_schedule_participants p JOIN students s ON p.student_id = s.student_id
         WHERE p.screening_schedule_id = ? ${round.pendingOnly ? "AND p.attendance_status = 'PENDING'" : ''}`,
        [schedule.screening_schedule_id]
      );
      if (students.length === 0) continue;

      sentScreeningReminders.add(key);
      let recipients = students.map((s) => s.user_id).filter(Boolean);
      try { recipients = [...new Set([...recipients, ...await getConnectedParentUserIds(students.map((s) => s.student_id))])]; } catch (_) {}

      await notifyUsers({
        sender_id: null,
        recipient_ids: recipients,
        title: `${round.title}: ${schedule.title}`,
        message: `${schedule.screening_type} Screening ${round.when} at ${formatTimeManila(`${String(schedule.scheduled_date).slice(0, 10)} ${schedule.start_time}`)}.`,
        type: round.type,
        payloadData: { screening_schedule_id: schedule.screening_schedule_id }
      });
      sent++;
    }
  }
  return sent;
};

cron.schedule('0 7 * * *', () => {
  sendScreeningReminders().catch((err) => console.error('Screening reminder job failed:', err.message));
}, { timezone: 'Asia/Manila' });

app.post('/api/screenings/send-reminders', async (req, res) => {
  try {
    const sent = await sendScreeningReminders();
    res.json({ message: sent > 0 ? `Sent reminders for ${sent} screening(s).` : 'No new reminders to send (already sent or nothing scheduled today/tomorrow).', sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Get Participants with attendance and results (read-only; absences are handled by the job above)
app.get('/api/screenings/:id/students', async (req, res) => {
  const { id } = req.params;
  try {
    const schedule = await loadScreening(pool, id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    const resultTable = SCREENING_RESULT_TABLES[schedule.screening_type];
    const docQuery = resultTable
      ? `LEFT JOIN ${resultTable.table} record ON record.student_id = st.student_id AND record.screening_schedule_id = p.screening_schedule_id`
      : '';

    const [rows] = await pool.query(`
      SELECT ${docQuery ? 'record.*, ' : ''}st.*, prog.program_name, p.participant_id, p.screening_schedule_id, p.attendance_status, p.attended_at, p.attendance_note, p.referral_appointment_id,
             ra.start_time AS referral_start_time, ra.status AS referral_status
      FROM screening_schedule_participants p
      JOIN students st ON p.student_id = st.student_id
      LEFT JOIN academic_programs prog ON st.program_id = prog.program_id
      LEFT JOIN doctor_appointments ra ON ra.appointment_id = p.referral_appointment_id
      ${docQuery}
      WHERE p.screening_schedule_id = ?
      ORDER BY st.last_name ASC, st.first_name ASC
    `, [id]);

    res.json({ schedule, students: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. QR / manual attendance. Outside the scheduled window the nurse has to confirm (force).
app.post('/api/screenings/:id/scan-qr', async (req, res) => {
  const { id } = req.params;
  const { student_id, force } = req.body;

  try {
    const schedule = await loadScreening(pool, id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found.' });
    if (schedule.status === 'Cancelled') return res.status(409).json({ error: 'This screening was cancelled.' });

    const [participant] = await pool.query(
      `SELECT p.*, s.first_name, s.last_name
       FROM screening_schedule_participants p
       JOIN students s ON p.student_id = s.student_id
       WHERE p.screening_schedule_id = ? AND p.student_id = ?`,
      [id, student_id]
    );

    if (participant.length === 0) {
      return res.status(404).json({ error: 'Student is not assigned to this screening schedule.' });
    }

    const studentName = `${participant[0].first_name} ${participant[0].last_name}`;
    if (participant[0].attendance_status === 'PRESENT') {
      return res.json({ message: `${studentName} is already marked PRESENT.`, student: participant[0] });
    }

    const nowStr = nowManilaStr();
    if ((nowStr < scheduleStartStr(schedule) || nowStr > scheduleEndStr(schedule)) && !force) {
      return res.status(409).json({
        error: `This screening runs ${formatTimeManila(scheduleStartStr(schedule))} - ${formatTimeManila(scheduleEndStr(schedule))}. Marking ${studentName} present now is outside that time.`,
        outside_window: true
      });
    }

    await pool.query(
      `UPDATE screening_schedule_participants
       SET attendance_status = 'PRESENT', attended_at = NOW(), attendance_note = NULL
       WHERE screening_schedule_id = ? AND student_id = ?`,
      [id, student_id]
    );

    res.json({ message: `Attendance marked PRESENT for ${studentName}`, student: participant[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Manual attendance override (needs a reason; a student with a recorded result cannot be moved away from PRESENT)
app.put('/api/screenings/:id/students/:studentId/attendance', async (req, res) => {
  const { id, studentId } = req.params;
  const { attendance_status } = req.body;
  const reason = textOrNull(req.body.reason);

  if (!['PENDING', 'PRESENT', 'ABSENT'].includes(attendance_status)) {
    return res.status(400).json({ error: 'Invalid attendance status.' });
  }
  if (!reason) return res.status(400).json({ error: 'Please give a reason for changing the attendance.' });

  try {
    const schedule = await loadScreening(pool, id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found.' });
    if (schedule.status === 'Cancelled') return res.status(409).json({ error: 'This screening was cancelled.' });

    const resultTable = SCREENING_RESULT_TABLES[schedule.screening_type];
    if (attendance_status !== 'PRESENT' && resultTable) {
      const [[has]] = await pool.query(`SELECT COUNT(*) AS n FROM ${resultTable.table} WHERE screening_schedule_id = ? AND student_id = ?`, [id, studentId]);
      if (has.n > 0) return res.status(409).json({ error: 'A result is already recorded for this student. Delete the result first.' });
    }

    const [result] = await pool.query(
      `UPDATE screening_schedule_participants
       SET attendance_status = ?, attended_at = ${attendance_status === 'PRESENT' ? 'NOW()' : 'NULL'}, attendance_note = ?
       WHERE screening_schedule_id = ? AND student_id = ?`,
      [attendance_status, reason.slice(0, 255), id, studentId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Student is not part of this screening.' });

    res.json({ message: `Attendance status updated to ${attendance_status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reference ranges used for Vital Signs flags (school-age / young adult, resting).
function classifyVitalSigns({ bp_systolic, bp_diastolic, pulse_rate, temperature_c, respiratory_rate }) {
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  const sys = num(bp_systolic), dia = num(bp_diastolic), pulse = num(pulse_rate), temp = num(temperature_c), resp = num(respiratory_rate);

  let bp = null;
  if (sys !== null && dia !== null) {
    if (sys < 90 || dia < 60) bp = 'Low';
    else if (sys >= 130 || dia >= 80) bp = 'High';
    else if (sys >= 120) bp = 'Elevated';
    else bp = 'Normal';
  }
  const pulseFlag = pulse === null ? null : pulse < 60 ? 'Low' : pulse > 100 ? 'High' : 'Normal';
  const tempFlag = temp === null ? null : temp < 36.1 ? 'Low' : temp >= 38 ? 'High' : temp > 37.5 ? 'Elevated' : 'Normal';
  const respFlag = resp === null ? null : resp < 12 ? 'Low' : resp > 20 ? 'High' : 'Normal';

  const flags = [bp, pulseFlag, tempFlag, respFlag];
  return {
    bp_flag: bp,
    pulse_flag: pulseFlag,
    temperature_flag: tempFlag,
    respiratory_flag: respFlag,
    is_abnormal: flags.some((f) => f && f !== 'Normal') ? 1 : 0
  };
}

// 12. Document (add or edit) a student's result. Re-saving updates the same record.
app.post('/api/screenings/:id/document', async (req, res) => {
  const { id } = req.params;
  const { student_id, screening_type, formData } = req.body;

  try {
    const sched = await loadScreening(pool, id);
    if (!sched) return res.status(404).json({ error: 'Screening schedule not found.' });
    if (sched.status === 'Cancelled') return res.status(409).json({ error: 'This screening was cancelled, so results cannot be recorded.' });

    const type = sched.screening_type;
    if (LEGACY_SCREENING_TYPES.includes(type)) {
      return res.status(400).json({ error: `${type} examinations are now Doctor Visits. Schedule a "${type} Examination" doctor visit instead.` });
    }
    if (!HEALTH_SCREENING_TYPES.includes(type)) {
      return res.status(400).json({ error: `Unsupported screening type: ${type}.` });
    }
    if (screening_type && screening_type !== type) {
      return res.status(400).json({ error: 'Screening type does not match the schedule.' });
    }
    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({ error: 'Result details are required.' });
    }

    const [part] = await pool.query(
      `SELECT attendance_status FROM screening_schedule_participants WHERE screening_schedule_id = ? AND student_id = ?`,
      [id, student_id]
    );

    if (part.length === 0 || part[0].attendance_status !== 'PRESENT') {
      return res.status(400).json({ error: 'Student must be marked PRESENT before documenting results.' });
    }

    const resultTable = SCREENING_RESULT_TABLES[type];
    const [previousRows] = await pool.query(`SELECT is_abnormal FROM ${resultTable.table} WHERE screening_schedule_id = ? AND student_id = ?`, [id, student_id]);
    const previous = previousRows[0] || null;

    let abnormal = 0;

    if (type === 'BMI') {
      const height = Number(formData.height_cm);
      const weight = Number(formData.weight_kg);
      if (!Number.isFinite(height) || height < 50 || height > 250) return res.status(400).json({ error: 'Height must be between 50 and 250 cm.' });
      if (!Number.isFinite(weight) || weight < 10 || weight > 300) return res.status(400).json({ error: 'Weight must be between 10 and 300 kg.' });
      // BMI and category are always computed here, never trusted from the browser
      const { bmi, category } = bmiFrom(height, weight);
      abnormal = category !== 'Normal' ? 1 : 0;
      const logId = await generateCustomId('BMI', 'bmi_monitoring_logs', 'bmi_log_id');

      await pool.query(`
        INSERT INTO bmi_monitoring_logs (bmi_log_id, student_id, screening_schedule_id, height_cm, weight_kg, bmi_value, bmi_category, is_abnormal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE height_cm = VALUES(height_cm), weight_kg = VALUES(weight_kg), bmi_value = VALUES(bmi_value), bmi_category = VALUES(bmi_category), is_abnormal = VALUES(is_abnormal), logged_at = NOW()
      `, [logId, student_id, id, height, weight, bmi, category, abnormal]);

    } else if (type === 'Vital Signs') {
      const f = formData;
      const toInt = (v) => (v === '' || v == null ? null : parseInt(v, 10));
      const toDec = (v) => (v === '' || v == null ? null : parseFloat(v));
      const sys = toInt(f.bp_systolic);
      const dia = toInt(f.bp_diastolic);
      const pulse = toInt(f.pulse_rate);
      const temp = toDec(f.temperature_c);
      const resp = toInt(f.respiratory_rate);

      if ([sys, dia, pulse, temp, resp].every((v) => v === null)) {
        return res.status(400).json({ error: 'Enter at least one vital sign.' });
      }
      if ((sys === null) !== (dia === null)) {
        return res.status(400).json({ error: 'Enter both systolic and diastolic blood pressure.' });
      }
      const inRange = (v, lo, hi) => v === null || (Number.isFinite(v) && v >= lo && v <= hi);
      if (!inRange(sys, 40, 300) || !inRange(dia, 20, 200) || !inRange(pulse, 20, 250) || !inRange(temp, 30, 45) || !inRange(resp, 5, 80)) {
        return res.status(400).json({ error: 'One or more vital sign values are outside a plausible range.' });
      }

      const flags = classifyVitalSigns({ bp_systolic: sys, bp_diastolic: dia, pulse_rate: pulse, temperature_c: temp, respiratory_rate: resp });
      abnormal = flags.is_abnormal;
      const recordId = await generateCustomId('VITAL', 'vital_signs_records', 'vital_record_id');

      await pool.query(`
        INSERT INTO vital_signs_records
          (vital_record_id, student_id, screening_schedule_id, bp_systolic, bp_diastolic, pulse_rate, temperature_c, respiratory_rate,
           bp_flag, pulse_flag, temperature_flag, respiratory_flag, is_abnormal, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE bp_systolic = VALUES(bp_systolic), bp_diastolic = VALUES(bp_diastolic), pulse_rate = VALUES(pulse_rate),
          temperature_c = VALUES(temperature_c), respiratory_rate = VALUES(respiratory_rate), bp_flag = VALUES(bp_flag),
          pulse_flag = VALUES(pulse_flag), temperature_flag = VALUES(temperature_flag), respiratory_flag = VALUES(respiratory_flag),
          is_abnormal = VALUES(is_abnormal), remarks = VALUES(remarks), recorded_at = NOW()
      `, [recordId, student_id, id, sys, dia, pulse, temp, resp, flags.bp_flag, flags.pulse_flag, flags.temperature_flag,
          flags.respiratory_flag, flags.is_abnormal, textOrNull(f.remarks)]);

    } else if (type === 'Hearing') {
      const left = textOrNull(formData.left_ear_result);
      const right = textOrNull(formData.right_ear_result);
      if (!['Pass', 'Refer'].includes(left) || !['Pass', 'Refer'].includes(right)) {
        return res.status(400).json({ error: 'Select Pass or Refer for both ears.' });
      }
      const recordId = await generateCustomId('HEAR', 'hearing_screening_records', 'hearing_record_id');
      abnormal = left === 'Refer' || right === 'Refer' ? 1 : 0;

      await pool.query(`
        INSERT INTO hearing_screening_records
          (hearing_record_id, student_id, screening_schedule_id, left_ear_result, right_ear_result, is_abnormal, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE left_ear_result = VALUES(left_ear_result), right_ear_result = VALUES(right_ear_result),
          is_abnormal = VALUES(is_abnormal), remarks = VALUES(remarks), recorded_at = NOW()
      `, [recordId, student_id, id, left, right, abnormal, textOrNull(formData.remarks)]);
    }

    // Tell the student and parents when a result is abnormal (once, not on every re-save)
    if (abnormal && !(previous && previous.is_abnormal)) {
      try {
        const [[stu]] = await pool.query('SELECT user_id FROM students WHERE student_id = ?', [student_id]);
        const parents = await getConnectedParentUserIds([student_id]);
        await notifyUsers({
          sender_id: null,
          recipient_ids: [...new Set([stu?.user_id, ...parents].filter(Boolean))],
          title: `${type} Screening Result`,
          message: `A ${type} result needs attention. Please follow up with the school clinic.`,
          type: 'SCREENING_RESULT',
          payloadData: { screening_schedule_id: id }
        });
      } catch (e) { console.error('Screening result notification failed:', e.message); }
    }

    res.json({ message: 'Screening documentation saved successfully.', is_abnormal: abnormal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Delete a recorded result (so it can be redone). The attendance stays.
app.delete('/api/screenings/:id/students/:studentId/result', async (req, res) => {
  const { id, studentId } = req.params;
  try {
    const schedule = await loadScreening(pool, id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found.' });
    const resultTable = SCREENING_RESULT_TABLES[schedule.screening_type];
    if (!resultTable) return res.status(400).json({ error: 'Unsupported screening type.' });

    const [result] = await pool.query(`DELETE FROM ${resultTable.table} WHERE screening_schedule_id = ? AND student_id = ?`, [id, studentId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'No result is recorded for this student.' });
    res.json({ message: 'Result deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Refer a student with a recorded result to a doctor (creates a Referral doctor visit in an open doctor slot)
app.post('/api/screenings/:id/students/:studentId/refer', async (req, res) => {
  const { id, studentId } = req.params;
  const { nurse_id, doctor_id, sender_id } = req.body;
  const startStr = String(req.body.start_time || '').replace('T', ' ').slice(0, 19);
  const duration = parseInt(req.body.duration_min, 10) || 15;
  if (!nurse_id || !doctor_id) return res.status(400).json({ error: 'Nurse and doctor are required.' });
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(startStr)) return res.status(400).json({ error: 'Pick a date and time slot for the referral.' });

  const connection = await pool.getConnection();
  let created = null;
  try {
    await connection.beginTransaction();

    const schedule = await loadScreening(connection, id);
    if (!schedule) throw new BookingError('Schedule not found.', 404);
    const resultTable = SCREENING_RESULT_TABLES[schedule.screening_type];
    const [[record]] = await connection.query(`SELECT * FROM ${resultTable.table} WHERE screening_schedule_id = ? AND student_id = ?`, [id, studentId]);
    if (!record) throw new BookingError('Document the result first, then refer the student.');

    const [[participant]] = await connection.query(
      `SELECT p.referral_appointment_id, da.status AS referral_status
       FROM screening_schedule_participants p LEFT JOIN doctor_appointments da ON da.appointment_id = p.referral_appointment_id
       WHERE p.screening_schedule_id = ? AND p.student_id = ? FOR UPDATE`,
      [id, studentId]
    );
    if (participant && participant.referral_appointment_id && ['Scheduled', 'Pending Approval'].includes(participant.referral_status)) {
      throw new BookingError('This student already has an active doctor referral from this screening.');
    }

    const doctor = await lockDoctor(connection, doctor_id);
    if (!doctor) throw new BookingError('Doctor not found.', 404);

    const endStr = addMinutesToStr(startStr, duration);
    await assertAppointmentFits(connection, { doctor, visitType: 'Referral', startStr, endStr, studentId, graceMin: 5 });

    const summary = screeningResultSummary(schedule.screening_type, record);
    const appointmentId = await generateCustomId('DVSCHED', 'doctor_appointments', 'appointment_id', connection);
    await connection.query(
      `INSERT INTO doctor_appointments
         (appointment_id, doctor_id, batch_id, title, announcement, start_time, end_time, assigned_by_nurse_id, status, visit_type, booking_source, booking_reason)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'Scheduled', 'Referral', 'Nurse', ?)`,
      [appointmentId, doctor_id, `Referral: ${schedule.title}`.slice(0, 45), `Referred from the ${schedule.screening_type} screening. ${summary}`, startStr, endStr, nurse_id,
       `Referred from ${schedule.title}: ${summary}`.slice(0, 255)]
    );
    await connection.query(`INSERT INTO doctor_appointment_students (appointment_id, student_id, attendance_status) VALUES (?, ?, 'Pending')`, [appointmentId, studentId]);
    await connection.query(`UPDATE screening_schedule_participants SET referral_appointment_id = ? WHERE screening_schedule_id = ? AND student_id = ?`, [appointmentId, id, studentId]);

    await connection.commit();
    created = { appointmentId, doctor, startStr, schedule };
  } catch (error) {
    await connection.rollback();
    connection.release();
    if (error instanceof BookingError) return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: error.message });
  }
  connection.release();

  try {
    const [[stu]] = await pool.query('SELECT user_id FROM students WHERE student_id = ?', [studentId]);
    const parents = await getConnectedParentUserIds([studentId]);
    await notifyUsers({
      sender_id: sender_id || null,
      recipient_ids: [...new Set([stu?.user_id, ...parents].filter(Boolean))],
      title: 'Doctor Referral Scheduled',
      message: `After your ${created.schedule.screening_type} screening, a doctor visit with ${doctorDisplayName(created.doctor)} is set for ${formatDateTimeManila(created.startStr)}.`,
      type: 'APPOINTMENT_SCHEDULED',
      payloadData: { appointment_id: created.appointmentId }
    });
  } catch (e) { console.error('Referral notification failed:', e.message); }

  res.status(201).json({ message: 'Doctor referral scheduled.', appointment_id: created.appointmentId });
});

// 15. Make-up session for the students who were absent
app.post('/api/screenings/:id/makeup', async (req, res) => {
  const { id } = req.params;
  const { sender_id } = req.body;

  const connection = await pool.getConnection();
  let created = null;
  try {
    await connection.beginTransaction();
    const source = await loadScreening(connection, id, true);
    if (!source) throw new BookingError('Schedule not found.', 404);
    if (source.status === 'Cancelled') throw new BookingError('A cancelled screening cannot have a make-up session.');
    if (scheduleEndStr(source) >= nowManilaStr()) throw new BookingError('The screening has not ended yet. Make-up sessions are for students who missed it.');
    if (!HEALTH_SCREENING_TYPES.includes(source.screening_type)) throw new BookingError('Make-up sessions are only available for current screening types.');

    const validated = validateScreeningFields({
      title: textOrNull(req.body.title) || `Make-up: ${source.title}`.slice(0, 150),
      screening_type: source.screening_type,
      scheduled_date: req.body.scheduled_date,
      start_time: req.body.start_time,
      end_time: req.body.end_time,
      announcement: req.body.announcement
    });
    if (validated.error) throw new BookingError(validated.error, 400);
    const f = validated.data;
    if (f.scheduled_date < todayManilaStr() || scheduleStartStr(f) < nowManilaStr()) throw new BookingError('The make-up session must be in the future.', 400);

    // students who did not attend and are not already booked into another active make-up of this screening
    const [absentees] = await connection.query(
      `SELECT p.student_id, s.user_id FROM screening_schedule_participants p JOIN students s ON s.student_id = p.student_id
       WHERE p.screening_schedule_id = ? AND p.attendance_status IN ('ABSENT', 'PENDING')
         AND p.student_id NOT IN (
           SELECT mp.student_id FROM screening_schedules m
           JOIN screening_schedule_participants mp ON mp.screening_schedule_id = m.screening_schedule_id
           WHERE m.makeup_of = ? AND m.status <> 'Cancelled')`,
      [id, id]
    );
    if (absentees.length === 0) throw new BookingError('There is no absent student left who still needs a make-up session.');

    const newId = await generateCustomId('HSSCHED', 'screening_schedules', 'screening_schedule_id', connection);
    await connection.query(
      `INSERT INTO screening_schedules
         (screening_schedule_id, title, screening_type, target_program_id, target_year_level, target_section, scheduled_date, start_time, end_time, announcement, makeup_of)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, f.title, f.screening_type, source.target_program_id, source.target_year_level, source.target_section, f.scheduled_date, f.start_time, f.end_time, f.announcement, id]
    );
    await connection.query(
      'INSERT INTO screening_schedule_participants (participant_id, screening_schedule_id, student_id, attendance_status) VALUES ?',
      [absentees.map((a) => [uuidv4(), newId, a.student_id, 'PENDING'])]
    );
    await connection.commit();
    created = { newId, f, absentees };
  } catch (error) {
    await connection.rollback();
    connection.release();
    if (error instanceof BookingError) return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: error.message });
  }
  connection.release();

  try {
    let recipients = created.absentees.map((a) => a.user_id).filter(Boolean);
    try { recipients = [...new Set([...recipients, ...await getConnectedParentUserIds(created.absentees.map((a) => a.student_id))])]; } catch (_) {}
    await notifyUsers({
      sender_id: sender_id || null,
      recipient_ids: recipients,
      title: `Make-up: ${created.f.title}`,
      message: `You missed the ${created.f.screening_type} screening. A make-up session is on ${formatDateManila(created.f.scheduled_date)} from ${formatTimeManila(`${created.f.scheduled_date} ${created.f.start_time}`)} to ${formatTimeManila(`${created.f.scheduled_date} ${created.f.end_time}`)}.`,
      type: 'SCREENING_SCHEDULED',
      payloadData: { screening_schedule_id: created.newId }
    });
  } catch (e) { console.error('Make-up notification failed:', e.message); }

  res.status(201).json({ message: `Make-up session created for ${created.absentees.length} student(s).`, scheduleId: created.newId, students: created.absentees.length });
});

// 16. Results of one screening: rows, summary and distribution (for the printout / CSV)
app.get('/api/screenings/:id/results', async (req, res) => {
  const { id } = req.params;
  try {
    const schedule = await loadScreening(pool, id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found.' });
    const resultTable = SCREENING_RESULT_TABLES[schedule.screening_type];

    const [rows] = await pool.query(`
      SELECT ${resultTable ? 'record.*, ' : ''}st.student_id, st.first_name, st.last_name, st.year_level, st.section, prog.program_name,
             p.attendance_status, p.attendance_note
      FROM screening_schedule_participants p
      JOIN students st ON p.student_id = st.student_id
      LEFT JOIN academic_programs prog ON st.program_id = prog.program_id
      ${resultTable ? `LEFT JOIN ${resultTable.table} record ON record.student_id = st.student_id AND record.screening_schedule_id = p.screening_schedule_id` : ''}
      WHERE p.screening_schedule_id = ?
      ORDER BY st.last_name ASC, st.first_name ASC
    `, [id]);

    const ended = scheduleEndStr(schedule) < nowManilaStr();
    const summary = { total: rows.length, present: 0, absent: 0, pending: 0, documented: 0, abnormal: 0, distribution: {} };
    const bump = (label) => { summary.distribution[label] = (summary.distribution[label] || 0) + 1; };

    const out = rows.map((r) => {
      let attendance = r.attendance_status;
      if (ended && attendance === 'PENDING') attendance = 'ABSENT';
      if (attendance === 'PRESENT') summary.present++;
      else if (attendance === 'ABSENT') summary.absent++;
      else summary.pending++;

      const idCol = resultTable ? resultTable.idCol : null;
      const documented = !!(idCol && r[idCol]);
      if (documented) {
        summary.documented++;
        if (r.is_abnormal) summary.abnormal++;
        if (schedule.screening_type === 'BMI') bump(r.bmi_category);
        else if (schedule.screening_type === 'Vital Signs') bump(`BP ${r.bp_flag || 'not taken'}`);
        else if (schedule.screening_type === 'Hearing') bump(r.is_abnormal ? 'Refer' : 'Pass');
      }
      return { ...r, attendance_status: attendance, documented, result_summary: documented ? screeningResultSummary(schedule.screening_type, r) : '' };
    });

    res.json({ schedule, summary, rows: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 17. Screening history of one student across all screening types
app.get('/api/students/:studentId/screening-history', async (req, res) => {
  const { studentId } = req.params;
  try {
    const history = [];
    for (const [type, t] of Object.entries(SCREENING_RESULT_TABLES)) {
      const [rows] = await pool.query(
        `SELECT r.*, s.title, s.scheduled_date FROM ${t.table} r JOIN screening_schedules s ON s.screening_schedule_id = r.screening_schedule_id WHERE r.student_id = ?`,
        [studentId]
      );
      rows.forEach((r) => history.push({
        screening_type: LEGACY_SCREENING_TYPES.includes(type) ? `${type} (legacy)` : type,
        screening_schedule_id: r.screening_schedule_id,
        title: r.title,
        date: r.scheduled_date,
        summary: screeningResultSummary(type, r),
        is_abnormal: r.is_abnormal ? 1 : 0,
        remarks: r.remarks || null
      }));
    }
    history.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 1. DOCTOR VISIT API
// ==========================================

const DOCTOR_VISIT_TYPES = ['General Check Up', 'Dental', 'Vision', 'Other', 'Follow-up', 'Referral'];
// What a student / nurse / doctor can pick as the purpose of a visit. "Other" must be specified (purpose_other).
const VISIT_PURPOSES = ['General Check Up', 'Dental', 'Vision', 'Other'];
const visitLabel = (type, other) => (type === 'Other' && other ? `Other: ${other}` : type);
const HEALTH_SCREENING_TYPES = ['BMI', 'Vital Signs', 'Hearing'];
// Dental / Vision used to be Health Screening types; they are now Doctor Visit types.
// Old schedules keep their type so history stays readable, but no new results are taken.
const LEGACY_SCREENING_TYPES = ['Dental', 'Vision'];

const toFlag = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);
const toCount = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
};
const textOrNull = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
};

/**
 * Generates formatted IDs in the pattern: PREFIX-MMDDYYXXX
 * @param {string} prefix - e.g., 'DVSCHED', 'DVAS'
 * @param {string} tableName - Target database table
 * @param {string} idColumn - Primary ID column name
 * @param {object} [dbExecutor=pool] - Optional database pool or connection (for transactions)
 * @returns {Promise<string>} e.g., 'DVSCHED-100226001'
 */
async function generateCustomId(prefix, tableName, idColumn, dbExecutor = pool) {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  
  const dateStr = `${mm}${dd}${yy}`;
  const searchPattern = `${prefix}-${dateStr}%`;

  const [rows] = await dbExecutor.query(
    `SELECT ${idColumn} FROM ${tableName} WHERE ${idColumn} LIKE ? ORDER BY ${idColumn} DESC LIMIT 1`,
    [searchPattern]
  );

  let nextSequence = 1;

  if (rows.length > 0) {
    const lastId = rows[0][idColumn];
    const lastSeqStr = lastId.slice(-3);
    const parsedSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(parsedSeq)) {
      nextSequence = parsedSeq + 1;
    }
  }

  const paddedSeq = String(nextSequence).padStart(3, '0');
  return `${prefix}-${dateStr}${paddedSeq}`;
}

// Get all doctors
app.get('/api/doctors', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM doctors ORDER BY last_name ASC');
        res.json({ success: true, doctors: rows });
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).json({ success: false, message: 'Server error fetching doctors' });
    }
});

// Add new doctor
app.post('/api/doctors', async (req, res) => {
    const { first_name, last_name, specialization, contact_number } = req.body;
    const doctor_id = `DOC-${uuidv4().substring(0, 8)}`;

    try {
        await pool.query(
            `INSERT INTO doctors (doctor_id, first_name, last_name, specialization, contact_number) 
             VALUES (?, ?, ?, ?, ?)`,
            [doctor_id, first_name, last_name, specialization, contact_number]
        );
        res.json({ success: true, message: 'Doctor added successfully', doctor_id });
    } catch (error) {
        console.error('Error adding doctor:', error);
        res.status(500).json({ success: false, message: 'Failed to add doctor' });
    }
});

// Update doctor profile
app.put('/api/doctors/:id', async (req, res) => {
    const doctor_id = req.params.id;
    const { first_name, last_name, specialization, contact_number } = req.body;

    try {
        await pool.query(
            `UPDATE doctors 
             SET first_name = ?, last_name = ?, specialization = ?, contact_number = ? 
             WHERE doctor_id = ?`,
            [first_name, last_name, specialization, contact_number, doctor_id]
        );
        res.json({ success: true, message: 'Doctor updated successfully' });
    } catch (error) {
        console.error('Error updating doctor:', error);
        res.status(500).json({ success: false, message: 'Failed to update doctor' });
    }
});

// ==========================================
// 2. HELPER DATA
// ==========================================

app.get('/api/students-list', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT s.student_id, s.user_id, s.first_name, s.last_name, s.program_id, s.year_level, s.section, p.program_name 
             FROM students s 
             LEFT JOIN academic_programs p ON s.program_id = p.program_id`
        );
        res.json({ success: true, students: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load students' });
    }
});

app.get('/api/academic-programs', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM academic_programs ORDER BY program_name ASC');
        res.json({ success: true, programs: rows });
    } catch (error) {
        console.error('Error fetching academic programs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch academic programs' });
    }
});

// ==========================================
// 3. MASS SCHEDULING & APPOINTMENT CREATION
// ==========================================

// POST /api/mass-schedules
app.post('/api/mass-schedules', async (req, res) => {
    const { 
        assigned_by_nurse_id, 
        doctor_id, 
        title, 
        announcement, 
        target_program, 
        target_year_level, 
        target_section, 
        batch_start_time, 
        batch_end_time,
        student_appointments
    } = req.body;
    const visit_type = req.body.visit_type || 'General Check Up';
    const purpose_other = visit_type === 'Other' ? textOrNull(req.body.purpose_other) : null;

    if (!assigned_by_nurse_id) {
        return res.status(400).json({ success: false, message: 'Nurse ID is required.' });
    }

    if (!DOCTOR_VISIT_TYPES.includes(visit_type)) {
        return res.status(400).json({ success: false, message: `Invalid visit type. Allowed: ${DOCTOR_VISIT_TYPES.join(', ')}.` });
    }
    if (visit_type === 'Other' && !purpose_other) {
        return res.status(400).json({ success: false, message: 'Please specify the purpose of the visit.' });
    }

    if (!Array.isArray(student_appointments) || student_appointments.length === 0) {
        return res.status(400).json({ success: false, message: 'Select at least one student.' });
    }

    const connection = await pool.getConnection();
    const pendingNotifications = [];

    try {
        await connection.beginTransaction();

        const [nurseRows] = await connection.query(
            `SELECT user_id FROM nurses WHERE nurse_id = ?`,
            [assigned_by_nurse_id]
        );
        const sender_id = nurseRows[0]?.user_id || null;

        // Serialize bookings for this doctor, then require the doctor to have a matching open schedule
        const doctor = await lockDoctor(connection, doctor_id);
        if (!doctor) throw new BookingError('Doctor not found.', 404);
        if (!doctorMatchesVisitType(doctor.specialization, visit_type)) {
            throw new BookingError(`${doctorDisplayName(doctor)} (${doctor.specialization || 'no specialization'}) cannot take ${visit_type} visits.`, 400);
        }
        const doctorName = doctorDisplayName(doctor);

        const batch_id = `BATCH-${uuidv4().substring(0, 8)}`;

        await connection.query(
            `INSERT INTO mass_schedule_batches 
             (batch_id, assigned_by_nurse_id, target_program, target_year_level, target_section, start_time, end_time, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [batch_id, assigned_by_nurse_id, target_program, target_year_level, target_section, batch_start_time, batch_end_time]
        );

        for (const appt of student_appointments) {
            // Generates appointment ID in DVSCHED-MMDDYYXXX format
            const appointment_id = await generateCustomId('DVSCHED', 'doctor_appointments', 'appointment_id', connection);

            await assertAppointmentFits(connection, {
                doctor, visitType: visit_type, graceMin: 10, studentId: appt.student_id,
                startStr: String(appt.start_time).replace('T', ' ').slice(0, 19),
                endStr: String(appt.end_time).replace('T', ' ').slice(0, 19)
            });
            
            await connection.query(
                `INSERT INTO doctor_appointments 
                 (appointment_id, doctor_id, batch_id, title, announcement, start_time, end_time, assigned_by_nurse_id, status, visit_type, purpose_other)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?)`,
                [appointment_id, doctor_id, batch_id, title, announcement, appt.start_time, appt.end_time, assigned_by_nurse_id, visit_type, purpose_other]
            );
            await logAppointment(connection, {
                appointment_id, action: 'Scheduled', to_status: 'Scheduled', new_start_time: appt.start_time, new_end_time: appt.end_time,
                reason: 'Scheduled in a batch by the nurse', actor_user_id: sender_id, actor_role: 'Nurse'
            });

            await connection.query(
                `INSERT INTO doctor_appointment_students 
                 (appointment_id, student_id, attendance_status) 
                 VALUES (?, ?, 'Pending')`,
                [appointment_id, appt.student_id]
            );

            if (appt.user_id) {
                pendingNotifications.push({
                    sender_id,
                    recipient_ids: [appt.user_id],
                    title: `Doctor Visit Scheduled`,
                    message: `${visitLabel(visit_type, purpose_other)} with ${doctorName} on ${formatDateTimeManila(appt.start_time)}.`,
                    type: 'APPOINTMENT_SCHEDULED',
                    payloadData: { appointment_id, batch_id }
                });
            }
        }
        if (doctor.user_id) {
            pendingNotifications.push({
                sender_id,
                recipient_ids: [doctor.user_id],
                title: 'New Appointments Scheduled',
                message: `${student_appointments.length} ${visitLabel(visit_type, purpose_other)} appointment(s) were scheduled for you: ${title}.`,
                type: 'APPOINTMENT_SCHEDULED',
                payloadData: { batch_id }
            });
        }

        await connection.commit();
        for (const n of pendingNotifications) {
            try { await notifyUsers(n); } catch (e) { console.error('Mass schedule notification failed:', e.message); }
        }
        res.json({ success: true, message: 'Mass schedule created successfully!' });
    } catch (error) {
        await connection.rollback();
        if (error instanceof BookingError) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        console.error('Error creating mass schedule:', error);
        res.status(500).json({ success: false, message: 'Failed to create schedule' });
    } finally {
        connection.release();
    }
});
// ==========================================
// 3B. DOCTOR SCHEDULES & STUDENT BOOKINGS
// ==========================================
// The nurse sets up when a doctor is available (doctor_schedules). Students book into those slots and the
// nurse approves them. Mass batches and bookings share the same server-side checks:
//   - the appointment must fall inside an open schedule of that doctor (matching visit type)
//   - no more overlapping appointments than the schedule's max_patients_per_slot
//   - a student cannot hold two overlapping appointments

const SCHEDULE_VISIT_TYPES = ['Any', ...DOCTOR_VISIT_TYPES];
const OCCUPYING_APPT_STATUSES = ['Scheduled', 'Pending Approval', 'Completed'];
const SPECIALIZATION_RULES = {
    'Dental': /dent/i,
    'Vision': /optom|ophthal|eye|vision/i
};

class BookingError extends Error {
    constructor(message, status = 409) {
        super(message);
        this.name = 'BookingError';
        this.status = status;
    }
}

const hmsToMin = (t) => {
    const [h, m] = String(t).split(':');
    return parseInt(h, 10) * 60 + parseInt(m, 10);
};
const minToHms = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
const isDateStr = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !isNaN(new Date(`${d}T00:00:00Z`).getTime());
const isTimeStr = (t) => /^\d{2}:\d{2}(:\d{2})?$/.test(String(t || ''));
const dayOfWeekOf = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();
const addDaysStr = (dateStr, n) => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
// 'YYYY-MM-DD HH:mm:ss' in Asia/Manila
const nowManilaStr = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Manila' });
const addMinutesToStr = (dtStr, mins) => {
    const d = new Date(`${dtStr.replace(' ', 'T')}Z`);
    d.setUTCMinutes(d.getUTCMinutes() + mins);
    return d.toISOString().slice(0, 19).replace('T', ' ');
};
const doctorDisplayName = (d) => `Dr. ${d.first_name || ''} ${d.last_name || ''}`.trim();
const doctorMatchesVisitType = (specialization, visitType) => {
    const rule = SPECIALIZATION_RULES[visitType];
    return !rule || rule.test(specialization || '');
};

const scheduleOccursOn = (s, dateStr) => {
    if (s.status !== 'Open') return false;
    if (s.recurrence === 'Once') return s.schedule_date === dateStr;
    return dayOfWeekOf(dateStr) === Number(s.day_of_week) && s.valid_from <= dateStr && dateStr <= s.valid_until;
};
// Follow-up and Referral visits happen in the doctor's normal hours, whatever the schedule's own visit type is.
const scheduleMatchesVisit = (s, visitType) =>
    s.visit_type === 'Any' || !visitType || s.visit_type === visitType || ['Follow-up', 'Referral'].includes(visitType);

const lockDoctor = async (conn, doctorId) => {
    const [rows] = await conn.query(`SELECT doctor_id, user_id, first_name, last_name, specialization FROM doctors WHERE doctor_id = ? FOR UPDATE`, [doctorId]);
    return rows[0] || null;
};

const countOverlappingAppointments = async (conn, doctorId, startStr, endStr, excludeId = null) => {
    const [[row]] = await conn.query(
        `SELECT COUNT(*) AS n FROM doctor_appointments
         WHERE doctor_id = ? AND status IN (?) AND start_time < ? AND end_time > ?
           ${excludeId ? 'AND appointment_id <> ?' : ''}`,
        excludeId ? [doctorId, OCCUPYING_APPT_STATUSES, endStr, startStr, excludeId] : [doctorId, OCCUPYING_APPT_STATUSES, endStr, startStr]
    );
    return row.n;
};

const countStudentOverlaps = async (conn, studentId, startStr, endStr, excludeId = null) => {
    const [[row]] = await conn.query(
        `SELECT COUNT(*) AS n FROM doctor_appointments da
         JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
         WHERE das.student_id = ? AND da.status IN (?) AND da.start_time < ? AND da.end_time > ?
           ${excludeId ? 'AND da.appointment_id <> ?' : ''}`,
        excludeId ? [studentId, OCCUPYING_APPT_STATUSES, endStr, startStr, excludeId] : [studentId, OCCUPYING_APPT_STATUSES, endStr, startStr]
    );
    return row.n;
};

// Finds the open schedule of the doctor that fully contains [startStr, endStr] (same day).
const findCoveringSchedule = async (conn, doctorId, visitType, startStr, endStr) => {
    const dateStr = startStr.slice(0, 10);
    if (endStr.slice(0, 10) !== dateStr) return null;
    const startMin = hmsToMin(startStr.slice(11));
    const endMin = hmsToMin(endStr.slice(11));
    const [rows] = await conn.query(`SELECT * FROM doctor_schedules WHERE doctor_id = ? AND status = 'Open'`, [doctorId]);
    return rows.find((s) =>
        scheduleOccursOn(s, dateStr) && scheduleMatchesVisit(s, visitType) &&
        hmsToMin(s.start_time) <= startMin && endMin <= hmsToMin(s.end_time)
    ) || null;
};

// Shared checks for mass batches and student bookings. Throws BookingError on a conflict.
// The caller must already hold the doctor lock (lockDoctor) inside a transaction.
const assertAppointmentFits = async (conn, { doctor, visitType, startStr, endStr, studentId, excludeId = null, graceMin = 0, schedule = null }) => {
    if (!(startStr < endStr)) throw new BookingError('Appointment end time must be after its start time.', 400);
    if (startStr < addMinutesToStr(nowManilaStr(), -graceMin)) throw new BookingError('Appointments cannot be scheduled in the past.', 400);

    const blocked = await findUnavailability(conn, doctor.doctor_id, startStr, endStr);
    if (blocked) throw new BookingError(`${doctorDisplayName(doctor)} is unavailable: ${unavailabilityLabel(blocked)}.`);

    const covering = schedule || await findCoveringSchedule(conn, doctor.doctor_id, visitType, startStr, endStr);
    if (!covering) {
        throw new BookingError(
            `${doctorDisplayName(doctor)} has no open ${visitType && visitType !== 'Any' ? visitType + ' ' : ''}schedule covering ${startStr.slice(0, 10)} ${startStr.slice(11, 16)}-${endStr.slice(11, 16)}. Set up the doctor's schedule first.`
        );
    }
    const overlaps = await countOverlappingAppointments(conn, doctor.doctor_id, startStr, endStr, excludeId);
    if (overlaps >= covering.max_patients_per_slot) {
        throw new BookingError(`${doctorDisplayName(doctor)} is already fully booked for ${startStr.slice(11, 16)}-${endStr.slice(11, 16)} on ${startStr.slice(0, 10)}.`);
    }
    if (studentId) {
        const mine = await countStudentOverlaps(conn, studentId, startStr, endStr, excludeId);
        if (mine > 0) throw new BookingError(`Student ${studentId} already has a doctor appointment overlapping ${startStr.slice(11, 16)}-${endStr.slice(11, 16)} on ${startStr.slice(0, 10)}.`);
    }
    return covering;
};

const getNurseUserIds = async () => {
    const [rows] = await pool.query(
        `SELECT n.user_id FROM nurses n JOIN users u ON u.user_id = n.user_id WHERE u.is_active = 1`
    );
    return rows.map((r) => r.user_id).filter(Boolean);
};

const getStudentAndParentUserIds = async (studentId) => {
    const [[stu]] = await pool.query(`SELECT user_id FROM students WHERE student_id = ?`, [studentId]);
    const parents = await getConnectedParentUserIds([studentId]);
    return [...new Set([stu?.user_id, ...parents].filter(Boolean))];
};

const fmtApptWhen = (startStr) => formatDateTimeManila(startStr);

// ---- doctor portal helpers: reason log, unavailable dates, direct (custom time block) appointments ----

const normDt = (v) => (v ? String(v).replace('T', ' ').slice(0, 19) : null);

// Role + display name of whoever did something, from users.user_id
const resolveActor = async (conn, userId) => {
    if (!userId) return { role: 'System', name: null };
    const [[u]] = await conn.query(
        `SELECT u.role_id,
                COALESCE(d.first_name, n.first_name, s.first_name) AS fn,
                COALESCE(d.last_name, n.last_name, s.last_name) AS ln
         FROM users u
         LEFT JOIN doctors d ON d.user_id = u.user_id
         LEFT JOIN nurses n ON n.user_id = u.user_id
         LEFT JOIN students s ON s.user_id = u.user_id
         WHERE u.user_id = ?`,
        [userId]
    );
    if (!u) return { role: 'System', name: null };
    const role = { DCTR: 'Doctor', NRS: 'Nurse', STDNT: 'Student' }[u.role_id] || 'System';
    const name = [u.fn, u.ln].filter(Boolean).join(' ') || null;
    return { role, name: role === 'Doctor' && name ? `Dr. ${name}` : name };
};

// One row per status change / reschedule / decision of an appointment, with the reason given
const logAppointment = async (conn, e) => {
    let { actor_role, actor_name } = e;
    if (!actor_role) {
        const actor = await resolveActor(conn, e.actor_user_id);
        actor_role = actor.role;
        actor_name = actor_name || actor.name;
    }
    await conn.query(
        `INSERT INTO doctor_appointment_logs
            (log_id, appointment_id, action, from_status, to_status, old_start_time, old_end_time, new_start_time, new_end_time,
             reason, actor_user_id, actor_role, actor_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), e.appointment_id, e.action, e.from_status || null, e.to_status || null,
         normDt(e.old_start_time), normDt(e.old_end_time), normDt(e.new_start_time), normDt(e.new_end_time),
         e.reason ? String(e.reason).slice(0, 255) : null, e.actor_user_id || null, actor_role, actor_name || null]
    );
};

const getDoctorUserIds = async (doctorId) => {
    const [rows] = await pool.query(`SELECT d.user_id FROM doctors d JOIN users u ON u.user_id = d.user_id WHERE d.doctor_id = ? AND u.is_active = 1`, [doctorId]);
    return rows.map((r) => r.user_id).filter(Boolean);
};

// Does an unavailable window (date range, optionally a time window every day of it) overlap [startStr, endStr]?
const unavailabilityApplies = (u, startStr, endStr) => {
    const sd = startStr.slice(0, 10);
    const ed = endStr.slice(0, 10);
    if (u.end_date < sd || u.start_date > ed) return false;
    if (!u.start_time) return true;
    for (let d = sd > u.start_date ? sd : u.start_date; d <= ed && d <= u.end_date; d = addDaysStr(d, 1)) {
        const winStart = `${d} ${String(u.start_time).slice(0, 8)}`;
        const winEnd = `${d} ${String(u.end_time).slice(0, 8)}`;
        if (winStart < endStr && winEnd > startStr) return true;
    }
    return false;
};

const unavailabilityLabel = (u) => {
    const range = u.start_date === u.end_date ? u.start_date : `${u.start_date} to ${u.end_date}`;
    const time = u.start_time ? ` ${String(u.start_time).slice(0, 5)}-${String(u.end_time).slice(0, 5)}` : '';
    return `${range}${time}${u.reason ? ` (${u.reason})` : ''}`;
};

const findUnavailability = async (conn, doctorId, startStr, endStr) => {
    const [rows] = await conn.query(
        `SELECT * FROM doctor_unavailable_dates WHERE doctor_id = ? AND start_date <= ? AND end_date >= ?`,
        [doctorId, endStr.slice(0, 10), startStr.slice(0, 10)]
    );
    return rows.find((u) => unavailabilityApplies(u, startStr, endStr)) || null;
};

// Direct appointments (nurse or doctor picks the student and a custom time block) do not need a posted schedule.
// They still must not clash with the doctor's unavailable dates, the doctor's other appointments or the student's.
// If the block happens to sit inside an open schedule, that schedule's capacity applies; otherwise one patient at a time.
const assertDirectFits = async (conn, { doctor, startStr, endStr, studentId, excludeId = null, graceMin = 0 }) => {
    if (!(startStr < endStr)) throw new BookingError('Appointment end time must be after its start time.', 400);
    if (startStr.slice(0, 10) !== endStr.slice(0, 10)) throw new BookingError('An appointment must start and end on the same day.', 400);
    if (startStr < addMinutesToStr(nowManilaStr(), -graceMin)) throw new BookingError('Appointments cannot be scheduled in the past.', 400);

    const blocked = await findUnavailability(conn, doctor.doctor_id, startStr, endStr);
    if (blocked) throw new BookingError(`${doctorDisplayName(doctor)} is unavailable: ${unavailabilityLabel(blocked)}.`);

    const covering = await findCoveringSchedule(conn, doctor.doctor_id, null, startStr, endStr);
    const capacity = covering ? covering.max_patients_per_slot : 1;
    const overlaps = await countOverlappingAppointments(conn, doctor.doctor_id, startStr, endStr, excludeId);
    if (overlaps >= capacity) {
        throw new BookingError(`${doctorDisplayName(doctor)} already has an appointment overlapping ${startStr.slice(11, 16)}-${endStr.slice(11, 16)} on ${startStr.slice(0, 10)}.`);
    }
    if (studentId) {
        const mine = await countStudentOverlaps(conn, studentId, startStr, endStr, excludeId);
        if (mine > 0) throw new BookingError(`Student ${studentId} already has a doctor appointment overlapping ${startStr.slice(11, 16)}-${endStr.slice(11, 16)} on ${startStr.slice(0, 10)}.`);
    }
    return covering;
};

// ---- schedule input validation (create + update) ----
const validateScheduleInput = async (conn, input, { excludeScheduleId = null } = {}) => {
    const doctor = (await conn.query(`SELECT * FROM doctors WHERE doctor_id = ?`, [input.doctor_id]))[0][0];
    if (!doctor) return { error: 'Doctor not found.' };

    const visitType = input.visit_type || 'Any';
    if (!SCHEDULE_VISIT_TYPES.includes(visitType)) return { error: `Visit type must be one of: ${SCHEDULE_VISIT_TYPES.join(', ')}.` };
    if (!doctorMatchesVisitType(doctor.specialization, visitType)) {
        return { error: `${doctorDisplayName(doctor)} (${doctor.specialization || 'no specialization'}) cannot hold ${visitType} schedules. Update the doctor's specialization first.` };
    }

    const recurrence = input.recurrence || 'Once';
    if (!['Once', 'Weekly'].includes(recurrence)) return { error: 'Recurrence must be Once or Weekly.' };

    if (!isTimeStr(input.start_time) || !isTimeStr(input.end_time)) return { error: 'Start and end time are required.' };
    const startMin = hmsToMin(input.start_time);
    const endMin = hmsToMin(input.end_time);
    if (endMin <= startMin) return { error: 'End time must be after start time.' };

    const slotMin = parseInt(input.slot_duration_min, 10);
    if (!Number.isFinite(slotMin) || slotMin < 5 || slotMin > 240) return { error: 'Slot duration must be between 5 and 240 minutes.' };
    if (endMin - startMin < slotMin) return { error: 'The time window is shorter than one slot.' };

    const capacity = parseInt(input.max_patients_per_slot, 10);
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 50) return { error: 'Max patients per slot must be between 1 and 50.' };

    const today = nowManilaStr().slice(0, 10);
    const normalized = {
        doctor_id: input.doctor_id,
        visit_type: visitType,
        recurrence,
        schedule_date: null,
        day_of_week: null,
        valid_from: null,
        valid_until: null,
        start_time: minToHms(startMin),
        end_time: minToHms(endMin),
        slot_duration_min: slotMin,
        max_patients_per_slot: capacity,
        location: textOrNull(input.location),
        notes: textOrNull(input.notes),
        auto_confirm: toFlag(input.auto_confirm)
    };

    let dates = [];
    if (recurrence === 'Once') {
        if (!isDateStr(input.schedule_date)) return { error: 'A valid schedule date is required.' };
        if (input.schedule_date < today) return { error: 'The schedule date cannot be in the past.' };
        normalized.schedule_date = input.schedule_date;
        dates = [input.schedule_date];
    } else {
        const dow = parseInt(input.day_of_week, 10);
        if (!Number.isInteger(dow) || dow < 0 || dow > 6) return { error: 'Pick a weekday for a weekly schedule.' };
        if (!isDateStr(input.valid_from) || !isDateStr(input.valid_until)) return { error: 'Weekly schedules need a start and end date.' };
        if (input.valid_until < input.valid_from) return { error: 'The end date must be on or after the start date.' };
        if (input.valid_until < today) return { error: 'The weekly schedule has already ended.' };
        if (input.valid_until > addDaysStr(input.valid_from, 365)) return { error: 'A weekly schedule can span at most one year.' };
        normalized.day_of_week = dow;
        normalized.valid_from = input.valid_from;
        normalized.valid_until = input.valid_until;
        for (let d = input.valid_from; d <= input.valid_until && dates.length < 400; d = addDaysStr(d, 1)) {
            if (dayOfWeekOf(d) === dow) dates.push(d);
        }
        if (dates.length === 0) return { error: 'No date in that range falls on the chosen weekday.' };
    }

    // Overlap with the doctor's other open schedules
    const [others] = await conn.query(
        `SELECT * FROM doctor_schedules WHERE doctor_id = ? AND status = 'Open' ${excludeScheduleId ? 'AND schedule_id <> ?' : ''}`,
        excludeScheduleId ? [input.doctor_id, excludeScheduleId] : [input.doctor_id]
    );
    for (const d of dates) {
        for (const o of others) {
            if (scheduleOccursOn(o, d) && hmsToMin(o.start_time) < endMin && startMin < hmsToMin(o.end_time)) {
                return { error: `Overlaps another open schedule of this doctor on ${d} (${o.start_time.slice(0, 5)}-${o.end_time.slice(0, 5)}).` };
            }
        }
    }

    return { doctor, data: normalized };
};

const futureActiveBookingCount = async (conn, scheduleId) => {
    const [[row]] = await conn.query(
        `SELECT COUNT(*) AS n FROM doctor_appointments
         WHERE schedule_id = ? AND status IN ('Scheduled', 'Pending Approval') AND end_time > NOW()`,
        [scheduleId]
    );
    return row.n;
};

// ---- Nurse: schedule management ----

app.get('/api/doctor-schedules', async (req, res) => {
    try {
        const { doctor_id, status } = req.query;
        const where = [];
        const params = [];
        if (doctor_id) { where.push('ds.doctor_id = ?'); params.push(doctor_id); }
        if (status === 'Open' || status === 'Closed') { where.push('ds.status = ?'); params.push(status); }

        const [rows] = await pool.query(
            `SELECT ds.*, d.first_name AS doc_first_name, d.last_name AS doc_last_name, d.specialization,
                    (SELECT COUNT(*) FROM doctor_appointments da
                       WHERE da.schedule_id = ds.schedule_id AND da.status IN ('Scheduled', 'Pending Approval') AND da.end_time > NOW()) AS active_bookings,
                    (SELECT COUNT(*) FROM doctor_appointments da
                       WHERE da.schedule_id = ds.schedule_id AND da.status = 'Pending Approval' AND da.end_time > NOW()) AS pending_bookings
             FROM doctor_schedules ds
             JOIN doctors d ON d.doctor_id = ds.doctor_id
             ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
             ORDER BY ds.status ASC, COALESCE(ds.schedule_date, ds.valid_from) ASC, ds.start_time ASC`,
            params
        );

        const today = nowManilaStr().slice(0, 10);
        const schedules = rows.map((s) => {
            let nextDate = null;
            if (s.status === 'Open') {
                if (s.recurrence === 'Once') nextDate = s.schedule_date >= today ? s.schedule_date : null;
                else {
                    for (let d = s.valid_from > today ? s.valid_from : today; d <= s.valid_until; d = addDaysStr(d, 1)) {
                        if (dayOfWeekOf(d) === Number(s.day_of_week)) { nextDate = d; break; }
                    }
                }
            }
            return { ...s, next_date: nextDate, is_expired: s.status === 'Open' && !nextDate };
        });
        res.json({ success: true, schedules });
    } catch (error) {
        console.error('Error fetching doctor schedules:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch doctor schedules' });
    }
});

// Open windows of one doctor on one date (used by the mass-schedule form)
app.get('/api/doctor-schedules/availability', async (req, res) => {
    try {
        const { doctor_id, date, visit_type } = req.query;
        if (!doctor_id || !isDateStr(date)) return res.status(400).json({ success: false, message: 'doctor_id and date are required.' });
        const [rows] = await pool.query(`SELECT * FROM doctor_schedules WHERE doctor_id = ? AND status = 'Open'`, [doctor_id]);
        const [unavailable] = await pool.query(
            `SELECT * FROM doctor_unavailable_dates WHERE doctor_id = ? AND start_date <= ? AND end_date >= ?`, [doctor_id, date, date]
        );
        // a window is dropped only when a whole-day absence covers it; partial absences are enforced when the appointment is saved
        if (unavailable.some((u) => !u.start_time)) return res.json({ success: true, windows: [], unavailable });
        const windows = rows
            .filter((s) => scheduleOccursOn(s, date) && scheduleMatchesVisit(s, visit_type))
            .map((s) => ({
                schedule_id: s.schedule_id, visit_type: s.visit_type, start_time: s.start_time, end_time: s.end_time,
                slot_duration_min: s.slot_duration_min, max_patients_per_slot: s.max_patients_per_slot, location: s.location
            }))
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
        res.json({ success: true, windows, unavailable });
    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch availability' });
    }
});

app.post('/api/doctor-schedules', async (req, res) => {
    // Both the nurse and the doctor can post the doctor's consultation availability
    const nurseId = req.body.nurse_id || null;
    const creatorDoctorId = req.body.created_by_doctor_id || null;
    if (!nurseId && !creatorDoctorId) return res.status(400).json({ success: false, message: 'Nurse or doctor ID is required.' });
    if (!nurseId && creatorDoctorId !== req.body.doctor_id) return res.status(403).json({ success: false, message: 'Doctors can only post their own schedule.' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await lockDoctor(connection, req.body.doctor_id);
        const result = await validateScheduleInput(connection, req.body);
        if (result.error) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: result.error });
        }
        const d = result.data;
        const scheduleId = await generateCustomId('DSCH', 'doctor_schedules', 'schedule_id', connection);
        await connection.query(
            `INSERT INTO doctor_schedules
                (schedule_id, doctor_id, visit_type, recurrence, schedule_date, day_of_week, valid_from, valid_until, start_time, end_time,
                 slot_duration_min, max_patients_per_slot, location, notes, auto_confirm, status, created_by_nurse_id, created_by_doctor_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?)`,
            [scheduleId, d.doctor_id, d.visit_type, d.recurrence, d.schedule_date, d.day_of_week, d.valid_from, d.valid_until, d.start_time, d.end_time,
             d.slot_duration_min, d.max_patients_per_slot, d.location, d.notes, d.auto_confirm, nurseId, nurseId ? null : creatorDoctorId]
        );
        await connection.commit();
        res.status(201).json({ success: true, message: 'Doctor schedule created.', schedule_id: scheduleId });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating doctor schedule:', error);
        res.status(500).json({ success: false, message: 'Failed to create doctor schedule' });
    } finally {
        connection.release();
    }
});

app.put('/api/doctor-schedules/:id', async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [[existing]] = await connection.query(`SELECT * FROM doctor_schedules WHERE schedule_id = ? FOR UPDATE`, [id]);
        if (!existing) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Schedule not found.' }); }
        await lockDoctor(connection, existing.doctor_id);

        const merged = { ...existing, ...req.body, doctor_id: existing.doctor_id };
        const result = await validateScheduleInput(connection, merged, { excludeScheduleId: id });
        if (result.error) { await connection.rollback(); return res.status(400).json({ success: false, message: result.error }); }
        const d = result.data;

        const structuralChange =
            d.visit_type !== existing.visit_type || d.recurrence !== existing.recurrence ||
            (d.schedule_date || null) !== (existing.schedule_date || null) || (d.day_of_week ?? null) !== (existing.day_of_week ?? null) ||
            (d.valid_from || null) !== (existing.valid_from || null) || (d.valid_until || null) !== (existing.valid_until || null) ||
            d.start_time !== existing.start_time || d.end_time !== existing.end_time || d.slot_duration_min !== existing.slot_duration_min ||
            d.max_patients_per_slot < existing.max_patients_per_slot;

        if (structuralChange && await futureActiveBookingCount(connection, id) > 0) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'This schedule has upcoming bookings. Only location, notes and auto-confirm can be edited; close the schedule to cancel the bookings first.' });
        }

        await connection.query(
            `UPDATE doctor_schedules SET visit_type = ?, recurrence = ?, schedule_date = ?, day_of_week = ?, valid_from = ?, valid_until = ?,
                    start_time = ?, end_time = ?, slot_duration_min = ?, max_patients_per_slot = ?, location = ?, notes = ?, auto_confirm = ?
             WHERE schedule_id = ?`,
            [d.visit_type, d.recurrence, d.schedule_date, d.day_of_week, d.valid_from, d.valid_until, d.start_time, d.end_time,
             d.slot_duration_min, d.max_patients_per_slot, d.location, d.notes, d.auto_confirm, id]
        );
        await connection.commit();
        res.json({ success: true, message: 'Doctor schedule updated.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating doctor schedule:', error);
        res.status(500).json({ success: false, message: 'Failed to update doctor schedule' });
    } finally {
        connection.release();
    }
});

// Closing a schedule cancels its upcoming bookings and tells the students (and parents).
app.put('/api/doctor-schedules/:id/close', async (req, res) => {
    const { id } = req.params;
    const { reason, sender_id } = req.body;
    const cancelReason = textOrNull(reason) || 'The doctor schedule was closed.';
    const connection = await pool.getConnection();
    let affected = [];
    try {
        await connection.beginTransaction();
        const [[schedule]] = await connection.query(`SELECT * FROM doctor_schedules WHERE schedule_id = ? FOR UPDATE`, [id]);
        if (!schedule) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Schedule not found.' }); }
        if (schedule.status === 'Closed') { await connection.rollback(); return res.status(409).json({ success: false, message: 'Schedule is already closed.' }); }

        const [bookings] = await connection.query(
            `SELECT da.appointment_id, da.start_time, das.student_id
             FROM doctor_appointments da
             JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
             WHERE da.schedule_id = ? AND da.status IN ('Scheduled', 'Pending Approval') AND da.end_time > NOW()`,
            [id]
        );
        affected = bookings;
        if (bookings.length > 0) {
            await connection.query(
                `UPDATE doctor_appointments SET status = 'Cancelled', decline_reason = ? WHERE appointment_id IN (?)`,
                [cancelReason.slice(0, 255), bookings.map((b) => b.appointment_id)]
            );
            for (const b of bookings) {
                await logAppointment(connection, {
                    appointment_id: b.appointment_id, action: 'Cancelled', to_status: 'Cancelled',
                    reason: `Schedule closed: ${cancelReason}`, actor_user_id: sender_id || null
                });
            }
        }
        await connection.query(`UPDATE doctor_schedules SET status = 'Closed', closed_reason = ? WHERE schedule_id = ?`, [cancelReason.slice(0, 255), id]);
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error closing doctor schedule:', error);
        return res.status(500).json({ success: false, message: 'Failed to close doctor schedule' });
    }
    connection.release();

    for (const b of affected) {
        try {
            const recipients = await getStudentAndParentUserIds(b.student_id);
            await notifyUsers({
                sender_id: sender_id || null,
                recipient_ids: recipients,
                title: 'Doctor Appointment Cancelled',
                message: `Your appointment on ${fmtApptWhen(b.start_time)} was cancelled: ${cancelReason} Please book another slot.`,
                type: 'BOOKING_CANCELLED',
                payloadData: { appointment_id: b.appointment_id }
            });
        } catch (e) {
            console.error('Failed to notify about closed schedule:', e.message);
        }
    }
    res.json({ success: true, message: `Schedule closed. ${affected.length} booking(s) cancelled and notified.`, cancelled: affected.length });
});

app.put('/api/doctor-schedules/:id/reopen', async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [[existing]] = await connection.query(`SELECT * FROM doctor_schedules WHERE schedule_id = ? FOR UPDATE`, [id]);
        if (!existing) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Schedule not found.' }); }
        await lockDoctor(connection, existing.doctor_id);
        const result = await validateScheduleInput(connection, existing, { excludeScheduleId: id });
        if (result.error) { await connection.rollback(); return res.status(409).json({ success: false, message: `Cannot reopen: ${result.error}` }); }
        await connection.query(`UPDATE doctor_schedules SET status = 'Open', closed_reason = NULL WHERE schedule_id = ?`, [id]);
        await connection.commit();
        res.json({ success: true, message: 'Schedule reopened.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error reopening doctor schedule:', error);
        res.status(500).json({ success: false, message: 'Failed to reopen doctor schedule' });
    } finally {
        connection.release();
    }
});

app.delete('/api/doctor-schedules/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [[ref]] = await pool.query(`SELECT COUNT(*) AS n FROM doctor_appointments WHERE schedule_id = ?`, [id]);
        if (ref.n > 0) {
            return res.status(409).json({ success: false, message: 'This schedule already has bookings, so it cannot be deleted. Close it instead to keep the history.' });
        }
        const [result] = await pool.query(`DELETE FROM doctor_schedules WHERE schedule_id = ?`, [id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Schedule not found.' });
        res.json({ success: true, message: 'Schedule deleted.' });
    } catch (error) {
        console.error('Error deleting doctor schedule:', error);
        res.status(500).json({ success: false, message: 'Failed to delete doctor schedule' });
    }
});

// ---- Slots (shared by students and nurses) ----

// Builds the slots of one schedule on one date. `appts` = active appointments of that doctor on that date.
const buildSlots = (schedule, dateStr, appts, studentAppts, nowStr, unavailable = []) => {
    const slots = [];
    const startMin = hmsToMin(schedule.start_time);
    const endMin = hmsToMin(schedule.end_time);
    for (let m = startMin; m + schedule.slot_duration_min <= endMin; m += schedule.slot_duration_min) {
        const startStr = `${dateStr} ${minToHms(m)}`;
        const endStr = `${dateStr} ${minToHms(m + schedule.slot_duration_min)}`;
        const booked = appts.filter((a) => a.start_time < endStr && a.end_time > startStr).length;
        const mine = studentAppts.some((a) => a.start_time < endStr && a.end_time > startStr);
        const past = startStr <= nowStr;
        const blocked = unavailable.some((u) => unavailabilityApplies(u, startStr, endStr));
        slots.push({
            schedule_id: schedule.schedule_id,
            start_time: startStr,
            end_time: endStr,
            capacity: schedule.max_patients_per_slot,
            booked,
            available: !past && !mine && !blocked && booked < schedule.max_patients_per_slot,
            mine,
            blocked,
            past
        });
    }
    return slots;
};

// Upcoming open days students can book (next 45 days)
app.get('/api/doctor-schedules/open', async (req, res) => {
    try {
        const { visit_type, doctor_id, student_id } = req.query;
        const nowStr = nowManilaStr();
        const today = nowStr.slice(0, 10);
        const horizon = addDaysStr(today, 45);

        const [schedules] = await pool.query(
            `SELECT ds.*, d.first_name AS doc_first_name, d.last_name AS doc_last_name, d.specialization
             FROM doctor_schedules ds JOIN doctors d ON d.doctor_id = ds.doctor_id
             WHERE ds.status = 'Open' ${doctor_id ? 'AND ds.doctor_id = ?' : ''}`,
            doctor_id ? [doctor_id] : []
        );
        const usable = schedules.filter((s) => scheduleMatchesVisit(s, visit_type));
        if (usable.length === 0) return res.json({ success: true, occurrences: [] });

        const doctorIds = [...new Set(usable.map((s) => s.doctor_id))];
        const [appts] = await pool.query(
            `SELECT doctor_id, start_time, end_time FROM doctor_appointments
             WHERE doctor_id IN (?) AND status IN (?) AND end_time > ? AND start_time < ?`,
            [doctorIds, OCCUPYING_APPT_STATUSES, `${today} 00:00:00`, `${horizon} 23:59:59`]
        );
        let studentAppts = [];
        if (student_id) {
            [studentAppts] = await pool.query(
                `SELECT da.start_time, da.end_time FROM doctor_appointments da
                 JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
                 WHERE das.student_id = ? AND da.status IN (?) AND da.end_time > ?`,
                [student_id, OCCUPYING_APPT_STATUSES, `${today} 00:00:00`]
            );
        }
        const [unavailable] = await pool.query(
            `SELECT * FROM doctor_unavailable_dates WHERE doctor_id IN (?) AND end_date >= ? AND start_date <= ?`,
            [doctorIds, today, horizon]
        );

        const occurrences = [];
        for (let d = today; d <= horizon; d = addDaysStr(d, 1)) {
            for (const s of usable) {
                if (!scheduleOccursOn(s, d)) continue;
                const docAppts = appts.filter((a) => a.doctor_id === s.doctor_id && a.start_time.slice(0, 10) === d);
                const docUnavailable = unavailable.filter((u) => u.doctor_id === s.doctor_id);
                const slots = buildSlots(s, d, docAppts, studentAppts, nowStr, docUnavailable);
                const open = slots.filter((x) => x.available).length;
                if (slots.length === 0 || open === 0) continue;
                occurrences.push({
                    date: d, schedule_id: s.schedule_id, doctor_id: s.doctor_id,
                    doctor_name: `Dr. ${s.doc_first_name} ${s.doc_last_name}`, specialization: s.specialization,
                    visit_type: s.visit_type, start_time: s.start_time, end_time: s.end_time, location: s.location, notes: s.notes,
                    slot_duration_min: s.slot_duration_min, auto_confirm: s.auto_confirm, total_slots: slots.length, open_slots: open
                });
            }
        }
        res.json({ success: true, occurrences });
    } catch (error) {
        console.error('Error fetching open schedules:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch open schedules' });
    }
});

app.get('/api/doctor-schedules/:id/slots', async (req, res) => {
    try {
        const { date, student_id } = req.query;
        if (!isDateStr(date)) return res.status(400).json({ success: false, message: 'A valid date is required.' });
        const [[schedule]] = await pool.query(`SELECT * FROM doctor_schedules WHERE schedule_id = ?`, [req.params.id]);
        if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found.' });
        if (!scheduleOccursOn(schedule, date)) return res.json({ success: true, slots: [] });

        const [appts] = await pool.query(
            `SELECT start_time, end_time FROM doctor_appointments WHERE doctor_id = ? AND status IN (?) AND start_time >= ? AND start_time < ?`,
            [schedule.doctor_id, OCCUPYING_APPT_STATUSES, `${date} 00:00:00`, `${addDaysStr(date, 1)} 00:00:00`]
        );
        let studentAppts = [];
        if (student_id) {
            [studentAppts] = await pool.query(
                `SELECT da.start_time, da.end_time FROM doctor_appointments da
                 JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
                 WHERE das.student_id = ? AND da.status IN (?) AND da.start_time >= ? AND da.start_time < ?`,
                [student_id, OCCUPYING_APPT_STATUSES, `${date} 00:00:00`, `${addDaysStr(date, 1)} 00:00:00`]
            );
        }
        const [unavailable] = await pool.query(
            `SELECT * FROM doctor_unavailable_dates WHERE doctor_id = ? AND end_date >= ? AND start_date <= ?`,
            [schedule.doctor_id, date, date]
        );
        res.json({ success: true, slots: buildSlots(schedule, date, appts, studentAppts, nowManilaStr(), unavailable) });
    } catch (error) {
        console.error('Error fetching slots:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch slots' });
    }
});

// ---- Student bookings ----

app.get('/api/student/:studentId/doctor-bookings', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT da.appointment_id, da.title, da.visit_type, da.purpose_other, da.start_time, da.end_time, da.status, da.booking_source,
                    da.booking_reason, da.decline_reason, da.schedule_id,
                    das.attendance_status, d.first_name AS doc_first_name, d.last_name AS doc_last_name, d.specialization,
                    ds.location, ds.auto_confirm,
                    (da.start_time > NOW() AND da.status IN ('Scheduled', 'Pending Approval') AND da.booking_source = 'Student') AS can_change
             FROM doctor_appointments da
             JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
             JOIN doctors d ON d.doctor_id = da.doctor_id
             LEFT JOIN doctor_schedules ds ON ds.schedule_id = da.schedule_id
             WHERE das.student_id = ? AND da.start_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)
             ORDER BY da.start_time DESC`,
            [req.params.studentId]
        );
        res.json({ success: true, bookings: rows });
    } catch (error) {
        console.error('Error fetching student bookings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
    }
});

app.post('/api/student/doctor-bookings', async (req, res) => {
    const { student_id, schedule_id, slot_start } = req.body;
    const reason = textOrNull(req.body.reason);
    if (!student_id || !schedule_id || !slot_start) {
        return res.status(400).json({ success: false, message: 'student_id, schedule_id and slot_start are required.' });
    }
    if (!reason) return res.status(400).json({ success: false, message: 'Please tell the clinic the reason for your check-up.' });

    const startStr = String(slot_start).replace('T', ' ').slice(0, 19);
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(startStr)) {
        return res.status(400).json({ success: false, message: 'Invalid slot time.' });
    }

    const connection = await pool.getConnection();
    let created = null;
    try {
        await connection.beginTransaction();

        const [[schedule]] = await connection.query(`SELECT * FROM doctor_schedules WHERE schedule_id = ?`, [schedule_id]);
        if (!schedule || schedule.status !== 'Open') throw new BookingError('This schedule is no longer open for booking.');
        const doctor = await lockDoctor(connection, schedule.doctor_id);

        const [[student]] = await connection.query(`SELECT student_id, user_id, first_name, last_name FROM students WHERE student_id = ?`, [student_id]);
        if (!student) throw new BookingError('Student not found.', 404);

        const dateStr = startStr.slice(0, 10);
        if (!scheduleOccursOn(schedule, dateStr)) throw new BookingError('The doctor has no schedule on that date.');
        const startMin = hmsToMin(startStr.slice(11));
        const offset = startMin - hmsToMin(schedule.start_time);
        if (offset < 0 || offset % schedule.slot_duration_min !== 0 || startMin + schedule.slot_duration_min > hmsToMin(schedule.end_time)) {
            throw new BookingError('That time is not a valid slot of this schedule.', 400);
        }
        const endStr = addMinutesToStr(startStr, schedule.slot_duration_min);

        let visitType = schedule.visit_type;
        if (visitType === 'Any') {
            visitType = req.body.visit_type || 'General Check Up';
            if (!VISIT_PURPOSES.includes(visitType) || !doctorMatchesVisitType(doctor.specialization, visitType)) {
                throw new BookingError('This doctor cannot take that visit type.', 400);
            }
        }
        const purposeOther = visitType === 'Other' ? textOrNull(req.body.purpose_other) : null;
        if (visitType === 'Other' && !purposeOther) throw new BookingError('Please specify the purpose of your visit.', 400);

        await assertAppointmentFits(connection, { doctor, visitType, startStr, endStr, studentId: student_id, schedule });

        const status = schedule.auto_confirm ? 'Scheduled' : 'Pending Approval';
        const appointmentId = await generateCustomId('DVSCHED', 'doctor_appointments', 'appointment_id', connection);
        await connection.query(
            `INSERT INTO doctor_appointments
                (appointment_id, doctor_id, batch_id, title, announcement, start_time, end_time, assigned_by_nurse_id, assigned_by_doctor_id, status, visit_type,
                 purpose_other, schedule_id, booking_source, booking_reason)
             VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Student', ?)`,
            [appointmentId, schedule.doctor_id, `${visitType} Booking`.slice(0, 45), reason, startStr, endStr, schedule.created_by_nurse_id, schedule.created_by_doctor_id,
             status, visitType, purposeOther, schedule_id, reason.slice(0, 255)]
        );
        await connection.query(
            `INSERT INTO doctor_appointment_students (appointment_id, student_id, attendance_status) VALUES (?, ?, 'Pending')`,
            [appointmentId, student_id]
        );
        await logAppointment(connection, {
            appointment_id: appointmentId, action: status === 'Scheduled' ? 'Confirmed' : 'Requested', to_status: status,
            new_start_time: startStr, new_end_time: endStr, reason: status === 'Scheduled' ? 'Booked in an auto-confirm time block' : reason,
            actor_user_id: student.user_id, actor_role: 'Student', actor_name: `${student.first_name} ${student.last_name}`
        });
        await connection.commit();
        created = { appointmentId, status, doctor, student, startStr, visitType, purposeOther };
    } catch (error) {
        await connection.rollback();
        connection.release();
        if (error instanceof BookingError) return res.status(error.status).json({ success: false, message: error.message });
        console.error('Error creating booking:', error);
        return res.status(500).json({ success: false, message: 'Failed to create booking' });
    }
    connection.release();

    try {
        const when = fmtApptWhen(created.startStr);
        const who = `${created.student.first_name} ${created.student.last_name}`;
        const docName = doctorDisplayName(created.doctor);
        const purpose = visitLabel(created.visitType, created.purposeOther);
        const doctorUsers = created.doctor.user_id ? [created.doctor.user_id] : [];
        if (created.status === 'Pending Approval') {
            await notifyUsers({
                sender_id: created.student.user_id, recipient_ids: [...await getNurseUserIds(), ...doctorUsers],
                title: 'New Doctor Booking Request', message: `${who} requested a ${purpose} with ${docName} on ${when}.`,
                type: 'BOOKING_REQUEST', payloadData: { appointment_id: created.appointmentId }
            });
        } else if (doctorUsers.length > 0) {
            await notifyUsers({
                sender_id: created.student.user_id, recipient_ids: doctorUsers,
                title: 'New Appointment Booked', message: `${who} booked a ${purpose} on ${when}.`,
                type: 'APPOINTMENT_SCHEDULED', payloadData: { appointment_id: created.appointmentId }
            });
        }
        await notifyUsers({
            sender_id: null, recipient_ids: await getStudentAndParentUserIds(student_id),
            title: created.status === 'Scheduled' ? 'Doctor Appointment Confirmed' : 'Booking Request Sent',
            message: created.status === 'Scheduled'
                ? `${who}: ${purpose} with ${docName} on ${when} is confirmed.`
                : `${who}: your ${purpose} request with ${docName} on ${when} is waiting for the nurse's or doctor's approval.`,
            type: 'BOOKING_UPDATE', payloadData: { appointment_id: created.appointmentId }
        });
    } catch (e) {
        console.error('Booking notification failed:', e.message);
    }

    res.status(201).json({ success: true, message: created.status === 'Scheduled' ? 'Appointment confirmed!' : 'Booking request sent. The nurse will confirm it.', appointment_id: created.appointmentId, status: created.status });
});

const loadStudentBooking = async (conn, appointmentId, studentId, forUpdate = false) => {
    const [[row]] = await conn.query(
        `SELECT da.*, das.student_id, s.first_name AS student_first_name, s.last_name AS student_last_name, s.user_id AS student_user_id
         FROM doctor_appointments da
         JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
         JOIN students s ON s.student_id = das.student_id
         WHERE da.appointment_id = ? AND das.student_id = ? ${forUpdate ? 'FOR UPDATE' : ''}`,
        [appointmentId, studentId]
    );
    return row || null;
};

app.put('/api/student/doctor-bookings/:appointment_id/cancel', async (req, res) => {
    const { appointment_id } = req.params;
    const { student_id } = req.body;
    try {
        const booking = await loadStudentBooking(pool, appointment_id, student_id);
        if (!booking || booking.booking_source !== 'Student') return res.status(404).json({ success: false, message: 'Booking not found.' });
        if (!['Scheduled', 'Pending Approval'].includes(booking.status)) return res.status(409).json({ success: false, message: `This booking is already ${booking.status.toLowerCase()}.` });
        if (booking.start_time <= nowManilaStr()) return res.status(409).json({ success: false, message: 'This appointment has already started.' });

        const cancelReason = textOrNull(req.body.reason);
        await pool.query(`UPDATE doctor_appointments SET status = 'Cancelled', decline_reason = ? WHERE appointment_id = ?`, [cancelReason ? `Cancelled by the student: ${cancelReason}`.slice(0, 255) : 'Cancelled by the student', appointment_id]);
        await logAppointment(pool, {
            appointment_id, action: 'Cancelled', from_status: booking.status, to_status: 'Cancelled', reason: cancelReason || 'Cancelled by the student',
            actor_user_id: booking.student_user_id, actor_role: 'Student', actor_name: `${booking.student_first_name} ${booking.student_last_name}`
        });

        try {
            await notifyUsers({
                sender_id: booking.student_user_id, recipient_ids: [...await getNurseUserIds(), ...await getDoctorUserIds(booking.doctor_id)],
                title: 'Doctor Booking Cancelled',
                message: `${booking.student_first_name} ${booking.student_last_name} cancelled the ${visitLabel(booking.visit_type, booking.purpose_other)} booking on ${fmtApptWhen(booking.start_time)}.`,
                type: 'BOOKING_CANCELLED', payloadData: { appointment_id }
            });
        } catch (e) { console.error('Cancel notification failed:', e.message); }

        res.json({ success: true, message: 'Booking cancelled.' });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel booking' });
    }
});

app.put('/api/student/doctor-bookings/:appointment_id/reschedule', async (req, res) => {
    const { appointment_id } = req.params;
    const { student_id, slot_start } = req.body;
    const startStr = String(slot_start || '').replace('T', ' ').slice(0, 19);
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(startStr)) return res.status(400).json({ success: false, message: 'Invalid slot time.' });

    const connection = await pool.getConnection();
    let result = null;
    try {
        await connection.beginTransaction();
        const booking = await loadStudentBooking(connection, appointment_id, student_id, true);
        if (!booking || booking.booking_source !== 'Student') throw new BookingError('Booking not found.', 404);
        if (!['Scheduled', 'Pending Approval'].includes(booking.status)) throw new BookingError(`This booking is already ${booking.status.toLowerCase()}.`);
        if (booking.start_time <= nowManilaStr()) throw new BookingError('This appointment has already started.');

        const [[schedule]] = await connection.query(`SELECT * FROM doctor_schedules WHERE schedule_id = ?`, [booking.schedule_id]);
        if (!schedule || schedule.status !== 'Open') throw new BookingError('This schedule is no longer open. Cancel and book another doctor schedule.');
        const doctor = await lockDoctor(connection, schedule.doctor_id);

        const dateStr = startStr.slice(0, 10);
        if (!scheduleOccursOn(schedule, dateStr)) throw new BookingError('The doctor has no schedule on that date.');
        const startMin = hmsToMin(startStr.slice(11));
        const offset = startMin - hmsToMin(schedule.start_time);
        if (offset < 0 || offset % schedule.slot_duration_min !== 0 || startMin + schedule.slot_duration_min > hmsToMin(schedule.end_time)) {
            throw new BookingError('That time is not a valid slot of this schedule.', 400);
        }
        const endStr = addMinutesToStr(startStr, schedule.slot_duration_min);

        await assertAppointmentFits(connection, { doctor, visitType: booking.visit_type, startStr, endStr, studentId: student_id, excludeId: appointment_id, schedule });

        const status = schedule.auto_confirm ? 'Scheduled' : 'Pending Approval';
        await connection.query(`UPDATE doctor_appointments SET start_time = ?, end_time = ?, status = ?, decline_reason = NULL WHERE appointment_id = ?`, [startStr, endStr, status, appointment_id]);
        await logAppointment(connection, {
            appointment_id, action: 'Rescheduled', from_status: booking.status, to_status: status,
            old_start_time: booking.start_time, old_end_time: booking.end_time, new_start_time: startStr, new_end_time: endStr,
            reason: textOrNull(req.body.reason) || 'Moved by the student',
            actor_user_id: booking.student_user_id, actor_role: 'Student', actor_name: `${booking.student_first_name} ${booking.student_last_name}`
        });
        await connection.commit();
        result = { booking, status, startStr };
    } catch (error) {
        await connection.rollback();
        connection.release();
        if (error instanceof BookingError) return res.status(error.status).json({ success: false, message: error.message });
        console.error('Error rescheduling booking:', error);
        return res.status(500).json({ success: false, message: 'Failed to reschedule booking' });
    }
    connection.release();

    try {
        await notifyUsers({
            sender_id: result.booking.student_user_id, recipient_ids: [...await getNurseUserIds(), ...await getDoctorUserIds(result.booking.doctor_id)],
            title: 'Doctor Booking Rescheduled',
            message: `${result.booking.student_first_name} ${result.booking.student_last_name} moved a ${visitLabel(result.booking.visit_type, result.booking.purpose_other)} booking to ${fmtApptWhen(result.startStr)}${result.status === 'Pending Approval' ? ' (needs approval)' : ''}.`,
            type: 'BOOKING_REQUEST', payloadData: { appointment_id }
        });
    } catch (e) { console.error('Reschedule notification failed:', e.message); }

    res.json({ success: true, message: result.status === 'Scheduled' ? 'Booking moved and confirmed.' : 'Booking moved. The nurse will confirm the new time.', status: result.status });
});

// ---- Nurse: booking requests ----

app.get('/api/doctor-bookings', async (req, res) => {
    try {
        const pendingOnly = req.query.status !== 'all';
        const [rows] = await pool.query(
            `SELECT da.appointment_id, da.doctor_id, da.title, da.visit_type, da.purpose_other, da.start_time, da.end_time, da.status, da.booking_reason, da.decline_reason, da.schedule_id,
                    das.student_id, s.first_name AS student_first_name, s.last_name AS student_last_name, s.year_level, s.section, p.program_name,
                    d.first_name AS doc_first_name, d.last_name AS doc_last_name, d.specialization, ds.location
             FROM doctor_appointments da
             JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
             JOIN students s ON s.student_id = das.student_id
             LEFT JOIN academic_programs p ON p.program_id = s.program_id
             JOIN doctors d ON d.doctor_id = da.doctor_id
             LEFT JOIN doctor_schedules ds ON ds.schedule_id = da.schedule_id
             WHERE da.booking_source = 'Student' ${pendingOnly ? "AND da.status = 'Pending Approval'" : 'AND da.start_time >= DATE_SUB(NOW(), INTERVAL 60 DAY)'}
             ${req.query.doctor_id ? 'AND da.doctor_id = ?' : ''}
             ORDER BY da.start_time ASC
             LIMIT 300`,
            req.query.doctor_id ? [req.query.doctor_id] : []
        );
        res.json({ success: true, bookings: rows });
    } catch (error) {
        console.error('Error fetching booking requests:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch booking requests' });
    }
});

const decideBooking = async (req, res, decision) => {
    const { appointment_id } = req.params;
    const { sender_id } = req.body;
    const declineReason = textOrNull(req.body.reason);
    if (decision === 'decline' && !declineReason) return res.status(400).json({ success: false, message: 'Please give a reason for declining.' });

    try {
        const [[row]] = await pool.query(
            `SELECT da.*, das.student_id, d.first_name, d.last_name, d.user_id AS doctor_user_id
             FROM doctor_appointments da
             JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
             JOIN doctors d ON d.doctor_id = da.doctor_id
             WHERE da.appointment_id = ? AND da.booking_source = 'Student'`,
            [appointment_id]
        );
        if (!row) return res.status(404).json({ success: false, message: 'Booking request not found.' });
        if (row.status !== 'Pending Approval') return res.status(409).json({ success: false, message: `This request is already ${row.status.toLowerCase()}.` });

        const approveNote = textOrNull(req.body.reason);
        if (decision === 'approve') {
            if (row.start_time <= nowManilaStr()) return res.status(409).json({ success: false, message: 'This slot has already passed, so it can only be declined.' });
            await pool.query(`UPDATE doctor_appointments SET status = 'Scheduled', decline_reason = NULL WHERE appointment_id = ?`, [appointment_id]);
        } else {
            await pool.query(`UPDATE doctor_appointments SET status = 'Declined', decline_reason = ? WHERE appointment_id = ?`, [declineReason.slice(0, 255), appointment_id]);
        }
        await logAppointment(pool, {
            appointment_id, action: decision === 'approve' ? 'Confirmed' : 'Declined', from_status: 'Pending Approval',
            to_status: decision === 'approve' ? 'Scheduled' : 'Declined', new_start_time: row.start_time, new_end_time: row.end_time,
            reason: decision === 'approve' ? approveNote : declineReason, actor_user_id: sender_id || null
        });

        try {
            const purpose = visitLabel(row.visit_type, row.purpose_other);
            await notifyUsers({
                sender_id: sender_id || null,
                recipient_ids: await getStudentAndParentUserIds(row.student_id),
                title: decision === 'approve' ? 'Doctor Appointment Confirmed' : 'Doctor Booking Declined',
                message: decision === 'approve'
                    ? `Your ${purpose} with ${doctorDisplayName(row)} on ${fmtApptWhen(row.start_time)} is confirmed.${approveNote ? ` Note: ${approveNote}` : ''}`
                    : `Your ${purpose} request for ${fmtApptWhen(row.start_time)} was declined: ${declineReason} You can book another slot.`,
                type: decision === 'approve' ? 'BOOKING_UPDATE' : 'BOOKING_DECLINED',
                payloadData: { appointment_id }
            });
            // the doctor hears about a decision the nurse made (and the other way round is already in the nurses' notifications list)
            if (row.doctor_user_id && row.doctor_user_id !== sender_id) {
                await notifyUsers({
                    sender_id: sender_id || null, recipient_ids: [row.doctor_user_id],
                    title: decision === 'approve' ? 'Booking Approved' : 'Booking Declined',
                    message: `${purpose} request on ${fmtApptWhen(row.start_time)} was ${decision === 'approve' ? 'approved' : `declined: ${declineReason}`}.`,
                    type: 'APPOINTMENT_UPDATE', payloadData: { appointment_id }
                });
            }
        } catch (e) { console.error('Decision notification failed:', e.message); }

        res.json({ success: true, message: decision === 'approve' ? 'Booking approved.' : 'Booking declined.' });
    } catch (error) {
        console.error(`Error trying to ${decision} booking:`, error);
        res.status(500).json({ success: false, message: `Failed to ${decision} booking` });
    }
};
app.put('/api/doctor-bookings/:appointment_id/approve', (req, res) => decideBooking(req, res, 'approve'));
app.put('/api/doctor-bookings/:appointment_id/decline', (req, res) => decideBooking(req, res, 'decline'));

// ==========================================
// 4. FETCH VISITS & ATTENDANCE MANAGEMENT
// ==========================================

// Students still marked Pending after their appointment ended become Absent.
// Runs from a schedule (see below) instead of being a hidden write inside GET /api/doctor-visits.
const markExpiredAppointmentsAbsent = async () => {
    const [result] = await pool.query(`
        UPDATE doctor_appointment_students das
        JOIN doctor_appointments da ON das.appointment_id = da.appointment_id
        SET das.attendance_status = 'Absent'
        WHERE das.attendance_status = 'Pending' AND da.end_time < NOW() AND da.status = 'Scheduled'
    `);
    return result.affectedRows;
};
cron.schedule('*/5 * * * *', () => {
    markExpiredAppointmentsAbsent().catch((err) => console.error('Auto-absent job failed:', err.message));
}, { timezone: 'Asia/Manila' });
markExpiredAppointmentsAbsent().catch((err) => console.error('Auto-absent job failed:', err.message));

const DOCTOR_VISIT_SELECT = `
            SELECT
                da.appointment_id, da.doctor_id, da.batch_id, da.title, da.announcement,
                da.start_time, da.end_time, da.status, da.assigned_by_nurse_id, da.assigned_by_doctor_id, da.visit_type, da.purpose_other,
                da.booking_source, da.booking_reason, da.decline_reason, da.schedule_id, da.parent_appointment_id,
                das.student_id, das.attendance_status, das.check_in_time, das.notes,
                s.first_name AS student_first_name, s.last_name AS student_last_name,
                s.user_id AS student_user_id, s.program_id, s.year_level, s.section,
                d.first_name AS doc_first_name, d.last_name AS doc_last_name, d.specialization,
                da_assessment.assessment_id, da_assessment.clinical_findings,
                da_assessment.diagnosis, da_assessment.treatment_recommendations, da_assessment.assessment_date,
                da_assessment.is_abnormal, da_assessment.follow_up_needed,
                da_assessment.prescriptions, da_assessment.follow_up_notes, da_assessment.follow_up_date,
                da_assessment.template_id, da_assessment.template_name, da_assessment.template_responses,
                da_assessment.updated_by AS assessment_updated_by, da_assessment.updated_at AS assessment_updated_at,
                da_assessment.referral_facility, da_assessment.referral_reason, da_assessment.referral_issued_at,
                dr.oral_hygiene, dr.caries_count, dr.missing_count, dr.filled_count, dr.gum_condition,
                dr.malocclusion, dr.tooth_notes, dr.treatment_done, dr.treatment_needed,
                dr.referral_needed, dr.referral_to, dr.next_visit_recommendation, dr.remarks AS dental_remarks,
                vr.visual_acuity_left, vr.visual_acuity_right, vr.va_left_corrected, vr.va_right_corrected,
                vr.wears_eyeglasses, vr.wears_contacts, vr.color_vision, vr.eye_findings,
                vr.recommended_action, vr.remarks AS vision_remarks
            FROM doctor_appointments da
            JOIN doctor_appointment_students das ON da.appointment_id = das.appointment_id
            JOIN students s ON das.student_id = s.student_id
            JOIN doctors d ON da.doctor_id = d.doctor_id
            LEFT JOIN doctor_assessments da_assessment
                ON da.appointment_id = da_assessment.appointment_id
               AND das.student_id = da_assessment.student_id
            LEFT JOIN dental_assessment_records dr
                ON dr.appointment_id = da.appointment_id AND dr.student_id = das.student_id
            LEFT JOIN vision_screening_records vr
                ON vr.appointment_id = da.appointment_id AND vr.student_id = das.student_id
`;

app.get('/api/doctor-visits', async (req, res) => {
    try {
        const query = `${DOCTOR_VISIT_SELECT}
            ORDER BY da.start_time ASC`;

        const [rows] = await pool.query(query);
        res.json({ success: true, appointments: rows });
    } catch (error) {
        console.error('Error fetching doctor visits:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch doctor visits' });
    }
});

// ---------- Folders (Program > Year-Section) and paginated visit groups ----------
// A "visit group" is one batch (or one individual appointment). A batch shows up in the folder of every
// section it has participants from, because most batches are created for "All Programs" and the real
// grouping is by the students in them. Individual bookings, walk-ins and follow-ups live in their own folder.
const DV_GROUP_CTE = `
  base AS (
    SELECT COALESCE(da.batch_id, da.appointment_id) AS gkey, da.appointment_id, da.batch_id, da.title, da.visit_type, da.status,
           da.start_time, da.end_time, da.doctor_id, das.student_id, das.attendance_status,
           s.first_name, s.last_name, s.program_id, s.year_level, s.section,
           d.first_name AS dfn, d.last_name AS dln, d.specialization,
           COALESCE(a.is_abnormal, 0) AS is_abnormal
    FROM doctor_appointments da
    JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
    JOIN students s ON s.student_id = das.student_id
    JOIN doctors d ON d.doctor_id = da.doctor_id
    LEFT JOIN doctor_assessments a ON a.appointment_id = da.appointment_id AND a.student_id = das.student_id
    WHERE da.status NOT IN ('Pending Approval', 'Declined')
  ),
  g AS (
    SELECT gkey, MIN(start_time) AS gstart, MAX(end_time) AS gend, MAX(batch_id IS NULL) AS individual,
           MIN(CASE WHEN status IN ('Completed', 'Cancelled') OR attendance_status IN ('Absent', 'Excused') THEN 1 ELSE 0 END) AS finished
    FROM base GROUP BY gkey
  ),
  gc AS (
    SELECT g.*, CASE WHEN finished = 1 OR gend < NOW() THEN 'past' WHEN gstart <= NOW() THEN 'ongoing' ELSE 'upcoming' END AS tab FROM g
  )`;

const pageParams = (query, defaultSize = 20) => {
    const all = query.pageSize === 'all';
    const pageSize = all ? 2000 : Math.min(Math.max(parseInt(query.pageSize, 10) || defaultSize, 1), 100);
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    return { page, pageSize, offset: all ? 0 : (page - 1) * pageSize };
};

const folderStatsSql = (groupBy, extraSelect = '', where = '1=1') => `
  SELECT ${extraSelect}
         COUNT(DISTINCT gc.gkey) AS total,
         COUNT(DISTINCT CASE WHEN gc.tab = 'upcoming' THEN gc.gkey END) AS upcoming,
         COUNT(DISTINCT CASE WHEN gc.tab = 'ongoing' THEN gc.gkey END) AS ongoing,
         COUNT(DISTINCT CASE WHEN gc.tab = 'past' THEN gc.gkey END) AS past,
         CAST(COALESCE(SUM(b.is_abnormal), 0) AS UNSIGNED) AS abnormal
  FROM base b JOIN gc ON gc.gkey = b.gkey
  WHERE ${where}
  ${groupBy ? `GROUP BY ${groupBy}` : ''}`;

app.get('/api/doctor-visits/folders', async (req, res) => {
    try {
        const [programRows] = await pool.query(`WITH ${DV_GROUP_CTE} ${folderStatsSql('b.program_id', 'b.program_id,', 'gc.individual = 0')}`);
        const [sectionRows] = await pool.query(`WITH ${DV_GROUP_CTE} ${folderStatsSql('b.program_id, b.year_level, b.section', 'b.program_id, b.year_level, b.section,', 'gc.individual = 0')}`);
        const [[individual]] = await pool.query(`WITH ${DV_GROUP_CTE} ${folderStatsSql('', '', 'gc.individual = 1')}`);
        const [names] = await pool.query('SELECT program_id, program_name FROM academic_programs');
        const nameOf = Object.fromEntries(names.map((n) => [n.program_id, n.program_name]));
        const [[pending]] = await pool.query(`SELECT COUNT(*) AS n FROM doctor_appointments WHERE status = 'Pending Approval'`);

        const num = (r) => ({ total: Number(r.total), upcoming: Number(r.upcoming), ongoing: Number(r.ongoing), past: Number(r.past), abnormal: Number(r.abnormal) });
        const programs = programRows.map((p) => ({
            program_id: p.program_id,
            program_name: nameOf[p.program_id] || p.program_id || 'No program',
            ...num(p),
            sections: sectionRows
                .filter((s) => s.program_id === p.program_id)
                .map((s) => ({ year_level: s.year_level, section: s.section, ...num(s) }))
                .sort((a, b) => (Number(a.year_level) - Number(b.year_level)) || String(a.section).localeCompare(String(b.section)))
        })).sort((a, b) => String(a.program_id).localeCompare(String(b.program_id)));

        res.json({ success: true, programs, individual: num(individual), pending_requests: Number(pending.n) });
    } catch (error) {
        console.error('Error fetching doctor visit folders:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch doctor visit folders' });
    }
});

// One page of visit groups (with all their appointment rows) for a folder / tab / search.
app.get('/api/doctor-visits/groups', async (req, res) => {
    try {
        const { tab, folder, program_id, year_level, section, q, doctor_id, from, to, appointment_id } = req.query;
        const { page, pageSize, offset } = pageParams(req.query);
        const where = ['1 = 1'];
        const params = [];

        if (appointment_id) {
            where.push('EXISTS (SELECT 1 FROM base bx WHERE bx.gkey = gc.gkey AND bx.appointment_id = ?)');
            params.push(appointment_id);
        } else {
            if (!['upcoming', 'ongoing', 'past'].includes(tab)) return res.status(400).json({ success: false, message: 'tab must be upcoming, ongoing or past.' });
            where.push('gc.tab = ?');
            params.push(tab);
        }

        if (folder === 'individual') {
            where.push('gc.individual = 1');
        } else if (program_id) {
            const parts = ['bf.gkey = gc.gkey', 'bf.program_id = ?'];
            params.push(program_id);
            if (year_level) { parts.push('bf.year_level = ?'); params.push(year_level); }
            if (section) { parts.push('bf.section = ?'); params.push(section); }
            where.push('gc.individual = 0', `EXISTS (SELECT 1 FROM base bf WHERE ${parts.join(' AND ')})`);
        }

        const search = textOrNull(q);
        if (search) {
            const like = `%${search}%`;
            where.push(`EXISTS (SELECT 1 FROM base bq WHERE bq.gkey = gc.gkey AND (
                bq.title LIKE ? OR bq.visit_type LIKE ? OR CONCAT(bq.dfn, ' ', bq.dln) LIKE ? OR bq.specialization LIKE ?
                OR CONCAT(bq.first_name, ' ', bq.last_name) LIKE ? OR bq.student_id LIKE ?))`);
            params.push(like, like, like, like, like, like);
        }
        if (doctor_id) {
            where.push('EXISTS (SELECT 1 FROM base bd WHERE bd.gkey = gc.gkey AND bd.doctor_id = ?)');
            params.push(doctor_id);
        }
        if (isDateStr(from)) { where.push('DATE(gc.gstart) >= ?'); params.push(from); }
        if (isDateStr(to)) { where.push('DATE(gc.gstart) <= ?'); params.push(to); }

        const [[countRow]] = await pool.query(`WITH ${DV_GROUP_CTE} SELECT COUNT(*) AS n FROM gc WHERE ${where.join(' AND ')}`, params);
        const total = Number(countRow.n);

        const [keys] = await pool.query(
            `WITH ${DV_GROUP_CTE} SELECT gc.gkey FROM gc WHERE ${where.join(' AND ')}
             ORDER BY gc.gstart ${tab === 'past' ? 'DESC' : 'ASC'}, gc.gkey ASC LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );

        let rows = [];
        if (keys.length > 0) {
            [rows] = await pool.query(
                `${DOCTOR_VISIT_SELECT} WHERE COALESCE(da.batch_id, da.appointment_id) IN (?) AND da.status NOT IN ('Pending Approval', 'Declined') ORDER BY da.start_time ${tab === 'past' ? 'DESC' : 'ASC'}`,
                [keys.map((k) => k.gkey)]
            );
        }

        res.json({ success: true, appointments: rows, total, page, pageSize, pageCount: Math.max(Math.ceil(total / pageSize), 1) });
    } catch (error) {
        console.error('Error fetching doctor visit groups:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch doctor visits' });
    }
});

const ATTENDANCE_STATUSES = ['Pending', 'Present', 'Absent', 'Excused'];

// Attendance: Present (check-in), Absent (no-show) or Excused. Absent / Excused keep the reason in `notes`.
app.put('/api/doctor-visits/status/:appointment_id', async (req, res) => {
    const { appointment_id } = req.params;
    const { student_id, status } = req.body;
    const reason = textOrNull(req.body.reason);

    if (!student_id || !status) {
        return res.status(400).json({ success: false, message: 'Missing student_id or status.' });
    }
    if (!ATTENDANCE_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `Status must be one of: ${ATTENDANCE_STATUSES.join(', ')}.` });
    }
    if (status === 'Excused' && !reason) {
        return res.status(400).json({ success: false, message: 'Please give a reason for excusing the student.' });
    }

    try {
        const [[appt]] = await pool.query(`SELECT status FROM doctor_appointments WHERE appointment_id = ?`, [appointment_id]);
        if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found.' });
        if (['Cancelled', 'Declined', 'Pending Approval'].includes(appt.status)) {
            return res.status(409).json({ success: false, message: `Attendance cannot be changed while the appointment is ${appt.status.toLowerCase()}.` });
        }

        const sets = ['attendance_status = ?'];
        const params = [status];
        if (status === 'Present') { sets.push('check_in_time = NOW()'); sets.push('notes = NULL'); }
        else if (status === 'Pending') { sets.push('check_in_time = NULL'); sets.push('notes = NULL'); }
        else { sets.push('notes = ?'); params.push(reason ? reason.slice(0, 255) : (status === 'Absent' ? 'No-show' : null)); }

        const [result] = await pool.query(
            `UPDATE doctor_appointment_students SET ${sets.join(', ')} WHERE appointment_id = ? AND student_id = ?`,
            [...params, appointment_id, student_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'No matching appointment record found for this student.' });
        }

        res.json({ success: true, message: `Student attendance updated to ${status}` });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ success: false, message: 'Failed to update attendance status' });
    }
});

// ==========================================
// 5. RESCHEDULE, CANCEL & BATCH START VISITS
// ==========================================

// Per-student reschedule: the new time must fit the doctor's open schedule and not clash with anyone else.
app.put('/api/doctor-visits/reschedule/:appointment_id', async (req, res) => {
    const { appointment_id } = req.params;
    const { sender_id } = req.body;
    const startStr = String(req.body.start_time || '').replace('T', ' ').slice(0, 19);
    let endStr = String(req.body.end_time || '').replace('T', ' ').slice(0, 19);
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(startStr)) {
        return res.status(400).json({ success: false, message: 'A valid new start time is required.' });
    }
    const moveReason = textOrNull(req.body.reason);
    if (!moveReason) return res.status(400).json({ success: false, message: 'Please give a reason for rescheduling.' });

    const connection = await pool.getConnection();
    let moved = null;
    try {
        await connection.beginTransaction();
        const [[appt]] = await connection.query(`SELECT * FROM doctor_appointments WHERE appointment_id = ? FOR UPDATE`, [appointment_id]);
        if (!appt) throw new BookingError('Appointment not found.', 404);
        if (!['Scheduled', 'Pending Approval'].includes(appt.status)) throw new BookingError(`A ${appt.status.toLowerCase()} appointment cannot be rescheduled.`);

        const [students] = await connection.query(`SELECT student_id, attendance_status FROM doctor_appointment_students WHERE appointment_id = ?`, [appointment_id]);
        if (students.some((s) => s.attendance_status === 'Present')) throw new BookingError('This student is already checked in, so the visit cannot be rescheduled.');

        // keep the original duration unless an end time was sent
        if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(endStr)) {
            const durationMin = Math.round((new Date(appt.end_time.replace(' ', 'T') + 'Z') - new Date(appt.start_time.replace(' ', 'T') + 'Z')) / 60000);
            endStr = addMinutesToStr(startStr, durationMin);
        }

        const doctor = await lockDoctor(connection, appt.doctor_id);
        // Batch members and student bookings must stay inside a posted schedule; direct appointments take any free custom block
        const mustFitSchedule = !!appt.batch_id || appt.booking_source === 'Student';
        for (const st of students) {
            if (mustFitSchedule) {
                await assertAppointmentFits(connection, { doctor, visitType: appt.visit_type, startStr, endStr, studentId: st.student_id, excludeId: appointment_id, graceMin: 5 });
            } else {
                await assertDirectFits(connection, { doctor, startStr, endStr, studentId: st.student_id, excludeId: appointment_id, graceMin: 5 });
            }
        }

        // Moving a request that was still waiting for approval confirms it at the new time
        const newStatus = appt.status === 'Pending Approval' ? 'Scheduled' : appt.status;
        await connection.query(`UPDATE doctor_appointments SET start_time = ?, end_time = ?, status = ?, decline_reason = NULL WHERE appointment_id = ?`, [startStr, endStr, newStatus, appointment_id]);
        await logAppointment(connection, {
            appointment_id, action: 'Rescheduled', from_status: appt.status, to_status: newStatus,
            old_start_time: appt.start_time, old_end_time: appt.end_time, new_start_time: startStr, new_end_time: endStr,
            reason: moveReason, actor_user_id: sender_id || null
        });
        await connection.commit();
        moved = { students, appt };
    } catch (error) {
        await connection.rollback();
        connection.release();
        if (error instanceof BookingError) return res.status(error.status).json({ success: false, message: error.message });
        console.error('Error rescheduling appointment:', error);
        return res.status(500).json({ success: false, message: 'Failed to reschedule appointment' });
    }
    connection.release();

    try {
        for (const st of moved.students) {
            await notifyUsers({
                sender_id: sender_id || null,
                recipient_ids: await getStudentAndParentUserIds(st.student_id),
                title: 'Doctor Visit Rescheduled',
                message: `Your ${visitLabel(moved.appt.visit_type, moved.appt.purpose_other)} was rescheduled to ${formatDateTimeManila(startStr)}. Reason: ${moveReason}`,
                type: 'APPOINTMENT_RESCHEDULED',
                payloadData: { appointment_id }
            });
        }
        const doctorUsers = (await getDoctorUserIds(moved.appt.doctor_id)).filter((id) => id !== sender_id);
        if (doctorUsers.length > 0) {
            await notifyUsers({
                sender_id: sender_id || null, recipient_ids: doctorUsers,
                title: 'Appointment Rescheduled',
                message: `${visitLabel(moved.appt.visit_type, moved.appt.purpose_other)} moved to ${formatDateTimeManila(startStr)}. Reason: ${moveReason}`,
                type: 'APPOINTMENT_RESCHEDULED', payloadData: { appointment_id }
            });
        }
    } catch (e) { console.error('Reschedule notification failed:', e.message); }

    res.json({ success: true, message: 'Appointment rescheduled successfully' });
});

app.put('/api/doctor-visits/cancel/:appointment_id', async (req, res) => {
    const { appointment_id } = req.params;
    const { sender_id } = req.body;
    const reason = textOrNull(req.body.reason);
    if (!reason) return res.status(400).json({ success: false, message: 'Please give a reason for cancelling.' });

    try {
        const [[appt]] = await pool.query(`SELECT status, visit_type, purpose_other, start_time, end_time, doctor_id FROM doctor_appointments WHERE appointment_id = ?`, [appointment_id]);
        if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found.' });
        if (!['Scheduled', 'Pending Approval'].includes(appt.status)) {
            return res.status(409).json({ success: false, message: `This appointment is already ${appt.status.toLowerCase()}.` });
        }

        await pool.query(
            `UPDATE doctor_appointments SET status = 'Cancelled', decline_reason = ? WHERE appointment_id = ?`,
            [reason.slice(0, 255), appointment_id]
        );
        await logAppointment(pool, {
            appointment_id, action: 'Cancelled', from_status: appt.status, to_status: 'Cancelled',
            old_start_time: appt.start_time, old_end_time: appt.end_time, reason, actor_user_id: sender_id || null
        });

        try {
            const purpose = visitLabel(appt.visit_type, appt.purpose_other);
            const [students] = await pool.query(`SELECT student_id FROM doctor_appointment_students WHERE appointment_id = ?`, [appointment_id]);
            for (const st of students) {
                await notifyUsers({
                    sender_id: sender_id || null,
                    recipient_ids: await getStudentAndParentUserIds(st.student_id),
                    title: 'Doctor Visit Cancelled',
                    message: `Your ${purpose} on ${formatDateTimeManila(appt.start_time)} was cancelled. Reason: ${reason}`,
                    type: 'APPOINTMENT_CANCELLED',
                    payloadData: { appointment_id }
                });
            }
            const doctorUsers = (await getDoctorUserIds(appt.doctor_id)).filter((id) => id !== sender_id);
            if (doctorUsers.length > 0) {
                await notifyUsers({
                    sender_id: sender_id || null, recipient_ids: doctorUsers,
                    title: 'Appointment Cancelled', message: `${purpose} on ${formatDateTimeManila(appt.start_time)} was cancelled. Reason: ${reason}`,
                    type: 'APPOINTMENT_CANCELLED', payloadData: { appointment_id }
                });
            }
        } catch (e) { console.error('Cancel notification failed:', e.message); }

        res.json({ success: true, message: 'Appointment cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel appointment' });
    }
});

// Batch Start Time Notification Endpoint
app.post('/api/doctor-visits/batch-start/:batch_id', async (req, res) => {
    const { batch_id } = req.params;
    const sender_id = req.body?.sender_id || req.user?.user_id;

    try {
        const [students] = await pool.query(
            `SELECT s.user_id, da.start_time
             FROM doctor_appointments da
             JOIN doctor_appointment_students das ON da.appointment_id = das.appointment_id
             JOIN students s ON das.student_id = s.student_id
             WHERE da.batch_id = ? AND das.attendance_status = 'Pending' AND da.status = 'Scheduled'`,
            [batch_id]
        );

        if (students.length > 0) {
            const recipientUserIds = students.map(st => st.user_id);
            await notifyUsers({
                sender_id: sender_id || null,
                recipient_ids: recipientUserIds,
                title: 'Doctor Visit Started',
                message: 'Your doctor visit batch is starting now. Please report to the clinic.',
                type: 'BATCH_STARTED',
                payloadData: { batch_id }
            });
        }

        res.json({ success: true, message: 'Batch start notifications sent successfully.' });
    } catch (error) {
        console.error('Error notifying batch start:', error);
        res.status(500).json({ success: false, message: 'Failed to send batch start notifications.' });
    }
});

// Reminder Notifications (1 day before & same day). Used by the button and the daily job.
// A reminder is sent at most once per appointment per day, even if both run.
const sentDoctorReminders = new Set();

const sendDoctorVisitReminders = async () => {
    const today = todayManilaStr();
    for (const key of sentDoctorReminders) {
        if (!key.endsWith(`|${today}`)) sentDoctorReminders.delete(key);
    }

    const rounds = [
        { dayOffset: 1, type: 'DOCTOR_VISIT_REMINDER_1DAY', title: 'Doctor Visit Tomorrow', when: 'tomorrow' },
        { dayOffset: 0, type: 'DOCTOR_VISIT_REMINDER_SAMEDAY', title: 'Doctor Visit Today', when: 'today' }
    ];

    let sent = 0;
    for (const round of rounds) {
        const [appts] = await pool.query(`
            SELECT da.appointment_id, da.start_time, da.visit_type, da.purpose_other, das.student_id, d.first_name, d.last_name
            FROM doctor_appointments da
            JOIN doctor_appointment_students das ON da.appointment_id = das.appointment_id
            JOIN doctors d ON da.doctor_id = d.doctor_id
            WHERE DATE(da.start_time) = CURDATE() + INTERVAL ? DAY
              AND das.attendance_status = 'Pending'
              AND da.status = 'Scheduled'
        `, [round.dayOffset]);

        for (const appt of appts) {
            const key = `${round.type}|${appt.appointment_id}|${appt.student_id}|${today}`;
            if (sentDoctorReminders.has(key)) continue;
            sentDoctorReminders.add(key);

            await notifyUsers({
                sender_id: null,
                recipient_ids: await getStudentAndParentUserIds(appt.student_id),
                title: round.title,
                message: `${visitLabel(appt.visit_type, appt.purpose_other)} ${round.when} at ${formatTimeManila(appt.start_time)} with Dr. ${appt.first_name} ${appt.last_name}.`,
                type: round.type,
                payloadData: { appointment_id: appt.appointment_id }
            });
            sent++;
        }
    }
    return sent;
};

cron.schedule('0 7 * * *', () => {
    sendDoctorVisitReminders().catch((err) => console.error('Doctor visit reminder job failed:', err.message));
}, { timezone: 'Asia/Manila' });

app.post('/api/doctor-visits/send-reminders', async (req, res) => {
    try {
        const sent = await sendDoctorVisitReminders();
        res.json({ success: true, message: sent > 0 ? `Sent ${sent} reminder(s).` : 'No new reminders to send (already sent or nothing due today/tomorrow).', sent });
    } catch (error) {
        console.error('Error sending reminders:', error);
        res.status(500).json({ success: false, message: 'Failed to send reminders' });
    }
});

// ==========================================
// 6. DOCTOR ASSESSMENT DOCUMENTATION
// ==========================================

// POST /api/doctor-assessments
// Saves the general assessment plus, for Dental / Vision visits, the type-specific record
// (all in one transaction). Re-saving updates in place; nothing is duplicated.
app.post('/api/doctor-assessments', async (req, res) => {
    const {
        appointment_id,
        student_id,
        student_user_id,
        sender_id,
        dental,
        vision
    } = req.body;
    let { clinical_findings, diagnosis, treatment_recommendations } = req.body;

    if (!appointment_id || !student_id) {
        return res.status(400).json({ success: false, message: 'appointment_id and student_id are required.' });
    }

    const connection = await pool.getConnection();
    let released = false;
    const release = () => { if (!released) { released = true; connection.release(); } };
    const fail = (status, message) => {
        release();
        return res.status(status).json({ success: false, message });
    };

    try {
        const [apptRows] = await connection.query(
            `SELECT visit_type, doctor_id FROM doctor_appointments WHERE appointment_id = ?`,
            [appointment_id]
        );
        if (apptRows.length === 0) return fail(404, 'Appointment not found.');
        const visitType = apptRows[0].visit_type || 'General Check Up';
        const doctorId = apptRows[0].doctor_id;

        let isAbnormal = toFlag(req.body.is_abnormal);
        let followUp = toFlag(req.body.follow_up_needed);
        let detail = null;

        if (visitType === 'Dental') {
            const d = dental || {};
            const hygiene = textOrNull(d.oral_hygiene);
            if (!hygiene) return fail(400, 'Oral hygiene rating is required for a dental examination.');
            if (!['Good', 'Fair', 'Poor'].includes(hygiene)) return fail(400, 'Oral hygiene must be Good, Fair or Poor.');
            detail = {
                oral_hygiene: hygiene,
                caries_count: toCount(d.caries_count),
                missing_count: toCount(d.missing_count),
                filled_count: toCount(d.filled_count),
                gum_condition: textOrNull(d.gum_condition),
                malocclusion: toFlag(d.malocclusion),
                tooth_notes: textOrNull(d.tooth_notes),
                treatment_done: textOrNull(d.treatment_done),
                treatment_needed: textOrNull(d.treatment_needed),
                referral_needed: toFlag(d.referral_needed),
                referral_to: textOrNull(d.referral_to),
                next_visit_recommendation: textOrNull(d.next_visit_recommendation),
                remarks: textOrNull(d.remarks)
            };
            const dmft = detail.caries_count + detail.missing_count + detail.filled_count;
            if (detail.caries_count > 0 || detail.referral_needed || hygiene === 'Poor') isAbnormal = 1;
            if (detail.referral_needed || detail.treatment_needed) followUp = 1;
            if (!textOrNull(clinical_findings)) {
                clinical_findings = `Oral hygiene: ${hygiene}. DMFT ${dmft} (Decayed ${detail.caries_count}, Missing ${detail.missing_count}, Filled ${detail.filled_count}). Gums: ${detail.gum_condition || 'not noted'}. Malocclusion: ${detail.malocclusion ? 'Yes' : 'No'}.${detail.tooth_notes ? ' ' + detail.tooth_notes : ''}`;
            }
            if (!textOrNull(diagnosis)) {
                diagnosis = detail.caries_count > 0 ? 'Dental caries' : (hygiene === 'Poor' ? 'Poor oral hygiene' : 'No significant dental findings');
            }
            if (!textOrNull(treatment_recommendations) && detail.treatment_needed) treatment_recommendations = detail.treatment_needed;
        } else if (visitType === 'Vision') {
            const v = vision || {};
            if (!textOrNull(v.visual_acuity_left) || !textOrNull(v.visual_acuity_right)) {
                return fail(400, 'Visual acuity for both eyes is required for a vision examination.');
            }
            const color = textOrNull(v.color_vision);
            if (color && !['Normal', 'Deficient'].includes(color)) return fail(400, 'Color vision must be Normal or Deficient.');
            const action = textOrNull(v.recommended_action) || 'No action';
            if (!['No action', 'Eyeglasses', 'Refer to ophthalmologist'].includes(action)) return fail(400, 'Invalid recommended action.');
            detail = {
                visual_acuity_left: textOrNull(v.visual_acuity_left),
                visual_acuity_right: textOrNull(v.visual_acuity_right),
                va_left_corrected: textOrNull(v.va_left_corrected),
                va_right_corrected: textOrNull(v.va_right_corrected),
                wears_eyeglasses: toFlag(v.wears_eyeglasses),
                wears_contacts: toFlag(v.wears_contacts),
                color_vision: color,
                eye_findings: textOrNull(v.eye_findings),
                recommended_action: action,
                remarks: textOrNull(v.remarks)
            };
            if (action !== 'No action' || color === 'Deficient') isAbnormal = 1;
            if (action === 'Refer to ophthalmologist') followUp = 1;
            if (!textOrNull(clinical_findings)) {
                const corrected = detail.va_left_corrected || detail.va_right_corrected
                    ? `; corrected L ${detail.va_left_corrected || '-'} / R ${detail.va_right_corrected || '-'}` : '';
                clinical_findings = `VA (uncorrected) L ${detail.visual_acuity_left} / R ${detail.visual_acuity_right}${corrected}. Color vision: ${color || 'not tested'}.${detail.eye_findings ? ' ' + detail.eye_findings : ''}`;
            }
            if (!textOrNull(diagnosis)) {
                if (action === 'Eyeglasses') diagnosis = 'Refractive error - eyeglasses recommended';
                else if (action === 'Refer to ophthalmologist') diagnosis = 'Vision concern - ophthalmology referral';
                else if (color === 'Deficient') diagnosis = 'Color vision deficiency';
                else diagnosis = 'No significant vision findings';
            }
            if (!textOrNull(treatment_recommendations) && action !== 'No action') treatment_recommendations = action;
        } else if (!textOrNull(clinical_findings) || !textOrNull(diagnosis)) {
            return fail(400, 'Clinical findings and diagnosis are required.');
        }

        const recommendations = textOrNull(treatment_recommendations);

        // Doctor consultation extras. Only touched when the form sent them, so the older nurse form never wipes them.
        const extras = {};
        if (req.body.prescriptions !== undefined) {
            const rx = Array.isArray(req.body.prescriptions) ? req.body.prescriptions : [];
            if (rx.length > 20) return fail(400, 'A prescription can list at most 20 medicines.');
            const cleaned = [];
            for (const item of rx) {
                const medicine = textOrNull(item?.medicine);
                const hasOther = ['dosage', 'frequency', 'duration', 'instructions'].some((k) => textOrNull(item?.[k]));
                if (!medicine && !hasOther) continue;
                if (!medicine) return fail(400, 'Every prescription line needs a medicine name.');
                cleaned.push({
                    medicine: medicine.slice(0, 150),
                    dosage: (textOrNull(item.dosage) || '').slice(0, 80),
                    frequency: (textOrNull(item.frequency) || '').slice(0, 80),
                    duration: (textOrNull(item.duration) || '').slice(0, 80),
                    instructions: (textOrNull(item.instructions) || '').slice(0, 255)
                });
            }
            extras.prescriptions = cleaned.length > 0 ? JSON.stringify(cleaned) : null;
        }
        if (req.body.follow_up_notes !== undefined) extras.follow_up_notes = textOrNull(req.body.follow_up_notes);
        if (req.body.follow_up_date !== undefined) {
            const fud = textOrNull(req.body.follow_up_date);
            if (fud && !isDateStr(fud)) return fail(400, 'The follow-up date is not valid.');
            extras.follow_up_date = fud;
            if (fud) followUp = 1;
        }
        if (req.body.template_responses !== undefined) {
            const answers = Array.isArray(req.body.template_responses) ? req.body.template_responses : [];
            extras.template_id = textOrNull(req.body.template_id);
            extras.template_name = textOrNull(req.body.template_name) ? textOrNull(req.body.template_name).slice(0, 120) : null;
            extras.template_responses = answers.length > 0
                ? JSON.stringify(answers.slice(0, 80).map((a) => ({
                    key: String(a.key || '').slice(0, 60), label: String(a.label || '').slice(0, 200), type: String(a.type || 'text').slice(0, 20),
                    value: Array.isArray(a.value) ? a.value.map((v) => String(v).slice(0, 255)) : (a.value === null || a.value === undefined ? '' : String(a.value).slice(0, 2000))
                })))
                : null;
        }
        if (req.body.documented_by_doctor_id) extras.documented_by_doctor_id = req.body.documented_by_doctor_id;
        const extraCols = Object.keys(extras);

        await connection.beginTransaction();

        const [existing] = await connection.query(
            `SELECT assessment_id FROM doctor_assessments WHERE appointment_id = ? AND student_id = ?`,
            [appointment_id, student_id]
        );

        if (existing.length > 0) {
            await connection.query(
                `UPDATE doctor_assessments
                 SET clinical_findings = ?, diagnosis = ?, treatment_recommendations = ?, is_abnormal = ?, follow_up_needed = ?, assessment_date = NOW(),
                     updated_by = ?, updated_at = NOW()${extraCols.map((c) => `, ${c} = ?`).join('')}
                 WHERE appointment_id = ? AND student_id = ?`,
                [clinical_findings, diagnosis, recommendations, isAbnormal, followUp, sender_id || null, ...extraCols.map((c) => extras[c]), appointment_id, student_id]
            );
        } else {
            const assessment_id = await generateCustomId('DVAS', 'doctor_assessments', 'assessment_id', connection);
            await connection.query(
                `INSERT INTO doctor_assessments (assessment_id, appointment_id, student_id, clinical_findings, diagnosis, treatment_recommendations, is_abnormal, follow_up_needed, assessment_date${extraCols.map((c) => `, ${c}`).join('')})
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW()${extraCols.map(() => ', ?').join('')})`,
                [assessment_id, appointment_id, student_id, clinical_findings, diagnosis, recommendations, isAbnormal, followUp, ...extraCols.map((c) => extras[c])]
            );
        }

        if (visitType === 'Dental') {
            const [rec] = await connection.query(
                `SELECT dental_record_id FROM dental_assessment_records WHERE appointment_id = ? AND student_id = ?`,
                [appointment_id, student_id]
            );
            const p = detail;
            if (rec.length > 0) {
                await connection.query(
                    `UPDATE dental_assessment_records SET doctor_id = ?, oral_hygiene = ?, caries_count = ?, missing_count = ?, filled_count = ?,
                        gum_condition = ?, malocclusion = ?, tooth_notes = ?, treatment_done = ?, treatment_needed = ?, referral_needed = ?,
                        referral_to = ?, next_visit_recommendation = ?, remarks = ?, dental_findings = ?, recorded_at = NOW()
                     WHERE dental_record_id = ?`,
                    [doctorId, p.oral_hygiene, p.caries_count, p.missing_count, p.filled_count, p.gum_condition, p.malocclusion, p.tooth_notes,
                     p.treatment_done, p.treatment_needed, p.referral_needed, p.referral_to, p.next_visit_recommendation, p.remarks,
                     clinical_findings, rec[0].dental_record_id]
                );
            } else {
                const recordId = await generateCustomId('DENT', 'dental_assessment_records', 'dental_record_id', connection);
                await connection.query(
                    `INSERT INTO dental_assessment_records
                        (dental_record_id, student_id, screening_schedule_id, appointment_id, doctor_id, oral_hygiene, caries_count, missing_count, filled_count,
                         gum_condition, malocclusion, tooth_notes, treatment_done, treatment_needed, referral_needed, referral_to,
                         next_visit_recommendation, remarks, dental_findings)
                     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [recordId, student_id, appointment_id, doctorId, p.oral_hygiene, p.caries_count, p.missing_count, p.filled_count, p.gum_condition,
                     p.malocclusion, p.tooth_notes, p.treatment_done, p.treatment_needed, p.referral_needed, p.referral_to,
                     p.next_visit_recommendation, p.remarks, clinical_findings]
                );
            }
        } else if (visitType === 'Vision') {
            const [rec] = await connection.query(
                `SELECT vision_record_id FROM vision_screening_records WHERE appointment_id = ? AND student_id = ?`,
                [appointment_id, student_id]
            );
            const p = detail;
            if (rec.length > 0) {
                await connection.query(
                    `UPDATE vision_screening_records SET doctor_id = ?, visual_acuity_left = ?, visual_acuity_right = ?, va_left_corrected = ?,
                        va_right_corrected = ?, wears_eyeglasses = ?, wears_contacts = ?, color_vision = ?, eye_findings = ?,
                        recommended_action = ?, remarks = ?, recorded_at = NOW()
                     WHERE vision_record_id = ?`,
                    [doctorId, p.visual_acuity_left, p.visual_acuity_right, p.va_left_corrected, p.va_right_corrected, p.wears_eyeglasses,
                     p.wears_contacts, p.color_vision, p.eye_findings, p.recommended_action, p.remarks, rec[0].vision_record_id]
                );
            } else {
                const recordId = await generateCustomId('VSN', 'vision_screening_records', 'vision_record_id', connection);
                await connection.query(
                    `INSERT INTO vision_screening_records
                        (vision_record_id, student_id, screening_schedule_id, appointment_id, doctor_id, visual_acuity_left, visual_acuity_right,
                         va_left_corrected, va_right_corrected, wears_eyeglasses, wears_contacts, color_vision, eye_findings, recommended_action, remarks)
                     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [recordId, student_id, appointment_id, doctorId, p.visual_acuity_left, p.visual_acuity_right, p.va_left_corrected,
                     p.va_right_corrected, p.wears_eyeglasses, p.wears_contacts, p.color_vision, p.eye_findings, p.recommended_action, p.remarks]
                );
            }
        }

        // The appointment is only Completed once every student who attended has been assessed.
        const [[pending]] = await connection.query(
            `SELECT COUNT(*) AS remaining
             FROM doctor_appointment_students das
             LEFT JOIN doctor_assessments a ON a.appointment_id = das.appointment_id AND a.student_id = das.student_id
             WHERE das.appointment_id = ? AND das.attendance_status = 'Present' AND a.assessment_id IS NULL`,
            [appointment_id]
        );
        if (pending.remaining === 0) {
            const [upd] = await connection.query(`UPDATE doctor_appointments SET status = 'Completed' WHERE appointment_id = ? AND status <> 'Completed'`, [appointment_id]);
            if (upd.affectedRows > 0) {
                await logAppointment(connection, {
                    appointment_id, action: 'Completed', from_status: 'Scheduled', to_status: 'Completed',
                    reason: 'Consultation documented', actor_user_id: sender_id || null
                });
            }
        }

        await connection.commit();
        release();

        // Parents are told as well when the result is abnormal or needs a follow-up
        let resultRecipients = student_user_id ? [student_user_id] : [];
        if (isAbnormal || followUp) {
            try { resultRecipients = [...new Set([...resultRecipients, ...await getConnectedParentUserIds([student_id])])]; } catch (_) {}
        }
        if (resultRecipients.length > 0) {
            await notifyUsers({
                sender_id: sender_id || null,
                recipient_ids: resultRecipients,
                title: `${visitType} Result Filed`,
                message: `Diagnosis: ${diagnosis || 'N/A'}. Recommendations: ${recommendations || 'None'}.${isAbnormal ? ' Please follow up with the clinic.' : ''}`,
                type: 'ASSESSMENT_COMPLETED',
                payloadData: { appointment_id }
            });
        }

        res.json({ success: true, message: 'Doctor assessment saved successfully!', is_abnormal: isAbnormal, follow_up_needed: followUp });
    } catch (error) {
        if (!released) { try { await connection.rollback(); } catch (_) {} }
        release();
        console.error('Error saving assessment:', error);
        res.status(500).json({ success: false, message: 'Failed to save assessment' });
    }
});

// Edit / delete a documented assessment, referral slips, walk-ins and follow-up visits

// Removes the assessment (and its dental / vision detail) so it can be redone. The visit goes back to Scheduled.
app.delete('/api/doctor-assessments/:appointment_id/:student_id', async (req, res) => {
    const { appointment_id, student_id } = req.params;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [[existing]] = await connection.query(
            `SELECT assessment_id FROM doctor_assessments WHERE appointment_id = ? AND student_id = ? FOR UPDATE`,
            [appointment_id, student_id]
        );
        if (!existing) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'No assessment found for this student.' });
        }
        await connection.query(`DELETE FROM dental_assessment_records WHERE appointment_id = ? AND student_id = ?`, [appointment_id, student_id]);
        await connection.query(`DELETE FROM vision_screening_records WHERE appointment_id = ? AND student_id = ?`, [appointment_id, student_id]);
        await connection.query(`DELETE FROM doctor_assessments WHERE appointment_id = ? AND student_id = ?`, [appointment_id, student_id]);
        await connection.query(`UPDATE doctor_appointments SET status = 'Scheduled' WHERE appointment_id = ? AND status = 'Completed'`, [appointment_id]);
        await connection.commit();
        res.json({ success: true, message: 'Assessment deleted.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting assessment:', error);
        res.status(500).json({ success: false, message: 'Failed to delete assessment' });
    } finally {
        connection.release();
    }
});

// Referral slip to an outside facility / specialist, stored with the assessment
app.put('/api/doctor-assessments/:appointment_id/:student_id/referral', async (req, res) => {
    const { appointment_id, student_id } = req.params;
    const facility = textOrNull(req.body.facility);
    const reason = textOrNull(req.body.reason);
    if (!facility || !reason) return res.status(400).json({ success: false, message: 'Facility / specialist and reason are required.' });

    try {
        const [result] = await pool.query(
            `UPDATE doctor_assessments
             SET referral_facility = ?, referral_reason = ?, referral_issued_at = NOW(), follow_up_needed = 1,
                 updated_by = ?, updated_at = NOW()
             WHERE appointment_id = ? AND student_id = ?`,
            [facility.slice(0, 150), reason, req.body.sender_id || null, appointment_id, student_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Document the assessment first, then issue the referral.' });

        try {
            await notifyUsers({
                sender_id: req.body.sender_id || null,
                recipient_ids: await getStudentAndParentUserIds(student_id),
                title: 'Referral Issued',
                message: `A referral to ${facility} was issued after your doctor visit. Please see the clinic for the referral slip.`,
                type: 'ASSESSMENT_REFERRAL',
                payloadData: { appointment_id }
            });
        } catch (e) { console.error('Referral notification failed:', e.message); }

        res.json({ success: true, message: 'Referral saved.' });
    } catch (error) {
        console.error('Error saving referral:', error);
        res.status(500).json({ success: false, message: 'Failed to save referral' });
    }
});

// Walk-in: the student is at the clinic now, so the visit starts immediately and the student is checked in.
app.post('/api/doctor-visits/walk-in', async (req, res) => {
    const { student_id, doctor_id } = req.body;
    const nurse_id = req.body.nurse_id || null;
    const creatorDoctorId = nurse_id ? null : (req.body.created_by_doctor_id || null);
    const visitType = req.body.visit_type || 'General Check Up';
    const reason = textOrNull(req.body.reason);
    const purposeOther = visitType === 'Other' ? textOrNull(req.body.purpose_other) : null;
    const duration = parseInt(req.body.duration_min, 10) || 15;

    if ((!nurse_id && !creatorDoctorId) || !student_id || !doctor_id) return res.status(400).json({ success: false, message: 'Nurse or doctor, student and doctor are required.' });
    if (creatorDoctorId && creatorDoctorId !== doctor_id) return res.status(403).json({ success: false, message: 'Doctors can only register walk-ins for themselves.' });
    if (!DOCTOR_VISIT_TYPES.includes(visitType)) return res.status(400).json({ success: false, message: `Visit type must be one of: ${DOCTOR_VISIT_TYPES.join(', ')}.` });
    if (visitType === 'Other' && !purposeOther) return res.status(400).json({ success: false, message: 'Please specify the purpose of the visit.' });
    if (!reason) return res.status(400).json({ success: false, message: 'Please enter the reason for the visit.' });
    if (duration < 5 || duration > 240) return res.status(400).json({ success: false, message: 'Duration must be between 5 and 240 minutes.' });

    const connection = await pool.getConnection();
    let created = null;
    try {
        await connection.beginTransaction();
        const doctor = await lockDoctor(connection, doctor_id);
        if (!doctor) throw new BookingError('Doctor not found.', 404);
        if (!doctorMatchesVisitType(doctor.specialization, visitType)) throw new BookingError(`${doctorDisplayName(doctor)} cannot take ${visitType} visits.`, 400);

        const [[student]] = await connection.query(`SELECT student_id, first_name, last_name FROM students WHERE student_id = ?`, [student_id]);
        if (!student) throw new BookingError('Student not found.', 404);

        const startStr = nowManilaStr();
        const endStr = addMinutesToStr(startStr, duration);
        if (await countStudentOverlaps(connection, student_id, startStr, endStr) > 0) {
            throw new BookingError('This student already has a doctor appointment happening right now.');
        }
        const absent = await findUnavailability(connection, doctor_id, startStr, endStr);
        if (absent) throw new BookingError(`${doctorDisplayName(doctor)} is unavailable: ${unavailabilityLabel(absent)}.`);

        const appointmentId = await generateCustomId('DVSCHED', 'doctor_appointments', 'appointment_id', connection);
        await connection.query(
            `INSERT INTO doctor_appointments
                (appointment_id, doctor_id, batch_id, title, announcement, start_time, end_time, assigned_by_nurse_id, assigned_by_doctor_id, status, visit_type, purpose_other, booking_source, booking_reason)
             VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?, 'Walk-in', ?)`,
            [appointmentId, doctor_id, `${visitType} Walk-in`.slice(0, 45), reason, startStr, endStr, nurse_id, creatorDoctorId, visitType, purposeOther, reason.slice(0, 255)]
        );
        await connection.query(
            `INSERT INTO doctor_appointment_students (appointment_id, student_id, attendance_status, check_in_time) VALUES (?, ?, 'Present', NOW())`,
            [appointmentId, student_id]
        );
        await logAppointment(connection, {
            appointment_id: appointmentId, action: 'Walk-in', to_status: 'Scheduled', new_start_time: startStr, new_end_time: endStr,
            reason, actor_user_id: req.body.sender_id || null
        });
        await connection.commit();
        created = { appointmentId, student, doctor };
    } catch (error) {
        await connection.rollback();
        connection.release();
        if (error instanceof BookingError) return res.status(error.status).json({ success: false, message: error.message });
        console.error('Error registering walk-in:', error);
        return res.status(500).json({ success: false, message: 'Failed to register walk-in visit' });
    }
    connection.release();
    if (created.doctor.user_id && created.doctor.user_id !== req.body.sender_id) {
        try {
            await notifyUsers({
                sender_id: req.body.sender_id || null, recipient_ids: [created.doctor.user_id],
                title: 'Walk-in Patient', message: `${created.student.first_name} ${created.student.last_name} is at the clinic for a ${visitLabel(visitType, purposeOther)}.`,
                type: 'APPOINTMENT_SCHEDULED', payloadData: { appointment_id: created.appointmentId }
            });
        } catch (e) { console.error('Walk-in notification failed:', e.message); }
    }
    res.status(201).json({ success: true, message: 'Walk-in registered. You can document the assessment now.', appointment_id: created.appointmentId, student_id });
});

// Follow-up visit created from an assessment that was flagged "follow-up needed".
app.post('/api/doctor-visits/:appointment_id/follow-up', async (req, res) => {
    const { appointment_id } = req.params;
    const { student_id } = req.body;
    const nurse_id = req.body.nurse_id || null;
    const creatorDoctorId = nurse_id ? null : (req.body.created_by_doctor_id || null);
    const startStr = String(req.body.start_time || '').replace('T', ' ').slice(0, 19);
    const duration = parseInt(req.body.duration_min, 10) || 15;
    if (!student_id || (!nurse_id && !creatorDoctorId)) return res.status(400).json({ success: false, message: 'Student and nurse or doctor are required.' });
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(startStr)) return res.status(400).json({ success: false, message: 'Pick a follow-up date and time.' });

    const connection = await pool.getConnection();
    let created = null;
    try {
        await connection.beginTransaction();
        const [[source]] = await connection.query(
            `SELECT da.title, da.doctor_id, da.visit_type, a.follow_up_needed
             FROM doctor_appointments da
             JOIN doctor_assessments a ON a.appointment_id = da.appointment_id AND a.student_id = ?
             WHERE da.appointment_id = ?`,
            [student_id, appointment_id]
        );
        if (!source) throw new BookingError('Document the assessment first before scheduling a follow-up.', 404);
        if (!source.follow_up_needed) throw new BookingError('This assessment is not marked "follow-up needed". Edit the assessment and tick it first.');

        const doctorId = req.body.doctor_id || source.doctor_id;
        const doctor = await lockDoctor(connection, doctorId);
        if (!doctor) throw new BookingError('Doctor not found.', 404);

        if (creatorDoctorId && creatorDoctorId !== doctorId) throw new BookingError('Doctors can only schedule follow-ups for their own patients.', 403);

        const endStr = addMinutesToStr(startStr, duration);
        // a doctor picks the follow-up time freely; the nurse still follows the doctor's posted schedule
        if (creatorDoctorId) await assertDirectFits(connection, { doctor, startStr, endStr, studentId: student_id, graceMin: 5 });
        else await assertAppointmentFits(connection, { doctor, visitType: 'Follow-up', startStr, endStr, studentId: student_id, graceMin: 5 });

        const newId = await generateCustomId('DVSCHED', 'doctor_appointments', 'appointment_id', connection);
        await connection.query(
            `INSERT INTO doctor_appointments
                (appointment_id, doctor_id, batch_id, title, announcement, start_time, end_time, assigned_by_nurse_id, assigned_by_doctor_id, status, visit_type, booking_source, parent_appointment_id)
             VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'Scheduled', 'Follow-up', ?, ?)`,
            [newId, doctorId, `Follow-up: ${source.title}`.slice(0, 45), textOrNull(req.body.notes) || `Follow-up of ${source.visit_type}`, startStr, endStr, nurse_id, creatorDoctorId,
             creatorDoctorId ? 'Doctor' : 'Nurse', appointment_id]
        );
        await connection.query(`INSERT INTO doctor_appointment_students (appointment_id, student_id, attendance_status) VALUES (?, ?, 'Pending')`, [newId, student_id]);
        await logAppointment(connection, {
            appointment_id: newId, action: 'Scheduled', to_status: 'Scheduled', new_start_time: startStr, new_end_time: endStr,
            reason: textOrNull(req.body.notes) || 'Follow-up visit', actor_user_id: req.body.sender_id || null
        });
        await connection.commit();
        created = { newId, doctor, startStr };
    } catch (error) {
        await connection.rollback();
        connection.release();
        if (error instanceof BookingError) return res.status(error.status).json({ success: false, message: error.message });
        console.error('Error scheduling follow-up:', error);
        return res.status(500).json({ success: false, message: 'Failed to schedule follow-up' });
    }
    connection.release();

    try {
        await notifyUsers({
            sender_id: req.body.sender_id || null,
            recipient_ids: await getStudentAndParentUserIds(student_id),
            title: 'Follow-up Visit Scheduled',
            message: `A follow-up visit with ${doctorDisplayName(created.doctor)} is set for ${formatDateTimeManila(created.startStr)}.`,
            type: 'APPOINTMENT_SCHEDULED',
            payloadData: { appointment_id: created.newId }
        });
    } catch (e) { console.error('Follow-up notification failed:', e.message); }

    res.status(201).json({ success: true, message: 'Follow-up visit scheduled.', appointment_id: created.newId });
});

// Batch reschedule appointments: every appointment is moved first, then each one is checked against the
// doctor's open schedule, the doctor's capacity and the student's other appointments.
app.put('/api/doctor-visits/batch-reschedule', async (req, res) => {
    const { batch_id, batch_start_time, batch_end_time, appointments, sender_id } = req.body;

    const connection = await pool.getConnection();
    const moved = [];

    try {
        await connection.beginTransaction();

        if (batch_id) {
            await connection.query(
                `UPDATE mass_schedule_batches SET start_time = ?, end_time = ? WHERE batch_id = ?`,
                [batch_start_time, batch_end_time, batch_id]
            );
        }

        if (Array.isArray(appointments) && appointments.length > 0) {
            const ids = appointments.map((a) => a.appointment_id);
            const [existing] = await connection.query(
                `SELECT da.appointment_id, da.doctor_id, da.visit_type, da.status, das.student_id
                 FROM doctor_appointments da JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
                 WHERE da.appointment_id IN (?) FOR UPDATE`,
                [ids]
            );
            const doctorIds = [...new Set(existing.map((e) => e.doctor_id))].sort();
            const doctors = {};
            for (const id of doctorIds) doctors[id] = await lockDoctor(connection, id);

            for (const appt of appointments) {
                await connection.query(
                    `UPDATE doctor_appointments SET start_time = ?, end_time = ? WHERE appointment_id = ?`,
                    [appt.start_time, appt.end_time, appt.appointment_id]
                );
            }
            for (const appt of appointments) {
                const row = existing.find((e) => e.appointment_id === appt.appointment_id);
                if (!row || !['Scheduled', 'Pending Approval'].includes(row.status)) continue;
                await assertAppointmentFits(connection, {
                    doctor: doctors[row.doctor_id], visitType: row.visit_type,
                    startStr: String(appt.start_time).replace('T', ' ').slice(0, 19), endStr: String(appt.end_time).replace('T', ' ').slice(0, 19),
                    studentId: row.student_id, excludeId: appt.appointment_id, graceMin: 10
                });
            }
            moved.push(...appointments);
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        connection.release();
        if (error instanceof BookingError) return res.status(error.status).json({ success: false, message: error.message });
        console.error('Error updating batch schedule:', error);
        return res.status(500).json({ success: false, message: 'Failed to update batch schedule' });
    }
    connection.release();

    for (const appt of moved) {
        if (!appt.student_user_id) continue;
        try {
            await notifyUsers({
                sender_id: sender_id || null,
                recipient_ids: [appt.student_user_id],
                title: 'Doctor Visit Rescheduled',
                message: `Moved to ${formatDateTimeManila(appt.start_time)}.`,
                type: 'BATCH_RESCHEDULED',
                payloadData: { batch_id, appointment_id: appt.appointment_id }
            });
        } catch (e) { console.error('Batch reschedule notification failed:', e.message); }
    }

    res.json({ success: true, message: 'Batch schedule updated successfully' });
});

// Cancel an entire batch and notify students
app.put('/api/doctor-visits/batch-cancel/:batch_id', async (req, res) => {
    const { batch_id } = req.params;
    const { sender_id, reason } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [appointments] = await connection.query(
            `SELECT da.appointment_id, da.status, das.student_id, s.user_id
             FROM doctor_appointments da
             JOIN doctor_appointment_students das ON da.appointment_id = das.appointment_id
             JOIN students s ON das.student_id = s.student_id
             WHERE da.batch_id = ?`,
            [batch_id]
        );

        await connection.query(
            `UPDATE doctor_appointments SET status = 'Cancelled' WHERE batch_id = ?`,
            [batch_id]
        );
        for (const a of appointments) {
            if (a.status === 'Cancelled') continue;
            await logAppointment(connection, {
                appointment_id: a.appointment_id, action: 'Cancelled', from_status: a.status, to_status: 'Cancelled',
                reason: textOrNull(reason) || 'Batch cancelled', actor_user_id: sender_id || null
            });
        }

        const recipientUserIds = appointments.map(a => a.user_id).filter(Boolean);
        if (recipientUserIds.length > 0) {
            await notifyUsers({
                sender_id: sender_id || null,
                recipient_ids: recipientUserIds,
                title: 'Doctor Visit Cancelled',
                message: `Batch doctor visit cancelled.${reason ? ` Reason: ${reason}` : ''}`,
                type: 'BATCH_CANCELLED',
                payloadData: { batch_id }
            });
        }

        await connection.commit();
        res.json({ success: true, message: 'Batch schedule cancelled successfully and students notified.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error cancelling batch schedule:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel batch schedule' });
    } finally {
        connection.release();
    }
});

// Hard Delete an entire batch and its records
app.delete('/api/doctor-visits/batch/:batch_id', async (req, res) => {
    const { batch_id } = req.params;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        await connection.query(
            `DELETE das FROM doctor_appointment_students das
             JOIN doctor_appointments da ON das.appointment_id = da.appointment_id
             WHERE da.batch_id = ?`,
            [batch_id]
        );

        await connection.query(
            `DELETE da_asm FROM doctor_assessments da_asm
             JOIN doctor_appointments da ON da_asm.appointment_id = da.appointment_id
             WHERE da.batch_id = ?`,
            [batch_id]
        );

        await connection.query(`DELETE FROM doctor_appointments WHERE batch_id = ?`, [batch_id]);
        await connection.query(`DELETE FROM mass_schedule_batches WHERE batch_id = ?`, [batch_id]);

        await connection.commit();
        res.json({ success: true, message: 'Batch appointment deleted successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting batch schedule:', error);
        res.status(500).json({ success: false, message: 'Failed to delete batch schedule' });
    } finally {
        connection.release();
    }
});

// Hard delete individual (non-batch) visits, e.g. a past booking, walk-in or follow-up
app.delete('/api/doctor-visits/appointments', async (req, res) => {
    const ids = Array.isArray(req.body?.appointment_ids) ? req.body.appointment_ids.filter(Boolean) : [];
    if (ids.length === 0) return res.status(400).json({ success: false, message: 'No appointments selected.' });
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        await connection.query(`DELETE FROM doctor_assessments WHERE appointment_id IN (?)`, [ids]);
        await connection.query(`DELETE FROM doctor_appointment_students WHERE appointment_id IN (?)`, [ids]);
        await connection.query(`DELETE FROM doctor_appointments WHERE appointment_id IN (?)`, [ids]);
        await connection.commit();
        res.json({ success: true, message: 'Doctor visit deleted successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting doctor visits:', error);
        res.status(500).json({ success: false, message: 'Failed to delete doctor visit' });
    } finally {
        connection.release();
    }
});


// ==========================================
// 7. DOCTOR PORTAL
// ==========================================
// Doctor accounts (created by the nurse), the doctor's own dashboard / appointments / patients,
// direct appointments, unavailable dates, the appointment reason log and assessment form templates.

const DOCTOR_PROFILE_SELECT = `
    SELECT d.doctor_id, d.user_id, d.first_name, d.last_name, d.specialization, d.contact_number, d.phone_confirmed_at, d.created_at,
           u.username, u.is_active
    FROM doctors d
    LEFT JOIN users u ON u.user_id = d.user_id`;

const accountUsername = (first, last) => {
    const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    return `dr.${clean(first)}.${clean(last)}`;
};

// ---- Nurse: manage doctor accounts ----

app.get('/api/doctor-accounts', async (req, res) => {
    try {
        const [rows] = await pool.query(`${DOCTOR_PROFILE_SELECT} ORDER BY d.last_name ASC, d.first_name ASC`);
        res.json({
            success: true,
            doctors: rows.map((r) => ({ ...r, has_account: !!r.user_id, is_active: r.user_id ? Number(r.is_active) : null, phone_confirmed: !!r.phone_confirmed_at }))
        });
    } catch (error) {
        console.error('Error fetching doctor accounts:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch doctor accounts' });
    }
});

// Creates a doctor login (default password "123") and the doctor profile, or adds a login to a profile-only doctor.
// The doctor adds their own phone number on first login.
app.post('/api/doctor-accounts', async (req, res) => {
    const nurseId = req.body.nurse_id || null;
    const linkDoctorId = textOrNull(req.body.link_doctor_id);
    const firstName = textOrNull(req.body.first_name);
    const lastName = textOrNull(req.body.last_name);
    const specialization = textOrNull(req.body.specialization);
    if (!nurseId) return res.status(400).json({ success: false, message: 'Nurse ID is required.' });
    if (!firstName || !lastName || !specialization) return res.status(400).json({ success: false, message: 'First name, last name and specialization are required.' });

    const rawUsername = textOrNull(req.body.username) || accountUsername(firstName, lastName);
    if (!/^[a-z0-9._-]{3,60}$/i.test(rawUsername.split('@')[0])) {
        return res.status(400).json({ success: false, message: 'The username can only use letters, numbers, dots, dashes and underscores (3 to 60 characters).' });
    }
    const username = formatUsername(rawUsername);

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [taken] = await connection.query(`SELECT 1 FROM users WHERE username = ? LIMIT 1`, [username]);
        if (taken.length > 0) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: `The username ${username} is already used. Pick another one.` });
        }

        let doctorId = linkDoctorId;
        if (doctorId) {
            const [[existing]] = await connection.query(`SELECT doctor_id, user_id FROM doctors WHERE doctor_id = ? FOR UPDATE`, [doctorId]);
            if (!existing) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Doctor profile not found.' }); }
            if (existing.user_id) { await connection.rollback(); return res.status(409).json({ success: false, message: 'This doctor already has an account.' }); }
        }

        const [roles] = await connection.query(`SELECT role_id FROM roles WHERE role_name = 'Doctor' LIMIT 1`);
        const roleId = roles.length > 0 ? roles[0].role_id : 'DCTR';
        const userId = crypto.randomUUID();
        await connection.query(
            `INSERT INTO users (user_id, username, password_hash, role_id, is_active, created_at) VALUES (?, ?, ?, ?, 1, NOW())`,
            [userId, username, await hashPassword('123'), roleId]
        );

        if (doctorId) {
            await connection.query(
                `UPDATE doctors SET user_id = ?, first_name = ?, last_name = ?, specialization = ?, phone_confirmed_at = NULL, created_by_nurse_id = COALESCE(created_by_nurse_id, ?) WHERE doctor_id = ?`,
                [userId, firstName, lastName, specialization, nurseId, doctorId]
            );
        } else {
            doctorId = `DOC-${uuidv4().substring(0, 8)}`;
            await connection.query(
                `INSERT INTO doctors (doctor_id, user_id, first_name, last_name, specialization, contact_number, created_by_nurse_id) VALUES (?, ?, ?, ?, ?, NULL, ?)`,
                [doctorId, userId, firstName, lastName, specialization, nurseId]
            );
        }

        await connection.commit();
        res.status(201).json({ success: true, message: 'Doctor account created.', doctor_id: doctorId, username, default_password: '123' });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating doctor account:', error);
        res.status(500).json({ success: false, message: 'Failed to create doctor account' });
    } finally {
        connection.release();
    }
});

app.put('/api/doctor-accounts/:doctorId', async (req, res) => {
    const firstName = textOrNull(req.body.first_name);
    const lastName = textOrNull(req.body.last_name);
    const specialization = textOrNull(req.body.specialization);
    if (!firstName || !lastName || !specialization) return res.status(400).json({ success: false, message: 'First name, last name and specialization are required.' });
    try {
        const [result] = await pool.query(
            `UPDATE doctors SET first_name = ?, last_name = ?, specialization = ? WHERE doctor_id = ?`,
            [firstName, lastName, specialization, req.params.doctorId]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Doctor not found.' });
        res.json({ success: true, message: 'Doctor updated.' });
    } catch (error) {
        console.error('Error updating doctor account:', error);
        res.status(500).json({ success: false, message: 'Failed to update doctor' });
    }
});

app.put('/api/doctor-accounts/:doctorId/active', async (req, res) => {
    const active = toFlag(req.body.is_active);
    try {
        const [[doc]] = await pool.query(`SELECT user_id FROM doctors WHERE doctor_id = ?`, [req.params.doctorId]);
        if (!doc || !doc.user_id) return res.status(404).json({ success: false, message: 'This doctor has no account.' });
        await pool.query(`UPDATE users SET is_active = ? WHERE user_id = ?`, [active, doc.user_id]);
        res.json({ success: true, message: active ? 'Account activated.' : 'Account deactivated. The doctor can no longer log in.' });
    } catch (error) {
        console.error('Error changing doctor account status:', error);
        res.status(500).json({ success: false, message: 'Failed to change account status' });
    }
});

// Back to the default password ("123"); optionally ask the doctor to confirm the phone number again
app.post('/api/doctor-accounts/:doctorId/reset', async (req, res) => {
    try {
        const [[doc]] = await pool.query(`SELECT user_id FROM doctors WHERE doctor_id = ?`, [req.params.doctorId]);
        if (!doc || !doc.user_id) return res.status(404).json({ success: false, message: 'This doctor has no account.' });
        await pool.query(`UPDATE users SET password_hash = ? WHERE user_id = ?`, [await hashPassword('123'), doc.user_id]);
        if (toFlag(req.body.reset_phone)) await pool.query(`UPDATE doctors SET phone_confirmed_at = NULL WHERE doctor_id = ?`, [req.params.doctorId]);
        res.json({ success: true, message: 'Password reset to the default ("123"). The doctor must change it at the next login.' });
    } catch (error) {
        console.error('Error resetting doctor password:', error);
        res.status(500).json({ success: false, message: 'Failed to reset the password' });
    }
});

// ---- Doctor: own profile, phone ----

app.get('/api/get-doctor/:userId', async (req, res) => {
    try {
        const [rows] = await pool.query(`${DOCTOR_PROFILE_SELECT} WHERE d.user_id = ?`, [req.params.userId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Doctor profile not found for this user.' });
        res.json({ success: true, doctor: { ...rows[0], phone_confirmed: !!rows[0].phone_confirmed_at && !!normalizePhPhone(rows[0].contact_number) } });
    } catch (error) {
        console.error('Error fetching doctor profile:', error);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// The phone number used to verify the doctor when the password is forgotten
app.put('/api/doctor/phone', async (req, res) => {
    const { user_id } = req.body;
    const phone = normalizePhPhone(req.body.phone);
    if (!user_id) return res.status(400).json({ success: false, message: 'User ID is required.' });
    if (!phone) return res.status(400).json({ success: false, message: 'Enter a valid Philippine mobile number (e.g. 09171234567 or +639171234567).' });
    try {
        const [result] = await pool.query(
            `UPDATE doctors SET contact_number = ?, phone_confirmed_at = NOW() WHERE user_id = ?`,
            [phone, user_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
        res.json({ success: true, message: 'Phone number saved.', contact_number: phone });
    } catch (error) {
        console.error('Error saving doctor phone:', error);
        res.status(500).json({ success: false, message: 'Failed to save the phone number' });
    }
});

// ---- Notifications of any user (the doctor portal; nurse / student / parent keep their own endpoints) ----

app.get('/api/notifications/user/:userId', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT notification_id, sender_id, recipient_id, title, message, type, is_read, created_at, read_at
             FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 50`,
            [req.params.userId]
        );
        res.json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        console.error('Error fetching user notifications:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.patch('/api/notifications/user/:userId/read-all', async (req, res) => {
    try {
        await pool.query(`UPDATE notifications SET is_read = 1, read_at = NOW() WHERE recipient_id = ? AND is_read = 0`, [req.params.userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking notifications read:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ---- Doctor: dashboard ----

app.get('/api/doctor/:doctorId/dashboard', async (req, res) => {
    const doctorId = req.params.doctorId;
    try {
        const today = todayManilaStr();
        const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : today.slice(0, 7);
        const range = req.query.range === 'month' ? 'month' : 'week';
        const live = `da.status NOT IN ('Cancelled', 'Declined')`;

        const [[totals]] = await pool.query(
            `SELECT COUNT(DISTINCT CASE WHEN da.status = 'Completed' OR das.attendance_status = 'Present' THEN das.student_id END) AS patients,
                    COUNT(DISTINCT CASE WHEN da.status = 'Completed' THEN da.appointment_id END) AS consultations,
                    COUNT(DISTINCT CASE WHEN da.status = 'Completed' AND DATE_FORMAT(da.start_time, '%Y-%m') = ? THEN da.appointment_id END) AS consultations_month,
                    COUNT(DISTINCT CASE WHEN da.status = 'Pending Approval' THEN da.appointment_id END) AS pending_requests,
                    COUNT(DISTINCT CASE WHEN da.status IN ('Scheduled', 'Completed') AND DATE(da.start_time) = ? THEN da.appointment_id END) AS today_total,
                    COUNT(DISTINCT CASE WHEN da.status = 'Scheduled' AND DATE(da.start_time) = ? AND da.end_time >= NOW() THEN da.appointment_id END) AS today_remaining
             FROM doctor_appointments da
             JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
             WHERE da.doctor_id = ?`,
            [today.slice(0, 7), today, today, doctorId]
        );

        // chart: this week (Mon-Sun) or this month, per day
        let from; let to;
        if (range === 'week') {
            const dow = dayOfWeekOf(today);
            from = addDaysStr(today, -((dow + 6) % 7));
            to = addDaysStr(from, 6);
        } else {
            from = `${today.slice(0, 7)}-01`;
            const next = new Date(`${from}T00:00:00Z`);
            next.setUTCMonth(next.getUTCMonth() + 1);
            to = addDaysStr(next.toISOString().slice(0, 10), -1);
        }
        const [daily] = await pool.query(
            `SELECT DATE(da.start_time) AS d, COUNT(*) AS total, SUM(da.status = 'Completed') AS completed
             FROM doctor_appointments da
             WHERE da.doctor_id = ? AND ${live} AND DATE(da.start_time) BETWEEN ? AND ?
             GROUP BY DATE(da.start_time)`,
            [doctorId, from, to]
        );
        const byDay = Object.fromEntries(daily.map((r) => [r.d, r]));
        const series = [];
        for (let d = from; d <= to; d = addDaysStr(d, 1)) {
            series.push({
                date: d, label: range === 'week' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeekOf(d)] : String(Number(d.slice(8))),
                appointments: Number(byDay[d]?.total || 0), completed: Number(byDay[d]?.completed || 0)
            });
        }

        const [purposes] = await pool.query(
            `SELECT da.visit_type, COUNT(*) AS n FROM doctor_appointments da
             WHERE da.doctor_id = ? AND ${live} AND da.status <> 'Pending Approval' GROUP BY da.visit_type`,
            [doctorId]
        );

        // calendar: appointment count per day of the requested month
        const monthStart = `${month}-01`;
        const nextMonth = new Date(`${monthStart}T00:00:00Z`);
        nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
        const monthEnd = addDaysStr(nextMonth.toISOString().slice(0, 10), -1);
        const [calendarRows] = await pool.query(
            `SELECT DATE(da.start_time) AS d, COUNT(*) AS n FROM doctor_appointments da
             WHERE da.doctor_id = ? AND da.status IN ('Scheduled', 'Pending Approval', 'Completed') AND DATE(da.start_time) BETWEEN ? AND ?
             GROUP BY DATE(da.start_time)`,
            [doctorId, monthStart, monthEnd]
        );
        const [absences] = await pool.query(
            `SELECT start_date, end_date, start_time, end_time, reason FROM doctor_unavailable_dates WHERE doctor_id = ? AND end_date >= ? AND start_date <= ?`,
            [doctorId, monthStart, monthEnd]
        );

        const [upcoming] = await pool.query(
            `SELECT da.appointment_id, da.visit_type, da.purpose_other, da.start_time, da.end_time, da.status, da.booking_source,
                    das.student_id, s.first_name AS student_first_name, s.last_name AS student_last_name
             FROM doctor_appointments da
             JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
             JOIN students s ON s.student_id = das.student_id
             WHERE da.doctor_id = ? AND da.status IN ('Scheduled', 'Pending Approval') AND da.end_time >= NOW()
             ORDER BY da.start_time ASC LIMIT 8`,
            [doctorId]
        );

        res.json({
            success: true,
            totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, Number(v || 0)])),
            range, series,
            purposes: purposes.map((p) => ({ visit_type: p.visit_type, count: Number(p.n) })),
            month, calendar: Object.fromEntries(calendarRows.map((r) => [r.d, Number(r.n)])), absences,
            upcoming
        });
    } catch (error) {
        console.error('Error building doctor dashboard:', error);
        res.status(500).json({ success: false, message: 'Failed to load the dashboard' });
    }
});

// ---- Doctor: appointments / consultations lists ----
// scope: requests (waiting for approval) | today | upcoming | past | queue (checked in, not documented yet) | documented | all

app.get('/api/doctor/:doctorId/appointments', async (req, res) => {
    try {
        const { scope = 'upcoming', q, purpose, from, to } = req.query;
        const { page, pageSize, offset } = pageParams(req.query);
        const where = ['da.doctor_id = ?'];
        const params = [req.params.doctorId];

        switch (scope) {
            case 'requests': where.push(`da.status = 'Pending Approval'`); break;
            case 'today': where.push(`DATE(da.start_time) = CURDATE()`, `da.status IN ('Scheduled', 'Pending Approval', 'Completed')`); break;
            case 'upcoming': where.push(`da.status IN ('Scheduled', 'Pending Approval')`, `da.end_time >= NOW()`); break;
            case 'past': where.push(`da.status <> 'Pending Approval'`, `(da.end_time < NOW() OR da.status IN ('Completed', 'Cancelled', 'Declined', 'No-Show'))`); break;
            case 'queue': where.push(`da.status = 'Scheduled'`, `das.attendance_status = 'Present'`, `da_assessment.assessment_id IS NULL`); break;
            case 'documented': where.push(`da_assessment.assessment_id IS NOT NULL`); break;
            case 'all': break;
            default: return res.status(400).json({ success: false, message: 'Unknown scope.' });
        }
        if (purpose && DOCTOR_VISIT_TYPES.includes(purpose)) { where.push('da.visit_type = ?'); params.push(purpose); }
        if (isDateStr(from)) { where.push('DATE(da.start_time) >= ?'); params.push(from); }
        if (isDateStr(to)) { where.push('DATE(da.start_time) <= ?'); params.push(to); }
        const search = textOrNull(q);
        if (search) {
            const like = `%${search}%`;
            where.push(`(CONCAT(s.first_name, ' ', s.last_name) LIKE ? OR s.student_id LIKE ? OR da.title LIKE ? OR da.visit_type LIKE ? OR da.purpose_other LIKE ? OR da.booking_reason LIKE ?)`);
            params.push(like, like, like, like, like, like);
        }

        const [[countRow]] = await pool.query(
            `SELECT COUNT(*) AS n
             FROM doctor_appointments da
             JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
             JOIN students s ON s.student_id = das.student_id
             LEFT JOIN doctor_assessments da_assessment ON da_assessment.appointment_id = da.appointment_id AND da_assessment.student_id = das.student_id
             WHERE ${where.join(' AND ')}`,
            params
        );
        const total = Number(countRow.n);
        const desc = ['past', 'documented'].includes(scope);

        const [rows] = await pool.query(
            `${DOCTOR_VISIT_SELECT} WHERE ${where.join(' AND ')} ORDER BY da.start_time ${desc ? 'DESC' : 'ASC'} LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );
        res.json({ success: true, appointments: rows, total, page, pageSize, pageCount: Math.max(Math.ceil(total / pageSize), 1) });
    } catch (error) {
        console.error('Error fetching doctor appointments:', error);
        res.status(500).json({ success: false, message: 'Failed to load appointments' });
    }
});

// who did what to an appointment, and why
app.get('/api/doctor-appointments/:appointmentId/logs', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT log_id, action, from_status, to_status, old_start_time, old_end_time, new_start_time, new_end_time, reason, actor_role, actor_name, created_at
             FROM doctor_appointment_logs WHERE appointment_id = ? ORDER BY created_at ASC, log_id ASC`,
            [req.params.appointmentId]
        );
        res.json({ success: true, logs: rows });
    } catch (error) {
        console.error('Error fetching appointment logs:', error);
        res.status(500).json({ success: false, message: 'Failed to load the appointment log' });
    }
});

// ---- Direct appointment: the nurse or the doctor picks the student and a custom time block ----

app.post('/api/doctor-appointments/direct', async (req, res) => {
    const { doctor_id, student_id } = req.body;
    const nurseId = req.body.nurse_id || null;
    const creatorDoctorId = nurseId ? null : (req.body.created_by_doctor_id || null);
    const visitType = req.body.visit_type || 'General Check Up';
    const purposeOther = visitType === 'Other' ? textOrNull(req.body.purpose_other) : null;
    const reason = textOrNull(req.body.reason);
    const startStr = normDt(req.body.start_time);
    let endStr = normDt(req.body.end_time);

    if ((!nurseId && !creatorDoctorId) || !doctor_id || !student_id) return res.status(400).json({ success: false, message: 'Doctor, student and who is scheduling are required.' });
    if (creatorDoctorId && creatorDoctorId !== doctor_id) return res.status(403).json({ success: false, message: 'Doctors can only schedule their own appointments.' });
    if (!VISIT_PURPOSES.includes(visitType)) return res.status(400).json({ success: false, message: `Purpose must be one of: ${VISIT_PURPOSES.join(', ')}.` });
    if (visitType === 'Other' && !purposeOther) return res.status(400).json({ success: false, message: 'Please specify the purpose of the visit.' });
    if (!startStr || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(startStr)) return res.status(400).json({ success: false, message: 'A valid start time is required.' });
    if (!endStr) {
        const dur = parseInt(req.body.duration_min, 10);
        if (!Number.isFinite(dur) || dur < 5 || dur > 480) return res.status(400).json({ success: false, message: 'Give an end time or a duration between 5 and 480 minutes.' });
        endStr = addMinutesToStr(startStr, dur);
    }

    const connection = await pool.getConnection();
    let created = null;
    try {
        await connection.beginTransaction();
        const doctor = await lockDoctor(connection, doctor_id);
        if (!doctor) throw new BookingError('Doctor not found.', 404);
        if (!doctorMatchesVisitType(doctor.specialization, visitType)) throw new BookingError(`${doctorDisplayName(doctor)} (${doctor.specialization || 'no specialization'}) cannot take ${visitType} visits.`, 400);
        const [[student]] = await connection.query(`SELECT student_id, user_id, first_name, last_name FROM students WHERE student_id = ?`, [student_id]);
        if (!student) throw new BookingError('Student not found.', 404);

        const s = startStr.length === 16 ? `${startStr}:00` : startStr;
        const e = endStr.length === 16 ? `${endStr}:00` : endStr;
        await assertDirectFits(connection, { doctor, startStr: s, endStr: e, studentId: student_id });

        const appointmentId = await generateCustomId('DVSCHED', 'doctor_appointments', 'appointment_id', connection);
        await connection.query(
            `INSERT INTO doctor_appointments
                (appointment_id, doctor_id, batch_id, title, announcement, start_time, end_time, assigned_by_nurse_id, assigned_by_doctor_id, status,
                 visit_type, purpose_other, booking_source, booking_reason)
             VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?, ?, ?)`,
            [appointmentId, doctor_id, `${visitLabel(visitType, purposeOther)} Appointment`.slice(0, 45), reason || 'Direct appointment', s, e, nurseId, creatorDoctorId,
             visitType, purposeOther, creatorDoctorId ? 'Doctor' : 'Nurse', reason ? reason.slice(0, 255) : null]
        );
        await connection.query(`INSERT INTO doctor_appointment_students (appointment_id, student_id, attendance_status) VALUES (?, ?, 'Pending')`, [appointmentId, student_id]);
        await logAppointment(connection, {
            appointment_id: appointmentId, action: 'Scheduled', to_status: 'Scheduled', new_start_time: s, new_end_time: e,
            reason: reason || 'Direct appointment', actor_user_id: req.body.sender_id || null
        });
        await connection.commit();
        created = { appointmentId, doctor, student, s };
    } catch (error) {
        await connection.rollback();
        connection.release();
        if (error instanceof BookingError) return res.status(error.status).json({ success: false, message: error.message });
        console.error('Error creating direct appointment:', error);
        return res.status(500).json({ success: false, message: 'Failed to create the appointment' });
    }
    connection.release();

    try {
        const purpose = visitLabel(visitType, purposeOther);
        await notifyUsers({
            sender_id: req.body.sender_id || null,
            recipient_ids: await getStudentAndParentUserIds(student_id),
            title: 'Doctor Appointment Scheduled',
            message: `${purpose} with ${doctorDisplayName(created.doctor)} on ${fmtApptWhen(created.s)}.${reason ? ` ${reason}` : ''}`,
            type: 'APPOINTMENT_SCHEDULED', payloadData: { appointment_id: created.appointmentId }
        });
        if (nurseId && created.doctor.user_id) {
            await notifyUsers({
                sender_id: req.body.sender_id || null, recipient_ids: [created.doctor.user_id],
                title: 'New Appointment Scheduled',
                message: `${created.student.first_name} ${created.student.last_name}: ${purpose} on ${fmtApptWhen(created.s)}.`,
                type: 'APPOINTMENT_SCHEDULED', payloadData: { appointment_id: created.appointmentId }
            });
        }
    } catch (e) { console.error('Direct appointment notification failed:', e.message); }

    res.status(201).json({ success: true, message: 'Appointment scheduled. The student and parents were notified.', appointment_id: created.appointmentId });
});

// ---- Unavailable dates (the nurse or the doctor can add them) ----

app.get('/api/doctor-unavailable-dates', async (req, res) => {
    try {
        const { doctor_id, include_past } = req.query;
        const where = [];
        const params = [];
        if (doctor_id) { where.push('u.doctor_id = ?'); params.push(doctor_id); }
        if (include_past !== '1') { where.push('u.end_date >= CURDATE()'); }
        const [rows] = await pool.query(
            `SELECT u.*, d.first_name AS doc_first_name, d.last_name AS doc_last_name
             FROM doctor_unavailable_dates u JOIN doctors d ON d.doctor_id = u.doctor_id
             ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
             ORDER BY u.start_date ASC, u.start_time ASC`,
            params
        );
        res.json({ success: true, unavailable: rows });
    } catch (error) {
        console.error('Error fetching unavailable dates:', error);
        res.status(500).json({ success: false, message: 'Failed to load unavailable dates' });
    }
});

app.post('/api/doctor-unavailable-dates', async (req, res) => {
    const { doctor_id } = req.body;
    const startDate = req.body.start_date;
    const endDate = req.body.end_date || req.body.start_date;
    const startTime = textOrNull(req.body.start_time);
    const endTime = textOrNull(req.body.end_time);
    const reason = textOrNull(req.body.reason);
    const actorUserId = req.body.actor_user_id || null;

    if (!doctor_id) return res.status(400).json({ success: false, message: 'Doctor is required.' });
    if (!isDateStr(startDate) || !isDateStr(endDate)) return res.status(400).json({ success: false, message: 'Pick a valid date.' });
    if (endDate < startDate) return res.status(400).json({ success: false, message: 'The end date must be on or after the start date.' });
    if (endDate < nowManilaStr().slice(0, 10)) return res.status(400).json({ success: false, message: 'That period is already over.' });
    if (endDate > addDaysStr(startDate, 366)) return res.status(400).json({ success: false, message: 'An absence can span at most one year.' });
    if ((startTime && !endTime) || (!startTime && endTime)) return res.status(400).json({ success: false, message: 'Give both a start and an end time, or leave both empty for the whole day.' });
    if (startTime && (!isTimeStr(startTime) || !isTimeStr(endTime) || hmsToMin(endTime) <= hmsToMin(startTime))) {
        return res.status(400).json({ success: false, message: 'The end time must be after the start time.' });
    }

    const connection = await pool.getConnection();
    let cancelled = [];
    try {
        await connection.beginTransaction();
        const doctor = await lockDoctor(connection, doctor_id);
        if (!doctor) { await connection.rollback(); connection.release(); return res.status(404).json({ success: false, message: 'Doctor not found.' }); }

        const window = { start_date: startDate, end_date: endDate, start_time: startTime ? minToHms(hmsToMin(startTime)) : null, end_time: endTime ? minToHms(hmsToMin(endTime)) : null };
        const [candidates] = await connection.query(
            `SELECT da.appointment_id, da.start_time, da.end_time, da.status, da.visit_type, da.purpose_other, das.student_id
             FROM doctor_appointments da JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
             WHERE da.doctor_id = ? AND da.status IN ('Scheduled', 'Pending Approval') AND DATE(da.end_time) >= ? AND DATE(da.start_time) <= ? AND da.end_time > NOW()`,
            [doctor_id, startDate, endDate]
        );
        const conflicts = candidates.filter((c) => unavailabilityApplies(window, c.start_time, c.end_time));
        if (conflicts.length > 0 && !toFlag(req.body.cancel_conflicts)) {
            await connection.rollback();
            connection.release();
            return res.status(409).json({
                success: false, needs_confirmation: true, conflicts: conflicts.length,
                message: `${conflicts.length} appointment(s) fall in this period. Confirm to cancel them (the students and parents are notified) or pick other dates.`
            });
        }

        const unavailableId = `UNV-${uuidv4().substring(0, 8)}`;
        const actor = await resolveActor(connection, actorUserId);
        await connection.query(
            `INSERT INTO doctor_unavailable_dates (unavailable_id, doctor_id, start_date, end_date, start_time, end_time, reason, created_by_user_id, created_by_role)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [unavailableId, doctor_id, startDate, endDate, window.start_time, window.end_time, reason ? reason.slice(0, 255) : null, actorUserId, actor.role === 'System' ? null : actor.role]
        );

        const cancelReason = `${doctorDisplayName(doctor)} is unavailable${reason ? `: ${reason}` : ''}`;
        for (const c of conflicts) {
            await connection.query(`UPDATE doctor_appointments SET status = 'Cancelled', decline_reason = ? WHERE appointment_id = ?`, [cancelReason.slice(0, 255), c.appointment_id]);
            await logAppointment(connection, {
                appointment_id: c.appointment_id, action: 'Cancelled', from_status: c.status, to_status: 'Cancelled',
                old_start_time: c.start_time, old_end_time: c.end_time, reason: cancelReason, actor_user_id: actorUserId
            });
        }
        cancelled = conflicts;
        await connection.commit();
        res.status(201).json({ success: true, message: cancelled.length > 0 ? `Saved. ${cancelled.length} appointment(s) were cancelled and the students notified.` : 'Unavailable dates saved.', unavailable_id: unavailableId, cancelled: cancelled.length });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error saving unavailable dates:', error);
        return res.status(500).json({ success: false, message: 'Failed to save the unavailable dates' });
    }
    connection.release();

    for (const c of cancelled) {
        try {
            await notifyUsers({
                sender_id: actorUserId, recipient_ids: await getStudentAndParentUserIds(c.student_id),
                title: 'Doctor Appointment Cancelled',
                message: `Your ${visitLabel(c.visit_type, c.purpose_other)} on ${fmtApptWhen(c.start_time)} was cancelled because the doctor is unavailable${reason ? ` (${reason})` : ''}. Please book another slot.`,
                type: 'APPOINTMENT_CANCELLED', payloadData: { appointment_id: c.appointment_id }
            });
        } catch (e) { console.error('Unavailable-date notification failed:', e.message); }
    }
});

app.delete('/api/doctor-unavailable-dates/:id', async (req, res) => {
    try {
        const [result] = await pool.query(`DELETE FROM doctor_unavailable_dates WHERE unavailable_id = ?`, [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found.' });
        res.json({ success: true, message: 'Removed. The doctor can be booked on those dates again.' });
    } catch (error) {
        console.error('Error deleting unavailable dates:', error);
        res.status(500).json({ success: false, message: 'Failed to remove the unavailable dates' });
    }
});

// ---- Doctor: patients (student clinic records) ----

app.get('/api/doctor/:doctorId/patients', async (req, res) => {
    try {
        const search = textOrNull(req.query.q);
        const params = [req.params.doctorId];
        let where = '';
        if (search) {
            const like = `%${search}%`;
            where = `WHERE CONCAT(s.first_name, ' ', s.last_name) LIKE ? OR s.student_id LIKE ?`;
            params.push(like, like);
        } else {
            where = `WHERE mine.visits IS NOT NULL`;
        }
        const [rows] = await pool.query(
            `SELECT s.student_id, s.first_name, s.last_name, s.year_level, s.section, p.program_name,
                    COALESCE(mine.visits, 0) AS visits_with_me, mine.last_visit, COALESCE(mine.abnormal, 0) AS abnormal
             FROM students s
             LEFT JOIN academic_programs p ON p.program_id = s.program_id
             LEFT JOIN (
                SELECT das.student_id, COUNT(DISTINCT da.appointment_id) AS visits, MAX(da.start_time) AS last_visit,
                       MAX(COALESCE(a.is_abnormal, 0)) AS abnormal
                FROM doctor_appointments da
                JOIN doctor_appointment_students das ON das.appointment_id = da.appointment_id
                LEFT JOIN doctor_assessments a ON a.appointment_id = da.appointment_id AND a.student_id = das.student_id
                WHERE da.doctor_id = ? AND da.status IN ('Scheduled', 'Completed')
                GROUP BY das.student_id
             ) mine ON mine.student_id = s.student_id
             ${where}
             ORDER BY mine.last_visit DESC, s.last_name ASC, s.first_name ASC
             LIMIT 60`,
            params
        );
        res.json({ success: true, patients: rows });
    } catch (error) {
        console.error('Error fetching doctor patients:', error);
        res.status(500).json({ success: false, message: 'Failed to load patients' });
    }
});

// Everything the clinic documented for one student (all doctors), newest first, plus their upcoming doctor appointments
app.get('/api/doctor/patients/:studentId/record', async (req, res) => {
    try {
        const studentId = req.params.studentId;
        const [[student]] = await pool.query(
            `SELECT s.student_id, s.first_name, s.last_name, s.year_level, s.section, p.program_name
             FROM students s LEFT JOIN academic_programs p ON p.program_id = s.program_id WHERE s.student_id = ?`,
            [studentId]
        );
        if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

        const [consultations] = await pool.query(
            `${DOCTOR_VISIT_SELECT} WHERE das.student_id = ? AND da_assessment.assessment_id IS NOT NULL ORDER BY da_assessment.assessment_date DESC LIMIT 100`,
            [studentId]
        );
        const [upcoming] = await pool.query(
            `${DOCTOR_VISIT_SELECT} WHERE das.student_id = ? AND da.status IN ('Scheduled', 'Pending Approval') AND da.end_time >= NOW() ORDER BY da.start_time ASC LIMIT 20`,
            [studentId]
        );
        const [clinicVisits] = await pool.query(
            `SELECT cv.visit_id, cv.visit_date, cv.time_in, cv.time_out, cv.specify_complaint_text, cv.temperature, cv.blood_pressure,
                    cv.pulse_rate, cv.respiratory_rate, cv.assessment, cv.nursing_intervention
             FROM clinic_visits cv WHERE cv.student_id = ? ORDER BY cv.visit_date DESC, cv.time_in DESC LIMIT 20`, [studentId]
        );
        res.json({ success: true, student, consultations, upcoming, clinic_visits: clinicVisits });
    } catch (error) {
        console.error('Error fetching patient record:', error);
        res.status(500).json({ success: false, message: 'Failed to load the patient record' });
    }
});

// ---- Doctor: assessment form templates ----

const TEMPLATE_FIELD_TYPES = ['heading', 'text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox', 'yesno'];
const TEMPLATE_OPTION_TYPES = ['select', 'radio', 'checkbox'];

const cleanTemplateFields = (raw) => {
    if (!Array.isArray(raw) || raw.length === 0) return { error: 'Add at least one field to the template.' };
    if (raw.length > 60) return { error: 'A template can have at most 60 fields.' };
    const used = new Set();
    const fields = [];
    for (let i = 0; i < raw.length; i++) {
        const f = raw[i] || {};
        const label = textOrNull(f.label);
        const type = String(f.type || 'text');
        if (!label) return { error: `Field ${i + 1} needs a label.` };
        if (!TEMPLATE_FIELD_TYPES.includes(type)) return { error: `Field "${label}" has an unknown type.` };
        let key = /^[a-z0-9_]{1,40}$/.test(String(f.key || '')) ? String(f.key) : `f${i + 1}`;
        while (used.has(key)) key = `${key}_${i + 1}`;
        used.add(key);
        const field = { key, label: label.slice(0, 200), type, required: type !== 'heading' && !!f.required };
        if (TEMPLATE_OPTION_TYPES.includes(type)) {
            const options = [...new Set((Array.isArray(f.options) ? f.options : []).map((o) => textOrNull(o)).filter(Boolean).map((o) => o.slice(0, 100)))];
            if (options.length < 2) return { error: `Field "${label}" needs at least two options.` };
            field.options = options.slice(0, 30);
        }
        const hint = textOrNull(f.hint);
        if (hint && type !== 'heading') field.hint = hint.slice(0, 200);
        if (type === 'number') {
            const unit = textOrNull(f.unit);
            if (unit) field.unit = unit.slice(0, 20);
        }
        fields.push(field);
    }
    if (!fields.some((f) => f.type !== 'heading')) return { error: 'A template needs at least one field that is not a heading.' };
    return { fields };
};

const parseJsonCol = (v) => {
    if (v === null || v === undefined) return v;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch (_) { return null; }
};

app.get('/api/doctor/:doctorId/templates', async (req, res) => {
    try {
        const where = ['doctor_id = ?'];
        const params = [req.params.doctorId];
        if (req.query.include_inactive !== '1') where.push('is_active = 1');
        if (req.query.visit_type) { where.push('(visit_type IS NULL OR visit_type = ?)'); params.push(req.query.visit_type); }
        const [rows] = await pool.query(`SELECT * FROM doctor_assessment_templates WHERE ${where.join(' AND ')} ORDER BY is_default DESC, template_name ASC`, params);
        res.json({ success: true, templates: rows.map((r) => ({ ...r, fields: parseJsonCol(r.fields) || [] })) });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ success: false, message: 'Failed to load templates' });
    }
});

const saveTemplate = async (req, res, templateId) => {
    const doctorId = templateId ? req.body.doctor_id : req.params.doctorId;
    const name = textOrNull(req.body.template_name);
    const visitType = textOrNull(req.body.visit_type);
    if (!doctorId) return res.status(400).json({ success: false, message: 'Doctor is required.' });
    if (!name) return res.status(400).json({ success: false, message: 'Give the template a name.' });
    if (visitType && !DOCTOR_VISIT_TYPES.includes(visitType)) return res.status(400).json({ success: false, message: 'Unknown visit purpose.' });
    const cleaned = cleanTemplateFields(req.body.fields);
    if (cleaned.error) return res.status(400).json({ success: false, message: cleaned.error });
    const isDefault = toFlag(req.body.is_default);

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        if (templateId) {
            const [[owned]] = await connection.query(`SELECT template_id FROM doctor_assessment_templates WHERE template_id = ? AND doctor_id = ? FOR UPDATE`, [templateId, doctorId]);
            if (!owned) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Template not found.' }); }
        }
        const [dupe] = await connection.query(
            `SELECT template_id FROM doctor_assessment_templates WHERE doctor_id = ? AND template_name = ? ${templateId ? 'AND template_id <> ?' : ''}`,
            templateId ? [doctorId, name, templateId] : [doctorId, name]
        );
        if (dupe.length > 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'You already have a template with that name.' }); }

        const id = templateId || `TPL-${uuidv4().substring(0, 8)}`;
        if (isDefault) {
            await connection.query(`UPDATE doctor_assessment_templates SET is_default = 0 WHERE doctor_id = ? AND visit_type <=> ? AND template_id <> ?`, [doctorId, visitType, id]);
        }
        if (templateId) {
            await connection.query(
                `UPDATE doctor_assessment_templates SET template_name = ?, visit_type = ?, description = ?, fields = ?, is_default = ?, is_active = ? WHERE template_id = ?`,
                [name.slice(0, 120), visitType, textOrNull(req.body.description)?.slice(0, 255) || null, JSON.stringify(cleaned.fields), isDefault, req.body.is_active === undefined ? 1 : toFlag(req.body.is_active), id]
            );
        } else {
            await connection.query(
                `INSERT INTO doctor_assessment_templates (template_id, doctor_id, template_name, visit_type, description, fields, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, doctorId, name.slice(0, 120), visitType, textOrNull(req.body.description)?.slice(0, 255) || null, JSON.stringify(cleaned.fields), isDefault]
            );
        }
        await connection.commit();
        res.status(templateId ? 200 : 201).json({ success: true, message: templateId ? 'Template saved.' : 'Template created.', template_id: id });
    } catch (error) {
        await connection.rollback();
        console.error('Error saving template:', error);
        res.status(500).json({ success: false, message: 'Failed to save the template' });
    } finally {
        connection.release();
    }
};

app.post('/api/doctor/:doctorId/templates', (req, res) => saveTemplate(req, res, null));
app.put('/api/doctor-templates/:templateId', (req, res) => saveTemplate(req, res, req.params.templateId));

app.post('/api/doctor-templates/:templateId/duplicate', async (req, res) => {
    try {
        const [[src]] = await pool.query(`SELECT * FROM doctor_assessment_templates WHERE template_id = ? AND doctor_id = ?`, [req.params.templateId, req.body.doctor_id]);
        if (!src) return res.status(404).json({ success: false, message: 'Template not found.' });
        let name = `${src.template_name} (copy)`.slice(0, 120);
        for (let n = 2; ; n++) {
            const [[dupe]] = await pool.query(`SELECT 1 AS x FROM doctor_assessment_templates WHERE doctor_id = ? AND template_name = ?`, [src.doctor_id, name]);
            if (!dupe) break;
            name = `${src.template_name} (copy ${n})`.slice(0, 120);
        }
        const id = `TPL-${uuidv4().substring(0, 8)}`;
        await pool.query(
            `INSERT INTO doctor_assessment_templates (template_id, doctor_id, template_name, visit_type, description, fields, is_default) VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [id, src.doctor_id, name, src.visit_type, src.description, typeof src.fields === 'string' ? src.fields : JSON.stringify(src.fields)]
        );
        res.status(201).json({ success: true, message: 'Template duplicated.', template_id: id });
    } catch (error) {
        console.error('Error duplicating template:', error);
        res.status(500).json({ success: false, message: 'Failed to duplicate the template' });
    }
});

app.delete('/api/doctor-templates/:templateId', async (req, res) => {
    try {
        // saved assessments keep their own copy of the answers, so a template can be removed safely
        const [result] = await pool.query(`DELETE FROM doctor_assessment_templates WHERE template_id = ? AND doctor_id = ?`, [req.params.templateId, req.query.doctor_id || '']);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Template not found.' });
        res.json({ success: true, message: 'Template deleted.' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ success: false, message: 'Failed to delete the template' });
    }
});


// Incident Reports API

// Helper function to generate daily resetting incremental IDs (e.g., INC-100226001)
const generateDailyId = async (prefix, tableName, idColumn) => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const dateStr = `${mm}${dd}${yy}`;

    const searchPattern = `${prefix}-${dateStr}%`;
    const [rows] = await pool.query(
        `SELECT ${idColumn} FROM ${tableName} WHERE ${idColumn} LIKE ? ORDER BY ${idColumn} DESC LIMIT 1`,
        [searchPattern]
    );

    let sequence = 1;
    if (rows.length > 0) {
        const lastId = rows[0][idColumn];
        const lastSeq = parseInt(lastId.slice(-3), 10);
        if (!isNaN(lastSeq)) {
            sequence = lastSeq + 1;
        }
    }

    const seqStr = String(sequence).padStart(3, '0');
    return `${prefix}-${dateStr}${seqStr}`;
};

// Standard fallback helper for non-daily unique IDs
const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// ----------------================================================--
// 1. INCIDENT REPORTS API
// ----------------================================================--

// GET: Fetch Incident Reports with student, program, and nurse details
app.get('/api/incident-reports', async (req, res) => {
    try {
        const { search, date } = req.query;
        
        let query = `
            SELECT 
                ir.*,
                s.first_name AS student_first_name,
                s.last_name AS student_last_name,
                s.year_level,
                s.section,
                ap.program_name,
                n.first_name AS nurse_first_name,
                n.last_name AS nurse_last_name
            FROM incident_reports ir
            LEFT JOIN students s ON ir.student_id = s.student_id
            LEFT JOIN academic_programs ap ON s.program_id = ap.program_id
            LEFT JOIN nurses n ON ir.nurse_id = n.nurse_id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (
                s.first_name LIKE ? OR
                s.last_name LIKE ? OR
                CONCAT_WS(' ', s.first_name, s.last_name) LIKE ? OR
                s.student_id LIKE ? OR
                ap.program_name LIKE ? OR
                CAST(s.year_level AS CHAR) LIKE ? OR
                s.section LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (date) {
            query += ` AND DATE(ir.incident_datetime) = ?`;
            params.push(date);
        }

        query += ` ORDER BY ir.incident_datetime DESC`;

        const [rows] = await pool.query(query, params);
        res.json({ success: true, reports: rows });
    } catch (error) {
        console.error('Error fetching incident reports:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// POST: Document Incident Report & Dispatch Identical Web Push + SMS Notifications[cite: 2, 3, 4]
app.post('/api/incident-reports', async (req, res) => {
    try {
        const {
            student_id,
            nurse_id,
            incident_datetime,
            incident_location,
            incident_description,
            first_aid_administered,
            current_physical_situation
        } = req.body;

        if (!student_id || !nurse_id || !incident_datetime || !incident_location) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const incident_id = await generateDailyId('INC', 'incident_reports', 'incident_id');

        const insertQuery = `
            INSERT INTO incident_reports 
            (incident_id, student_id, nurse_id, incident_datetime, incident_location, incident_description, first_aid_administered, current_physical_situation, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        await pool.query(insertQuery, [
            incident_id,
            student_id,
            nurse_id,
            incident_datetime,
            incident_location,
            incident_description,
            first_aid_administered,
            current_physical_situation
        ]);

        // Query student details and nurse sender ID[cite: 4]
        const [studentData] = await pool.query(
            `SELECT s.user_id AS student_user_id, s.first_name, s.last_name, n.user_id AS nurse_user_id
             FROM students s
             LEFT JOIN nurses n ON n.nurse_id = ?
             WHERE s.student_id = ?`,
            [nurse_id, student_id]
        );

        // Query mapped parents' user IDs and primary phone numbers[cite: 4]
        const [parentData] = await pool.query(
            `SELECT p.user_id, p.primary_phone 
             FROM parents p
             INNER JOIN parent_student_mapping psm ON p.parent_id = psm.parent_id
             WHERE psm.student_id = ?`,
            [student_id]
        );

        const student_user_id = studentData[0]?.student_user_id;
        const studentName = studentData[0] ? `${studentData[0].first_name} ${studentData[0].last_name}` : 'Your child';
        const sender_id = studentData[0]?.nurse_user_id || null;
        const parentUserIds = parentData.map(p => p.user_id).filter(Boolean);

        const formattedDate = formatDateTimeManila(incident_datetime);

        // -------------------------------------------------------------
        // UNIFIED PARENT MESSAGE (Used identically in Web Push and SMS)
        // -------------------------------------------------------------
        const parentTitle = `Campus Incident Advisory: ${studentName}`;
        const parentMessage = `STI Clinic Alert: An incident involving ${studentName} was documented at ${incident_location} on ${formattedDate}. Initial Care: ${first_aid_administered || 'N/A'}. Status: ${current_physical_situation || 'Under observation'}. Please check your Parent Portal for complete details.`;

        const studentTitle = `Incident Report Documented`;
        const studentMessage = `An incident report was recorded at ${incident_location} on ${formattedDate}. Care provided: ${first_aid_administered || 'N/A'}.`;

        // 1. Send Web Push to Student[cite: 2, 4]
        if (student_user_id) {
            await notifyUsers({
                sender_id,
                recipient_ids: [student_user_id],
                title: studentTitle,
                message: studentMessage,
                type: 'INCIDENT_REPORT',
                payloadData: { incident_id }
            });
        }

        // 2. Send Web Push to Parents (using parentMessage)[cite: 2, 4]
        if (parentUserIds.length > 0) {
            await notifyUsers({
                sender_id,
                recipient_ids: parentUserIds,
                title: parentTitle,
                message: parentMessage,
                type: 'INCIDENT_REPORT_PARENT',
                payloadData: { incident_id, student_id }
            });
        }

        // 3. Send SMS to Parents via PhilSMS (using EXACT SAME parentMessage)[cite: 3]
        let parentSmsResults = [];
        for (const parent of parentData) {
            if (parent.primary_phone) {
                const formattedPhone = formatPhoneNumber(parent.primary_phone);
                if (formattedPhone) {
                    const smsResult = await sendPhilSms(formattedPhone, parentMessage);
                    parentSmsResults.push({
                        phone: formattedPhone,
                        sent: smsResult.success
                    });
                }
            }
        }

        res.json({ 
            success: true, 
            message: 'Incident report created and notifications sent successfully', 
            incident_id,
            smsNotifications: parentSmsResults
        });
    } catch (error) {
        console.error('Error creating incident report:', error);
        res.status(500).json({ success: false, message: 'Failed to create report' });
    }
});

// ----------------================================================--
// 2. EMERGENCY HOTLINE DIRECTORY API
// ----------------================================================--

// GET: All Hotlines
app.get('/api/emergency-hotlines', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM emergency_hotline_directory ORDER BY facility_name ASC`);
        res.json({ success: true, hotlines: rows });
    } catch (error) {
        console.error('Error fetching hotlines:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// POST: Add Emergency Hotline
app.post('/api/emergency-hotlines', async (req, res) => {
    try {
        const { facility_name, contact_number, description_notes } = req.body;
        const hotline_id = generateId('HOT');

        await pool.query(
            `INSERT INTO emergency_hotline_directory (hotline_id, facility_name, contact_number, description_notes) VALUES (?, ?, ?, ?)`,
            [hotline_id, facility_name, contact_number, description_notes]
        );

        res.json({ success: true, message: 'Hotline added successfully' });
    } catch (error) {
        console.error('Error adding hotline:', error);
        res.status(500).json({ success: false, message: 'Failed to add hotline' });
    }
});

// PUT: Update Emergency Hotline
app.put('/api/emergency-hotlines/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { facility_name, contact_number, description_notes } = req.body;

        await pool.query(
            `UPDATE emergency_hotline_directory SET facility_name = ?, contact_number = ?, description_notes = ? WHERE hotline_id = ?`,
            [facility_name, contact_number, description_notes, id]
        );

        res.json({ success: true, message: 'Hotline updated successfully' });
    } catch (error) {
        console.error('Error updating hotline:', error);
        res.status(500).json({ success: false, message: 'Failed to update hotline' });
    }
});

// DELETE: Delete Emergency Hotline
app.delete('/api/emergency-hotlines/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`DELETE FROM emergency_hotline_directory WHERE hotline_id = ?`, [id]);
        res.json({ success: true, message: 'Hotline deleted successfully' });
    } catch (error) {
        console.error('Error deleting hotline:', error);
        res.status(500).json({ success: false, message: 'Failed to delete hotline' });
    }
});

// SEARCH STUDENTS ROUTE
app.get('/api/incident-reports/students', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length === 0) {
            return res.json({ success: true, students: [] });
        }

        const searchTerm = `%${q.trim()}%`;

        const query = `
            SELECT 
                s.*,
                ap.program_name
            FROM students s
            LEFT JOIN academic_programs ap ON s.program_id = ap.program_id
            WHERE 
                s.first_name LIKE ? OR 
                s.last_name LIKE ? OR 
                CAST(s.student_id AS CHAR) LIKE ? OR 
                CONCAT_WS(' ', s.first_name, s.last_name) LIKE ?
            LIMIT 10
        `;

        const [rows] = await pool.query(query, [searchTerm, searchTerm, searchTerm, searchTerm]);
        
        return res.json({ success: true, students: rows });
    } catch (error) {
        console.error('Error executing student search:', error);

        try {
            const searchTerm = `%${req.query.q.trim()}%`;
            const [rows] = await pool.query(
                `SELECT * FROM students WHERE first_name LIKE ? OR last_name LIKE ? OR student_id LIKE ? LIMIT 10`,
                [searchTerm, searchTerm, searchTerm]
            );
            return res.json({ success: true, students: rows });
        } catch (fallbackError) {
            console.error('Fallback query error:', fallbackError);
            return res.status(500).json({ success: false, message: 'Database query failed' });
        }
    }
});


//Insurance Vault API
// 1. Search Students (FIXED: CONCAT_WS + Collation safety)
// 1. Search Students (Collation-safe + NULL handling)
app.get('/api/insurance-vault/search', async (req, res) => {
    const { query } = req.query;
    if (!query || !query.trim()) return res.json([]);

    try {
        const searchTerm = `%${query.trim()}%`;
        const sql = `
            SELECT 
                s.student_id, 
                s.first_name, 
                s.last_name, 
                s.year_level, 
                s.section, 
                COALESCE(ap.program_name, CAST(s.program_id AS CHAR), 'N/A') AS program_name
            FROM students s
            LEFT JOIN academic_programs ap ON s.program_id = ap.program_id
            WHERE CAST(s.student_id AS CHAR) LIKE ? 
               OR s.first_name LIKE ? 
               OR s.last_name LIKE ? 
               OR CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, '')) LIKE ?
            LIMIT 10
        `;
        const [rows] = await pool.query(sql, [searchTerm, searchTerm, searchTerm, searchTerm]);
        res.json(rows);
    } catch (err) {
        console.error("Error searching students:", err);
        res.status(500).json({ error: "Failed to search students" });
    }
});

// 2. Fetch Grouped Vault Folders (FIXED: Group By syntax for MySQL 8.0)
app.get('/api/insurance-vault', async (req, res) => {
    try {
        const sql = `
            SELECT 
                s.student_id,
                s.first_name AS student_first_name,
                s.last_name AS student_last_name,
                s.year_level,
                s.section,
                COALESCE(ap.program_name, s.program_id, 'N/A') AS program_name,
                COUNT(CASE WHEN iv.file_url IS NOT NULL AND iv.file_url != '' THEN 1 END) AS total_files,
                MAX(iv.uploaded_at) AS last_updated,
                MAX(iv.managed_by_nurse_id) AS managed_by_nurse_id,
                COALESCE(
                    MAX(CONCAT(n.first_name, ' ', n.last_name)), 
                    MAX(iv.managed_by_nurse_id), 
                    'N/A'
                ) AS nurse_name
            FROM insurance_vault_files iv
            JOIN students s ON iv.student_id = s.student_id
            LEFT JOIN academic_programs ap ON s.program_id = ap.program_id
            LEFT JOIN nurses n ON iv.managed_by_nurse_id = n.nurse_id
            GROUP BY s.student_id, s.first_name, s.last_name, s.year_level, s.section, ap.program_name
            ORDER BY last_updated DESC
        `;
        const [rows] = await pool.query(sql);
        res.json(rows);
    } catch (err) {
        console.error("Error fetching vaults:", err);
        res.status(500).json({ error: "Failed to fetch insurance vaults" });
    }
});

// 3. Fetch All Files Inside a Specific Student's Vault
app.get('/api/insurance-vault/student/:student_id/files', async (req, res) => {
    const { student_id } = req.params;
    try {
        const sql = `
            SELECT 
                iv.vault_file_id,
                iv.student_id,
                iv.document_name,
                iv.file_url,
                iv.description_notes,
                iv.uploaded_at,
                iv.managed_by_nurse_id,
                CONCAT_WS(' ', n.first_name, n.last_name) AS nurse_name
            FROM insurance_vault_files iv
            LEFT JOIN nurses n ON iv.managed_by_nurse_id = n.nurse_id
            WHERE iv.student_id = ? AND iv.file_url IS NOT NULL AND iv.file_url != ''
            ORDER BY iv.uploaded_at DESC
        `;
        const [rows] = await pool.query(sql, [student_id]);
        res.json(rows);
    } catch (err) {
        console.error("Error fetching student files:", err);
        res.status(500).json({ error: "Failed to fetch student vault files" });
    }
});

// 4. Initialize Vault Folder for Student
app.post('/api/insurance-vault/create-vault', async (req, res) => {
    const { student_id, managed_by_nurse_id } = req.body;
    const vault_file_id = 'VF-' + Date.now();

    if (!student_id || !managed_by_nurse_id) {
        return res.status(400).json({ error: "Student ID and Nurse ID are required" });
    }

    try {
        const [existing] = await pool.query(`SELECT vault_file_id FROM insurance_vault_files WHERE student_id = ? LIMIT 1`, [student_id]);
        if (existing.length > 0) {
            return res.status(400).json({ error: "Vault folder already exists for this student." });
        }

        const sql = `
            INSERT INTO insurance_vault_files 
            (vault_file_id, student_id, document_name, file_url, description_notes, uploaded_at, managed_by_nurse_id) 
            VALUES (?, ?, 'Insurance Vault Created', '', 'Vault folder initialized.', NOW(), ?)
        `;
        await pool.query(sql, [vault_file_id, student_id, managed_by_nurse_id]);
        res.status(201).json({ success: true, message: "Insurance Vault folder created successfully!" });
    } catch (err) {
        console.error("Error creating vault:", err);
        res.status(500).json({ error: "Database error while creating vault" });
    }
});

// 5. Add File Inside Vault Folder
app.post('/api/insurance-vault/add-file', upload.single('file'), async (req, res) => {
    const { student_id, document_name, description_notes, managed_by_nurse_id } = req.body;
    const file_url = req.file ? `/uploads/${req.file.filename}` : '';
    const vault_file_id = 'VF-' + Date.now();

    if (!student_id || !document_name || !managed_by_nurse_id) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const sql = `
            INSERT INTO insurance_vault_files 
            (vault_file_id, student_id, document_name, file_url, description_notes, uploaded_at, managed_by_nurse_id) 
            VALUES (?, ?, ?, ?, ?, NOW(), ?)
        `;
        await pool.query(sql, [vault_file_id, student_id, document_name, file_url, description_notes || '', managed_by_nurse_id]);
        res.status(201).json({ success: true, message: "File added to vault folder successfully!" });
    } catch (err) {
        console.error("Error adding file to vault:", err);
        res.status(500).json({ error: "Database error while uploading file" });
    }
});

// 6. Delete Individual File from Vault
app.delete('/api/insurance-vault/file/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`DELETE FROM insurance_vault_files WHERE vault_file_id = ?`, [id]);
        res.json({ success: true, message: "File deleted successfully" });
    } catch (err) {
        console.error("Error deleting file:", err);
        res.status(500).json({ error: "Failed to delete file" });
    }
});

// 7. Delete Entire Vault Folder
app.delete('/api/insurance-vault/student/:student_id', async (req, res) => {
    const { student_id } = req.params;
    try {
        await pool.query(`DELETE FROM insurance_vault_files WHERE student_id = ?`, [student_id]);
        res.json({ success: true, message: "Vault folder deleted successfully" });
    } catch (err) {
        console.error("Error deleting vault folder:", err);
        res.status(500).json({ error: "Failed to delete vault folder" });
    }
});

//Health Tips API
app.get('/api/top-complaint-last-week', async (req, res) => {
  const query = `
    SELECT 
      c.complaint_id, 
      c.complaint_name, 
      COUNT(v.visit_id) AS total_cases,
      DATE_FORMAT(DATE_SUB(CURRENT_DATE(), INTERVAL (WEEKDAY(CURRENT_DATE()) + 7) DAY), '%b %d, %Y') AS week_start,
      DATE_FORMAT(DATE_SUB(CURRENT_DATE(), INTERVAL (WEEKDAY(CURRENT_DATE()) + 1) DAY), '%b %d, %Y') AS week_end
    FROM clinic_visits v
    JOIN chief_complaints c ON v.complaint_id = c.complaint_id
    WHERE v.visit_date >= DATE_SUB(CURRENT_DATE(), INTERVAL (WEEKDAY(CURRENT_DATE()) + 7) DAY)
      AND v.visit_date <= DATE_SUB(CURRENT_DATE(), INTERVAL (WEEKDAY(CURRENT_DATE()) + 1) DAY)
    GROUP BY c.complaint_id, c.complaint_name
    ORDER BY total_cases DESC
    LIMIT 1;
  `;

  try {
    // Destructure the first element because mysql2 promises return [rows, fields]
    const [results] = await pool.query(query);

    if (results.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: "No clinic visits recorded for last week."
      });
    }

    res.json({
      success: true,
      data: results[0]
    });
  } catch (error) {
    console.error("Error executing query:", error);
    return res.status(500).json({ success: false, message: "Database query error" });
  }
});

//Health Tips Module API
app.get('/api/all-chief-complaints', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT complaint_id, complaint_name FROM chief_complaints ORDER BY complaint_name ASC'
    );
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).json({ success: false, message: "Database query error" });
  }
});

//Clinic Logs & Records API 
// 1. Clinic Visit Logs -> GET /clinic-visits/clinicLogs&Records
// 1. Clinic Visit Logs
// ==========================================
// Clinic Logs & Records API 
// ==========================================

// 1. Clinic Visit Logs
app.get('/clinic-visits/clinicLogs&Records', async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    let query = `
      SELECT 
        cv.*,
        s.first_name AS student_first_name,
        s.last_name AS student_last_name,
        n.first_name AS nurse_first_name,
        n.last_name AS nurse_last_name
      FROM clinic_visits cv
      LEFT JOIN students s ON cv.student_id = s.student_id
      LEFT JOIN nurses n ON cv.nurse_id = n.nurse_id
      WHERE cv.student_id = ?
    `;
    const params = [studentId];

    if (startDate && endDate) {
      query += ` AND cv.visit_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    query += ` ORDER BY cv.visit_date DESC, cv.time_in DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Medicine Dispensed (Updated: Replaced batch_id with brand_name & generic_name, joined students)
app.get('/medicine-dispensed/clinicLogs&Records', async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const params = [];

    let directWhere = ` WHERE d.student_id = ?`;
    params.push(studentId);
    if (startDate && endDate) {
      directWhere += ` AND DATE(d.dispensed_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    let consultWhere = ` WHERE cv.student_id = ?`;
    params.push(studentId);
    if (startDate && endDate) {
      consultWhere += ` AND DATE(c.dispensed_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    const query = `
      SELECT 
        d.direct_dispense_id AS id,
        'Direct Dispensation' AS dispensation_type,
        d.student_id,
        s.first_name,
        s.last_name,
        d.nurse_id,
        NULL AS visit_id,
        m.brand_name,
        m.generic_name,
        d.dosage_consumption_unit_value,
        d.dosage_consumption_unit_of_measure,
        CONCAT(d.dosage_consumption_unit_value, ' ', d.dosage_consumption_unit_of_measure) AS quantity_dispensed,
        d.dispensed_at
      FROM direct_dispensation d
      LEFT JOIN students s ON d.student_id = s.student_id
      LEFT JOIN medicine_inventory_batches b ON d.batch_id = b.batch_id
      LEFT JOIN medicines m ON b.medicine_id = m.medicine_id
      ${directWhere}

      UNION ALL

      SELECT 
        c.consultation_dispense_id AS id,
        'Consultation Dispensation' AS dispensation_type,
        cv.student_id,
        s.first_name,
        s.last_name,
        cv.nurse_id,
        c.visit_id,
        m.brand_name,
        m.generic_name,
        c.dosage_consumption_unit_value,
        c.dosage_consumption_unit_of_measure,
        CONCAT(c.dosage_consumption_unit_value, ' ', c.dosage_consumption_unit_of_measure) AS quantity_dispensed,
        c.dispensed_at
      FROM consultation_dispensation c
      LEFT JOIN clinic_visits cv ON c.visit_id = cv.visit_id
      LEFT JOIN students s ON cv.student_id = s.student_id
      LEFT JOIN medicine_inventory_batches b ON c.batch_id = b.batch_id
      LEFT JOIN medicines m ON b.medicine_id = m.medicine_id
      ${consultWhere}

      ORDER BY dispensed_at DESC
    `;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Incident Reports
app.get('/incident-reports/clinicLogs&Records', async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    let query = `
      SELECT 
        ir.*,
        s.first_name AS student_first_name,
        s.last_name AS student_last_name,
        n.first_name AS nurse_first_name,
        n.last_name AS nurse_last_name
      FROM incident_reports ir
      LEFT JOIN students s ON ir.student_id = s.student_id
      LEFT JOIN nurses n ON ir.nurse_id = n.nurse_id
      WHERE ir.student_id = ?
    `;
    const params = [studentId];

    if (startDate && endDate) {
      query += ` AND DATE(ir.incident_datetime) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    query += ` ORDER BY ir.incident_datetime DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Health Screenings
app.get('/health-screenings/clinicLogs&Records', async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const params = [];

    // 1. Assigned Scheduled Screenings Filter
    let where1 = `WHERE p.student_id = ?`;
    params.push(studentId);
    if (startDate && endDate) {
      where1 += ` AND s.scheduled_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    // 2. Standalone BMI Logs Filter
    let where2 = `WHERE b.student_id = ? AND (b.screening_schedule_id IS NULL OR b.screening_schedule_id = '')`;
    params.push(studentId);
    if (startDate && endDate) {
      where2 += ` AND DATE(b.logged_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    // 3. Standalone Dental Logs Filter
    let where3 = `WHERE d.student_id = ? AND d.appointment_id IS NULL AND (d.screening_schedule_id IS NULL OR d.screening_schedule_id = '')`;
    params.push(studentId);
    if (startDate && endDate) {
      where3 += ` AND DATE(d.recorded_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    // 4. Standalone Vision Logs Filter
    let where4 = `WHERE v.student_id = ? AND v.appointment_id IS NULL AND (v.screening_schedule_id IS NULL OR v.screening_schedule_id = '')`;
    params.push(studentId);
    if (startDate && endDate) {
      where4 += ` AND DATE(v.recorded_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    const query = `
      SELECT 
        s.screening_schedule_id AS record_id,
        CASE s.screening_type WHEN 'Dental' THEN 'Dental (legacy)' WHEN 'Vision' THEN 'Vision (legacy)' ELSE COALESCE(s.screening_type, 'Health Screening') END AS screening_type,
        p.student_id,
        st.first_name,
        st.last_name,
        s.screening_schedule_id,
        s.scheduled_date AS record_date,
        s.title,
        s.start_time,
        s.end_time,
        s.announcement,
        CASE 
          WHEN b.bmi_log_id IS NOT NULL THEN CONCAT('BMI: ', b.bmi_value, ' (', b.bmi_category, ') | Height: ', b.height_cm, 'cm | Weight: ', b.weight_kg, 'kg')
          WHEN vs.vital_record_id IS NOT NULL THEN CONCAT('BP: ', COALESCE(CONCAT(vs.bp_systolic, '/', vs.bp_diastolic), '-'), ' (', COALESCE(vs.bp_flag, '-'), ') | Pulse: ', COALESCE(vs.pulse_rate, '-'), ' bpm | Temp: ', COALESCE(vs.temperature_c, '-'), ' C | Resp: ', COALESCE(vs.respiratory_rate, '-'), '/min')
          WHEN h.hearing_record_id IS NOT NULL THEN CONCAT('Left ear: ', h.left_ear_result, ' | Right ear: ', h.right_ear_result, ' | Remarks: ', COALESCE(h.remarks, 'None'))
          WHEN d.dental_record_id IS NOT NULL THEN CONCAT('Findings: ', d.dental_findings, ' | Remarks: ', COALESCE(d.remarks, 'None'))
          WHEN v.vision_record_id IS NOT NULL THEN CONCAT('VA Left: ', v.visual_acuity_left, ' | VA Right: ', v.visual_acuity_right, ' | Remarks: ', COALESCE(v.remarks, 'None'))
          ELSE COALESCE(s.announcement, 'No examination details recorded yet.')
        END AS details,
        CASE 
          WHEN b.bmi_log_id IS NOT NULL OR vs.vital_record_id IS NOT NULL OR h.hearing_record_id IS NOT NULL OR d.dental_record_id IS NOT NULL OR v.vision_record_id IS NOT NULL THEN 'Completed'
          WHEN s.scheduled_date > CURRENT_DATE() THEN 'Upcoming'
          WHEN s.scheduled_date = CURRENT_DATE() THEN 'Ongoing'
          ELSE 'Missed'
        END AS status
      FROM screening_schedule_participants p
      JOIN screening_schedules s ON p.screening_schedule_id = s.screening_schedule_id
      LEFT JOIN students st ON p.student_id = st.student_id
      LEFT JOIN bmi_monitoring_logs b ON b.screening_schedule_id = s.screening_schedule_id AND b.student_id = p.student_id
      LEFT JOIN dental_assessment_records d ON d.screening_schedule_id = s.screening_schedule_id AND d.student_id = p.student_id
      LEFT JOIN vision_screening_records v ON v.screening_schedule_id = s.screening_schedule_id AND v.student_id = p.student_id
      LEFT JOIN vital_signs_records vs ON vs.screening_schedule_id = s.screening_schedule_id AND vs.student_id = p.student_id
      LEFT JOIN hearing_screening_records h ON h.screening_schedule_id = s.screening_schedule_id AND h.student_id = p.student_id
      ${where1}

      UNION ALL

      SELECT 
        b.bmi_log_id AS record_id,
        'BMI Monitoring' AS screening_type,
        b.student_id,
        st.first_name,
        st.last_name,
        b.screening_schedule_id,
        DATE(b.logged_at) AS record_date,
        'BMI Monitoring' AS title,
        NULL AS start_time,
        NULL AS end_time,
        NULL AS announcement,
        CONCAT('BMI: ', b.bmi_value, ' (', b.bmi_category, ') | Height: ', b.height_cm, 'cm | Weight: ', b.weight_kg, 'kg') AS details,
        'Completed' AS status
      FROM bmi_monitoring_logs b
      LEFT JOIN students st ON b.student_id = st.student_id
      ${where2}

      UNION ALL

      SELECT 
        d.dental_record_id AS record_id,
        'Dental (legacy)' AS screening_type,
        d.student_id,
        st.first_name,
        st.last_name,
        d.screening_schedule_id,
        DATE(d.recorded_at) AS record_date,
        'Dental Assessment' AS title,
        NULL AS start_time,
        NULL AS end_time,
        NULL AS announcement,
        CONCAT('Findings: ', d.dental_findings, ' | Remarks: ', COALESCE(d.remarks, 'None')) AS details,
        'Completed' AS status
      FROM dental_assessment_records d
      LEFT JOIN students st ON d.student_id = st.student_id
      ${where3}

      UNION ALL

      SELECT 
        v.vision_record_id AS record_id,
        'Vision (legacy)' AS screening_type,
        v.student_id,
        st.first_name,
        st.last_name,
        v.screening_schedule_id,
        DATE(v.recorded_at) AS record_date,
        'Vision Screening' AS title,
        NULL AS start_time,
        NULL AS end_time,
        NULL AS announcement,
        CONCAT('VA Left: ', v.visual_acuity_left, ' | VA Right: ', v.visual_acuity_right, ' | Remarks: ', COALESCE(v.remarks, 'None')) AS details,
        'Completed' AS status
      FROM vision_screening_records v
      LEFT JOIN students st ON v.student_id = st.student_id
      ${where4}

      ORDER BY record_date DESC
    `;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Doctor Visit Records
app.get('/doctor-visits/clinicLogs&Records', async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    let query = `
      SELECT 
        da.appointment_id,
        das.student_id,
        st.first_name AS student_first_name,
        st.last_name AS student_last_name,
        da.doctor_id,
        doc.first_name AS doctor_first_name,
        doc.last_name AS doctor_last_name,
        da.batch_id,
        da.title,
        da.announcement,
        da.start_time,
        da.end_time,
        da.assigned_by_nurse_id,
        da.status,
        CASE WHEN da.visit_type = 'Other' AND da.purpose_other IS NOT NULL THEN CONCAT('Other: ', da.purpose_other) ELSE da.visit_type END AS visit_type,
        da.booking_source,
        da.booking_reason,
        da.decline_reason,
        das.attendance_status,
        das.check_in_time,
        das.notes AS student_notes,
        doc_ast.assessment_id,
        doc_ast.clinical_findings,
        doc_ast.diagnosis,
        doc_ast.treatment_recommendations,
        doc_ast.assessment_date,
        doc_ast.is_abnormal,
        doc_ast.follow_up_needed,
        dr.oral_hygiene, dr.caries_count, dr.missing_count, dr.filled_count, dr.gum_condition,
        dr.malocclusion, dr.tooth_notes, dr.treatment_done, dr.treatment_needed,
        dr.referral_needed, dr.referral_to, dr.next_visit_recommendation, dr.remarks AS dental_remarks,
        vr.visual_acuity_left, vr.visual_acuity_right, vr.va_left_corrected, vr.va_right_corrected,
        vr.wears_eyeglasses, vr.wears_contacts, vr.color_vision, vr.eye_findings,
        vr.recommended_action, vr.remarks AS vision_remarks
      FROM doctor_appointments da
      JOIN doctor_appointment_students das ON da.appointment_id = das.appointment_id
      LEFT JOIN students st ON das.student_id = st.student_id
      LEFT JOIN doctors doc ON da.doctor_id = doc.doctor_id
      LEFT JOIN doctor_assessments doc_ast 
        ON da.appointment_id = doc_ast.appointment_id 
        AND das.student_id = doc_ast.student_id
      LEFT JOIN dental_assessment_records dr ON dr.appointment_id = da.appointment_id AND dr.student_id = das.student_id
      LEFT JOIN vision_screening_records vr ON vr.appointment_id = da.appointment_id AND vr.student_id = das.student_id
      WHERE das.student_id = ?
    `;
    const params = [studentId];

    if (startDate && endDate) {
      query += ` AND DATE(da.start_time) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY da.start_time DESC`;

    const [rows] = await pool.query(query, params);

    // The student / parent detail view lists every key, so drop the detail columns that do not apply to the visit type.
    const dentalKeys = ['oral_hygiene', 'caries_count', 'missing_count', 'filled_count', 'gum_condition', 'malocclusion', 'tooth_notes', 'treatment_done', 'treatment_needed', 'referral_needed', 'referral_to', 'next_visit_recommendation', 'dental_remarks'];
    const visionKeys = ['visual_acuity_left', 'visual_acuity_right', 'va_left_corrected', 'va_right_corrected', 'wears_eyeglasses', 'wears_contacts', 'color_vision', 'eye_findings', 'recommended_action', 'vision_remarks'];
    rows.forEach((row) => {
      if (row.visit_type !== 'Dental') dentalKeys.forEach((k) => delete row[k]);
      if (row.visit_type !== 'Vision') visionKeys.forEach((k) => delete row[k]);
    });

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Document Requests (Excuse & Referral Slips)
app.get('/document-requests/childClinicRecords', async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const params = [];

    let excuseWhere = `WHERE e.student_id = ?`;
    params.push(studentId);
    if (startDate && endDate) {
      excuseWhere += ` AND DATE(e.created_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    let referralWhere = `WHERE r.student_id = ?`;
    params.push(studentId);
    if (startDate && endDate) {
      referralWhere += ` AND DATE(r.created_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    const query = `
      SELECT 
        e.request_id,
        'Excuse Slip' AS document_type,
        e.student_id,
        s.first_name,
        s.last_name,
        e.reason_for_excuse AS reason,
        e.status,
        e.issued_by,
        e.issued_at,
        e.issued_slip_url,
        e.created_at
      FROM excuse_slip_requests e
      LEFT JOIN students s ON e.student_id = s.student_id
      ${excuseWhere}

      UNION ALL

      SELECT 
        r.request_id,
        'Referral Slip' AS document_type,
        r.student_id,
        s.first_name,
        s.last_name,
        r.reason_for_referral AS reason,
        r.status,
        r.issued_by,
        r.issued_at,
        r.issued_slip_url,
        r.created_at
      FROM referral_slip_requests r
      LEFT JOIN students s ON r.student_id = s.student_id
      ${referralWhere}

      ORDER BY created_at DESC
    `;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Student Health Requirements
app.get('/student-requirements/childClinicRecords', async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    let query = `
      SELECT 
        sr.submission_id,
        sr.student_id,
        s.first_name,
        s.last_name,
        sr.requirement_name,
        sr.file_url,
        COALESCE(sr.status, 'Not Submitted') AS status,
        sr.is_late,
        sr.nurse_remarks,
        sr.submitted_at,
        sr.reviewed_by
      FROM student_requirement_submissions sr
      LEFT JOIN students s ON sr.student_id = s.student_id
      WHERE sr.student_id = ?
    `;
    const params = [studentId];

    if (startDate && endDate) {
      query += ` AND DATE(sr.submitted_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY sr.submitted_at DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Contact Settings API
// ==========================================

// GET: Fetch current contact number
app.get('/api/parents/:parentId', async (req, res) => {
  const { parentId } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT parent_id, primary_phone, first_name, last_name FROM parents WHERE parent_id = ?',
      [parentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Parent record not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving contact details' });
  }
});

// PUT: Update contact number
app.put('/api/parents/:parentId/contact', async (req, res) => {
  const { parentId } = req.params;
  const { primary_phone } = req.body;

  const phPhoneRegex = /^(09|\+639)\d{9}$/;

  if (!primary_phone || !phPhoneRegex.test(primary_phone)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid phone number format. Please enter a valid Philippine mobile number (e.g., 09171234567 or +639171234567).'
    });
  }

  try {
    const [result] = await pool.query(
      'UPDATE parents SET primary_phone = ? WHERE parent_id = ?',
      [primary_phone, parentId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Parent record not found' });
    }

    res.json({ success: true, message: 'Contact number updated successfully' });
  } catch (error) {
    console.error('Database update error:', error);
    res.status(500).json({ success: false, message: 'Server error updating contact details' });
  }
});

// PUT: Update parent profile details
app.put('/api/parents/:parentId', async (req, res) => {
  const { parentId } = req.params;
  const { first_name, last_name, primary_phone } = req.body;

  if (!first_name?.trim() || !last_name?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'First name and last name are required.'
    });
  }

  const phPhoneRegex = /^(09|\+639)\d{9}$/;

  if (!primary_phone || !phPhoneRegex.test(primary_phone)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid phone number format. Please enter a valid Philippine mobile number (e.g., 09171234567 or +639171234567).'
    });
  }

  try {
    const [result] = await pool.query(
      'UPDATE parents SET first_name = ?, last_name = ?, primary_phone = ? WHERE parent_id = ?',
      [first_name.trim(), last_name.trim(), primary_phone.trim(), parentId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Parent record not found' });
    }

    res.json({ success: true, message: 'Profile details updated successfully' });
  } catch (error) {
    console.error('Database update error:', error);
    res.status(500).json({ success: false, message: 'Server error updating profile details' });
  }
});

// ManageStudentAccounts.jsx API
// ManageStudentAccounts.jsx API
const formatUsername = (username) => {
  if (!username) return '';
  const domain = '@baliuag.sti.edu.ph';
  const clean = username.trim().split('@')[0];
  return `${clean}${domain}`;
};

// 1. GET: Fetch all academic programs for dropdown
app.get('/api/academic-programs/manageStudentAccounts', async (req, res) => {
  try {
    const [programs] = await pool.query('SELECT program_id, program_name, type FROM academic_programs');
    res.json(programs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch academic programs' });
  }
});

// 2. GET: Fetch student accounts with full linked parent details
app.get('/api/students/manageStudentAccounts', async (req, res) => {
  const search = req.query.search || '';
  try {
    const query = `
      SELECT 
        s.student_id,
        s.user_id,
        s.first_name,
        s.last_name,
        s.program_id,
        ap.program_name,
        s.year_level,
        s.section,
        u.username,
        u.is_active,
        psm.parent_id,
        pu.username AS parent_username,
        p.first_name AS parent_first_name,
        p.last_name AS parent_last_name,
        p.primary_phone AS parent_phone,
        pu.is_active AS parent_is_active
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN academic_programs ap ON s.program_id = ap.program_id
      LEFT JOIN parent_student_mapping psm ON s.student_id = psm.student_id
      LEFT JOIN parents p ON psm.parent_id = p.parent_id
      LEFT JOIN users pu ON p.user_id = pu.user_id
      WHERE s.student_id LIKE ? 
         OR s.first_name LIKE ? 
         OR s.last_name LIKE ? 
         OR u.username LIKE ?
      ORDER BY u.created_at DESC
    `;
    const searchTerm = `%${search}%`;
    const [students] = await pool.query(query, [searchTerm, searchTerm, searchTerm, searchTerm]);
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch student accounts' });
  }
});

// 3. GET: Search existing parents by parent_id, username, or full name
app.get('/api/parents/search/manageStudentAccounts', async (req, res) => {
  const query = req.query.q || '';
  try {
    const sql = `
      SELECT 
        p.parent_id, 
        p.first_name, 
        p.last_name, 
        p.primary_phone,
        u.username, 
        u.is_active
      FROM parents p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.parent_id LIKE ? 
         OR u.username LIKE ? 
         OR p.first_name LIKE ? 
         OR p.last_name LIKE ?
      LIMIT 10
    `;
    const searchTerm = `%${query}%`;
    const [parents] = await pool.query(sql, [searchTerm, searchTerm, searchTerm, searchTerm]);
    res.json(parents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search parents' });
  }
});

// 3.5 GET: Fetch next auto-incremented parent_id by student/parent last name
app.get('/api/parents/next-id/manageStudentAccounts', async (req, res) => {
  const lastName = req.query.lastName || '';
  if (!lastName.trim()) {
    return res.json({ nextParentId: '' });
  }

  const cleanLastName = lastName.trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (!cleanLastName) {
    return res.json({ nextParentId: '' });
  }

  const prefix = `PARENT-${cleanLastName}`;

  try {
    const [rows] = await pool.query(
      `SELECT parent_id FROM parents WHERE parent_id LIKE ? ORDER BY parent_id DESC`,
      [`${prefix}%`]
    );

    let maxCount = 0;
    for (const row of rows) {
      const match = row.parent_id.match(new RegExp(`^${prefix}(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxCount) maxCount = num;
      }
    }

    const nextCount = maxCount + 1;
    const paddedIndex = String(nextCount).padStart(3, '0');
    const nextParentId = `${prefix}${paddedIndex}`;

    res.json({ nextParentId, count: nextCount });
  } catch (err) {
    console.error('Error fetching next parent ID:', err);
    res.status(500).json({ error: 'Failed to generate parent ID' });
  }
});

// 4. POST: Create a Single Student Account
app.post('/api/students/manageStudentAccounts', async (req, res) => {
  const {
    student_id,
    first_name,
    last_name,
    username,
    password,
    program_id,
    year_level,
    section,
    is_active,
    parent_option,
    selected_parent_id,
    new_parent
  } = req.body;

  const formattedStudentUsername = formatUsername(username);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const studentUserId = crypto.randomUUID();
    const studentPasswordHash = await hashPassword(password);

    const [studentRoles] = await connection.query("SELECT role_id FROM roles WHERE role_name = 'Student' LIMIT 1");
    const studentRoleId = studentRoles.length > 0 ? studentRoles[0].role_id : 'ROLE_STUDENT';

    await connection.query(
      `INSERT INTO users (user_id, username, password_hash, role_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
      [studentUserId, formattedStudentUsername, studentPasswordHash, studentRoleId, is_active ? 1 : 0]
    );

    await connection.query(
      `INSERT INTO students (student_id, user_id, first_name, last_name, program_id, year_level, section) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [student_id, studentUserId, first_name, last_name, program_id, year_level, section]
    );

    let finalParentId = null;

    if (parent_option === 'existing' && selected_parent_id) {
      finalParentId = selected_parent_id;
    } else if (parent_option === 'new' && new_parent) {
      const parentUserId = crypto.randomUUID();
      const parentPasswordHash = await hashPassword(new_parent.password);
      const formattedParentUsername = formatUsername(new_parent.username);

      const [parentRoles] = await connection.query("SELECT role_id FROM roles WHERE role_name = 'Parent' LIMIT 1");
      const parentRoleId = parentRoles.length > 0 ? parentRoles[0].role_id : 'ROLE_PARENT';

      await connection.query(
        `INSERT INTO users (user_id, username, password_hash, role_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
        [parentUserId, formattedParentUsername, parentPasswordHash, parentRoleId, new_parent.is_active ? 1 : 0]
      );

      await connection.query(
        `INSERT INTO parents (parent_id, user_id, first_name, last_name, primary_phone) VALUES (?, ?, ?, ?, ?)`,
        [new_parent.parent_id, parentUserId, new_parent.first_name || '', new_parent.last_name || '', new_parent.primary_phone || '']
      );

      finalParentId = new_parent.parent_id;
    }

    if (finalParentId) {
      await connection.query(
        `INSERT INTO parent_student_mapping (parent_id, student_id) VALUES (?, ?)`,
        [finalParentId, student_id]
      );
    }

    await connection.commit();
    res.status(201).json({ message: 'Student account created successfully' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create student account' });
  } finally {
    connection.release();
  }
});

// 5. POST: Bulk Import Students via CSV array
app.post('/api/students/import/manageStudentAccounts', async (req, res) => {
  const { students, default_program_id } = req.body;

  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'No student data provided for import.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [studentRoles] = await connection.query("SELECT role_id FROM roles WHERE role_name = 'Student' LIMIT 1");
    const studentRoleId = studentRoles.length > 0 ? studentRoles[0].role_id : 'ROLE_STUDENT';

    let importedCount = 0;

    for (const item of students) {
      if (!item.student_id || !item.first_name || !item.last_name) continue;

      const studentUserId = crypto.randomUUID();
      
      const generatedUsername = formatUsername(item.student_id);
      const defaultPassword = await hashPassword('123456');

      await connection.query(
        `INSERT INTO users (user_id, username, password_hash, role_id, is_active, created_at) VALUES (?, ?, ?, ?, 1, NOW())`,
        [studentUserId, generatedUsername, defaultPassword, studentRoleId]
      );

      await connection.query(
        `INSERT INTO students (student_id, user_id, first_name, last_name, program_id, year_level, section) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.student_id,
          studentUserId,
          item.first_name,
          item.last_name,
          item.program_id || default_program_id || null,
          item.year_level || '1',
          item.section || ''
        ]
      );

      importedCount++;
    }

    await connection.commit();
    res.status(200).json({ message: `Successfully imported ${importedCount} student accounts.` });
  } catch (err) {
    await connection.rollback();
    console.error('Import Error:', err);
    res.status(500).json({ error: err.message || 'Failed to import student CSV data.' });
  } finally {
    connection.release();
  }
});

// 6. PUT: Update Student Details (including Username) and Manage Linked Parent Account
app.put('/api/students/:student_id/manageStudentAccounts', async (req, res) => {
  const { student_id } = req.params;
  const { 
    first_name, 
    last_name, 
    username,
    program_id, 
    year_level, 
    section, 
    is_active,
    reset_password,
    parent_action,
    selected_parent_id,
    new_parent 
  } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT user_id FROM students WHERE student_id = ?', [student_id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Student not found' });
    }
    const userId = rows[0].user_id;

    await connection.query(
      `UPDATE students SET first_name = ?, last_name = ?, program_id = ?, year_level = ?, section = ? WHERE student_id = ?`,
      [first_name, last_name, program_id, year_level, section, student_id]
    );

    const formattedStudentUsername = formatUsername(username);

    if (reset_password) {
      await connection.query(
        `UPDATE users SET username = ?, is_active = ?, password_hash = ? WHERE user_id = ?`,
        [formattedStudentUsername, is_active ? 1 : 0, await hashPassword('123'), userId]
      );
    } else {
      await connection.query(
        `UPDATE users SET username = ?, is_active = ? WHERE user_id = ?`,
        [formattedStudentUsername, is_active ? 1 : 0, userId]
      );
    }

    if (parent_action === 'remove') {
      await connection.query('DELETE FROM parent_student_mapping WHERE student_id = ?', [student_id]);
    } else if (parent_action === 'existing' && selected_parent_id) {
      await connection.query('DELETE FROM parent_student_mapping WHERE student_id = ?', [student_id]);
      await connection.query(
        'INSERT INTO parent_student_mapping (parent_id, student_id) VALUES (?, ?)',
        [selected_parent_id, student_id]
      );
    } else if (parent_action === 'new' && new_parent) {
      const parentUserId = crypto.randomUUID();
      const parentPasswordHash = await hashPassword(new_parent.password);
      const formattedParentUsername = formatUsername(new_parent.username);

      const [parentRoles] = await connection.query("SELECT role_id FROM roles WHERE role_name = 'Parent' LIMIT 1");
      const parentRoleId = parentRoles.length > 0 ? parentRoles[0].role_id : 'ROLE_PARENT';

      await connection.query(
        `INSERT INTO users (user_id, username, password_hash, role_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
        [parentUserId, formattedParentUsername, parentPasswordHash, parentRoleId, new_parent.is_active ? 1 : 0]
      );

      await connection.query(
        `INSERT INTO parents (parent_id, user_id, first_name, last_name, primary_phone) VALUES (?, ?, ?, ?, ?)`,
        [new_parent.parent_id, parentUserId, new_parent.first_name || '', new_parent.last_name || '', new_parent.primary_phone || '']
      );

      await connection.query('DELETE FROM parent_student_mapping WHERE student_id = ?', [student_id]);
      await connection.query(
        'INSERT INTO parent_student_mapping (parent_id, student_id) VALUES (?, ?)',
        [new_parent.parent_id, student_id]
      );
    }

    await connection.commit();
    res.json({ message: 'Student account updated successfully' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to update student account' });
  } finally {
    connection.release();
  }
});

// ManageParentAccounts.jsx API  
app.get('/manageParentAccount', async (req, res) => {
  const search = req.query.search || '';
  try {
    const parentQuery = `
      SELECT 
        p.parent_id,
        p.user_id,
        p.first_name,
        p.last_name,
        p.primary_phone,
        p.is_sms_verified,
        u.username,
        u.is_active,
        u.created_at
      FROM parents p
      INNER JOIN users u ON p.user_id = u.user_id
      WHERE p.parent_id LIKE ? 
         OR p.first_name LIKE ? 
         OR p.last_name LIKE ? 
         OR u.username LIKE ?
      ORDER BY u.created_at DESC
    `;
    const searchPattern = `%${search}%`;
    const [parents] = await pool.query(parentQuery, [searchPattern, searchPattern, searchPattern, searchPattern]);

    for (let parent of parents) {
      const studentQuery = `
        SELECT 
          s.student_id,
          s.first_name,
          s.last_name,
          s.year_level,
          s.section,
          ap.program_name,
          ap.type AS program_type
        FROM parent_student_mapping psm
        INNER JOIN students s ON psm.student_id = s.student_id
        LEFT JOIN academic_programs ap ON s.program_id = ap.program_id
        WHERE psm.parent_id = ?
      `;
      const [students] = await pool.query(studentQuery, [parent.parent_id]);
      parent.linked_students = students;
    }

    res.json({ success: true, data: parents });
  } catch (error) {
    console.error('Error fetching parents:', error);
    res.status(500).json({ success: false, message: 'Database error', error: error.message });
  }
});

app.get('/manageParentAccount/students', async (req, res) => {
  const search = req.query.search || '';
  try {
    const studentQuery = `
      SELECT 
        s.student_id,
        s.first_name,
        s.last_name,
        s.year_level,
        s.section,
        ap.program_name
      FROM students s
      LEFT JOIN academic_programs ap ON s.program_id = ap.program_id
      WHERE s.student_id LIKE ? 
         OR s.first_name LIKE ? 
         OR s.last_name LIKE ?
      LIMIT 10
    `;
    const searchPattern = `%${search}%`;
    const [students] = await pool.query(studentQuery, [searchPattern, searchPattern, searchPattern]);
    res.json({ success: true, data: students });
  } catch (error) {
    console.error('Error searching students:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.put('/manageParentAccount', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      original_parent_id,
      parent_id,
      user_id,
      first_name,
      last_name,
      username,
      password,
      resetToDefault,
      is_active,
      linked_student_ids
    } = req.body;

    await connection.query(
      `UPDATE users SET username = ?, is_active = ? WHERE user_id = ?`,
      [username, is_active ? 1 : 0, user_id]
    );

    let targetPassword = resetToDefault ? '123' : password;
    if (targetPassword) {
      const hashedPassword = await hashPassword(targetPassword);
      await connection.query(
        `UPDATE users SET password_hash = ? WHERE user_id = ?`,
        [hashedPassword, user_id]
      );
    }

    await connection.query(
      `UPDATE parents SET parent_id = ?, first_name = ?, last_name = ? WHERE parent_id = ?`,
      [parent_id, first_name, last_name, original_parent_id]
    );

    await connection.query(
      `DELETE FROM parent_student_mapping WHERE parent_id = ? OR parent_id = ?`,
      [original_parent_id, parent_id]
    );

    if (linked_student_ids && linked_student_ids.length > 0) {
      await connection.query(
        `DELETE FROM parent_student_mapping WHERE student_id IN (?)`,
        [linked_student_ids]
      );

      const mappingValues = linked_student_ids.map((sId) => [parent_id, sId]);
      await connection.query(
        `INSERT INTO parent_student_mapping (parent_id, student_id) VALUES ?`,
        [mappingValues]
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Parent account updated successfully!' });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating parent account:', error);
    res.status(500).json({ success: false, message: 'Failed to update parent account', error: error.message });
  } finally {
    connection.release();
  }
});

// Check if active in system
// ==========================================
// 1. ACTIVE USER TRACKING (IN-MEMORY HEARTBEAT)
// ==========================================
const activeUsersMap = new Map();

// Heartbeat endpoint pinged by active frontend layouts
app.post('/api/users/heartbeat', (req, res) => {
    const { user_id } = req.body;
    if (user_id) {
        activeUsersMap.set(String(user_id), Date.now());
    }
    res.json({ success: true });
});

// Helper function to check if user is active (pinged in the last 15 seconds)
function isUserActiveInSystem(userId) {
    if (!userId) return false;
    const lastActive = activeUsersMap.get(String(userId));
    if (!lastActive) return false;
    return (Date.now() - lastActive) < 15000; // 15 seconds threshold
}


//NurseMessage API
// 1. Search contacts (Students & Parents by First or Last name, or Student Name for Parents)
app.get('/api/messages/contacts', async (req, res) => {
    const { search } = req.query;
    const searchTerm = `%${search || ''}%`;

    const sql = `
        SELECT 
            s.user_id, 
            s.first_name, 
            s.last_name, 
            'student' AS role, 
            s.program_id AS detail,
            NULL AS linked_student
        FROM students s
        WHERE s.first_name LIKE ? OR s.last_name LIKE ?

        UNION ALL

        SELECT 
            p.user_id, 
            p.first_name, 
            p.last_name, 
            'parent' AS role, 
            p.primary_phone AS detail,
            GROUP_CONCAT(DISTINCT CONCAT(s.first_name, ' ', s.last_name) SEPARATOR ', ') AS linked_student
        FROM parents p
        LEFT JOIN parent_student_mapping psm ON p.parent_id = psm.parent_id
        LEFT JOIN students s ON psm.student_id = s.student_id
        WHERE p.first_name LIKE ? 
           OR p.last_name LIKE ?
           OR s.first_name LIKE ? 
           OR s.last_name LIKE ?
        GROUP BY p.user_id, p.first_name, p.last_name, p.primary_phone
        LIMIT 20;
    `;

    try {
        const [rows] = await pool.query(sql, [
            searchTerm, searchTerm,                         // Student search (first_name, last_name)
            searchTerm, searchTerm, searchTerm, searchTerm  // Parent search (parent first/last name OR student first/last name)
        ]);
        res.json({ success: true, contacts: rows });
    } catch (error) {
        console.error('Error searching contacts:', error);
        res.status(500).json({ success: false, message: 'Error fetching contacts' });
    }
});

// ==========================================
// 2. UNREAD COUNT FOR ALL CONTACTS
// ==========================================
app.get('/api/messages/unread-count/:userId', async (req, res) => {
    const { userId } = req.params;

    if (!userId || userId === 'undefined' || userId === 'null') {
        return res.json({ success: true, unreadCount: 0 });
    }

    const sql = `
        SELECT COUNT(*) AS total_unread_messages
FROM messages 
WHERE (
    receiver_id = 'NRS02000' 
    OR receiver_id IN (SELECT nurse_id COLLATE utf8mb4_unicode_ci FROM nurses WHERE user_id = 'NRS02000')
    OR receiver_id IN (SELECT user_id COLLATE utf8mb4_unicode_ci FROM nurses WHERE nurse_id = 'NRS02000')
)
AND (is_read = FALSE OR is_read = 0 OR is_read IS NULL);
    `;

    try {
        const [rows] = await pool.query(sql, [userId, userId, userId]);
        const count = Number(rows[0]?.total_unread_messages || 0);
        res.json({ success: true, unreadCount: count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ success: false, message: 'Error fetching unread count' });
    }
});

// 2. Get Recent Conversations for Nurse (with per-chat unread count)
// 2. Get Recent Conversations for Nurse
app.get('/api/messages/conversations/:userId', async (req, res) => {
    const { userId } = req.params;

    const sql = `
        SELECT 
            u.contact_user_id,
            u.first_name,
            u.last_name,
            u.role,
            m.message_id,
            m.sender_id,
            m.receiver_id,
            m.message_type,
            m.content,
            m.media_url,
            m.created_at,
            (
                SELECT COUNT(*) 
                FROM messages 
                WHERE sender_id = u.contact_user_id 
                  AND receiver_id = ? 
                  AND is_read = FALSE
            ) AS unread_count
        FROM (
            SELECT user_id COLLATE utf8mb4_unicode_ci AS contact_user_id, first_name, last_name, 'student' AS role FROM students
            UNION
            SELECT user_id COLLATE utf8mb4_unicode_ci AS contact_user_id, first_name, last_name, 'parent' AS role FROM parents
            UNION
            SELECT user_id COLLATE utf8mb4_unicode_ci AS contact_user_id, first_name, last_name, 'nurse' AS role FROM nurses
        ) u
        INNER JOIN messages m ON (
            (m.sender_id = ? AND m.receiver_id = u.contact_user_id) OR
            (m.receiver_id = ? AND m.sender_id = u.contact_user_id)
        )
        WHERE m.message_id IN (
            SELECT MAX(message_id)
            FROM messages
            WHERE sender_id = ? OR receiver_id = ?
            GROUP BY IF(sender_id = ?, receiver_id, sender_id)
        )
        ORDER BY m.created_at DESC, m.message_id DESC;
    `;

    try {
        const [rows] = await pool.query(sql, [userId, userId, userId, userId, userId, userId]);
        res.json({ success: true, conversations: decryptMessageRows(rows) });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ success: false, message: 'Error fetching conversations' });
    }
});

// 3. Get Total Unread Contacts Count (For Nurse Sidebar Badge)
// Get Total Unread Messages Count (For Nurse Sidebar & Topbar Badges)
// GET Total Unread Messages Count for Nurse Topbar/Sidebar Badges
app.get('/api/messages/unread-count/:userId', async (req, res) => {
    const { userId } = req.params;

    if (!userId || userId === 'undefined' || userId === 'null') {
        return res.json({ success: true, unreadCount: 0 });
    }

    const sql = `
        SELECT COUNT(*) AS total_unread_messages
        FROM messages 
        WHERE (
            receiver_id = ? 
            OR receiver_id IN (SELECT CAST(nurse_id AS CHAR) FROM nurses WHERE user_id = ?)
            OR receiver_id IN (SELECT CAST(user_id AS CHAR) FROM nurses WHERE nurse_id = ?)
        )
        AND sender_id != ?
        AND sender_id NOT IN (SELECT CAST(nurse_id AS CHAR) FROM nurses WHERE user_id = ?)
        AND sender_id NOT IN (SELECT CAST(user_id AS CHAR) FROM nurses WHERE nurse_id = ?)
        AND (is_read = FALSE OR is_read = 0 OR is_read IS NULL);
    `;

    try {
        const [rows] = await pool.query(sql, [userId, userId, userId, userId, userId, userId]);
        const count = Number(rows[0]?.total_unread_messages || 0);
        res.json({ success: true, unreadCount: count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ success: false, message: 'Error fetching unread count' });
    }
});

// 4. Get Chat History between Nurse and Selected Contact
app.get('/api/messages/history/:userId/:contactId', async (req, res) => {
    const { userId, contactId } = req.params;

    const sql = `
        SELECT * FROM messages
        WHERE (sender_id = ? AND receiver_id = ?)
           OR (sender_id = ? AND receiver_id = ?)
        ORDER BY message_id ASC;
    `;

    try {
        const [rows] = await pool.query(sql, [userId, contactId, contactId, userId]);
        res.json({ success: true, messages: decryptMessageRows(rows) });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ success: false, message: 'Error fetching chat history' });
    }
});

// 5. Mark Conversation Messages as Read
app.put('/api/messages/read/:userId/:contactId', async (req, res) => {
    const { userId, contactId } = req.params;

    const sql = `
        UPDATE messages 
        SET is_read = TRUE 
        WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE;
    `;

    try {
        await pool.query(sql, [contactId, userId]);
        res.json({ success: true, message: 'Messages marked as read' });
    } catch (error) {
        console.error('Error updating read status:', error);
        res.status(500).json({ success: false, message: 'Error updating read status' });
    }
});

// 6. Send Message with Optional File/Audio/Video/Image Upload
// ==========================================
// 3. SEND MESSAGE & TRIGGER WEB PUSH (IF USER OFFLINE)
// ==========================================
app.post('/api/messages/send', upload.single('media'), async (req, res) => {
    const { sender_id, receiver_id, message_type, content } = req.body;

    if (!sender_id || !receiver_id || sender_id === 'undefined' || receiver_id === 'undefined') {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid sender_id or receiver_id provided.' 
        });
    }

    const media_url = req.file ? `/uploads/${req.file.filename}` : null;
    const safeContent = content && content.trim() !== '' ? content.trim() : null;

    const sql = `
        INSERT INTO messages (sender_id, receiver_id, message_type, content, media_url, is_read)
        VALUES (?, ?, ?, ?, ?, FALSE);
    `;

    try {
        const [result] = await pool.query(sql, [
            sender_id,
            receiver_id,
            message_type || 'text',
            encryptText(safeContent),
            media_url
        ]);

        const [newMessage] = await pool.query('SELECT * FROM messages WHERE message_id = ?', [result.insertId]);

        // --- WEB PUSH NOTIFICATION TRIGGER ---
        // Check if recipient is currently NOT active in the system
        const isRecipientActive = isUserActiveInSystem(receiver_id);

        if (!isRecipientActive) {
            // Fetch sender's full name for push notification header
            const [senderRows] = await pool.query(`
                SELECT first_name, last_name FROM (
                    SELECT user_id, first_name, last_name FROM students
                    UNION
                    SELECT user_id, first_name, last_name FROM parents
                    UNION
                    SELECT user_id, first_name, last_name FROM nurses
                ) u WHERE user_id = ? LIMIT 1
            `, [sender_id]);

            const senderName = senderRows.length > 0 
                ? `${senderRows[0].first_name} ${senderRows[0].last_name}`.trim()
                : 'New Message';

            const pushBody = message_type === 'text' 
                ? (safeContent || 'Sent a message') 
                : `Sent an attachment [${message_type}]`;

            // Dispatch web push via notifyUsers helper
            await notifyUsers({
                sender_id: sender_id,
                recipient_ids: [receiver_id],
                title: `Message from ${senderName}`,
                message: pushBody,
                type: 'MESSAGE',
                payloadData: { url: '/NurseMessages' }
            });
        }

        res.json({ success: true, message: decryptMessageRows(newMessage[0]) });
    } catch (error) {
        console.error('Database Error in /api/messages/send:', error);
        res.status(500).json({ success: false, message: 'Database failed to store message.', error: error.message });
    }
});

// 7. Delete an Individual Message
app.delete('/api/messages/:messageId', async (req, res) => {
    const { messageId } = req.params;

    try {
        await pool.query('DELETE FROM messages WHERE message_id = ?', [messageId]);
        res.json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ success: false, message: 'Error deleting message' });
    }
});

// 8. Delete an Entire Conversation (Clear All Messages between two users)
app.delete('/api/messages/conversations/:userId/:contactId', async (req, res) => {
    const { userId, contactId } = req.params;

    const sql = `
        DELETE FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) 
           OR (sender_id = ? AND receiver_id = ?);
    `;

    try {
        await pool.query(sql, [userId, contactId, contactId, userId]);
        res.json({ success: true, message: 'Conversation cleared successfully' });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ success: false, message: 'Error deleting conversation' });
    }
});

//Student Message API
// 1. Get Contacts for Student (ONLY Connected Parent(s) & Nurses)
app.get('/api/messages/student-contacts/:userId', async (req, res) => {
    const { userId } = req.params;
    const { search } = req.query;
    const searchTerm = `%${search || ''}%`;

    const sql = `
        -- Connected Parent(s)
        SELECT 
            p.user_id, 
            p.first_name, 
            p.last_name, 
            'parent' AS role, 
            p.primary_phone AS detail 
        FROM parents p
        INNER JOIN parent_student_mapping psm ON p.parent_id = psm.parent_id
        INNER JOIN students s ON psm.student_id = s.student_id
        WHERE s.user_id = ? 
          AND (p.first_name LIKE ? OR p.last_name LIKE ?)

        UNION

        -- All Nurses
        SELECT 
            n.user_id, 
            n.first_name, 
            n.last_name, 
            'nurse' AS role, 
            'Clinic Nurse' AS detail 
        FROM nurses n
        WHERE n.first_name LIKE ? OR n.last_name LIKE ?
        LIMIT 20;
    `;

    try {
        const [rows] = await pool.query(sql, [userId, searchTerm, searchTerm, searchTerm, searchTerm]);
        res.json({ success: true, contacts: rows });
    } catch (error) {
        console.error('Error fetching student contacts:', error);
        res.status(500).json({ success: false, message: 'Error fetching contacts' });
    }
});

// 2. Get Recent Conversations for Student (with per-chat unread count)
// Get Recent Conversations for Nurse (with linked student full name for parents)
app.get('/api/messages/conversations/:userId', async (req, res) => {
    const { userId } = req.params;

    const sql = `
        SELECT 
            u.contact_user_id,
            u.first_name,
            u.last_name,
            u.role,
            u.linked_student,
            m.message_id,
            m.sender_id,
            m.receiver_id,
            m.message_type,
            m.content,
            m.media_url,
            m.created_at,
            (
                SELECT COUNT(*) 
                FROM messages 
                WHERE sender_id = u.contact_user_id 
                  AND receiver_id = ? 
                  AND is_read = FALSE
            ) AS unread_count
        FROM (
            SELECT 
                s.user_id COLLATE utf8mb4_unicode_ci AS contact_user_id, 
                s.first_name, 
                s.last_name, 
                'student' AS role,
                NULL AS linked_student
            FROM students s

            UNION ALL

            SELECT 
                p.user_id COLLATE utf8mb4_unicode_ci AS contact_user_id, 
                p.first_name, 
                p.last_name, 
                'parent' AS role,
                GROUP_CONCAT(DISTINCT CONCAT(s.first_name, ' ', s.last_name) SEPARATOR ', ') AS linked_student
            FROM parents p
            LEFT JOIN parent_student_mapping psm ON p.parent_id = psm.parent_id
            LEFT JOIN students s ON psm.student_id = s.student_id
            GROUP BY p.user_id, p.first_name, p.last_name

            UNION ALL

            SELECT 
                n.user_id COLLATE utf8mb4_unicode_ci AS contact_user_id, 
                n.first_name, 
                n.last_name, 
                'nurse' AS role,
                NULL AS linked_student
            FROM nurses n
        ) u
        INNER JOIN messages m ON (
            (m.sender_id = ? AND m.receiver_id = u.contact_user_id) OR
            (m.receiver_id = ? AND m.sender_id = u.contact_user_id)
        )
        WHERE m.message_id IN (
            SELECT MAX(message_id)
            FROM messages
            WHERE sender_id = ? OR receiver_id = ?
            GROUP BY IF(sender_id = ?, receiver_id, sender_id)
        )
        ORDER BY m.created_at DESC, m.message_id DESC;
    `;

    try {
        const [rows] = await pool.query(sql, [userId, userId, userId, userId, userId, userId]);
        res.json({ success: true, conversations: decryptMessageRows(rows) });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ success: false, message: 'Error fetching conversations' });
    }
});

// 3. Get Total Unread Contacts Count (For Student Top Bar Badge)
// 3. Get Total Unread Messages Count (For Top Bar Badge across all contacts)
app.get('/api/messages/unread-count/:userId', async (req, res) => {
    const { userId } = req.params;

    const sql = `
        SELECT COUNT(*) AS total_unread_messages
        FROM messages 
        WHERE receiver_id = ? AND is_read = FALSE;
    `;

    try {
        const [rows] = await pool.query(sql, [userId]);
        res.json({ 
            success: true, 
            unreadCount: rows[0]?.total_unread_messages || 0 
        });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ success: false, message: 'Error fetching unread count' });
    }
});

// 4. Get Chat History between Student and Selected Contact
app.get('/api/messages/history/:userId/:contactId', async (req, res) => {
    const { userId, contactId } = req.params;

    const sql = `
        SELECT * FROM messages
        WHERE (sender_id = ? AND receiver_id = ?)
           OR (sender_id = ? AND receiver_id = ?)
        ORDER BY message_id ASC;
    `;

    try {
        const [rows] = await pool.query(sql, [userId, contactId, contactId, userId]);
        res.json({ success: true, messages: decryptMessageRows(rows) });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ success: false, message: 'Error fetching chat history' });
    }
});

// 5. Mark Conversation Messages as Read
app.put('/api/messages/read/:userId/:contactId', async (req, res) => {
    const { userId, contactId } = req.params;

    const sql = `
        UPDATE messages 
        SET is_read = TRUE 
        WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE;
    `;

    try {
        await pool.query(sql, [contactId, userId]);
        res.json({ success: true, message: 'Messages marked as read' });
    } catch (error) {
        console.error('Error updating read status:', error);
        res.status(500).json({ success: false, message: 'Error updating read status' });
    }
});

// 6. Send Message with File/Audio/Video/Image Upload
// 6. Send Message with File/Audio/Video/Image Upload & Web Push
app.post('/api/messages/send', upload.single('media'), async (req, res) => {
    const { sender_id, receiver_id, message_type, content } = req.body;

    if (!sender_id || !receiver_id || sender_id === 'undefined' || receiver_id === 'undefined') {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid sender_id or receiver_id provided.' 
        });
    }

    const media_url = req.file ? `/uploads/${req.file.filename}` : null;
    const safeContent = content && content.trim() !== '' ? content.trim() : null;

    const sql = `
        INSERT INTO messages (sender_id, receiver_id, message_type, content, media_url, is_read)
        VALUES (?, ?, ?, ?, ?, FALSE);
    `;

    try {
        const [result] = await pool.query(sql, [
            sender_id,
            receiver_id,
            message_type || 'text',
            encryptText(safeContent),
            media_url
        ]);

        const [newMessage] = await pool.query('SELECT * FROM messages WHERE message_id = ?', [result.insertId]);

        // Trigger Web Push ONLY if recipient is NOT currently active in the system
        if (!isUserActiveInSystem(receiver_id)) {
            // Fetch sender full name for notification preview
            const [senderRows] = await pool.query(
                `SELECT first_name, last_name FROM (
                    SELECT user_id, first_name, last_name FROM students
                    UNION ALL
                    SELECT user_id, first_name, last_name FROM parents
                    UNION ALL
                    SELECT user_id, first_name, last_name FROM nurses
                ) u WHERE user_id = ? LIMIT 1`,
                [sender_id]
            );

            const senderName = senderRows.length > 0 
                ? `${senderRows[0].first_name} ${senderRows[0].last_name}` 
                : 'Someone';

            const pushMessage = safeContent 
                ? (safeContent.length > 60 ? safeContent.substring(0, 57) + '...' : safeContent)
                : (media_url ? `Sent an attachment (${message_type || 'file'})` : 'Sent a new message');

            await notifyUsers({
                sender_id,
                recipient_ids: [receiver_id],
                title: `New Message from ${senderName}`,
                message: pushMessage,
                type: 'MESSAGE',
                payloadData: { sender_id, type: 'MESSAGE' }
            });
        }

        res.json({ success: true, message: decryptMessageRows(newMessage[0]) });
    } catch (error) {
        console.error('Database Error in /api/messages/send:', error);
        res.status(500).json({ success: false, message: 'Database failed to store message.', error: error.message });
    }
});

// 7. Delete an Individual Message
app.delete('/api/messages/:messageId', async (req, res) => {
    const { messageId } = req.params;

    try {
        await pool.query('DELETE FROM messages WHERE message_id = ?', [messageId]);
        res.json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ success: false, message: 'Error deleting message' });
    }
});

// 8. Delete Conversation
app.delete('/api/messages/conversations/:userId/:contactId', async (req, res) => {
    const { userId, contactId } = req.params;

    const sql = `
        DELETE FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) 
           OR (sender_id = ? AND receiver_id = ?);
    `;

    try {
        await pool.query(sql, [userId, contactId, contactId, userId]);
        res.json({ success: true, message: 'Conversation deleted successfully' });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ success: false, message: 'Error deleting conversation' });
    }
});

// api qr student
// Get single student by ID
app.get('/api/students/qr/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(
      'SELECT student_id, user_id, first_name, last_name, program_id, year_level, section FROM students WHERE student_id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// ==================== NURSE DASHBOARD ENDPOINTS ====================

app.get('/api/nurse/dashboard', async (req, res) => {
  try {
    const [
      requirementApprovalSummary,
      upcomingRequirementDeadlines,
      documentRequestsPending,
      medicineStockAlerts,
      upcomingHealthScreenings,
      upcomingDoctorVisits
    ] = await Promise.all([
      
      // 1. Overview of waiting for approval and incomplete requirements
      pool.query(`
        SELECT 
          SUM(CASE WHEN status IN ('Submitted', 'Submitted Late', 'Pending') THEN 1 ELSE 0 END) AS waiting_for_approval_count,
          SUM(CASE WHEN status IN ('Not Submitted', 'Resubmit', 'Rejected') THEN 1 ELSE 0 END) AS incomplete_count,
          COUNT(*) AS total_submissions
        FROM student_requirement_submissions
      `),

      // 2. Overview of upcoming deadline of requirements with details (Program + Special Requirements)
      pool.query(`
        SELECT * FROM (
          SELECT 
            'Program' AS requirement_type,
            config_id AS id,
            requirement_name,
            program_id,
            year_level,
            NULL AS student_id,
            submission_deadline,
            allow_late_submission
          FROM program_requirements_config
          WHERE submission_deadline >= CURDATE()
          
          UNION ALL
          
          SELECT 
            'Special' AS requirement_type,
            CONCAT(student_id, '_', requirement_name) AS id,
            requirement_name,
            NULL AS program_id,
            NULL AS year_level,
            student_id,
            submission_deadline,
            allow_late_submission
          FROM student_special_requirements
          WHERE submission_deadline >= CURDATE()
        ) AS upcoming_requirements
        ORDER BY submission_deadline ASC
        LIMIT 10
      `),

      // 3. Overview of waiting for approval document requests (Excuse Slips & Referral Slips)
      pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM excuse_slip_requests WHERE status = 'Pending') AS pending_excuse_slips,
          (SELECT COUNT(*) FROM referral_slip_requests WHERE status = 'Pending') AS pending_referral_slips,
          (
            (SELECT COUNT(*) FROM excuse_slip_requests WHERE status = 'Pending') + 
            (SELECT COUNT(*) FROM referral_slip_requests WHERE status = 'Pending')
          ) AS total_pending_requests
      `),

      // 4. Medicines that are low, critical or out of stock (same per-medicine numbers as the Restock Report)
      getMedicineStockStatuses().then((list) => [list.filter((m) => m.status !== 'Adequate').map((m) => ({
        medicine_id: m.medicine_id,
        generic_name: m.generic_name,
        brand_name: m.brand_name,
        dosage_form: m.dosage_form,
        low_stock_level: m.low_stock_level,
        critical_stock_level: m.critical_stock_level,
        total_current_stock: m.usable_stock,
        stock_status: m.status === 'Out of stock' ? 'OUT' : m.status.toUpperCase()
      }))]),

      // 5. Overview of upcoming health screening with details
      pool.query(`
        SELECT 
          screening_schedule_id,
          title,
          screening_type,
          target_program_id,
          target_year_level,
          target_section,
          scheduled_date,
          start_time,
          end_time,
          announcement
        FROM screening_schedules
        WHERE scheduled_date >= CURDATE()
        ORDER BY scheduled_date ASC, start_time ASC
        LIMIT 10
      `),

      // 6. Overview of upcoming doctor visit with details
      pool.query(`
        SELECT 
          appointment_id,
          doctor_id,
          batch_id,
          title,
          start_time,
          end_time,
          status,
          visit_type,
          announcement,
          assigned_by_nurse_id
        FROM doctor_appointments
        WHERE start_time >= NOW() 
          AND status NOT IN ('Cancelled', 'Completed', 'Pending Approval', 'Declined')
        ORDER BY start_time ASC
        LIMIT 10
      `)
    ]);

    // Format response structure for nurseDashboard.jsx
    res.status(200).json({
      success: true,
      data: {
        requirementsOverview: {
          waitingForApprovalCount: parseInt(requirementApprovalSummary[0][0]?.waiting_for_approval_count || 0),
          incompleteCount: parseInt(requirementApprovalSummary[0][0]?.incomplete_count || 0),
          totalSubmissions: parseInt(requirementApprovalSummary[0][0]?.total_submissions || 0)
        },
        upcomingRequirementDeadlines: upcomingRequirementDeadlines[0],
        pendingDocumentRequests: documentRequestsPending[0][0],
        medicineStockAlerts: medicineStockAlerts[0],
        upcomingHealthScreenings: upcomingHealthScreenings[0],
        upcomingDoctorVisits: upcomingDoctorVisits[0]
      }
    });

  } catch (error) {
    console.error('Error fetching nurse dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve nurse dashboard data',
      error: error.message
    });
  }
});

//student dashboard api
// -----------------------------------------------------------------------------
// 1. Overview of Student Recent Visits & Medicine Dispensation (With Medicine Names)
// -----------------------------------------------------------------------------
app.get('/api/student/dashboard/visits-dispensation/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    // Fetch clinic visits joined with chief_complaints, consultation_dispensation, batch, and medicines
    const visitsQuery = `
      SELECT 
        v.visit_id,
        v.student_id,
        v.nurse_id,
        v.complaint_id,
        cc.complaint_name,
        v.specify_complaint_text,
        v.visit_date,
        v.time_in,
        v.time_out,
        v.temperature,
        v.respiratory_rate,
        v.pulse_rate,
        v.blood_pressure,
        v.nursing_intervention,
        v.assessment,
        cd.consultation_dispense_id,
        cd.dosage_consumption_unit_value AS consultation_dosage_value,
        cd.dosage_consumption_unit_of_measure AS consultation_dosage_unit,
        cd.dispensed_at AS consultation_dispensed_at,
        m.generic_name AS medicine_generic_name,
        m.brand_name AS medicine_brand_name
      FROM clinic_visits v
      LEFT JOIN chief_complaints cc ON v.complaint_id = cc.complaint_id
      LEFT JOIN consultation_dispensation cd ON v.visit_id = cd.visit_id
      LEFT JOIN medicine_inventory_batches mb ON cd.batch_id = mb.batch_id
      LEFT JOIN medicines m ON mb.medicine_id = m.medicine_id
      WHERE v.student_id = ?
      ORDER BY v.visit_date DESC, v.time_in DESC
      LIMIT 10;
    `;

    // Fetch direct medicine dispensations joined with batch and medicines
    const directDispenseQuery = `
      SELECT 
        dd.direct_dispense_id,
        dd.nurse_id,
        dd.dosage_consumption_unit_value,
        dd.dosage_consumption_unit_of_measure,
        dd.dispensed_at,
        m.generic_name AS medicine_generic_name,
        m.brand_name AS medicine_brand_name
      FROM direct_dispensation dd
      LEFT JOIN medicine_inventory_batches mb ON dd.batch_id = mb.batch_id
      LEFT JOIN medicines m ON mb.medicine_id = m.medicine_id
      WHERE dd.student_id = ?
      ORDER BY dd.dispensed_at DESC
      LIMIT 10;
    `;

    const [visits] = await pool.query(visitsQuery, [studentId]);
    const [directDispensations] = await pool.query(directDispenseQuery, [studentId]);

    // Format direct dispensations with medicine_name
    const formattedDirectDispensations = directDispensations.map((dd) => {
      let medName = dd.medicine_generic_name || dd.medicine_brand_name || 'Medicine';
      if (dd.medicine_generic_name && dd.medicine_brand_name) {
        medName = `${dd.medicine_generic_name} (${dd.medicine_brand_name})`;
      }
      return {
        ...dd,
        medicine_name: medName,
      };
    });

    // Group consultation dispensations inside their corresponding visit object
    const visitMap = {};
    visits.forEach((row) => {
      if (!visitMap[row.visit_id]) {
        visitMap[row.visit_id] = {
          visit_id: row.visit_id,
          visit_date: row.visit_date,
          time_in: row.time_in,
          time_out: row.time_out,
          complaint_id: row.complaint_id,
          complaint_name: row.complaint_name,
          specify_complaint_text: row.specify_complaint_text,
          vitals: {
            temperature: row.temperature,
            respiratory_rate: row.respiratory_rate,
            pulse_rate: row.pulse_rate,
            blood_pressure: row.blood_pressure,
          },
          nursing_intervention: row.nursing_intervention,
          assessment: row.assessment,
          dispensed_medicines: [],
        };
      }

      if (row.consultation_dispense_id) {
        let medName = row.medicine_generic_name || row.medicine_brand_name || 'Medicine';
        if (row.medicine_generic_name && row.medicine_brand_name) {
          medName = `${row.medicine_generic_name} (${row.medicine_brand_name})`;
        }

        visitMap[row.visit_id].dispensed_medicines.push({
          dispense_id: row.consultation_dispense_id,
          dosage_value: row.consultation_dosage_value,
          dosage_unit: row.consultation_dosage_unit,
          dispensed_at: row.consultation_dispensed_at,
          medicine_name: medName,
          generic_name: row.medicine_generic_name,
          brand_name: row.medicine_brand_name,
        });
      }
    });

    res.status(200).json({
      success: true,
      data: {
        clinic_visits: Object.values(visitMap),
        direct_dispensations: formattedDirectDispensations,
      },
    });
  } catch (error) {
    console.error('Error fetching visits and dispensation:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});

// -----------------------------------------------------------------------------
// 2. Overview of Student Requirements (Updated to include 'Incomplete')
// -----------------------------------------------------------------------------
app.get('/api/student/dashboard/requirements/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    const query = `
      SELECT 
        sr.requirement_name,
        sr.submission_deadline,
        sr.allow_late_submission,
        sr.assigned_at,
        sub.submission_id,
        sub.file_url,
        COALESCE(sub.status, 'Incomplete') AS status,
        sub.is_late,
        sub.nurse_remarks,
        sub.submitted_at
      FROM student_special_requirements sr
      LEFT JOIN student_requirement_submissions sub 
        ON sr.student_id = sub.student_id 
        AND sr.requirement_name = sub.requirement_name
      WHERE sr.student_id = ?
      ORDER BY sr.submission_deadline ASC;
    `;

    const [requirements] = await pool.query(query, [studentId]);

    // Filter incomplete vs completed requirements (Includes 'Incomplete')
    const incompleteRequirements = requirements.filter((req) =>
      ['Pending', 'Rejected', 'Resubmit', 'Not Submitted', 'Incomplete'].includes(req.status)
    );

    res.status(200).json({
      success: true,
      data: {
        all_requirements: requirements,
        incomplete_requirements: incompleteRequirements,
        total_assigned: requirements.length,
        total_incomplete: incompleteRequirements.length,
      },
    });
  } catch (error) {
    console.error('Error fetching student requirements:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});

// -----------------------------------------------------------------------------
// 3. Overview of Student Updates in Document Requests (with details)
// -----------------------------------------------------------------------------
app.get('/api/student/dashboard/document-requests/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    const excuseSlipsQuery = `
      SELECT 
        request_id,
        reason_for_excuse,
        valid_absence_start,
        valid_absence_end,
        student_proof_url,
        status,
        issued_by,
        issued_at,
        issued_slip_url,
        created_at,
        'Excuse Slip' AS request_type
      FROM excuse_slip_requests
      WHERE student_id = ?
      ORDER BY created_at DESC;
    `;

    const referralSlipsQuery = `
      SELECT 
        request_id,
        facility_id,
        reason_for_referral,
        status,
        issued_by,
        issued_at,
        issued_slip_url,
        created_at,
        'Referral Slip' AS request_type
      FROM referral_slip_requests
      WHERE student_id = ?
      ORDER BY created_at DESC;
    `;

    const [excuseSlips] = await pool.query(excuseSlipsQuery, [studentId]);
    const [referralSlips] = await pool.query(referralSlipsQuery, [studentId]);

    res.status(200).json({
      success: true,
      data: {
        excuse_slip_requests: excuseSlips,
        referral_slip_requests: referralSlips,
        recent_updates: [...excuseSlips, ...referralSlips].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        ),
      },
    });
  } catch (error) {
    console.error('Error fetching document requests:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});

// -----------------------------------------------------------------------------
// 4. Overview of Student Upcoming Health Screening (with details)
// -----------------------------------------------------------------------------
app.get('/api/student/dashboard/upcoming-health-screenings', async (req, res) => {
  const { programId, yearLevel, section } = req.query;

  try {
    const query = `
      SELECT 
        screening_schedule_id,
        title,
        screening_type,
        target_program_id,
        target_year_level,
        target_section,
        scheduled_date,
        start_time,
        end_time,
        announcement
      FROM screening_schedules
      WHERE scheduled_date >= CURDATE()
        AND (target_program_id = ? OR target_program_id IS NULL)
        AND (target_year_level = ? OR target_year_level IS NULL)
        AND (target_section = ? OR target_section IS NULL)
      ORDER BY scheduled_date ASC, start_time ASC;
    `;

    const [screenings] = await pool.query(query, [programId || null, yearLevel || null, section || null]);

    res.status(200).json({
      success: true,
      data: screenings,
    });
  } catch (error) {
    console.error('Error fetching upcoming health screenings:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});

// -----------------------------------------------------------------------------
// 5. Overview of Student Upcoming Doctor Visit Schedule (with details)
// -----------------------------------------------------------------------------
app.get('/api/student/dashboard/doctor-appointments/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    const query = `
      SELECT 
        da.appointment_id,
        da.title,
        da.doctor_id,
        da.batch_id,
        da.start_time,
        da.end_time,
        da.status AS appointment_status,
        CASE WHEN da.visit_type = 'Other' AND da.purpose_other IS NOT NULL THEN CONCAT('Other: ', da.purpose_other) ELSE da.visit_type END AS visit_type,
        da.announcement,
        das.attendance_status,
        das.check_in_time,
        das.notes
      FROM doctor_appointments da
      INNER JOIN doctor_appointment_students das 
        ON da.appointment_id = das.appointment_id
      WHERE das.student_id = ?
        AND da.start_time >= NOW()
      ORDER BY da.start_time ASC;
    `;

    const [appointments] = await pool.query(query, [studentId]);

    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    console.error('Error fetching upcoming doctor appointments:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});

//Parent Dashboard api
// 1. Overview of student's recent clinic visits
app.get('/api/student/:studentId/clinic-visits', async (req, res) => {
    try {
        const { studentId } = req.params;
        // Queries the clinic_visits table as defined in sdb 1 .png[cite: 10]
        const query = `
            SELECT visit_date, time_in, time_out, temperature, respiratory_rate, 
                   pulse_rate, blood_pressure, nursing_intervention, recommmedations 
            FROM clinic_visits 
            WHERE student_id = ? 
            ORDER BY visit_date DESC, time_in DESC 
            LIMIT 5
        `;
        const [visits] = await pool.query(query, [studentId]);
        res.status(200).json(visits);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Overview of recent medicine dispensation (Direct and Consultation)
app.get('/api/student/:studentId/dispensations', async (req, res) => {
    try {
        const { studentId } = req.params;
        
        // Fetches direct dispensation records referencing sdp 3.png[cite: 8]
        const directQuery = `
            SELECT 'Direct' AS type, dosage_consumption_unit_value, 
                   dosage_consumption_unit_of_measure, dispensed_at 
            FROM direct_dispensation 
            WHERE student_id = ? 
            ORDER BY dispensed_at DESC LIMIT 5
        `;
        
        // Fetches consultation dispensation records by joining clinic_visits to match the student, based on sdp 2.png and sdb 1 .png[cite: 9, 10]
        const consultQuery = `
            SELECT 'Consultation' AS type, cd.dosage_consumption_unit_value, 
                   cd.dosage_consumption_unit_of_measure, cd.dispensed_at 
            FROM consultation_dispensation cd
            JOIN clinic_visits cv ON cd.visit_id = cv.visit_id
            WHERE cv.student_id = ? 
            ORDER BY cd.dispensed_at DESC LIMIT 5
        `;

        const [directDispense] = await pool.query(directQuery, [studentId]);
        const [consultDispense] = await pool.query(consultQuery, [studentId]);
        
        // Combine and sort both arrays to provide a unified timeline
        const allDispensations = [...directDispense, ...consultDispense]
            .sort((a, b) => new Date(b.dispensed_at) - new Date(a.dispensed_at))
            .slice(0, 10);

        res.status(200).json(allDispensations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Overview of student's list of requirements
app.get('/api/student/:studentId/requirements', async (req, res) => {
    try {
        const { studentId } = req.params;
        // Joins student_special_requirements (sdb 5.png) with student_requirement_submissions (sdb4.png) to get current status[cite: 6, 7]
        const query = `
            SELECT req.requirement_name, req.submission_deadline, req.allow_late_submission,
                   sub.status, sub.submitted_at, sub.is_late, sub.nurse_remarks 
            FROM student_special_requirements req
            LEFT JOIN student_requirement_submissions sub 
                   ON req.student_id = sub.student_id AND req.requirement_name = sub.requirement_name
            WHERE req.student_id = ?
            ORDER BY req.submission_deadline ASC
        `;
        const [requirements] = await pool.query(query, [studentId]);
        res.status(200).json(requirements);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Upcoming health screenings
app.get('/api/student/:studentId/screenings', async (req, res) => {
    try {
        // Note: Screening schedules are targeted by program, year, and section (sdb 8.png)[cite: 3].
        // Pass these variables in req.query when calling this endpoint from parentDashboard.jsx.
        const { programId, yearLevel, section } = req.query; 
        
        const query = `
            SELECT title, scheduled_date, start_time, end_time, announcement, screening_type 
            FROM screening_schedules 
            WHERE target_program_id = ? AND target_year_level = ? AND target_section = ? 
              AND scheduled_date >= CURDATE()
            ORDER BY scheduled_date ASC
        `;
        const [screenings] = await pool.query(query, [programId, yearLevel, section]);
        res.status(200).json(screenings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Doctor visits / appointments
app.get('/api/student/:studentId/doctor-appointments', async (req, res) => {
    try {
        const { studentId } = req.params;
        // Joins doctor_appointments (sdb 9.png) with doctor_appointment_students (sdb 10.png)[cite: 2, 1]
        const query = `
            SELECT da.title, CASE WHEN da.visit_type = 'Other' AND da.purpose_other IS NOT NULL THEN CONCAT('Other: ', da.purpose_other) ELSE da.visit_type END AS visit_type, da.start_time, da.end_time, da.status AS appointment_status, 
                   das.attendance_status, das.check_in_time, das.notes 
            FROM doctor_appointment_students das
            JOIN doctor_appointments da ON das.appointment_id = da.appointment_id
            WHERE das.student_id = ?
            ORDER BY da.start_time DESC
        `;
        const [appointments] = await pool.query(query, [studentId]);
        res.status(200).json(appointments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. Incident reports
app.get('/api/student/:studentId/incidents', async (req, res) => {
    try {
        const { studentId } = req.params;
        const query = `
            SELECT incident_datetime, incident_location, incident_description, 
                   first_aid_administered, current_physical_situation 
            FROM incident_reports 
            WHERE student_id = ? 
            ORDER BY incident_datetime DESC
        `;
        const [incidents] = await pool.query(query, [studentId]);
        res.status(200).json(incidents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. Document requests (Referral & Excuse Slips)
app.get('/api/student/:studentId/document-requests', async (req, res) => {
    try {
        const { studentId } = req.params;
        
        // Fetches from referral_slip_requests (sdb 7.png)[cite: 4]
        const referralQuery = `
            SELECT request_id, 'Referral Slip' AS document_type, reason_for_referral AS details, 
                   status, issued_at, created_at 
            FROM referral_slip_requests 
            WHERE student_id = ?
        `;
        
        // Fetches from excuse_slip_requests (sdb 6.png)[cite: 5]
        const excuseQuery = `
            SELECT request_id, 'Excuse Slip' AS document_type, reason_for_excuse AS details, 
                   status, issued_at, created_at 
            FROM excuse_slip_requests 
            WHERE student_id = ?
        `;

        const [referrals] = await pool.query(referralQuery, [studentId]);
        const [excuses] = await pool.query(excuseQuery, [studentId]);
        
        // Combines both document types into a single chronologically sorted history
        const allDocuments = [...referrals, ...excuses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.status(200).json(allDocuments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


//Fetch Nurse Notification
// 1. Get all unread notifications for a nurse using nurse_id
// 1. Get all notifications for a nurse using nurse_id (both read and unread)
app.get('/api/notifications/nurse/:nurse_id', async (req, res) => {
  const { nurse_id } = req.params;

  try {
    const query = `
      SELECT 
        n.notification_id,
        n.sender_id,
        n.recipient_id,
        n.title,
        n.message,
        n.type,
        n.is_read,
        n.created_at,
        n.read_at
      FROM notifications n
      INNER JOIN nurses nu ON n.recipient_id = nu.user_id
      WHERE nu.nurse_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `;

    const [notifications] = await pool.query(query, [nurse_id]);

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 2. Mark a notification as read
app.patch('/api/notifications/:notification_id/read', async (req, res) => {
  const { notification_id } = req.params;

  try {
    const query = `
      UPDATE notifications 
      SET is_read = 1, read_at = CURRENT_TIMESTAMP 
      WHERE notification_id = ?
    `;

    await pool.query(query, [notification_id]);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Express API route
app.patch('/api/notifications/nurse/:nurseId/read-all', async (req, res) => {
    const { nurseId } = req.params;
    try {
        await pool.query(
            'UPDATE notifications SET is_read = true WHERE nurse_id = ? AND is_read = false',
            [nurseId]
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

//Fetch Student Notification 
// Get all unread notifications for a student using student_id
// 1. Get all notifications (read and unread) for a student using student_id
app.get('/api/notifications/student/:student_id', async (req, res) => {
  const { student_id } = req.params;

  try {
    const query = `
      SELECT 
        n.notification_id,
        n.sender_id,
        n.recipient_id,
        n.title,
        n.message,
        n.type,
        n.is_read,
        n.created_at,
        n.read_at
      FROM notifications n
      INNER JOIN students s ON n.recipient_id = s.user_id
      WHERE s.student_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `;

    const [notifications] = await pool.query(query, [student_id]);

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching student notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 2. Mark a single notification as read
app.patch('/api/notifications/:notification_id/read', async (req, res) => {
  const { notification_id } = req.params;

  try {
    const query = `
      UPDATE notifications 
      SET is_read = 1, read_at = CURRENT_TIMESTAMP 
      WHERE notification_id = ?
    `;

    await pool.query(query, [notification_id]);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 3. Mark all notifications as read for a student
app.patch('/api/notifications/student/:studentId/read-all', async (req, res) => {
  const { studentId } = req.params;

  try {
    const query = `
      UPDATE notifications n
      INNER JOIN students s ON n.recipient_id = s.user_id
      SET n.is_read = 1, n.read_at = CURRENT_TIMESTAMP
      WHERE s.student_id = ? AND n.is_read = 0
    `;

    await pool.query(query, [studentId]);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


//Parent Notification
// GET /api/notifications/parent/:parentId
app.get('/api/notifications/parent/:parentId', async (req, res) => {
  const { parentId } = req.params;

  if (!parentId) {
    return res.status(400).json({ error: 'parentId is required' });
  }

  try {
    const query = `
      SELECT 
        n.notification_id,
        n.sender_id,
        n.recipient_id,
        n.title,
        n.message,
        n.type,
        n.is_read,
        n.created_at,
        n.read_at
      FROM notifications n
      INNER JOIN parents p ON n.recipient_id = p.user_id
      WHERE p.parent_id = ?
      ORDER BY n.created_at DESC;
    `;

    const [rows] = await pool.query(query, [parentId]);
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching parent notifications:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/notifications/student/:studentId
app.get('/api/notifications/student/:studentId', async (req, res) => {
  const { studentId } = req.params;

  if (!studentId) {
    return res.status(400).json({ error: 'studentId is required' });
  }

  try {
    const query = `
      SELECT 
        n.notification_id,
        n.sender_id,
        n.recipient_id,
        n.title,
        n.message,
        n.type,
        n.is_read,
        n.created_at,
        n.read_at
      FROM notifications n
      INNER JOIN students s ON n.recipient_id = s.user_id
      WHERE s.student_id = ?
      ORDER BY n.created_at DESC;
    `;

    const [rows] = await pool.query(query, [studentId]);
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching student notifications:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all notifications as read for a parent (including parent & linked student notifications)
app.patch('/api/notifications/parent/:parentId/read-all', async (req, res) => {
  const { parentId } = req.params;

  try {
    const query = `
      UPDATE notifications n
      INNER JOIN parents p ON n.recipient_id = p.user_id
      SET n.is_read = 1, n.read_at = CURRENT_TIMESTAMP
      WHERE p.parent_id = ? AND n.is_read = 0
    `;

    await pool.query(query, [parentId]);

    res.status(200).json({
      success: true,
      message: 'All parent notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all parent notifications as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET: Retrieve Notifications for a specific Recipient (User)
app.get('/api/notifications', async (req, res) => {
    const { recipient_id } = req.query;

    if (!recipient_id) {
        return res.status(400).json({ error: "recipient_id query parameter is required." });
    }

    try {
        const sql = `
            SELECT 
                notification_id, sender_id, recipient_id, title, message, type, is_read, created_at, read_at
            FROM notifications
            WHERE recipient_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        `;
        const [rows] = await pool.execute(sql, [recipient_id]);
        res.json(rows);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ error: "Failed to fetch notifications." });
    }
});

// PATCH: Mark a Notification as Read
app.patch('/api/notifications/:id/read', async (req, res) => {
    const { id } = req.params;

    try {
        const sql = `
            UPDATE notifications 
            SET is_read = 1, read_at = NOW() 
            WHERE notification_id = ?
        `;
        const [result] = await pool.execute(sql, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Notification not found." });
        }

        res.json({ success: true, message: "Notification marked as read." });
    } catch (error) {
        console.error("Error marking notification read:", error);
        res.status(500).json({ error: "Failed to update notification status." });
    }
});

// Register / Save Web Push Subscription
app.post('/api/push-subscriptions', async (req, res) => {
  try {
    const { user_id, endpoint, keys } = req.body;
    if (!user_id || !endpoint || !keys) {
      return res.status(400).json({ error: 'Missing required subscription parameters.' });
    }

    const { p256dh, auth } = keys;

    // Remove duplicates for the same endpoint
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);

    const subscription_id = uuidv4();
    await pool.query(
      `INSERT INTO push_subscriptions (subscription_id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)`,
      [subscription_id, user_id, endpoint, p256dh, auth]
    );

    res.status(201).json({ message: 'Push subscription registered successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register or update Web Push Subscription
app.post('/api/push-subscribe', async (req, res) => {
    const { user_id: inputId, endpoint, keys } = req.body;

    if (!inputId || !endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ success: false, message: 'Invalid subscription payload.' });
    }

    try {
        // 1. Look up actual users.user_id from users, students, nurses, or parents
        const [userRows] = await pool.query(
            `SELECT user_id FROM users WHERE user_id = ?
             UNION
             SELECT user_id FROM students WHERE student_id = ?
             UNION
             SELECT user_id FROM nurses WHERE nurse_id = ?
             UNION
             SELECT user_id FROM parents WHERE parent_id = ?
             LIMIT 1`,
            [inputId, inputId, inputId, inputId]
        );

        if (!userRows || userRows.length === 0) {
            return res.status(404).json({ success: false, message: 'User record not found in system.' });
        }

        const actualUserId = userRows[0].user_id;

        // 2. Save push subscription with the validated users.user_id
        const [existing] = await pool.query(
            `SELECT subscription_id FROM push_subscriptions WHERE endpoint = ?`,
            [endpoint]
        );

        if (existing.length > 0) {
            await pool.query(
                `UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ? WHERE endpoint = ?`,
                [actualUserId, keys.p256dh, keys.auth, endpoint]
            );
        } else {
            const subscription_id = `SUB-${uuidv4().substring(0, 8)}`;
            await pool.query(
                `INSERT INTO push_subscriptions (subscription_id, user_id, endpoint, p256dh, auth, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [subscription_id, actualUserId, endpoint, keys.p256dh, keys.auth]
            );
        }

        res.json({ success: true, message: 'Push subscription saved.' });
    } catch (error) {
        console.error('Error saving push subscription:', error);
        res.status(500).json({ success: false, message: 'Failed to subscribe to push notifications.' });
    }
});


//Parent Messaging
// 1. SEND MESSAGE (Parent -> Nurse or Nurse -> Parent / Student)
app.post('/api/messages/send', async (req, res) => {
    const { sender_id, receiver_id, content, message_type = 'text' } = req.body;

    if (!sender_id || !receiver_id || !content) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
        const query = `
            INSERT INTO messages (sender_id, receiver_id, message_type, content, is_read, created_at)
            VALUES (?, ?, ?, ?, 0, NOW(3));
        `;
        // Explicitly cast parameters to String to prevent MySQL type coercion
        const [result] = await pool.query(query, [
            String(sender_id), 
            String(receiver_id), 
            String(message_type), 
            encryptText(String(content))
        ]);

        res.json({ success: true, message_id: result.insertId });
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ success: false, message: 'Failed to send message' });
    }
});

// 2. RECEIVE / FETCH MESSAGES THREAD (Both Sent & Received)
app.get('/api/messages/:userId/:contactUserId', async (req, res) => {
    const { userId, contactUserId } = req.params;

    if (!userId || !contactUserId) {
        return res.status(400).json({ success: false, message: 'Missing userId or contactUserId' });
    }

    try {
        const query = `
            SELECT message_id, sender_id, receiver_id, message_type, content, media_url, is_read, created_at
            FROM messages
            WHERE (sender_id = ? AND receiver_id = ?)
               OR (sender_id = ? AND receiver_id = ?)
            ORDER BY created_at ASC;
        `;
        // Explicitly cast parameters to String to prevent MySQL type coercion
        const strUserId = String(userId);
        const strContactUserId = String(contactUserId);
        const [messages] = await pool.query(query, [strUserId, strContactUserId, strContactUserId, strUserId]);

        res.json({ success: true, messages: decryptMessageRows(messages) });
    } catch (err) {
        console.error('Error fetching chat messages:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
});

// 3. UNREAD MESSAGES COUNT FOR BADGE (Received Messages)
// 3. Get Total Unread Message Count across all contacts for badge
app.get('/api/messages/unread-count/:userId', async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'Missing userId' });
    }

    try {
        const query = `
            SELECT COUNT(*) AS unreadCount 
            FROM messages 
            WHERE receiver_id = ? AND is_read = FALSE;
        `;
        const [rows] = await pool.query(query, [String(userId)]);

        res.json({ success: true, unreadCount: rows[0]?.unreadCount || 0 });
    } catch (err) {
        console.error('Error fetching unread count:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
    }
});

// 4. MARK MESSAGES AS READ WHEN PARENT OPENS CHAT
app.patch('/api/messages/mark-read', async (req, res) => {
    const { sender_id, receiver_id } = req.body;

    if (!sender_id || !receiver_id) {
        return res.status(400).json({ success: false, message: 'Missing sender_id or receiver_id' });
    }

    try {
        const query = `
            UPDATE messages 
            SET is_read = 1 
            WHERE sender_id = ? AND receiver_id = ? AND is_read = 0;
        `;
        // Explicitly cast parameters to String to prevent TRUNCATED_WRONG_VALUE error
        await pool.query(query, [String(sender_id), String(receiver_id)]);

        res.json({ success: true });
    } catch (err) {
        console.error('Error marking messages read:', err);
        res.status(500).json({ success: false, message: 'Failed to mark read' });
    }
});

// 5. GET PARENT CONTACTS (Linked Students)
app.get('/api/parent/:parentId/contacts', async (req, res) => {
    const { parentId } = req.params;

    if (!parentId) {
        return res.status(400).json({ success: false, message: 'Missing parentId' });
    }

    try {
        const query = `
            SELECT 
                s.student_id,
                s.user_id AS contact_user_id,
                s.first_name,
                s.last_name,
                s.program_id,
                s.year_level,
                s.section,
                'Student' AS role
            FROM parent_student_mapping psm
            JOIN students s ON psm.student_id = s.student_id
            WHERE psm.parent_id = ?;
        `;
        const [contacts] = await pool.query(query, [String(parentId)]);

        res.json({ success: true, contacts });
    } catch (err) {
        console.error('Error fetching parent contacts:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch contacts' });
    }
});



//unified
// 1. Unified Send Message (Handles Text, Image, Video, Audio, and Documents)
// 1. Unified Send Message Endpoint with Inactive Web Push Trigger
app.post('/api/messages/send', upload.single('media'), async (req, res) => {
    const { sender_id, receiver_id, message_type, content } = req.body;

    if (!sender_id || !receiver_id || sender_id === 'undefined' || receiver_id === 'undefined') {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid sender_id or receiver_id provided.' 
        });
    }

    const media_url = req.file ? `/uploads/${req.file.filename}` : null;
    const safeContent = content && content.trim() !== '' ? content.trim() : null;

    if (!safeContent && !media_url) {
        return res.status(400).json({ success: false, message: 'Message content or file attachment is required.' });
    }

    const sql = `
        INSERT INTO messages (sender_id, receiver_id, message_type, content, media_url, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, FALSE, NOW(3));
    `;

    try {
        const [result] = await pool.query(sql, [
            String(sender_id),
            String(receiver_id),
            message_type || 'text',
            encryptText(safeContent),
            media_url
        ]);

        const [newMessage] = await pool.query('SELECT * FROM messages WHERE message_id = ?', [result.insertId]);

        // Trigger Web Push Notification ONLY if the recipient is NOT currently active in the system
        if (!isUserActiveInSystem(receiver_id)) {
            // Resolve sender full name across role tables
            const [senderRows] = await pool.query(
                `SELECT first_name, last_name FROM (
                    SELECT user_id, first_name, last_name FROM students
                    UNION ALL
                    SELECT user_id, first_name, last_name FROM parents
                    UNION ALL
                    SELECT user_id, first_name, last_name FROM nurses
                ) u WHERE user_id = ? LIMIT 1`,
                [String(sender_id)]
            );

            const senderName = senderRows.length > 0 
                ? `${senderRows[0].first_name} ${senderRows[0].last_name}` 
                : 'Someone';

            const pushMessage = safeContent 
                ? (safeContent.length > 60 ? safeContent.substring(0, 57) + '...' : safeContent)
                : (media_url ? `Sent an attachment (${message_type || 'file'})` : 'Sent a new message');

            await notifyUsers({
                sender_id: String(sender_id),
                recipient_ids: [String(receiver_id)],
                title: `New Message from ${senderName}`,
                message: pushMessage,
                type: 'MESSAGE',
                payloadData: { sender_id: String(sender_id), type: 'MESSAGE' }
            });
        }

        res.json({ success: true, message: decryptMessageRows(newMessage[0]), message_id: result.insertId });
    } catch (error) {
        console.error('Database error in /api/messages/send:', error);
        res.status(500).json({ success: false, message: 'Database failed to store message.', error: error.message });
    }
});

// 2. Fetch Chat History / Thread (Both Nurse & Parent)
app.get('/api/messages/:userId/:contactUserId', async (req, res) => {
    const { userId, contactUserId } = req.params;

    try {
        const query = `
            SELECT message_id, sender_id, receiver_id, message_type, content, media_url, is_read, created_at
            FROM messages
            WHERE (sender_id = ? AND receiver_id = ?)
               OR (sender_id = ? AND receiver_id = ?)
            ORDER BY created_at ASC;
        `;
        const [messages] = await pool.query(query, [userId, contactUserId, contactUserId, userId]);
        res.json({ success: true, messages: decryptMessageRows(messages) });
    } catch (err) {
        console.error('Error fetching chat messages:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
});

// 3. Get Total Unread Message Count for Badge
app.get('/api/messages/unread-count/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const query = `
            SELECT COUNT(DISTINCT sender_id) AS unreadCount 
            FROM messages 
            WHERE receiver_id = ? AND is_read = 0;
        `;
        const [rows] = await pool.query(query, [userId]);
        res.json({ success: true, unreadCount: rows[0]?.unreadCount || 0 });
    } catch (err) {
        console.error('Error fetching unread count:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
    }
});

// 4. Mark Messages as Read
app.patch('/api/messages/mark-read', async (req, res) => {
    const { sender_id, receiver_id } = req.body;

    try {
        const query = `
            UPDATE messages 
            SET is_read = 1 
            WHERE sender_id = ? AND receiver_id = ? AND is_read = 0;
        `;
        await pool.query(query, [sender_id, receiver_id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error marking messages read:', err);
        res.status(500).json({ success: false, message: 'Failed to mark read' });
    }
});

// 5. Unsend / Delete an Individual Message
app.delete('/api/messages/:messageId', async (req, res) => {
    const { messageId } = req.params;

    try {
        await pool.query('DELETE FROM messages WHERE message_id = ?', [messageId]);
        res.json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ success: false, message: 'Error deleting message' });
    }
});

// 6. Get Linked Student Contacts for Parent
app.get('/api/parent/:parentId/contacts', async (req, res) => {
    const { parentId } = req.params;

    try {
        const query = `
            SELECT 
                s.student_id,
                s.user_id AS contact_user_id,
                s.first_name,
                s.last_name,
                s.program_id,
                s.year_level,
                s.section,
                'Student' AS role
            FROM parent_student_mapping psm
            JOIN students s ON psm.student_id = s.student_id
            WHERE psm.parent_id = ?;
        `;
        const [contacts] = await pool.query(query, [parentId]);
        res.json({ success: true, contacts });
    } catch (err) {
        console.error('Error fetching parent contacts:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch contacts' });
    }
});


// Express.js Route: GET /api/nurses
app.get('/api/nurses', async (req, res) => {
    try {
        // Query nurses table guaranteeing user_id is retrieved
        const [rows] = await pool.query(
            `SELECT nurse_id, user_id, first_name, last_name 
             FROM nurses 
             WHERE user_id IS NOT NULL`
        );

        return res.json({
            success: true,
            nurses: rows
        });
    } catch (error) {
        console.error('Error fetching nurses:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching nurses' });
    }
});

//Announcement API

// Announcement API with notifyUsers Integration

// ==========================================
// 1. CREATE ANNOUNCEMENT & TRIGGER NOTIFICATIONS
// ==========================================
// Announcement API with notifyUsers Integration

// Helper to format HTML5 datetime-local string (YYYY-MM-DDTHH:mm) to MySQL DATETIME (YYYY-MM-DD HH:mm:ss)
const formatMySQLDateTime = (dtStr) => {
  if (!dtStr) return null;
  const clean = dtStr.replace('T', ' ');
  return clean.length === 16 ? `${clean}:00` : clean;
};

// ==========================================
// 1. CREATE ANNOUNCEMENT & TRIGGER NOTIFICATIONS
// ==========================================
app.post('/api/announcements', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      nurse_id,
      user_id,
      title,
      content,
      target_audience,
      target_program_id = null,
      target_year_level = null,
      start_at,
      expires_at
    } = req.body;

    if (!nurse_id || !title || !content || !target_audience || !start_at || !expires_at) {
      return res.status(400).json({
        success: false,
        message: 'nurse_id, title, content, target_audience, start_at, and expires_at are required.'
      });
    }

    const formattedStartAt = formatMySQLDateTime(start_at);
    const formattedExpiresAt = formatMySQLDateTime(expires_at);

    if (new Date(formattedStartAt) >= new Date(formattedExpiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'Expiration date (expires_at) must be after start date (start_at).'
      });
    }

    const announcement_id = `ANN-${uuidv4()}`;
    const cleanProgramId = target_program_id === '' ? null : target_program_id;
    const cleanYearLevel = target_year_level === '' || target_year_level === null ? null : parseInt(target_year_level, 10);

    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO announcements (
        announcement_id, nurse_id, title, content, target_audience,
        target_program_id, target_year_level, start_at, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [announcement_id, nurse_id, title, content, target_audience, cleanProgramId, cleanYearLevel, formattedStartAt, formattedExpiresAt]
    );

    const targetUserIds = new Set();

    if (target_audience === 'STUDENT' || target_audience === 'BOTH') {
      let studentQuery = `SELECT student_id, user_id FROM students WHERE 1=1`;
      const studentParams = [];

      if (cleanProgramId) {
        studentQuery += ` AND program_id = ?`;
        studentParams.push(cleanProgramId);
      }
      if (cleanYearLevel) {
        studentQuery += ` AND year_level = ?`;
        studentParams.push(cleanYearLevel);
      }

      const [matchingStudents] = await connection.execute(studentQuery, studentParams);

      if (matchingStudents.length > 0) {
        const studentValues = matchingStudents.map(s => [announcement_id, s.student_id]);
        await connection.query(
          `INSERT INTO announcement_target_students (announcement_id, student_id) VALUES ?`,
          [studentValues]
        );
        matchingStudents.forEach(s => { if (s.user_id) targetUserIds.add(s.user_id); });
      }
    }

    if (target_audience === 'PARENT' || target_audience === 'BOTH') {
      let parentQuery = `
        SELECT DISTINCT p.parent_id, p.user_id 
        FROM parents p
        JOIN parent_student_mapping psm ON p.parent_id = psm.parent_id
        JOIN students s ON psm.student_id = s.student_id
        WHERE 1=1
      `;
      const parentParams = [];

      if (cleanProgramId) {
        parentQuery += ` AND s.program_id = ?`;
        parentParams.push(cleanProgramId);
      }
      if (cleanYearLevel) {
        parentQuery += ` AND s.year_level = ?`;
        parentParams.push(cleanYearLevel);
      }

      const [matchingParents] = await connection.execute(parentQuery, parentParams);

      if (matchingParents.length > 0) {
        const parentValues = matchingParents.map(p => [announcement_id, p.parent_id]);
        await connection.query(
          `INSERT INTO announcement_target_parents (announcement_id, parent_id) VALUES ?`,
          [parentValues]
        );
        matchingParents.forEach(p => { if (p.user_id) targetUserIds.add(p.user_id); });
      }
    }

    await connection.commit();

    notifyUsers({
      sender_id: user_id || nurse_id,
      recipient_ids: Array.from(targetUserIds),
      title: `📣 New Announcement: ${title}`,
      message: content.length > 120 ? `${content.substring(0, 117)}...` : content,
      type: 'ANNOUNCEMENT',
      payloadData: { announcement_id, url: '/announcements' }
    }).catch(err => console.error('Error dispatching notifications:', err));

    return res.status(201).json({
      success: true,
      message: 'Announcement created and published successfully.',
      announcement_id
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error creating announcement:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating announcement.',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// ==========================================
// 2. UPDATE ANNOUNCEMENT & REFLECT ON DASHBOARD
// ==========================================
app.put('/api/announcements/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id: announcement_id } = req.params;
    const {
      nurse_id,
      user_id,
      title,
      content,
      target_audience,
      target_program_id = null,
      target_year_level = null,
      start_at,
      expires_at,
      notify_update = false
    } = req.body;

    if (!title || !content || !target_audience || !start_at || !expires_at) {
      return res.status(400).json({
        success: false,
        message: 'title, content, target_audience, start_at, and expires_at are required.'
      });
    }

    const formattedStartAt = formatMySQLDateTime(start_at);
    const formattedExpiresAt = formatMySQLDateTime(expires_at);

    const cleanProgramId = target_program_id === '' ? null : target_program_id;
    const cleanYearLevel = target_year_level === '' || target_year_level === null ? null : parseInt(target_year_level, 10);

    await connection.beginTransaction();

    const [updateResult] = await connection.execute(
      `UPDATE announcements 
       SET title = ?, content = ?, target_audience = ?, target_program_id = ?, 
           target_year_level = ?, start_at = ?, expires_at = ?
       WHERE announcement_id = ?`,
      [title, content, target_audience, cleanProgramId, cleanYearLevel, formattedStartAt, formattedExpiresAt, announcement_id]
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    await connection.execute(`DELETE FROM announcement_target_students WHERE announcement_id = ?`, [announcement_id]);
    await connection.execute(`DELETE FROM announcement_target_parents WHERE announcement_id = ?`, [announcement_id]);

    const targetUserIds = new Set();

    if (target_audience === 'STUDENT' || target_audience === 'BOTH') {
      let studentQuery = `SELECT student_id, user_id FROM students WHERE 1=1`;
      const studentParams = [];

      if (cleanProgramId) {
        studentQuery += ` AND program_id = ?`;
        studentParams.push(cleanProgramId);
      }
      if (cleanYearLevel) {
        studentQuery += ` AND year_level = ?`;
        studentParams.push(cleanYearLevel);
      }

      const [matchingStudents] = await connection.execute(studentQuery, studentParams);

      if (matchingStudents.length > 0) {
        const studentValues = matchingStudents.map(s => [announcement_id, s.student_id]);
        await connection.query(
          `INSERT INTO announcement_target_students (announcement_id, student_id) VALUES ?`,
          [studentValues]
        );
        matchingStudents.forEach(s => { if (s.user_id) targetUserIds.add(s.user_id); });
      }
    }

    if (target_audience === 'PARENT' || target_audience === 'BOTH') {
      let parentQuery = `
        SELECT DISTINCT p.parent_id, p.user_id 
        FROM parents p
        JOIN parent_student_mapping psm ON p.parent_id = psm.parent_id
        JOIN students s ON psm.student_id = s.student_id
        WHERE 1=1
      `;
      const parentParams = [];

      if (cleanProgramId) {
        parentQuery += ` AND s.program_id = ?`;
        parentParams.push(cleanProgramId);
      }
      if (cleanYearLevel) {
        parentQuery += ` AND s.year_level = ?`;
        parentParams.push(cleanYearLevel);
      }

      const [matchingParents] = await connection.execute(parentQuery, parentParams);

      if (matchingParents.length > 0) {
        const parentValues = matchingParents.map(p => [announcement_id, p.parent_id]);
        await connection.query(
          `INSERT INTO announcement_target_parents (announcement_id, parent_id) VALUES ?`,
          [parentValues]
        );
        matchingParents.forEach(p => { if (p.user_id) targetUserIds.add(p.user_id); });
      }
    }

    await connection.commit();

    if (notify_update) {
      notifyUsers({
        sender_id: user_id || nurse_id || null,
        recipient_ids: Array.from(targetUserIds),
        title: `📢 Updated Announcement: ${title}`,
        message: content.length > 120 ? `${content.substring(0, 117)}...` : content,
        type: 'ANNOUNCEMENT',
        payloadData: { announcement_id, url: '/announcements' }
      }).catch(err => console.error('Error dispatching update notifications:', err));
    }

    return res.status(200).json({
      success: true,
      message: 'Announcement updated successfully.'
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error updating announcement:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating announcement.',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// ==========================================
// 3. GET ANNOUNCEMENTS FOR STUDENT DASHBOARD
// ==========================================
app.get('/api/student/dashboard/announcements/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    const query = `
      SELECT DISTINCT 
        a.announcement_id,
        a.nurse_id,
        CONCAT(n.first_name, ' ', n.last_name) AS nurse_name,
        a.title,
        a.content,
        a.target_audience,
        a.start_at,
        a.expires_at,
        a.created_at
      FROM announcements a
      LEFT JOIN nurses n ON a.nurse_id = n.nurse_id
      LEFT JOIN announcement_target_students ats 
             ON a.announcement_id = ats.announcement_id AND ats.student_id = ?
      LEFT JOIN students s ON s.student_id = ?
      WHERE a.target_audience IN ('STUDENT', 'BOTH')
        AND (a.start_at IS NULL OR a.start_at <= NOW())
        AND (a.expires_at IS NULL OR a.expires_at >= NOW())
        AND (
          ats.student_id IS NOT NULL
          OR (
            (a.target_program_id IS NULL OR a.target_program_id = s.program_id)
            AND (a.target_year_level IS NULL OR a.target_year_level = s.year_level)
          )
        )
      ORDER BY a.created_at DESC;
    `;

    const [rows] = await pool.query(query, [studentId, studentId]);

    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching student announcements:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
});

// ==========================================
// 4. GET ANNOUNCEMENTS FOR PARENT DASHBOARD
// ==========================================
app.get('/api/parent/dashboard/announcements/:parentId', async (req, res) => {
  const { parentId } = req.params;

  try {
    const query = `
      SELECT DISTINCT 
        a.announcement_id,
        a.nurse_id,
        CONCAT(n.first_name, ' ', n.last_name) AS nurse_name,
        a.title,
        a.content,
        a.target_audience,
        a.start_at,
        a.expires_at,
        a.created_at
      FROM announcements a
      LEFT JOIN nurses n ON a.nurse_id = n.nurse_id
      LEFT JOIN announcement_target_parents atp 
             ON a.announcement_id = atp.announcement_id AND atp.parent_id = ?
      LEFT JOIN parent_student_mapping psm ON psm.parent_id = ?
      LEFT JOIN announcement_target_students ats 
             ON a.announcement_id = ats.announcement_id AND ats.student_id = psm.student_id
      LEFT JOIN students s ON s.student_id = psm.student_id
      WHERE a.target_audience IN ('PARENT', 'BOTH')
        AND (a.start_at IS NULL OR a.start_at <= NOW())
        AND (a.expires_at IS NULL OR a.expires_at >= NOW())
        AND (
          atp.parent_id IS NOT NULL
          OR ats.student_id IS NOT NULL
          OR (
            (a.target_program_id IS NULL OR a.target_program_id = s.program_id)
            AND (a.target_year_level IS NULL OR a.target_year_level = s.year_level)
          )
        )
      ORDER BY a.created_at DESC;
    `;

    const [rows] = await pool.query(query, [parentId, parentId, parentId]);

    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching parent announcements:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
});

// GET ALL ANNOUNCEMENTS FOR NURSE DASHBOARD ("MANAGE ACTIVE NOTICES" TAB)
app.get('/api/announcements', async (req, res) => {
  try {
    const query = `
      SELECT 
        a.announcement_id,
        a.nurse_id,
        CONCAT(n.first_name, ' ', n.last_name) AS nurse_name,
        a.title,
        a.content,
        a.target_audience,
        a.target_program_id,
        a.target_year_level,
        a.start_at,
        a.expires_at,
        a.created_at
      FROM announcements a
      LEFT JOIN nurses n ON a.nurse_id = n.nurse_id
      ORDER BY a.created_at DESC;
    `;
    
    const [rows] = await pool.query(query);

    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching announcements for nurse:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
});

// ==========================================
// DELETE ANNOUNCEMENT & OPTIONALLY NOTIFY RECIPIENTS
// ==========================================
app.delete('/api/announcements/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id: announcement_id } = req.params;
    const { user_id, notify_cancellation = false } = req.body;

    await connection.beginTransaction();

    // 1. Fetch announcement title and recipient user IDs before deletion
    const [existing] = await connection.execute(
      `SELECT title, content, target_audience FROM announcements WHERE announcement_id = ?`,
      [announcement_id]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    const announcementTitle = existing[0].title;
    const targetUserIds = new Set();

    if (notify_cancellation) {
      // Get student user_ids
      const [students] = await connection.execute(
        `SELECT DISTINCT s.user_id 
         FROM announcement_target_students ats
         JOIN students s ON ats.student_id = s.student_id
         WHERE ats.announcement_id = ? AND s.user_id IS NOT NULL`,
        [announcement_id]
      );
      students.forEach(s => targetUserIds.add(s.user_id));

      // Get parent user_ids
      const [parents] = await connection.execute(
        `SELECT DISTINCT p.user_id 
         FROM announcement_target_parents atp
         JOIN parents p ON atp.parent_id = p.parent_id
         WHERE atp.announcement_id = ? AND p.user_id IS NOT NULL`,
        [announcement_id]
      );
      parents.forEach(p => targetUserIds.add(p.user_id));
    }

    // 2. Delete child records from target mapping tables first
    await connection.execute(`DELETE FROM announcement_target_students WHERE announcement_id = ?`, [announcement_id]);
    await connection.execute(`DELETE FROM announcement_target_parents WHERE announcement_id = ?`, [announcement_id]);

    // 3. Delete the parent announcement record
    const [deleteResult] = await connection.execute(
      `DELETE FROM announcements WHERE announcement_id = ?`,
      [announcement_id]
    );

    if (deleteResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Announcement could not be deleted.' });
    }

    await connection.commit();

    // 4. Send push notification if cancellation alert was requested
    if (notify_cancellation && targetUserIds.size > 0) {
      notifyUsers({
        sender_id: user_id || null,
        recipient_ids: Array.from(targetUserIds),
        title: `🚫 Notice Cancelled: ${announcementTitle}`,
        message: `The campus health announcement "${announcementTitle}" has been cancelled by the school clinic.`,
        type: 'ANNOUNCEMENT',
        payloadData: { announcement_id, action: 'DELETED' }
      }).catch(err => console.error('Error dispatching deletion notifications:', err));
    }

    return res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully.'
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error deleting announcement:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting announcement.',
      error: error.message
    });
  } finally {
    connection.release();
  }
});


app.listen(3001, () => console.log('Server running on port 3001'));