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

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Helper function to hash passwords (or use bcrypt)
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

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

    const pool = mysql.createPool({
        host: "localhost",
        user: "root",
        password: "Yahweh0512",
        database: "ClinicManagementSystem",
        dateStrings: true
});


//Format Number
function formatPhoneNumber(phone) {
    if (!phone) return null;
    let cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
    
    // If phone starts with local '0', replace with default country code
    if (cleaned.startsWith('0')) {
        const countryCode = process.env.DEFAULT_COUNTRY_CODE || '+63';
        cleaned = countryCode + cleaned.substring(1);
    } else if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }
    return cleaned;
}

/**
 * Format local numbers to standard PH format (09171234567)
 */
function formatPhPhoneForIprog(phone) {
    if (!phone) return null;
    let cleaned = phone.trim().replace(/[\s\-\(\)\+]/g, '');

    // Convert 639XXXXXXXXX -> 09XXXXXXXXX
    if (cleaned.startsWith('639')) {
        cleaned = '0' + cleaned.substring(2);
    }
    
    // Ensure it starts with 09 and is 11 digits
    if (/^09\d{9}$/.test(cleaned)) {
        return cleaned;
    }
    
    return null;
}

/**
 * Send SMS using iPROG API
 */
async function sendIprogSms(toPhoneNumber, messageBody) {
    const formattedPhone = formatPhPhoneForIprog(toPhoneNumber);
    
    if (!formattedPhone) {
        throw new Error(`Invalid PH phone number format: ${toPhoneNumber}`);
    }

    const endpoint = process.env.IPROG_SMS_ENDPOINT || 'https://sms.iprogtech.com/api/v1/send_sms';

    // Use URLSearchParams (form-urlencoded) required by iPROG API
    const bodyParams = new URLSearchParams({
        api_token: process.env.IPROG_API_TOKEN,
        phone_number: formattedPhone,
        message: messageBody
    });

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        body: bodyParams.toString()
    });

    // Handle non-200 responses (e.g. 404 Not Found, 401 Unauthorized)
    if (!response.ok) {
        const rawText = await response.text();
        throw new Error(`Endpoint returned HTTP ${response.status}: ${rawText || response.statusText}`);
    }

    const data = await response.json();
    return data;
}

//Access role and Management api
// 1. LOGIN ENDPOINT
// ==================== 1. LOGIN ENDPOINT ====================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

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
        if (password !== user.password_hash) { 
            return res.status(401).json({ success: false, message: "Invalid username or password." });
        }

        // 3. Check account active status
        if (!user.is_active) {
            return res.status(403).json({ success: false, message: "Account is not Active" });
        }

        // 4. Check if using default password ("123")
        const isDefaultPassword = (password === "123" || user.password_hash === "123");

        const userData = {
            id: user.user_id,
            username: user.username,
            role_id: user.role_id,
            role: user.role_name.toLowerCase() 
        };

        let isFormCompleted = false;
        let students = [];
        let isProfileIncomplete = false;

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
                        (SELECT COUNT(*) FROM student_health_information WHERE student_id = ?) AS health_count,
                        (SELECT COUNT(*) FROM emergency_contacts WHERE student_id = ?) AS emergency_count
                `;

                const [rows] = await pool.execute(checkFormsQuery, [studentId, studentId, studentId]);
                const counts = rows[0];

                if (counts.personal_count > 0 && counts.health_count > 0 && counts.emergency_count > 0) {
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

        // Send consolidated payload including default password and profile status
        res.json({
            success: true,
            user: userData,
            isDefaultPassword,
            isProfileIncomplete,
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
    const { username, newPassword } = req.body;

    try {
        const [result] = await pool.execute(
            `UPDATE users SET password_hash = ? WHERE username = ?`,
            [newPassword, username]
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



// 2. --- FORGOT PASSWORD ENDPOINT ---
app.post('/api/forgot-password', async (req, res) => {
    const { username, firstName, lastName } = req.body;

    try {
        const query = `
            SELECT u.password_hash
            FROM users u
            LEFT JOIN students s ON u.user_id = s.user_id
            LEFT JOIN parents p ON u.user_id = p.user_id
            LEFT JOIN nurses n ON u.user_id = n.user_id
            WHERE u.username = ?
            AND (
                (s.first_name = ? AND s.last_name = ?) OR
                (p.first_name = ? AND p.last_name = ?) OR
                (n.first_name = ? AND n.last_name = ?)
            )
        `;

        const [results] = await pool.execute(query, [
            username, 
            firstName, lastName, 
            firstName, lastName, 
            firstName, lastName
        ]);

        if (results.length > 0) {
            res.json({ success: true, password: results[0].password_hash });
        } else {
            res.status(404).json({ success: false, message: "Verification details do not match our records." });
        }

    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ success: false, message: "Internal server database error." });
    }
});

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
app.post('/api/submit-health-form', async (req, res) => {
    const { student_id, personalInfo, healthInfo, emergencyContact } = req.body;
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

        // C. Insert Emergency Contact
        const emergencyQuery = `
            INSERT INTO emergency_contacts 
            (contact_id, student_id, contact_name, relationship, contact_number, address) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const contact_id = uuidv4();
        const emergencyValues = [
            contact_id, student_id, emergencyContact.contact_name, 
            emergencyContact.relationship, emergencyContact.contact_number, emergencyContact.address
        ];
        await connection.execute(emergencyQuery, emergencyValues);

        await connection.commit();
        res.json({ success: true, message: 'Form submitted successfully' });

    } catch (error) {
        await connection.rollback();
        console.error("Transaction error:", error);
        res.status(500).json({ success: false, message: 'Transaction error', error: error.message });
    } finally {
        connection.release();
    }
});

// Helper function to handle empty strings for date/number columns
const parseEmpty = (val) => val === '' || val === undefined ? null : val;

// --- GET PROFILE DATA ---
app.get('/api/profile/:studentId', async (req, res) => {
    const { studentId } = req.params;
    try {
        const [personal] = await pool.execute('SELECT * FROM student_personal_information WHERE student_id = ?', [studentId]);
        const [health] = await pool.execute('SELECT * FROM student_health_information WHERE student_id = ?', [studentId]);
        const [emergency] = await pool.execute('SELECT * FROM emergency_contacts WHERE student_id = ?', [studentId]);

        res.json({
            success: true,
            personalInfo: personal[0] || null,
            healthInfo: health[0] || null,
            emergencyContact: emergency[0] || null
        });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ success: false, message: "Database error." });
    }
});

// --- UPDATE PROFILE DATA ---
app.put('/api/update-profile', async (req, res) => {
    const { student_id, personalInfo, healthInfo, emergencyContact } = req.body;
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

        // 3. Update Emergency Contact
        if (emergencyContact) {
            const emergencyQuery = `
                UPDATE emergency_contacts SET 
                contact_name=?, relationship=?, contact_number=?, address=?
                WHERE student_id=?
            `;
            const e = emergencyContact;
            await connection.execute(emergencyQuery, [
                e.contact_name, e.relationship, e.contact_number, e.address, student_id
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

//Requirement Management API
// 1. Get all students with comprehensive requirement stats
// 1. Get all students with comprehensive requirement stats (SAFE VERSION)
// 1. Get all students with stats filtered by their specific Year Level
// 1. Get all students with dynamic metric auto-evaluation pipeline
app.get('/api/students', async (req, res) => {
    try {
        const [students] = await pool.query(`SELECT * FROM students`);
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

                // DYNAMIC AUTO-EVALUATION PIPELINE
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

// 2. Get combined requirements list matching all statuses for a specific student (SAFE VERSION)
app.get('/api/students/:id/full-requirements', async (req, res) => {
    const studentId = req.params.id; 
    try {
        const [studentRow] = await pool.query('SELECT program_id, year_level FROM students WHERE student_id = ?', [studentId]); 
        if (studentRow.length === 0) return res.status(404).json({ error: 'Student not found' }); 
        
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
            `SELECT requirement_name, status, file_url, nurse_remarks, submitted_at 
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

            // DYNAMIC AUTO-EVALUATION PIPELINE
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

            // Isolated Database Syncer Layer
            try {
                if ((sub.status || 'Pending') !== targetDbStatus) {
                    
                    // FIX: Ensure requirement_name exists in parent table before sync check
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

// 3. Add Special Requirement
app.post('/api/students/:id/special-requirements', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const studentId = req.params.id;
        const { requirement_name, submission_deadline, allow_late_submission, nurse_id } = req.body;

        if (!requirement_name || !submission_deadline) {
            return res.status(400).json({ success: false, error: "Requirement Name and Deadline are required parameters." });
        }

        const lateOverrideValue = allow_late_submission ? 1 : 0;
        const assignedNurseId = nurse_id || 'UNKNOWN_NURSE'; 

        // FIX: Seed the medical_requirements base lookup index within the safe transactional channel 
        await connection.query(
            `INSERT IGNORE INTO medical_requirements (requirement_name) VALUES (?)`,
            [requirement_name]
        );

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
        res.json({ success: true });

    } catch (err) {
        await connection.rollback();
        console.error("CRITICAL ERROR RECORDING SPECIAL REQUIREMENT:", err);
        res.status(500).json({ success: false, error: "Database execution fault: " + err.message });
    } finally {
        connection.release();
    }
});

// 4. Update requirement submission (Removes file attachment if status is rejected or resubmit)
app.put('/api/students/:id/requirements/:reqName', async (req, res) => {
    try {
        const studentId = req.params.id;
        const reqName = req.params.reqName;
        const now = new Date();
        
        const [studentVerification] = await pool.query('SELECT student_id FROM students WHERE student_id = ?', [studentId]);
        if (studentVerification.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: `Database Integrity Error: Student ID "${studentId}" was not found.` 
            });
        }

        const { 
            status = 'Pending', 
            nurse_remarks = '', 
            submission_deadline = null, 
            type = 'Program', 
            config_id = null, 
            override_allow_late_submission = false 
        } = req.body || {};
        
        const targetStatusClean = String(status).toLowerCase().trim();
        const incomingAllowLate = !!override_allow_late_submission;
        
        const incomingDeadline = submission_deadline && !isNaN(new Date(submission_deadline).getTime()) 
            ? new Date(submission_deadline) 
            : null;
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
            return res.status(400).json({ success: false, error: "Pending Reset Restriction: Cannot reset a 'Not Submitted' record to Pending unless you extend the deadline to a future date or enable late submission." });
        }

        if (['submitted late', 'late submitted'].includes(existingStatus) && targetStatusClean === 'pending' && !isExtendedToFuture) {
            return res.status(400).json({ success: false, error: "Pending Reset Restriction: Cannot reset a 'Late Submitted' record to Pending unless you extend the deadline to a future date." });
        }

        if (targetStatusClean === 'resubmit' && !isExtendedToFuture && !incomingAllowLate) {
            return res.status(400).json({ success: false, error: "Resubmission Request Constraint: Setting status to 'Resubmit' requires extending the deadline to a future date or enabling late submission." });
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

        res.json({ success: true });
        
    } catch (err) {
        console.error("CRITICAL BACKEND UPDATE FAILURE:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Delete Special Requirement
app.delete('/api/students/:id/special-requirements/:reqName', async (req, res) => {
    const studentId = req.params.id;
    const reqName = req.params.reqName;
    try {
        await pool.query(`DELETE FROM student_special_requirements WHERE student_id = ? AND requirement_name = ?`, [studentId, reqName]);
        await pool.query(`DELETE FROM student_requirement_submissions WHERE student_id = ? AND requirement_name = ?`, [studentId, reqName]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- COURSE / STRAND MANAGEMENT API ENDPOINTS ---

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

// 8. ADD REQUIREMENT RULE ARCHITECTURE AND AUTOMATICALLY SEED STUDENT SUBMISSIONS
app.post('/api/programs/:programId/requirements', async (req, res) => {
    const { programId } = req.params;
    const { requirement_name, year_level, submission_deadline, allow_late_submission } = req.body;

    if (!requirement_name || !submission_deadline) {
        return res.status(400).json({ error: "Requirement name and deadline are required fields." });
    }

    const trimmedReqName = requirement_name.trim();
    const targetYearLevel = year_level || null;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Step A: Ensure requirement exists in base lookup table
        const checkBaseQuery = `SELECT requirement_name FROM medical_requirements WHERE requirement_name = ?`;
        const [baseExists] = await connection.query(checkBaseQuery, [trimmedReqName]);

        if (baseExists.length === 0) {
            const insertBaseQuery = `INSERT INTO medical_requirements (requirement_name) VALUES (?)`;
            await connection.query(insertBaseQuery, [trimmedReqName]);
        }

        // Step B: Double check if this exact program definition mapping is already present
        const checkMappingQuery = `SELECT config_id FROM program_requirements_config WHERE program_id = ? AND requirement_name = ?`;
        const [mappingExists] = await connection.query(checkMappingQuery, [programId, trimmedReqName]);

        if (mappingExists.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: "This medical requirement already exists inside the targeted program rules." });
        }

        // Step C: Construct unique config mapping row
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

        // Step D: BATCH REFLECT TO SUBMISSIONS TABLE (With explicit submitted_at = NULL patch)
        const seedSubmissionsQuery = `
            INSERT INTO student_requirement_submissions (submission_id, student_id, requirement_name, status, nurse_remarks, file_url, submitted_at)
            SELECT UUID(), s.student_id, ?, 'Pending', '', NULL, NULL
            FROM students s
            WHERE s.program_id = ?
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

        await connection.commit();
        res.status(201).json({ 
            success: true, 
            message: "Program requirement configured and synchronized for all matching tracking profiles.", 
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

// 9. UPDATE EXTANT REQUIREMENT CONFIGURATION PROPERTIES
app.put('/api/programs/:programId/requirements/:configId', async (req, res) => {
    const { programId, configId } = req.params;
    const { requirement_name, year_level, submission_deadline, allow_late_submission } = req.body;

    try {
        const checkBaseQuery = `SELECT requirement_name FROM medical_requirements WHERE requirement_name = ?`;
        const [baseExists] = await pool.query(checkBaseQuery, [requirement_name.trim()]);

        if (baseExists.length === 0) {
            const insertBaseQuery = `INSERT INTO medical_requirements (requirement_name) VALUES (?)`;
            await pool.query(insertBaseQuery, [requirement_name.trim()]);
        }

        const updateConfigQuery = `
            UPDATE program_requirements_config 
            SET requirement_name = ?, year_level = ?, submission_deadline = ?, allow_late_submission = ? 
            WHERE config_id = ? AND program_id = ?
        `;
        
        await pool.query(updateConfigQuery, [
            requirement_name.trim(), 
            year_level || null,
            submission_deadline, 
            allow_late_submission ? 1 : 0, 
            configId, 
            programId
        ]);

        res.json({ message: "Requirement rules modification successfully applied." });
    } catch (error) {
        console.error("Failed executing configuration update parameters:", error);
        res.status(500).json({ error: "Database exception error routing updates." });
    }
});

// 10. REMOVE CONFIGURATION RULE WITH AUTOMATIC TRACKER CASCADE CLEANUP
app.delete('/api/programs/:programId/requirements/:configId', async (req, res) => {
    const { programId, configId } = req.params;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Step 1: Query the config rows to fetch mapping indicators before it drops
        const [configRows] = await connection.query(
            `SELECT requirement_name, year_level FROM program_requirements_config WHERE config_id = ? AND program_id = ?`,
            [configId, programId]
        );

        if (configRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, error: "Program requirement configuration not found." });
        }

        const { requirement_name, year_level } = configRows[0];

        // Step 2: Delete corresponding tracking elements using synchronized filters matching user view profiles
        await connection.query(
            `DELETE srs FROM student_requirement_submissions srs
             INNER JOIN students s ON srs.student_id = s.student_id
             WHERE s.program_id = ? 
               AND srs.requirement_name = ?
               AND (? IS NULL OR s.year_level = ? OR s.year_level LIKE CONCAT('%', ?, '%'))`,
            [programId, requirement_name, year_level, year_level, year_level]
        );

        // Step 3: Remove lingering custom student overrides referencing this rule config key
        await connection.query(
            `DELETE FROM student_deadline_overrides WHERE config_id = ?`,
            [configId]
        );

        // Step 4: Drop structural definition constraint out of config dashboard registry
        await connection.query(
            `DELETE FROM program_requirements_config WHERE config_id = ? AND program_id = ?`,
            [configId, programId]
        );

        await connection.commit();
        res.json({ success: true, message: "Program rule configuration and related student tracking records dropped successfully." });

    } catch (error) {
        await connection.rollback();
        console.error("Failed removal operations processing database entry:", error);
        res.status(500).json({ error: "Database transaction cascade failure: " + error.message });
    } finally {
        connection.release();
    }
});

//Student Upload Requirements
app.post('/api/students/:id/requirements/:reqName/submit', upload.single('file'), async (req, res) => {
    const studentId = req.params.id;
    const reqName = req.params.reqName;

    if (!req.file) {
        return res.status(400).json({ success: false, error: "A local file upload stream is required." });
    }

    const file_url = `http://localhost:3001/uploads/${req.file.filename}`;

    try {
        const [studentRow] = await pool.query('SELECT program_id, year_level FROM students WHERE student_id = ?', [studentId]); 
        if (studentRow.length === 0) {
            return res.status(404).json({ success: false, error: 'Student record could not be verified.' }); 
        }
        
        const programId = studentRow[0].program_id; 
        const studentYearLevel = studentRow[0].year_level; 
        const now = new Date();

        const [progReqs] = await pool.query(
            `SELECT 
                COALESCE(sdo.override_deadline, prc.submission_deadline) AS submission_deadline, 
                COALESCE(sdo.override_allow_late_submission, prc.allow_late_submission) AS allow_late_submission
             FROM program_requirements_config prc
             LEFT JOIN student_deadline_overrides sdo ON sdo.student_id = ? AND sdo.config_id = prc.config_id
             WHERE prc.program_id = ? AND prc.requirement_name = ?
               AND (prc.year_level IS NULL OR ? LIKE CONCAT('%', prc.year_level, '%') OR prc.year_level = ?)`, 
            [studentId, programId, reqName, studentYearLevel, studentYearLevel] 
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

        // Gate: reject if deadline has passed AND late submission is not enabled
        if (isLate && !allowLate) {
            return res.status(400).json({ 
                success: false, 
                error: `Submission rejected. The deadline (${deadlineDate.toLocaleDateString()}) has passed and late submissions are locked.` 
            });
        }

        const targetStatus = isLate ? 'Submitted Late' : 'Submitted';
        const isLateTinyInt = isLate ? 1 : 0;

        const [checkExisting] = await pool.query(
            `SELECT submission_id FROM student_requirement_submissions WHERE student_id = ? AND requirement_name = ?`,
            [studentId, reqName]
        );

        if (checkExisting.length > 0) {
            await pool.query(
                `UPDATE student_requirement_submissions 
                 SET file_url = ?, status = ?, is_late = ?, submitted_at = NOW() 
                 WHERE student_id = ? AND requirement_name = ?`,
                [file_url, targetStatus, isLateTinyInt, studentId, reqName]
            );
        } else {
            await pool.query(
                `INSERT INTO student_requirement_submissions 
                 (submission_id, student_id, requirement_name, file_url, status, is_late, submitted_at, nurse_remarks) 
                 VALUES (UUID(), ?, ?, ?, ?, ?, NOW(), '')`,
                [studentId, reqName, file_url, targetStatus, isLateTinyInt]
            );
        }

        res.json({ success: true, message: "Requirement uploaded successfully!", status: targetStatus });

    } catch (err) {
        console.error("Critical student submission channel fault:", err.message);
        res.status(500).json({ success: false, error: "Internal processing error: " + err.message });
    }
});


//Health Record Api
// 1. GET ALL STUDENTS WITH SEARCH FILTERS
// GET ALL STUDENTS WITH A SINGLE GLOBAL SEARCH TERM
app.get('/api/health-records/students', async (req, res) => {
    const { search } = req.query;
    
    let query = `
        SELECT 
            student_id, 
            first_name, 
            last_name, 
            program_id, 
            year_level 
        FROM students 
        WHERE 1=1
    `;
    const params = [];

    // If there is a search term, match it against multiple student detail attributes
    if (search && search.trim() !== '') {
        const searchWildcard = `%${search}%`;
        query += ` AND (
            first_name LIKE ? 
            OR last_name LIKE ? 
            OR student_id LIKE ? 
            OR program_id LIKE ?
        )`;
        params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard);
    }

    query += ` ORDER BY last_name ASC`;

    try {
        const [rows] = await pool.execute(query, params);
        res.json({ success: true, students: rows });
    } catch (error) {
        console.error("Error searching student records:", error);
        res.status(500).json({ success: false, message: "Database search execution failure." });
    }
});

// 2. GET SINGLE STUDENT BASIC DETAILS BY STUDENT_ID (Direct Header Lookup)
app.get('/api/health-records/student-header/:studentId', async (req, res) => {
    const { studentId } = req.params;

    const query = `
        SELECT 
            student_id, 
            first_name, 
            last_name, 
            program_id, 
            year_level 
        FROM students 
        WHERE student_id = ?
    `;

    try {
        const [rows] = await pool.execute(query, [studentId]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Student target master entry not found." });
        }
        res.json({ success: true, student: rows[0] });
    } catch (error) {
        console.error("Error fetching single student record context header:", error);
        res.status(500).json({ success: false, message: "Database read failure." });
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

const normalizeMedicinePayload = (body) => {
  const isDiscrete = DISCRETE_UNITS.includes(body.strength_unit_of_measure);
  return {
    ...body,
    strength_unit_value: isDiscrete ? 1.00 : parseFloat(body.strength_unit_value),
    avg_dosage_consumption_value: isDiscrete ? 1.00 : (parseFloat(body.avg_dosage_consumption_value) || 0.00),
    avg_dosage_consumption_unit_of_measure: isDiscrete ? body.strength_unit_of_measure : body.avg_dosage_consumption_unit_of_measure
  };
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
    `SELECT b.batch_id, b.current_stock, b.remaining_volume, m.strength_unit_value, m.strength_unit_of_measure
     FROM medicine_inventory_batches b
     JOIN medicines m ON b.medicine_id = m.medicine_id
     WHERE b.batch_id = ?`,
    [batchId]
  );

  if (!rows.length) throw new Error('Batch not found');
  
  const { strength_unit_of_measure } = rows[0];
  const isDiscrete = DISCRETE_UNITS.includes(strength_unit_of_measure);

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

// 2. Fetch medicines
app.get('/api/medicines', async (req, res) => {
  try {
    const query = `
      SELECT m.*, GROUP_CONCAT(mi.complaint_id SEPARATOR ',') AS complaint_ids
      FROM medicines m
      LEFT JOIN medicine_indications mi ON m.medicine_id = mi.medicine_id
      GROUP BY m.medicine_id
      ORDER BY m.generic_name ASC
    `;
    const [rows] = await pool.execute(query);
    
    const formattedRows = rows.map(row => {
      const convertedStrength = autoConvertUnit(row.strength_unit_value, row.strength_unit_of_measure);
      const convertedAvg = autoConvertUnit(row.avg_dosage_consumption_value, row.avg_dosage_consumption_unit_of_measure);
      return {
        ...row,
        display_strength_value: convertedStrength.value,
        display_strength_unit: convertedStrength.unit,
        display_avg_value: convertedAvg.value,
        display_avg_unit: convertedAvg.unit,
        complaint_ids: row.complaint_ids ? row.complaint_ids.split(',') : []
      };
    });
    
    res.json(formattedRows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Fetch inventory
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
        m.low_stock_level, m.critical_stock_level, m.adequate_stock_level,
        GROUP_CONCAT(c.complaint_name SEPARATOR ', ') AS connected_complaints
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

// 4. Create medicine
app.post('/api/medicines', async (req, res) => {
  const payload = normalizeMedicinePayload(req.body);
  const {
    generic_name, brand_name, dosage_form,
    strength_unit_value, strength_unit_of_measure,
    avg_dosage_consumption_value, avg_dosage_consumption_unit_of_measure,
    low_stock_level, critical_stock_level, adequate_stock_level,
    complaint_ids
  } = payload;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const medicine_id = uuidv4().substring(0, 45);

    await connection.execute(
      `INSERT INTO medicines (
        medicine_id, generic_name, brand_name, dosage_form,
        strength_unit_value, strength_unit_of_measure,
        avg_dosage_consumption_value, avg_dosage_consumption_unit_of_measure,
        low_stock_level, critical_stock_level, adequate_stock_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        medicine_id, generic_name.trim(), brand_name.trim(), dosage_form,
        strength_unit_value, strength_unit_of_measure,
        avg_dosage_consumption_value, avg_dosage_consumption_unit_of_measure,
        low_stock_level || 0, critical_stock_level || 0, adequate_stock_level || 0
      ]
    );

    if (complaint_ids?.length) {
      for (const complaint_id of complaint_ids) {
        await connection.execute(
          'INSERT INTO medicine_indications (medicine_id, complaint_id) VALUES (?, ?)',
          [medicine_id, complaint_id]
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

// 5. Update medicine
app.put('/api/medicines/:id', async (req, res) => {
  const { id } = req.params;
  const payload = normalizeMedicinePayload(req.body);
  const {
    generic_name, brand_name, dosage_form,
    strength_unit_value, strength_unit_of_measure,
    avg_dosage_consumption_value, avg_dosage_consumption_unit_of_measure,
    low_stock_level, critical_stock_level, adequate_stock_level,
    complaint_ids
  } = payload;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE medicines SET 
        generic_name = ?, brand_name = ?, dosage_form = ?,
        strength_unit_value = ?, strength_unit_of_measure = ?,
        avg_dosage_consumption_value = ?, avg_dosage_consumption_unit_of_measure = ?,
        low_stock_level = ?, critical_stock_level = ?, adequate_stock_level = ?
      WHERE medicine_id = ?`,
      [
        generic_name.trim(), brand_name.trim(), dosage_form,
        strength_unit_value, strength_unit_of_measure,
        avg_dosage_consumption_value, avg_dosage_consumption_unit_of_measure,
        low_stock_level || 0, critical_stock_level || 0, adequate_stock_level || 0,
        id
      ]
    );

    await connection.execute('DELETE FROM medicine_indications WHERE medicine_id = ?', [id]);

    if (complaint_ids?.length) {
      for (const complaint_id of complaint_ids) {
        await connection.execute(
          'INSERT INTO medicine_indications (medicine_id, complaint_id) VALUES (?, ?)',
          [id, complaint_id]
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
      'SELECT strength_unit_value, strength_unit_of_measure FROM medicines WHERE medicine_id = ?', 
      [medicine_id]
    );
    if (meds.length === 0) return res.status(404).json({ error: 'Medicine reference not found.' });

    const { strength_unit_value, strength_unit_of_measure } = meds[0];
    const isDiscrete = DISCRETE_UNITS.includes(strength_unit_of_measure);

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
      `SELECT m.strength_unit_value, m.strength_unit_of_measure FROM medicine_inventory_batches b 
       JOIN medicines m ON b.medicine_id = m.medicine_id WHERE b.batch_id = ?`,
      [id]
    );

    if (meds.length > 0) {
      const { strength_unit_value, strength_unit_of_measure } = meds[0];
      const isDiscrete = DISCRETE_UNITS.includes(strength_unit_of_measure);
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

app.post('/api/batches', async (req, res) => {
  const { medicine_id, expiration_date, current_stock, remaining_volume } = req.body;

  try {
    const [meds] = await pool.execute(
      'SELECT strength_unit_value, strength_unit_of_measure FROM medicines WHERE medicine_id = ?', 
      [medicine_id]
    );
    if (meds.length === 0) return res.status(404).json({ error: 'Medicine reference not found.' });

    const { strength_unit_value, strength_unit_of_measure } = meds[0];
    const isDiscrete = DISCRETE_UNITS.includes(strength_unit_of_measure);

    let finalVolume;
    if (isDiscrete) {
      finalVolume = 1; // Default value in database for discrete items
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
app.get('/api/students/direct', async (req, res) => {
  const { search } = req.query;
  try {
    if (!search || !search.trim()) return res.json([]);
    
    const queryStr = `
      SELECT student_id, first_name, last_name 
      FROM students 
      WHERE CONCAT(first_name, ' ', last_name) LIKE ? 
         OR CONCAT(last_name, ' ', first_name) LIKE ? 
         OR student_id LIKE ? 
      LIMIT 10
    `;
    const wildcard = `%${search.trim()}%`;
    const [rows] = await pool.execute(queryStr, [wildcard, wildcard, wildcard]);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database querying error encountered.' });
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
        m.avg_dosage_consumption_value,
        m.avg_dosage_consumption_unit_of_measure
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
          'Direct Dispensation' AS dispensation_type
        FROM direct_dispensation d
        JOIN students s ON d.student_id = s.student_id
        JOIN medicine_inventory_batches b ON d.batch_id = b.batch_id
        JOIN medicines m ON b.medicine_id = m.medicine_id

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
          'Consultation Dispensation' AS dispensation_type
        FROM consultation_dispensation c
        JOIN clinic_visits v ON c.visit_id = v.visit_id
        JOIN students s ON v.student_id = s.student_id
        JOIN medicine_inventory_batches b ON c.batch_id = b.batch_id
        JOIN medicines m ON b.medicine_id = m.medicine_id
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

// Core Dispensation POST Handler with Unit Normalization
app.post('/api/dispensation', async (req, res) => {
  const { 
    student_id, 
    nurse_id, 
    batch_id, 
    dosage_consumption_unit_value, 
    dosage_consumption_unit_of_measure 
  } = req.body;

  const numericVal = parseFloat(dosage_consumption_unit_value);

  if (isNaN(numericVal) || numericVal <= 0) {
    return res.status(400).json({ error: 'Dosage value must be greater than zero.' });
  }

  // Include 'pcs.' so piece deductions lower remaining_volume
  const measuredUnits = ['mg', 'g', 'mcg', 'mL', 'L', 'pcs.'];
  const isMeasured = measuredUnits.includes(dosage_consumption_unit_of_measure);

  if (!isMeasured && !Number.isInteger(numericVal)) {
    return res.status(400).json({ 
      error: 'Quantity for discrete items (e.g. tablets, capsules) must be a whole integer.' 
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [batchRows] = await connection.execute(
      `SELECT mib.current_stock, mib.remaining_volume, mib.expiration_date, 
              m.strength_unit_value, m.strength_unit_of_measure 
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

    if (expirationDate < new Date()) {
      await connection.rollback();
      return res.status(400).json({ error: 'Cannot dispense medicine from an expired batch.' });
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

    const direct_dispense_id = uuidv4().substring(0, 45); 
    await connection.execute(
      `INSERT INTO direct_dispensation 
       (direct_dispense_id, student_id, nurse_id, batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        direct_dispense_id, 
        student_id, 
        nurse_id, 
        batch_id, 
        numericVal, 
        dosage_consumption_unit_of_measure
      ]
    );

    await connection.commit();
    res.status(201).json({ 
      success: true, 
      message: 'Transaction posted successfully.', 
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

//Visit Log Consultation API
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

// GET: Retrieve available medicine batches with parent medicine details
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
                m.strength_unit_value,
                m.strength_unit_of_measure,
                m.avg_dosage_consumption_value,
                m.avg_dosage_consumption_unit_of_measure
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

// GET: Retrieve history of all clinic visits
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
            ORDER BY cv.visit_date DESC, cv.time_in DESC
        `;
        const [rows] = await pool.execute(sql);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch clinic visits" });
    }
});

// POST: Add a new Visit Log Consultation with complete dispensation logic and SMS notification
app.post('/api/clinic-visits', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const {
            student_id,
            nurse_id,
            complaint_id,
            visit_date,
            time_in,
            time_out,
            temperature,
            respiratory_rate,
            pulse_rate,
            blood_pressure,
            nursing_intervention,
            health_advice,
            batch_id,
            dosage_consumption_unit_value,
            dosage_consumption_unit_of_measure
        } = req.body;

        const visit_id = 'VISIT-' + Math.random().toString(36).substr(2, 9).toUpperCase();

        const visitSql = `
            INSERT INTO clinic_visits (
                visit_id, student_id, nurse_id, complaint_id, visit_date, 
                time_in, time_out, temperature, respiratory_rate, pulse_rate, 
                blood_pressure, nursing_intervention, health_advice
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.execute(visitSql, [
            visit_id, student_id, nurse_id || null, complaint_id || null, visit_date,
            time_in || null, time_out || null, temperature || null, respiratory_rate || null,
            pulse_rate || null, blood_pressure || null, nursing_intervention || null, health_advice || null
        ]);

        // Handle Medicine Dispensation
        if (batch_id && dosage_consumption_unit_value) {
            const numericVal = parseFloat(dosage_consumption_unit_value);

            if (isNaN(numericVal) || numericVal <= 0) {
                throw new Error('Dosage value must be greater than zero.');
            }

            const continuousUnits = ['mg', 'g', 'mcg', 'mL', 'L'];
            const volumeUnits = ['mg', 'g', 'mcg', 'mL', 'L', 'pcs.'];

            const isContinuous = continuousUnits.includes(dosage_consumption_unit_of_measure);
            const usesVolume = volumeUnits.includes(dosage_consumption_unit_of_measure);

            if (!isContinuous && !Number.isInteger(numericVal)) {
                throw new Error('Quantity for discrete items must be a whole integer.');
            }

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

            const dispensation_id = 'DISP-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            await connection.execute(
                `INSERT INTO consultation_dispensation 
                 (consultation_dispense_id, visit_id, batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at) 
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [dispensation_id, visit_id, batch_id, numericVal, dosage_consumption_unit_of_measure]
            );
        }

        // SMS Notification Logic
        let smsNotificationSent = false;
        try {
            const smsDetailsSql = `
                SELECT 
                    s.first_name AS student_first_name,
                    s.last_name AS student_last_name,
                    p.primary_phone,
                    cc.complaint_name,
                    cv.nursing_intervention,
                    cv.health_advice,
                    cd.dosage_consumption_unit_value,
                    cd.dosage_consumption_unit_of_measure,
                    CONCAT(m.brand_name, ' (', m.generic_name, ')') AS medicine_name
                FROM clinic_visits cv
                JOIN students s ON cv.student_id = s.student_id
                LEFT JOIN parent_student_mapping psm ON s.student_id = psm.student_id
                LEFT JOIN parents p ON psm.parent_id = p.parent_id
                LEFT JOIN chief_complaints cc ON cv.complaint_id = cc.complaint_id
                LEFT JOIN consultation_dispensation cd ON cv.visit_id = cd.visit_id
                LEFT JOIN medicine_inventory_batches mib ON cd.batch_id = mib.batch_id
                LEFT JOIN medicines m ON mib.medicine_id = m.medicine_id
                WHERE cv.visit_id = ?
            `;

            const [detailsRows] = await pool.execute(smsDetailsSql, [visit_id]);

            if (detailsRows.length > 0 && detailsRows[0].primary_phone) {
                const info = detailsRows[0];
                const studentFullName = `${info.student_first_name} ${info.student_last_name}`;
                const complaintName = info.complaint_name || 'General Checkup';
                const interventionText = info.nursing_intervention || 'None';
                const healthAdviceText = info.health_advice || 'None';
                const medicineGiven = (info.dosage_consumption_unit_value && info.medicine_name)
                    ? `${info.dosage_consumption_unit_value} ${info.dosage_consumption_unit_of_measure} of ${info.medicine_name}`
                    : 'None';

                const smsMessage = 
                    `${studentFullName} visited the clinic because of ${complaintName}.\n\n` +
                    `Other Details:\n` +
                    `Nursing intervention: ${interventionText}\n` +
                    `health_advice: ${healthAdviceText}\n` +
                    `medicine given: ${medicineGiven}`;

                await sendIprogSms(info.primary_phone, smsMessage);
                smsNotificationSent = true;
            }
        } catch (smsError) {
            console.error('[iPROG SMS Error] Failed to send SMS:', smsError.message);
        }

        await connection.commit();
        res.status(201).json({ 
            success: true, 
            message: smsNotificationSent 
                ? "Consultation logged and parent notified via SMS!" 
                : "Consultation logged successfully (SMS notification failed or skipped).",
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
        res.json({ success: true, message: "Time out updated successfully!" });
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
        temperature,
        respiratory_rate,
        pulse_rate,
        blood_pressure,
        nursing_intervention,
        health_advice,
        batch_id,
        dosage_consumption_unit_value,
        dosage_consumption_unit_of_measure
    } = req.body;

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const visitQuery = `
            UPDATE clinic_visits 
            SET 
                time_in = COALESCE(?, time_in),
                time_out = ?,
                complaint_id = ?,
                temperature = ?,
                respiratory_rate = ?,
                pulse_rate = ?,
                blood_pressure = ?,
                nursing_intervention = ?,
                health_advice = ?
            WHERE visit_id = ?
        `;

        await connection.execute(visitQuery, [
            time_in,
            time_out || null,
            complaint_id || null,
            temperature || null,
            respiratory_rate || null,
            pulse_rate || null,
            blood_pressure || null,
            nursing_intervention || null,
            health_advice || null,
            id
        ]);

        if (batch_id && dosage_consumption_unit_value) {
            const numericVal = parseFloat(dosage_consumption_unit_value);

            if (isNaN(numericVal) || numericVal <= 0) {
                throw new Error('Dosage value must be greater than zero.');
            }

            const continuousUnits = ['mg', 'g', 'mcg', 'mL', 'L'];
            const volumeUnits = ['mg', 'g', 'mcg', 'mL', 'L', 'pcs.'];

            const isContinuous = continuousUnits.includes(dosage_consumption_unit_of_measure);
            const usesVolume = volumeUnits.includes(dosage_consumption_unit_of_measure);

            if (!isContinuous && !Number.isInteger(numericVal)) {
                throw new Error('Quantity for discrete items must be a whole integer.');
            }

            const [existingDisp] = await connection.execute(
                `SELECT consultation_dispense_id FROM consultation_dispensation WHERE visit_id = ?`,
                [id]
            );

            if (existingDisp.length === 0) {
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

                const dispensation_id = 'DISP-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                await connection.execute(
                    `INSERT INTO consultation_dispensation 
                     (consultation_dispense_id, visit_id, batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at) 
                     VALUES (?, ?, ?, ?, ?, NOW())`,
                    [dispensation_id, id, batch_id, numericVal, dosage_consumption_unit_of_measure]
                );
            }
        }

        await connection.commit();
        res.json({ success: true, message: 'Documentation saved successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error('Error updating visit documentation:', error);
        res.status(400).json({ success: false, error: error.message || 'Database update failed' });
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

function getBaseUnitLabel(unit, dosageForm) {
  if (!unit) return dosageForm || 'units';
  const u = unit.toLowerCase().trim();
  if (['g', 'mg', 'mcg'].includes(u)) return 'mg';
  if (['l', 'ml'].includes(u)) return 'mL';
  return unit;
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

// 1. Health Trends API
app.get('/api/health-trends', async (req, res) => {
  try {
    const filterType = req.query.filterType || 'current';
    let targetDate = new Date();

    if (req.query.date) {
      const dateParts = req.query.date.split('-');
      if (dateParts.length === 3) {
        const tempDate = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
        if (!isNaN(tempDate.getTime())) targetDate = tempDate;
      } else if (dateParts.length === 2) {
        const tempDate = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, 1);
        if (!isNaN(tempDate.getTime())) targetDate = tempDate;
      } else {
        const tempDate = new Date(req.query.date);
        if (!isNaN(tempDate.getTime())) targetDate = tempDate;
      }
    }

    const targetYear = targetDate.getFullYear();

    const [complaints] = await pool.query(`SELECT complaint_name FROM chief_complaints`);
    const complaintNames = complaints.map(c => c.complaint_name);

    let startDate, endDate, periodLabel, timelineLabel = '';
    let graphData = [];
    let averages = {};

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (filterType === 'current' || filterType === 'weekly') {
      startDate = startOfMonth(targetDate);
      endDate = endOfMonth(targetDate);
      periodLabel = `Weekly Overview: ${format(startDate, 'MMMM yyyy')}`;
      timelineLabel = `Weekly breakdown of complaints for ${format(startDate, 'MMMM yyyy')}`;

      const totalDays = endDate.getDate();
      const numWeeks = totalDays > 28 ? 5 : 4;
      const monthAbbr = format(startDate, 'MMM');
      
      for (let i = 1; i <= numWeeks; i++) {
        const startDay = (i - 1) * 7 + 1;
        const endDay = i === numWeeks ? totalDays : i * 7;
        const weekLabel = `W${i} (${monthAbbr} ${startDay}-${endDay})`;
        
        const weekObj = { name: weekLabel };
        complaintNames.forEach(name => { weekObj[name] = 0; });
        graphData.push(weekObj);
      }

      const [visits] = await pool.query(`
        SELECT cv.visit_date, cc.complaint_name 
        FROM clinic_visits cv
        JOIN chief_complaints cc ON cv.complaint_id = cc.complaint_id
        WHERE cv.visit_date BETWEEN ? AND ?
      `, [formatDate(startDate), formatDate(endDate)]);

      visits.forEach(visit => {
        const day = new Date(visit.visit_date).getDate();
        let weekIndex = Math.floor((day - 1) / 7);
        if (weekIndex >= numWeeks) weekIndex = numWeeks - 1;

        const name = visit.complaint_name;
        if (graphData[weekIndex] && name in graphData[weekIndex]) {
          graphData[weekIndex][name]++;
        }
      });
    } else if (filterType === 'yearly') {
      startDate = startOfYear(targetDate);
      endDate = endOfYear(targetDate);
      periodLabel = `Yearly Overview: ${targetYear}`;
      timelineLabel = `All months breakdown for the year ${targetYear}`;

      for (let i = 0; i < 12; i++) {
        const monthObj = { name: monthNames[i] };
        complaintNames.forEach(name => { monthObj[name] = 0; });
        graphData.push(monthObj);
      }

      const [visits] = await pool.query(`
        SELECT cv.visit_date, cc.complaint_name 
        FROM clinic_visits cv
        JOIN chief_complaints cc ON cv.complaint_id = cc.complaint_id
        WHERE cv.visit_date BETWEEN ? AND ?
      `, [formatDate(startDate), formatDate(endDate)]);

      visits.forEach(visit => {
        const m = new Date(visit.visit_date).getMonth();
        const name = visit.complaint_name;
        if (graphData[m] && name in graphData[m]) {
          graphData[m][name]++;
        }
      });
    }

    const { avgStartDate, avgEndDate, avgDivisor, averagesLabel } = getAverageDateWindow(targetDate);

    const [avgCounts] = await pool.query(`
      SELECT cc.complaint_name, COUNT(*) as count
      FROM clinic_visits cv
      JOIN chief_complaints cc ON cv.complaint_id = cc.complaint_id
      WHERE cv.visit_date BETWEEN ? AND ?
      GROUP BY cc.complaint_name
    `, [avgStartDate, avgEndDate]);

    const avgMap = {};
    avgCounts.forEach(row => {
      avgMap[row.complaint_name] = row.count;
    });

    complaintNames.forEach(name => {
      const total = avgMap[name] || 0;
      averages[name] = parseFloat((total / avgDivisor).toFixed(1));
    });

    res.json({
      periodLabel,
      timelineLabel,
      averagesLabel,
      complaintsList: complaintNames,
      data: graphData,
      averages: Object.keys(averages).length > 0 ? averages : null
    });

  } catch (error) {
    console.error("Error fetching health trends:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// 2. Medicine Dispensed Overview API
app.get('/api/medicine-dispensed-overview', async (req, res) => {
  try {
    const filterType = req.query.filterType || 'current';
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
        strength_unit_of_measure
      FROM medicines 
      ORDER BY generic_name ASC
    `);

    const medicinesList = medicines.map(m => m.medicine_name);
    const medicineUnits = {};
    medicines.forEach(m => {
      medicineUnits[m.medicine_name] = getBaseUnitLabel(m.strength_unit_of_measure, m.dosage_form);
    });

    let startDate, endDate, periodLabel, timelineLabel = '';
    let graphData = [];
    let averages = {};

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (filterType === 'current' || filterType === 'weekly') {
      startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
      
      const monthFormatted = targetDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      periodLabel = `Weekly Dispense Overview: ${monthFormatted}`;
      timelineLabel = `Weekly breakdown of medicine dispensations for ${monthFormatted}`;

      const totalDays = endDate.getDate();
      const numWeeks = totalDays > 28 ? 5 : 4;
      const monthAbbr = targetDate.toLocaleString('default', { month: 'short' });

      for (let i = 1; i <= numWeeks; i++) {
        const startDay = (i - 1) * 7 + 1;
        const endDay = i === numWeeks ? totalDays : i * 7;
        const weekLabel = `W${i} (${monthAbbr} ${startDay}-${endDay})`;

        const weekObj = { name: weekLabel };
        medicinesList.forEach(name => { weekObj[name] = 0; });
        graphData.push(weekObj);
      }

      const [dispensations] = await pool.query(`
        SELECT 
          d.dispensed_at,
          CONCAT(m.generic_name, ' (', m.brand_name, ')') AS medicine_name,
          d.dosage_consumption_unit_value,
          d.dosage_consumption_unit_of_measure
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
        const baseVal = toBaseValue(item.dosage_consumption_unit_value, item.dosage_consumption_unit_of_measure);
        if (graphData[weekIndex] && name in graphData[weekIndex]) {
          graphData[weekIndex][name] = parseFloat((graphData[weekIndex][name] + baseVal).toFixed(2));
        }
      });
    } else if (filterType === 'yearly') {
      startDate = new Date(targetYear, 0, 1);
      endDate = new Date(targetYear, 11, 31);
      periodLabel = `Yearly Dispense Overview: ${targetYear}`;
      timelineLabel = `All months breakdown of dispensations for the year ${targetYear}`;

      for (let i = 0; i < 12; i++) {
        const monthObj = { name: monthNames[i] };
        medicinesList.forEach(name => { monthObj[name] = 0; });
        graphData.push(monthObj);
      }

      const [dispensations] = await pool.query(`
        SELECT 
          d.dispensed_at,
          CONCAT(m.generic_name, ' (', m.brand_name, ')') AS medicine_name,
          d.dosage_consumption_unit_value,
          d.dosage_consumption_unit_of_measure
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
        const baseVal = toBaseValue(item.dosage_consumption_unit_value, item.dosage_consumption_unit_of_measure);
        if (graphData[m] && name in graphData[m]) {
          graphData[m][name] = parseFloat((graphData[m][name] + baseVal).toFixed(2));
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
        d.dosage_consumption_unit_of_measure
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
      const baseVal = toBaseValue(row.dosage_consumption_unit_value, row.dosage_consumption_unit_of_measure);
      const key = row.medicine_name.trim();
      totalBaseDispensedMap[key] = (totalBaseDispensedMap[key] || 0) + baseVal;
    });

    medicinesList.forEach(name => {
      const key = name.trim();
      const totalBase = totalBaseDispensedMap[key] || 0;
      averages[name] = parseFloat((totalBase / avgDivisor).toFixed(1));
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
app.get('/api/predictive-medicine', async (req, res) => {
  try {
    const currentDate = new Date();
    let targetMonthDate;

    if (req.query.month) {
      const [y, m] = req.query.month.split('-');
      if (y && m) targetMonthDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    } else {
      // Default to 1st day of next month
      targetMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }

    // --- RESTRICTION: Limit selection to max next month ---
    const maxAllowedDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const targetNormalized = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), 1);

    if (targetNormalized > maxAllowedDate) {
      return res.status(400).json({ 
        error: "Predictive medicine demand cannot be viewed beyond the next month." 
      });
    }

    // Use unified getAverageDateWindow(currentDate) so historical baseline matches Medicine Dispensed Overview EXACTLY
    const { avgStartDate, avgEndDate, avgDivisor } = getAverageDateWindow(currentDate);

    const avgStartDateTime = `${avgStartDate} 00:00:00`;
    const avgEndDateTime = `${avgEndDate} 23:59:59`;

    // 1. Fetch complaint counts for chief complaint calculations
    const [complaintCounts] = await pool.query(`
      SELECT cc.complaint_name, COUNT(*) as total_count
      FROM clinic_visits cv
      JOIN chief_complaints cc ON cv.complaint_id = cc.complaint_id
      WHERE cv.visit_date BETWEEN ? AND ?
      GROUP BY cc.complaint_name
    `, [avgStartDateTime, avgEndDateTime]);

    const complaintAveragesMap = {};
    complaintCounts.forEach(row => {
      complaintAveragesMap[row.complaint_name] = row.total_count / avgDivisor;
    });

    // 2. Fetch historical dispensation totals using exact same date window
    const [dispensedTotals] = await pool.query(`
      SELECT 
        m.medicine_id,
        d.dosage_consumption_unit_value,
        d.dosage_consumption_unit_of_measure
      FROM (
        SELECT batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at FROM consultation_dispensation
        UNION ALL
        SELECT batch_id, dosage_consumption_unit_value, dosage_consumption_unit_of_measure, dispensed_at FROM direct_dispensation
      ) d
      JOIN medicine_inventory_batches mib ON d.batch_id = mib.batch_id
      JOIN medicines m ON mib.medicine_id = m.medicine_id
      WHERE d.dispensed_at BETWEEN ? AND ?
    `, [avgStartDateTime, avgEndDateTime]);

    const medicineBaseDispensedMap = {};
    dispensedTotals.forEach(row => {
      const baseVal = toBaseValue(row.dosage_consumption_unit_value, row.dosage_consumption_unit_of_measure);
      medicineBaseDispensedMap[row.medicine_id] = (medicineBaseDispensedMap[row.medicine_id] || 0) + baseVal;
    });

    // 3. Fetch all medicines with indications and current inventory stocks
    const [medicineRows] = await pool.query(`
      SELECT 
        m.medicine_id,
        CONCAT(m.generic_name, ' (', m.brand_name, ')') AS medicine_name,
        m.dosage_form,
        m.strength_unit_value,
        m.strength_unit_of_measure,
        COALESCE((
          SELECT SUM(mib.current_stock) 
          FROM medicine_inventory_batches mib 
          WHERE mib.medicine_id = m.medicine_id
        ), 0) AS total_stock,
        cc.complaint_name
      FROM medicines m
      LEFT JOIN medicine_indications mi ON m.medicine_id = mi.medicine_id
      LEFT JOIN chief_complaints cc ON mi.complaint_id = cc.complaint_id
      ORDER BY m.generic_name ASC
    `);

    // 4. Deduplicate medicine indication rows and aggregate complaint metrics
    const medicineAggregation = {};

    medicineRows.forEach(row => {
      const {
        medicine_id,
        medicine_name,
        dosage_form,
        strength_unit_value,
        strength_unit_of_measure,
        total_stock,
        complaint_name
      } = row;

      if (!medicineAggregation[medicine_id]) {
        medicineAggregation[medicine_id] = {
          id: medicine_id,
          name: medicine_name,
          dosageForm: dosage_form || 'N/A',
          strengthUnitValue: strength_unit_value,
          strengthUnitOfMeasure: strength_unit_of_measure,
          currentStock: parseFloat(total_stock) || 0,
          connectedComplaints: new Set(),
          complaintPredictedNeed: 0
        };
      }

      if (complaint_name) {
        medicineAggregation[medicine_id].connectedComplaints.add(complaint_name);
        const complaintAvg = complaintAveragesMap[complaint_name] || 0;
        medicineAggregation[medicine_id].complaintPredictedNeed += complaintAvg;
      }
    });

    // 5. Construct unified graph response data
    const graphData = Object.values(medicineAggregation).map(med => {
      const totalBaseDispensed = medicineBaseDispensedMap[med.id] || 0;
      const avgMonthlyBaseDispensed = totalBaseDispensed / avgDivisor;
      const containerStrengthBase = toBaseValue(med.strengthUnitValue, med.strengthUnitOfMeasure);
      const unitLabel = getBaseUnitLabel(med.strengthUnitOfMeasure, med.dosageForm);

      const predictedNeedUnits = containerStrengthBase > 0 
        ? parseFloat((avgMonthlyBaseDispensed / containerStrengthBase).toFixed(1))
        : 0;

      return {
        id: med.id,
        name: med.name,
        dosageForm: med.dosageForm,
        unitOfMeasure: unitLabel,
        packageStrength: `${med.strengthUnitValue || 1} ${med.strengthUnitOfMeasure || unitLabel}`,
        avgMonthlyDispensedBase: parseFloat(avgMonthlyBaseDispensed.toFixed(1)),
        currentStock: med.currentStock,
        stockUnit: med.dosageForm,
        predictedNeed: predictedNeedUnits,
        complaintPredictedNeed: parseFloat(med.complaintPredictedNeed.toFixed(1)),
        connectedComplaints: Array.from(med.connectedComplaints)
      };
    });

    const monthFormatted = targetMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const graphTitle = `Predictive Medicine Demand - ${monthFormatted}`;

    res.json({
      graphTitle,
      selectedMonth: formatDate(targetMonthDate).slice(0, 7),
      data: graphData
    });

  } catch (error) {
    console.error("Error generating predictive medicine data:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
    const targetMonth = req.query.month || new Date().toISOString().slice(0, 7);

    // SQL Query without DB health_advice
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

// Weekly Reports
// GET /api/weekly-reports?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// GET /api/weekly-reports?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
app.get('/api/weekly-reports', async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate parameters are required.' });
  }

  // Formatting timestamp bounds for TIMESTAMP columns (dispensed_at)
  const startTimestamp = `${startDate} 00:00:00`;
  const endTimestamp = `${endDate} 23:59:59`;

  try {
    // 1. Total Visits Count
    const visitsQuery = `
      SELECT COUNT(*) AS total_visits 
      FROM clinic_visits 
      WHERE visit_date >= ? AND visit_date <= ?
    `;
    const [visitsResult] = await pool.query(visitsQuery, [startDate, endDate]);
    const totalVisits = Number(visitsResult[0]?.total_visits || 0);

    // 2. Complaints Breakdown
    const complaintsQuery = `
      SELECT 
        cc.complaint_name AS name, 
        COUNT(cv.visit_id) AS total_count
      FROM clinic_visits cv
      JOIN chief_complaints cc ON cv.complaint_id = cc.complaint_id
      WHERE cv.visit_date >= ? AND cv.visit_date <= ?
      GROUP BY cc.complaint_id, cc.complaint_name
      HAVING total_count > 0
      ORDER BY total_count DESC
    `;
    const [complaintsRaw] = await pool.query(complaintsQuery, [startDate, endDate]);
    
    const complaints = complaintsRaw.map(row => ({
      name: row.name,
      count: Number(row.total_count)
    }));

    // 3. Medicine Dispensed Breakdown (Count of occurrences in combined Direct + Consultation dispensation)
    const medicinesQuery = `
      SELECT 
        CONCAT(m.generic_name, ' (', m.brand_name, ')') AS name, 
        COUNT(*) AS total_count
      FROM (
        SELECT batch_id
        FROM direct_dispensation
        WHERE dispensed_at >= ? AND dispensed_at <= ?

        UNION ALL

        SELECT batch_id
        FROM consultation_dispensation
        WHERE dispensed_at >= ? AND dispensed_at <= ?
      ) combined
      JOIN medicine_inventory_batches b ON combined.batch_id = b.batch_id
      JOIN medicines m ON b.medicine_id = m.medicine_id
      GROUP BY m.medicine_id, m.generic_name, m.brand_name
      HAVING total_count > 0
      ORDER BY total_count DESC
    `;
    const [medicinesRaw] = await pool.query(medicinesQuery, [
      startTimestamp, endTimestamp, 
      startTimestamp, endTimestamp
    ]);

    const medicines = medicinesRaw.map(row => ({
      name: row.name,
      count: Number(row.total_count)
    }));

    // Calculate Top Summary Metrics
    const topComplaint = complaints.length > 0 ? complaints[0].name : 'None';
    const topMedicine = medicines.length > 0 ? medicines[0].name : 'None';

    res.json({
      overview: {
        totalVisits,
        totalIncidents: 0,
        topComplaint,
        topMedicine
      },
      complaintsBreakdown: complaints,
      medicineDispensed: medicines
    });

  } catch (error) {
    console.error('Error fetching weekly reports:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

//Document Request API
// =========================================================================
// 1. POST: Submit Excuse Slip Request
// =========================================================================
// =========================================================================
// 1. POST: Submit Excuse Slip Request
// =========================================================================
app.post('/api/requests/excuse-slip', upload.single('proof'), async (req, res) => {
  try {
    const { student_id, reason_for_excuse, valid_absence_start, valid_absence_end } = req.body;
    const request_id = `EXC-${uuidv4().substring(0, 8)}`;
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

    res.status(201).json({ message: 'Excuse slip request submitted successfully', request_id });
  } catch (error) {
    console.error('Error submitting excuse slip:', error);
    res.status(500).json({ error: 'Failed to submit excuse slip request' });
  }
});

// =========================================================================
// 0. GET: Fetch Partner Facilities & Associated Services
// =========================================================================
app.get('/api/partner-facilities', async (req, res) => {
  try {
    const [facilities] = await pool.query(`SELECT * FROM partner_facilities ORDER BY facility_name ASC`);
    const [services] = await pool.query(`SELECT * FROM facility_services ORDER BY service_name ASC`);

    // Group services by facility_id
    const facilitiesWithServices = facilities.map((facility) => ({
      ...facility,
      services: services.filter((s) => s.facility_id === facility.facility_id)
    }));

    res.json(facilitiesWithServices);
  } catch (error) {
    console.error('Error fetching partner facilities:', error);
    res.status(500).json({ error: 'Failed to fetch partner facilities' });
  }
});

// =========================================================================
// 2. POST: Submit Referral Slip Request (Updated with Transaction)
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

    const request_id = `REF-${uuidv4().substring(0, 8)}`;

    await connection.beginTransaction();

    // 1. Insert into referral_slip_requests
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

    // 2. Insert selected services into junction table
    const insertServiceQuery = `
      INSERT INTO referral_request_services (request_id, service_id) 
      VALUES ?
    `;
    const serviceValues = service_ids.map((serviceId) => [request_id, serviceId]);
    await connection.query(insertServiceQuery, [serviceValues]);

    await connection.commit();
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
// 3. GET: Fetch All Requests for a Student (Updated with JOINs)
// =========================================================================
app.get('/api/requests/student/:student_id', async (req, res) => {
  try {
    const { student_id } = req.params;

    const [excuseRequests] = await pool.query(
      `SELECT *, 'Excuse Slip' AS request_type FROM excuse_slip_requests WHERE student_id = ? ORDER BY created_at DESC`,
      [student_id]
    );

    // Join partner_facilities and aggregate requested services into string list
    const [referralRequests] = await pool.query(
      `SELECT 
        r.*, 
        pf.facility_name AS partner_facility_name,
        GROUP_CONCAT(fs.service_name SEPARATOR ', ') AS requested_services,
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
// 4. GET & POST: Notes / Messages for a Specific Request
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

    await pool.query(
      `INSERT INTO ${tableName} (note_id, request_id, sender_type, sender_id, message) VALUES (?, ?, ?, ?, ?)`,
      [note_id, request_id, sender_type, sender_id, message]
    );

    res.status(201).json({ message: 'Note added successfully' });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

//Document Issuance API
// ==========================================
// 1. GET ALL DOCUMENT REQUESTS (Updated for New Schema)
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
                GROUP_CONCAT(fs.service_name SEPARATOR ', ') AS requested_services,
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
// 2. GET NOTES FOR A SPECIFIC REQUEST
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
// 3. ACTION ENDPOINT: APPROVE / DENY & NOTE
// ==========================================
app.post('/api/document-requests/action', upload.single('issued_slip'), async (req, res) => {
    const { request_id, request_type, action, nurse_id, message } = req.body;
    
    if (!request_id || !request_type || !action || !nurse_id) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const isExcuse = request_type === 'Excuse Slip';
    const requestTable = isExcuse ? 'excuse_slip_requests' : 'referral_slip_requests';
    const notesTable = isExcuse ? 'excuse_slip_notes' : 'referral_slip_notes';

    // FIXED: Changed '/uploads/issued_slips/' to '/uploads/' to match Express static path
    const issued_slip_url = req.file ? `/uploads/${req.file.filename}` : null;
    const status = action === 'Approve' ? 'Completed' : 'Denied';

    try {
        // Update Request Table Status and Issued info
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

        // If a message was entered, insert note record
        if (message && message.trim() !== '') {
            const noteId = `NOTE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const insertNoteQuery = `
                INSERT INTO ${notesTable} (note_id, request_id, sender_type, sender_id, message, created_at)
                VALUES (?, ?, 'Nurse', ?, ?, NOW())
            `;
            await pool.query(insertNoteQuery, [noteId, request_id, nurse_id, message.trim()]);
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
// 4. POST A NEW NOTE / MESSAGE FOR A REQUEST
// ==========================================
app.post('/api/document-requests/notes', async (req, res) => {
    const { request_id, request_type, sender_id, sender_type, message } = req.body;

    if (!request_id || !request_type || !sender_id || !sender_type || !message) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // Determine target database table
    const notesTable = request_type === 'Excuse Slip' ? 'excuse_slip_notes' : 'referral_slip_notes';

    try {
        const noteId = `NOTE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const query = `
            INSERT INTO ${notesTable} (note_id, request_id, sender_type, sender_id, message, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `;

        await pool.query(query, [noteId, request_id, sender_type, sender_id, message.trim()]);

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

// GET ALL FACILITIES WITH THEIR SERVICES
app.get('/api/partner-facilities', async (req, res) => {
    try {
        const [facilities] = await pool.query('SELECT * FROM partner_facilities ORDER BY facility_name ASC');
        const [services] = await pool.query('SELECT * FROM facility_services ORDER BY service_name ASC');

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

// CREATE PARTNER FACILITY
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

// UPDATE PARTNER FACILITY
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

// DELETE PARTNER FACILITY
app.delete('/api/partner-facilities/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM partner_facilities WHERE facility_id = ?', [id]);
        res.status(200).json({ success: true, message: 'Facility deleted successfully.' });
    } catch (error) {
        console.error('Error deleting facility:', error);
        res.status(500).json({ success: false, message: 'Failed to delete facility' });
    }
});

// CREATE FACILITY SERVICE
app.post('/api/partner-facilities/:facilityId/services', async (req, res) => {
    const { facilityId } = req.params;
    const { service_name, description } = req.body;

    if (!service_name || !service_name.trim()) {
        return res.status(400).json({ success: false, message: 'Service name is required.' });
    }

    const service_id = `SRV-${uuidv4().substring(0, 8)}`;
    try {
        await pool.query(
            'INSERT INTO facility_services (service_id, facility_id, service_name, description) VALUES (?, ?, ?, ?)',
            [service_id, facilityId, service_name.trim(), description || null]
        );
        res.status(201).json({ success: true, message: 'Service created successfully.', service_id });
    } catch (error) {
        console.error('Error creating facility service:', error);
        res.status(500).json({ success: false, message: 'Failed to create service' });
    }
});

// UPDATE FACILITY SERVICE
app.put('/api/facility-services/:serviceId', async (req, res) => {
    const { serviceId } = req.params;
    const { service_name, description } = req.body;
    try {
        await pool.query(
            'UPDATE facility_services SET service_name = ?, description = ? WHERE service_id = ?',
            [service_name.trim(), description || null, serviceId]
        );
        res.status(200).json({ success: true, message: 'Service updated successfully.' });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({ success: false, message: 'Failed to update service' });
    }
});

// DELETE FACILITY SERVICE
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
// UPDATED HEALTH SCREENING API ENDPOINTS
// ==========================================

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

// 3. Get All Screening Schedules Categorized by Status
app.get('/api/screenings', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, p.program_name,
        (SELECT COUNT(*) FROM screening_schedule_participants WHERE screening_schedule_id = s.screening_schedule_id) AS total_students
      FROM screening_schedules s
      LEFT JOIN academic_programs p ON s.target_program_id = p.program_id
      ORDER BY s.scheduled_date DESC, s.start_time ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Create New Screening Schedule (Validation: Must have participants)
app.post('/api/screenings', async (req, res) => {
  const { title, screening_type, target_program_id, target_year_level, target_section, scheduled_date, start_time, end_time, student_ids } = req.body;
  
  // REQUIREMENT: Cannot create screening if no participants selected
  if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
    return res.status(400).json({ error: 'At least one participant must be selected to create a screening.' });
  }

  const scheduleId = uuidv4();

  try {
    await pool.query(
      `INSERT INTO screening_schedules 
      (screening_schedule_id, title, screening_type, target_program_id, target_year_level, target_section, scheduled_date, start_time, end_time) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [scheduleId, title, screening_type, target_program_id || null, target_year_level || null, target_section || null, scheduled_date, start_time, end_time]
    );

    // Insert Participants with default 'PENDING' attendance
    const participantValues = student_ids.map(sId => [uuidv4(), scheduleId, sId, 'PENDING']);
    await pool.query(
      'INSERT INTO screening_schedule_participants (participant_id, screening_schedule_id, student_id, attendance_status) VALUES ?',
      [participantValues]
    );

    // Fetch User IDs for notifications
    const [users] = await pool.query('SELECT user_id FROM students WHERE student_id IN (?)', [student_ids]);
    
    // Insert Notifications
    const notifValues = users.map(u => [
      uuidv4(),
      u.user_id,
      `New Health Screening Scheduled: ${title}`,
      `You are scheduled for a ${screening_type} screening on ${scheduled_date} from ${start_time} to ${end_time}.`,
      0
    ]);
    if (notifValues.length > 0) {
      await pool.query(
        'INSERT INTO notifications (notification_id, recipient_user_id, title, message_body, is_read) VALUES ?',
        [notifValues]
      );
    }

    res.json({ message: 'Screening scheduled successfully!', scheduleId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Update Scheduled Date/Time
app.put('/api/screenings/:id', async (req, res) => {
  const { id } = req.params;
  const { scheduled_date, start_time, end_time } = req.body;

  try {
    await pool.query(
      'UPDATE screening_schedules SET scheduled_date = ?, start_time = ?, end_time = ? WHERE screening_schedule_id = ?',
      [scheduled_date, start_time, end_time, id]
    );

    const [students] = await pool.query(
      `SELECT s.user_id, sc.title, sc.screening_type 
       FROM screening_schedule_participants p 
       JOIN students s ON p.student_id = s.student_id 
       JOIN screening_schedules sc ON sc.screening_schedule_id = p.screening_schedule_id 
       WHERE p.screening_schedule_id = ?`,
      [id]
    );

    if (students.length > 0) {
      const notifValues = students.map(st => [
        uuidv4(),
        st.user_id,
        `Updated Schedule: ${st.title}`,
        `Your ${st.screening_type} screening schedule has been updated to ${scheduled_date} (${start_time} - ${end_time}).`,
        0
      ]);
      await pool.query(
        'INSERT INTO notifications (notification_id, recipient_user_id, title, message_body, is_read) VALUES ?',
        [notifValues]
      );
    }

    res.json({ message: 'Schedule updated and notifications sent successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Cancel/Delete Screening
app.delete('/api/screenings/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [students] = await pool.query(
      `SELECT s.user_id, sc.title 
       FROM screening_schedule_participants p 
       JOIN students s ON p.student_id = s.student_id 
       JOIN screening_schedules sc ON sc.screening_schedule_id = p.screening_schedule_id 
       WHERE p.screening_schedule_id = ?`,
      [id]
    );

    if (students.length > 0) {
      const notifValues = students.map(st => [
        uuidv4(),
        st.user_id,
        `Cancelled Screening: ${st.title}`,
        `The scheduled health screening "${st.title}" has been cancelled.`,
        0
      ]);
      await pool.query(
        'INSERT INTO notifications (notification_id, recipient_user_id, title, message_body, is_read) VALUES ?',
        [notifValues]
      );
    }

    await pool.query('DELETE FROM screening_schedules WHERE screening_schedule_id = ?', [id]);
    res.json({ message: 'Screening cancelled successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get Participants with Attendance & Auto-Absent Logic for Past Screenings
app.get('/api/screenings/:id/students', async (req, res) => {
  const { id } = req.params;
  try {
    const [schedule] = await pool.query('SELECT * FROM screening_schedules WHERE screening_schedule_id = ?', [id]);
    if (schedule.length === 0) return res.status(404).json({ error: 'Schedule not found' });

    const schDate = schedule[0].scheduled_date ? new Date(schedule[0].scheduled_date).toISOString().split('T')[0] : '';
    const todayStr = new Date().toISOString().split('T')[0];

    // REQUIREMENT: If the screening is past, automatically mark un-scanned 'PENDING' students as 'ABSENT'
    if (schDate < todayStr) {
      await pool.query(
        `UPDATE screening_schedule_participants 
         SET attendance_status = 'ABSENT' 
         WHERE screening_schedule_id = ? AND attendance_status = 'PENDING'`,
        [id]
      );
    }

    const type = schedule[0].screening_type;
    let docQuery = '';
    if (type === 'BMI') {
      docQuery = `LEFT JOIN bmi_monitoring_logs record ON record.student_id = st.student_id AND record.screening_schedule_id = p.screening_schedule_id`;
    } else if (type === 'Dental') {
      docQuery = `LEFT JOIN dental_assessment_records record ON record.student_id = st.student_id AND record.screening_schedule_id = p.screening_schedule_id`;
    } else if (type === 'Vision') {
      docQuery = `LEFT JOIN vision_screening_records record ON record.student_id = st.student_id AND record.screening_schedule_id = p.screening_schedule_id`;
    }

    const [rows] = await pool.query(`
      SELECT st.*, prog.program_name, p.participant_id, p.attendance_status, p.attended_at, record.*
      FROM screening_schedule_participants p
      JOIN students st ON p.student_id = st.student_id
      LEFT JOIN academic_programs prog ON st.program_id = prog.program_id
      ${docQuery}
      WHERE p.screening_schedule_id = ?
    `, [id]);

    res.json({ schedule: schedule[0], students: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. QR Code Attendance Scanning (Only for Ongoing Screening)
app.post('/api/screenings/:id/scan-qr', async (req, res) => {
  const { id } = req.params;
  const { student_id } = req.body;

  try {
    // Verify student is assigned to this screening
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

    // Update attendance status to PRESENT
    await pool.query(
      `UPDATE screening_schedule_participants 
       SET attendance_status = 'PRESENT', attended_at = NOW() 
       WHERE screening_schedule_id = ? AND student_id = ?`,
      [id, student_id]
    );

    const studentName = `${participant[0].first_name} ${participant[0].last_name}`;
    res.json({ message: `Attendance marked PRESENT for ${studentName}`, student: participant[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Modify Participant Attendance Status (For Past Screenings Manual Update)
app.put('/api/screenings/:id/students/:studentId/attendance', async (req, res) => {
  const { id, studentId } = req.params;
  const { attendance_status } = req.body;

  if (!['PENDING', 'PRESENT', 'ABSENT'].includes(attendance_status)) {
    return res.status(400).json({ error: 'Invalid attendance status.' });
  }

  try {
    const attendedAt = attendance_status === 'PRESENT' ? new Date() : null;
    await pool.query(
      `UPDATE screening_schedule_participants 
       SET attendance_status = ?, attended_at = ? 
       WHERE screening_schedule_id = ? AND student_id = ?`,
      [attendance_status, attendedAt, id, studentId]
    );

    res.json({ message: `Attendance status updated to ${attendance_status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Document Student Health Screening Results
app.post('/api/screenings/:id/document', async (req, res) => {
  const { id } = req.params;
  const { student_id, screening_type, formData } = req.body;

  try {
    // Verify participant is marked PRESENT
    const [part] = await pool.query(
      `SELECT attendance_status FROM screening_schedule_participants WHERE screening_schedule_id = ? AND student_id = ?`,
      [id, student_id]
    );

    if (part.length === 0 || part[0].attendance_status !== 'PRESENT') {
      return res.status(400).json({ error: 'Student must be marked PRESENT before documenting results.' });
    }

    if (screening_type === 'BMI') {
      const { height_cm, weight_kg, bmi_value, bmi_category } = formData;
      const logId = uuidv4();
      await pool.query(`
        INSERT INTO bmi_monitoring_logs (bmi_log_id, student_id, screening_schedule_id, height_cm, weight_kg, bmi_value, bmi_category)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE height_cm = VALUES(height_cm), weight_kg = VALUES(weight_kg), bmi_value = VALUES(bmi_value), bmi_category = VALUES(bmi_category)
      `, [logId, student_id, id, height_cm, weight_kg, bmi_value, bmi_category]);

    } else if (screening_type === 'Dental') {
      const { dental_findings, remarks } = formData;
      const recordId = uuidv4();
      await pool.query(`
        INSERT INTO dental_assessment_records (dental_record_id, student_id, screening_schedule_id, dental_findings, remarks)
        VALUES (?, ?, ?, ?, ?)
      `, [recordId, student_id, id, dental_findings, remarks]);

    } else if (screening_type === 'Vision') {
      const { visual_acuity_left, visual_acuity_right, remarks } = formData;
      const recordId = uuidv4();
      await pool.query(`
        INSERT INTO vision_screening_records (vision_record_id, student_id, screening_schedule_id, visual_acuity_left, visual_acuity_right, remarks)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [recordId, student_id, id, visual_acuity_left, visual_acuity_right, remarks]);
    }

    res.json({ message: 'Screening documentation saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


//Doctor Visit API
// ==========================================
// 1. DOCTOR MANAGEMENT
// ==========================================

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

app.post('/api/mass-schedules', async (req, res) => {
    const { 
        assigned_by_nurse_id, 
        doctor_id, 
        target_program, 
        target_year_level, 
        target_section, 
        batch_start_time, 
        batch_end_time, 
        student_appointments 
    } = req.body;

    if (!assigned_by_nurse_id) {
        return res.status(400).json({ success: false, message: 'Nurse ID is required.' });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const batch_id = `BATCH-${uuidv4().substring(0, 8)}`;

        // 1. Create Batch Record
        await connection.query(
            `INSERT INTO mass_schedule_batches 
             (batch_id, assigned_by_nurse_id, target_program, target_year_level, target_section, start_time, end_time, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [batch_id, assigned_by_nurse_id, target_program, target_year_level, target_section, batch_start_time, batch_end_time]
        );

        // 2. Insert Appointments and Junction Student Records
        for (const appt of student_appointments) {
            const appointment_id = `APPT-${uuidv4().substring(0, 8)}`;
            
            await connection.query(
                `INSERT INTO doctor_appointments 
                 (appointment_id, doctor_id, batch_id, start_time, end_time, assigned_by_nurse_id, status) 
                 VALUES (?, ?, ?, ?, ?, ?, 'Scheduled')`,
                [appointment_id, doctor_id, batch_id, appt.start_time, appt.end_time, assigned_by_nurse_id]
            );

            await connection.query(
                `INSERT INTO doctor_appointment_students 
                 (appointment_id, student_id, attendance_status) 
                 VALUES (?, ?, 'Pending')`,
                [appointment_id, appt.student_id]
            );

            // Notify Student
            if (appt.user_id) {
                const notif_id = `NOTIF-${uuidv4().substring(0, 8)}`;
                const title = "New Doctor Visit Scheduled";
                const body = `You have been scheduled for a doctor visit on ${new Date(appt.start_time).toLocaleString()}. Please be at the clinic on time.`;

                await connection.query(
                    `INSERT INTO notifications (notification_id, recipient_user_id, title, message_body, is_read, created_at) 
                     VALUES (?, ?, ?, ?, 0, NOW())`,
                    [notif_id, appt.user_id, title, body]
                );
            }
        }

        await connection.commit();
        res.json({ success: true, message: 'Mass schedule and appointments created successfully!' });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating mass schedule:', error);
        res.status(500).json({ success: false, message: 'Failed to create schedule' });
    } finally {
        connection.release();
    }
});

// ==========================================
// 4. FETCH VISITS & ATTENDANCE MANAGEMENT
// ==========================================

app.get('/api/doctor-visits', async (req, res) => {
    try {
        // Auto-mark student attendance as 'Absent' when appointment end_time has passed and status is still 'Pending'
        await pool.query(`
            UPDATE doctor_appointment_students das
            JOIN doctor_appointments da ON das.appointment_id = da.appointment_id
            SET das.attendance_status = 'Absent'
            WHERE das.attendance_status = 'Pending' AND da.end_time < NOW()
        `);

        const query = `
            SELECT 
                da.appointment_id,
                da.doctor_id,
                da.batch_id,
                da.start_time,
                da.end_time,
                da.status,
                da.assigned_by_nurse_id,
                das.student_id,
                das.attendance_status,
                das.check_in_time,
                das.notes,
                s.first_name AS student_first_name,
                s.last_name AS student_last_name,
                s.user_id AS student_user_id,
                s.program_id,
                s.year_level,
                s.section,
                d.first_name AS doc_first_name,
                d.last_name AS doc_last_name,
                d.specialization,
                da_assessment.assessment_id,
                da_assessment.clinical_findings,
                da_assessment.diagnosis,
                da_assessment.treatment_recommendations,
                da_assessment.assessment_date
            FROM doctor_appointments da
            JOIN doctor_appointment_students das ON da.appointment_id = das.appointment_id
            JOIN students s ON das.student_id = s.student_id
            JOIN doctors d ON da.doctor_id = d.doctor_id
            LEFT JOIN doctor_assessments da_assessment 
                ON da.appointment_id = da_assessment.appointment_id 
               AND das.student_id = da_assessment.student_id
            ORDER BY da.start_time ASC
        `;

        const [rows] = await pool.query(query);
        res.json({ success: true, appointments: rows });
    } catch (error) {
        console.error('Error fetching doctor visits:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch doctor visits' });
    }
});

// Update attendance status (Present, Pending, Absent)
app.put('/api/doctor-visits/status/:appointment_id', async (req, res) => {
    const { appointment_id } = req.params;
    const { student_id, status } = req.body; // status: 'Present', 'Pending', or 'Absent'

    try {
        const checkInQuery = status === 'Present' ? ', check_in_time = NOW()' : '';
        await pool.query(
            `UPDATE doctor_appointment_students 
             SET attendance_status = ? ${checkInQuery} 
             WHERE appointment_id = ? AND student_id = ?`,
            [status, appointment_id, student_id]
        );
        res.json({ success: true, message: `Student attendance updated to ${status}` });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ success: false, message: 'Failed to update attendance status' });
    }
});

// ==========================================
// 5. RESCHEDULE & CANCEL VISITS
// ==========================================

app.put('/api/doctor-visits/reschedule/:appointment_id', async (req, res) => {
    const { appointment_id } = req.params;
    const { start_time, end_time, student_user_id } = req.body;

    try {
        await pool.query(
            `UPDATE doctor_appointments SET start_time = ?, end_time = ? WHERE appointment_id = ?`,
            [start_time, end_time, appointment_id]
        );

        if (student_user_id) {
            const notif_id = `NOTIF-${uuidv4().substring(0, 8)}`;
            const title = "Doctor Visit Rescheduled";
            const body = `Your doctor visit appointment time has been updated to ${new Date(start_time).toLocaleString()}.`;

            await pool.query(
                `INSERT INTO notifications (notification_id, recipient_user_id, title, message_body, is_read, created_at) 
                 VALUES (?, ?, ?, ?, 0, NOW())`,
                [notif_id, student_user_id, title, body]
            );
        }

        res.json({ success: true, message: 'Appointment rescheduled successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to reschedule appointment' });
    }
});

app.put('/api/doctor-visits/cancel/:appointment_id', async (req, res) => {
    const { appointment_id } = req.params;
    const { student_user_id } = req.body;

    try {
        await pool.query(
            `UPDATE doctor_appointments SET status = 'Cancelled' WHERE appointment_id = ?`,
            [appointment_id]
        );

        if (student_user_id) {
            const notif_id = `NOTIF-${uuidv4().substring(0, 8)}`;
            const title = "Doctor Visit Cancelled";
            const body = `Your scheduled doctor visit appointment has been cancelled by the clinic nurse.`;

            await pool.query(
                `INSERT INTO notifications (notification_id, recipient_user_id, title, message_body, is_read, created_at) 
                 VALUES (?, ?, ?, ?, 0, NOW())`,
                [notif_id, student_user_id, title, body]
            );
        }

        res.json({ success: true, message: 'Appointment cancelled successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to cancel appointment' });
    }
});

// ==========================================
// 6. DOCTOR ASSESSMENT DOCUMENTATION
// ==========================================

app.post('/api/doctor-assessments', async (req, res) => {
    const { appointment_id, student_id, clinical_findings, diagnosis, treatment_recommendations, student_user_id } = req.body;

    try {
        const [existing] = await pool.query(
            `SELECT assessment_id FROM doctor_assessments WHERE appointment_id = ? AND student_id = ?`,
            [appointment_id, student_id]
        );

        if (existing.length > 0) {
            await pool.query(
                `UPDATE doctor_assessments 
                 SET clinical_findings = ?, diagnosis = ?, treatment_recommendations = ?, assessment_date = NOW() 
                 WHERE appointment_id = ? AND student_id = ?`,
                [clinical_findings, diagnosis, treatment_recommendations, appointment_id, student_id]
            );
        } else {
            const assessment_id = `ASM-${uuidv4().substring(0, 8)}`;
            await pool.query(
                `INSERT INTO doctor_assessments (assessment_id, appointment_id, student_id, clinical_findings, diagnosis, treatment_recommendations, assessment_date) 
                 VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                [assessment_id, appointment_id, student_id, clinical_findings, diagnosis, treatment_recommendations]
            );
        }

        await pool.query(`UPDATE doctor_appointments SET status = 'Completed' WHERE appointment_id = ?`, [appointment_id]);

        if (student_user_id) {
            const notif_id = `NOTIF-${uuidv4().substring(0, 8)}`;
            const title = "Doctor Visit Assessment Recorded";
            const body = `Your doctor visit assessment and recommendations have been documented by the clinic staff.`;

            await pool.query(
                `INSERT INTO notifications (notification_id, recipient_user_id, title, message_body, is_read, created_at) 
                 VALUES (?, ?, ?, ?, 0, NOW())`,
                [notif_id, student_user_id, title, body]
            );
        }

        res.json({ success: true, message: 'Doctor assessment saved successfully!' });
    } catch (error) {
        console.error('Error saving assessment:', error);
        res.status(500).json({ success: false, message: 'Failed to save assessment' });
    }
});

//Incident Reports API
const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// ----------------================================------------------
// 1. INCIDENT REPORTS API
// ----------------================================------------------

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

// POST: Add new Incident Report
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

        const incident_id = generateId('INC');

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

        res.json({ success: true, message: 'Incident report created successfully' });
    } catch (error) {
        console.error('Error creating incident report:', error);
        res.status(500).json({ success: false, message: 'Failed to create report' });
    }
});

// ----------------================================------------------
// 2. EMERGENCY HOTLINE DIRECTORY API
// ----------------================================------------------

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

// SEARCH STUDENTS for Modal dropdown/autocomplete
// SEARCH STUDENTS ROUTE
app.get('/api/incident-reports/students', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length === 0) {
            return res.json({ success: true, students: [] });
        }

        const searchTerm = `%${q.trim()}%`;

        // Safe query selecting directly from students table with fallbacks
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

        // Fallback: simple query if the JOIN or CONCAT_WS failed
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
app.get('/clinic-visits/clinicLogs&Records', async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    let query = `SELECT * FROM clinic_visits WHERE student_id = ?`;
    const params = [studentId];

    if (startDate && endDate) {
      query += ` AND visit_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    query += ` ORDER BY visit_date DESC, time_in DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Medicine Dispensed
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
        d.nurse_id,
        NULL AS visit_id,
        d.batch_id,
        d.quantity_dispensed,
        d.dispensed_at
      FROM direct_dispensation d
      ${directWhere}

      UNION ALL

      SELECT 
        c.consultation_dispense_id AS id,
        'Consultation Dispensation' AS dispensation_type,
        cv.student_id,
        cv.nurse_id,
        c.visit_id,
        c.batch_id,
        c.quantity_dispensed,
        c.dispensed_at
      FROM consultation_dispensation c
      LEFT JOIN clinic_visits cv ON c.visit_id = cv.visit_id
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

    let query = `SELECT * FROM incident_reports WHERE student_id = ?`;
    const params = [studentId];

    if (startDate && endDate) {
      query += ` AND DATE(incident_datetime) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    query += ` ORDER BY incident_datetime DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Health Screenings (FIXED QUERY & PARAMETER BINDING)
// 4. Health Screenings (Includes Upcoming, Ongoing, Completed, and Missed)
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
    let where3 = `WHERE d.student_id = ? AND (d.screening_schedule_id IS NULL OR d.screening_schedule_id = '')`;
    params.push(studentId);
    if (startDate && endDate) {
      where3 += ` AND DATE(d.recorded_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    // 4. Standalone Vision Logs Filter
    let where4 = `WHERE v.student_id = ? AND (v.screening_schedule_id IS NULL OR v.screening_schedule_id = '')`;
    params.push(studentId);
    if (startDate && endDate) {
      where4 += ` AND DATE(v.recorded_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    const query = `
      SELECT 
        s.screening_schedule_id AS record_id,
        COALESCE(s.screening_type, 'Health Screening') AS screening_type,
        p.student_id,
        s.screening_schedule_id,
        s.scheduled_date AS record_date,
        s.title,
        s.start_time,
        s.end_time,
        s.announcement,
        CASE 
          WHEN b.bmi_log_id IS NOT NULL THEN CONCAT('BMI: ', b.bmi_value, ' (', b.bmi_category, ') | Height: ', b.height_cm, 'cm | Weight: ', b.weight_kg, 'kg')
          WHEN d.dental_record_id IS NOT NULL THEN CONCAT('Findings: ', d.dental_findings, ' | Remarks: ', COALESCE(d.remarks, 'None'))
          WHEN v.vision_record_id IS NOT NULL THEN CONCAT('VA Left: ', v.visual_acuity_left, ' | VA Right: ', v.visual_acuity_right, ' | Remarks: ', COALESCE(v.remarks, 'None'))
          ELSE COALESCE(s.announcement, 'No examination details recorded yet.')
        END AS details,
        CASE 
          WHEN b.bmi_log_id IS NOT NULL OR d.dental_record_id IS NOT NULL OR v.vision_record_id IS NOT NULL THEN 'Completed'
          WHEN s.scheduled_date > CURRENT_DATE() THEN 'Upcoming'
          WHEN s.scheduled_date = CURRENT_DATE() THEN 'Ongoing'
          ELSE 'Missed'
        END AS status
      FROM screening_schedule_participants p
      JOIN screening_schedules s ON p.screening_schedule_id = s.screening_schedule_id
      LEFT JOIN bmi_monitoring_logs b ON b.screening_schedule_id = s.screening_schedule_id AND b.student_id = p.student_id
      LEFT JOIN dental_assessment_records d ON d.screening_schedule_id = s.screening_schedule_id AND d.student_id = p.student_id
      LEFT JOIN vision_screening_records v ON v.screening_schedule_id = s.screening_schedule_id AND v.student_id = p.student_id
      ${where1}

      UNION ALL

      SELECT 
        b.bmi_log_id AS record_id,
        'BMI Monitoring' AS screening_type,
        b.student_id,
        b.screening_schedule_id,
        DATE(b.logged_at) AS record_date,
        'BMI Monitoring' AS title,
        NULL AS start_time,
        NULL AS end_time,
        NULL AS announcement,
        CONCAT('BMI: ', b.bmi_value, ' (', b.bmi_category, ') | Height: ', b.height_cm, 'cm | Weight: ', b.weight_kg, 'kg') AS details,
        'Completed' AS status
      FROM bmi_monitoring_logs b
      ${where2}

      UNION ALL

      SELECT 
        d.dental_record_id AS record_id,
        'Dental Assessment' AS screening_type,
        d.student_id,
        d.screening_schedule_id,
        DATE(d.recorded_at) AS record_date,
        'Dental Assessment' AS title,
        NULL AS start_time,
        NULL AS end_time,
        NULL AS announcement,
        CONCAT('Findings: ', d.dental_findings, ' | Remarks: ', COALESCE(d.remarks, 'None')) AS details,
        'Completed' AS status
      FROM dental_assessment_records d
      ${where3}

      UNION ALL

      SELECT 
        v.vision_record_id AS record_id,
        'Vision Screening' AS screening_type,
        v.student_id,
        v.screening_schedule_id,
        DATE(v.recorded_at) AS record_date,
        'Vision Screening' AS title,
        NULL AS start_time,
        NULL AS end_time,
        NULL AS announcement,
        CONCAT('VA Left: ', v.visual_acuity_left, ' | VA Right: ', v.visual_acuity_right, ' | Remarks: ', COALESCE(v.remarks, 'None')) AS details,
        'Completed' AS status
      FROM vision_screening_records v
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
        da.student_id,
        da.doctor_id,
        da.batch_id,
        da.start_time,
        da.end_time,
        da.assigned_by_nurse_id,
        da.status,
        doc_ast.assessment_id,
        doc_ast.clinical_findings,
        doc_ast.diagnosis,
        doc_ast.treatment_recommendations,
        doc_ast.assessment_date
      FROM doctor_appointments da
      LEFT JOIN doctor_assessments doc_ast ON da.appointment_id = doc_ast.appointment_id
      WHERE da.student_id = ?
    `;
    const params = [studentId];

    if (startDate && endDate) {
      query += ` AND DATE(da.start_time) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY da.start_time DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. Document Requests (Excuse & Referral Slips)
// ==========================================
app.get('/document-requests/childClinicRecords', async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const params = [];

    // Excuse Slip Filter
    let excuseWhere = `WHERE student_id = ?`;
    params.push(studentId);
    if (startDate && endDate) {
      excuseWhere += ` AND DATE(created_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    // Referral Slip Filter
    let referralWhere = `WHERE student_id = ?`;
    params.push(studentId);
    if (startDate && endDate) {
      referralWhere += ` AND DATE(created_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    const query = `
      SELECT 
        request_id,
        'Excuse Slip' AS document_type,
        student_id,
        reason_for_excuse AS reason,
        status,
        issued_by,
        issued_at,
        issued_slip_url,
        created_at
      FROM excuse_slip_requests
      ${excuseWhere}

      UNION ALL

      SELECT 
        request_id,
        'Referral Slip' AS document_type,
        student_id,
        reason_for_referral AS reason,
        status,
        issued_by,
        issued_at,
        issued_slip_url,
        created_at
      FROM referral_slip_requests
      ${referralWhere}

      ORDER BY created_at DESC
    `;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 7. Student Health Requirements
// ==========================================
app.get('/student-requirements/childClinicRecords', async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    let query = `
      SELECT 
        submission_id,
        student_id,
        requirement_name,
        file_url,
        COALESCE(status, 'Not Submitted') AS status,
        is_late,
        nurse_remarks,
        submitted_at,
        reviewed_by
      FROM student_requirement_submissions
      WHERE student_id = ?
    `;
    const params = [studentId];

    if (startDate && endDate) {
      query += ` AND DATE(submitted_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY submitted_at DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//Contact Settings API
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

  // PH phone number regex (Supports 09XXXXXXXXX or +639XXXXXXXXX)
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

  // PH phone number regex (Supports 09XXXXXXXXX or +639XXXXXXXXX)
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

//ManageStudentAccounts.jsx API
// Helper function hashPassword removed temporarily

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

// 4. POST: Create a Student Account (with optional Parent linking/creation)
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
    parent_option, // 'none' | 'existing' | 'new'
    selected_parent_id,
    new_parent // { parent_id, first_name, last_name, username, password, primary_phone, is_active }
  } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const studentUserId = crypto.randomUUID();
    // Using plain password directly (hashing disabled)
    const studentPasswordHash = password;

    const [studentRoles] = await connection.query("SELECT role_id FROM roles WHERE role_name = 'Student' LIMIT 1");
    const studentRoleId = studentRoles.length > 0 ? studentRoles[0].role_id : 'ROLE_STUDENT';

    await connection.query(
      `INSERT INTO users (user_id, username, password_hash, role_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
      [studentUserId, username, studentPasswordHash, studentRoleId, is_active ? 1 : 0]
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
      // Using plain password directly (hashing disabled)
      const parentPasswordHash = new_parent.password;

      const [parentRoles] = await connection.query("SELECT role_id FROM roles WHERE role_name = 'Parent' LIMIT 1");
      const parentRoleId = parentRoles.length > 0 ? parentRoles[0].role_id : 'ROLE_PARENT';

      await connection.query(
        `INSERT INTO users (user_id, username, password_hash, role_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
        [parentUserId, new_parent.username, parentPasswordHash, parentRoleId, new_parent.is_active ? 1 : 0]
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

// 5. PUT: Update Student Details and Manage Linked Parent Account
// 5. PUT: Update Student Details and Manage Linked Parent Account
app.put('/api/students/:student_id/manageStudentAccounts', async (req, res) => {
  const { student_id } = req.params;
  const { 
    first_name, 
    last_name, 
    program_id, 
    year_level, 
    section, 
    is_active,
    reset_password, // <-- Received from request body
    parent_action, // 'keep' | 'remove' | 'existing' | 'new'
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

    // Update Student Record
    await connection.query(
      `UPDATE students SET first_name = ?, last_name = ?, program_id = ?, year_level = ?, section = ? WHERE student_id = ?`,
      [first_name, last_name, program_id, year_level, section, student_id]
    );

    // Update User Account Status and optionally Reset Password to '123'
    if (reset_password) {
      await connection.query(
        `UPDATE users SET is_active = ?, password_hash = '123' WHERE user_id = ?`,
        [is_active ? 1 : 0, userId]
      );
    } else {
      await connection.query(
        `UPDATE users SET is_active = ? WHERE user_id = ?`,
        [is_active ? 1 : 0, userId]
      );
    }

    // Parent Account Management Logic
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
      const parentPasswordHash = new_parent.password;

      const [parentRoles] = await connection.query("SELECT role_id FROM roles WHERE role_name = 'Parent' LIMIT 1");
      const parentRoleId = parentRoles.length > 0 ? parentRoles[0].role_id : 'ROLE_PARENT';

      await connection.query(
        `INSERT INTO users (user_id, username, password_hash, role_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
        [parentUserId, new_parent.username, parentPasswordHash, parentRoleId, new_parent.is_active ? 1 : 0]
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

//ManageParentAccounts.jsx API  
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

    // Fetch linked students for each parent
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

// -------------------------------------------------------------
// GET: Search students available to link
// Endpoint: http://localhost:3001/manageParentAccount/students
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// PUT: Update Parent Account details, password, and linked students
// Endpoint: http://localhost:3001/manageParentAccount
// -------------------------------------------------------------
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
      linked_student_ids // Array of student_id strings
    } = req.body;

    // 1. Update Username & Status in `users` table
    await connection.query(
      `UPDATE users SET username = ?, is_active = ? WHERE user_id = ?`,
      [username, is_active ? 1 : 0, user_id]
    );

    // 2. Handle Password Reset or Manual Password Change
    let targetPassword = resetToDefault ? '123' : password;
    if (targetPassword) {
      const hashedPassword = await bcrypt.hash(targetPassword, 10);
      await connection.query(
        `UPDATE users SET password_hash = ? WHERE user_id = ?`,
        [hashedPassword, user_id]
      );
    }

    // 3. Update Parent Info in `parents` table
    await connection.query(
      `UPDATE parents SET parent_id = ?, first_name = ?, last_name = ? WHERE parent_id = ?`,
      [parent_id, first_name, last_name, original_parent_id]
    );

    // 4. Update Student Mappings
    // Clear all existing student links for this parent (using both original and new IDs)
    await connection.query(
      `DELETE FROM parent_student_mapping WHERE parent_id = ? OR parent_id = ?`,
      [original_parent_id, parent_id]
    );

    if (linked_student_ids && linked_student_ids.length > 0) {
      // Remove any existing links for these selected students from ANY other parent
      // (Enforces the rule: 1 student can only be linked to 1 parent)
      await connection.query(
        `DELETE FROM parent_student_mapping WHERE student_id IN (?)`,
        [linked_student_ids]
      );

      // Insert the new mappings for this parent
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

//NurseMessage API
// 1. Search contacts (Students & Parents by First or Last name)
app.get('/api/messages/contacts', async (req, res) => {
    const { search } = req.query;
    const searchTerm = `%${search || ''}%`;

    const sql = `
        SELECT user_id, first_name, last_name, 'student' AS role, program_id AS detail 
        FROM students 
        WHERE first_name LIKE ? OR last_name LIKE ?
        UNION
        SELECT user_id, first_name, last_name, 'parent' AS role, primary_phone AS detail 
        FROM parents 
        WHERE first_name LIKE ? OR last_name LIKE ?
        LIMIT 20;
    `;

    try {
        const [rows] = await pool.query(sql, [searchTerm, searchTerm, searchTerm, searchTerm]);
        res.json({ success: true, contacts: rows });
    } catch (error) {
        console.error('Error searching contacts:', error);
        res.status(500).json({ success: false, message: 'Error fetching contacts' });
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
        res.json({ success: true, conversations: rows });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ success: false, message: 'Error fetching conversations' });
    }
});

// 3. Get Total Unread Contacts Count (For Nurse Sidebar Badge)
app.get('/api/messages/unread-count/:userId', async (req, res) => {
    const { userId } = req.params;

    const sql = `
        SELECT COUNT(DISTINCT sender_id) AS total_unread_contacts
        FROM messages 
        WHERE receiver_id = ? AND is_read = FALSE;
    `;

    try {
        const [rows] = await pool.query(sql, [userId]);
        res.json({ success: true, unreadCount: rows[0]?.total_unread_contacts || 0 });
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
        res.json({ success: true, messages: rows });
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
app.post('/api/messages/send', upload.single('media'), async (req, res) => {
    const { sender_id, receiver_id, message_type, content } = req.body;

    // 1. Validate required string IDs
    if (!sender_id || !receiver_id || sender_id === 'undefined' || receiver_id === 'undefined') {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid sender_id or receiver_id provided.' 
        });
    }

    // 2. Format media URL safely
    const media_url = req.file ? `/uploads/${req.file.filename}` : null;
    
    // 3. Fallback content to NULL if empty string
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
            safeContent,
            media_url
        ]);

        const [newMessage] = await pool.query('SELECT * FROM messages WHERE message_id = ?', [result.insertId]);
        res.json({ success: true, message: newMessage[0] });
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

// 8. Delete an Entire Conversation (Clears all messages between two users)
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
        res.json({ success: true, conversations: rows });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ success: false, message: 'Error fetching conversations' });
    }
});

// 3. Get Total Unread Contacts Count (For Student Top Bar Badge)
app.get('/api/messages/unread-count/:userId', async (req, res) => {
    const { userId } = req.params;

    const sql = `
        SELECT COUNT(DISTINCT sender_id) AS total_unread_contacts
        FROM messages 
        WHERE receiver_id = ? AND is_read = FALSE;
    `;

    try {
        const [rows] = await pool.query(sql, [userId]);
        res.json({ success: true, unreadCount: rows[0]?.total_unread_contacts || 0 });
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
        res.json({ success: true, messages: rows });
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
            safeContent,
            media_url
        ]);

        const [newMessage] = await pool.query('SELECT * FROM messages WHERE message_id = ?', [result.insertId]);
        res.json({ success: true, message: newMessage[0] });
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

// 1. Actionable Previews & Schedules
app.get('/api/documents-approval', async (req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM documents_approval WHERE status = 'pending'`);
        res.json({ data: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/inventory-updates', async (req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM inventory WHERE current_stock <= reorder_level`);
        res.json({ data: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/health-screenings', async (req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM health_screenings WHERE date >= CURDATE()`);
        res.json({ data: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/doctor-visits', async (req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM doctor_visits WHERE visit_date >= CURDATE()`);
        res.json({ data: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/weekly-reports', async (req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM weekly_reports ORDER BY created_at DESC LIMIT 5`);
        res.json({ data: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Health Trends Overview
app.get('/api/health-trends', async (req, res) => {
    const { filterType, date } = req.query;
    try {
        // Replace with your trend aggregation logic
        res.json({ 
            data: [], 
            complaintsList: [], 
            averages: {}, 
            averagesLabel: "Average Complaints", 
            timelineLabel: "Timeline", 
            periodLabel: "Period" 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Medicine Dispensed Overview
app.get('/api/medicine-dispensed-overview', async (req, res) => {
    const { filterType, date } = req.query;
    try {
        // Replace with your medicine aggregation logic
        res.json({ 
            data: [], 
            medicinesList: [], 
            medicinesUnitsMap: {}, 
            averages: {}, 
            averagesLabel: "Dispensed Averages", 
            timelineLabel: "Timeline", 
            periodLabel: "Period" 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Predictive Medicine Demand
app.get('/api/predictive-medicine', async (req, res) => {
    const { month } = req.query;
    try {
        // Replace with predictive demand query mapping to expected JSON structure
        res.json({ data: [], graphTitle: "Predictive Medicine Demand" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Frequent Complaint Alerts
app.get('/api/frequent-complaints', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT studentName, studentId, visitCount, complaint, advice, date 
            FROM frequent_complaints 
            WHERE visitCount > 3
        `);
        res.json({ data: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.listen(3001, () => console.log('Server running on port 3001'));