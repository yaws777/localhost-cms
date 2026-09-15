/*const pool = require('../database/connection');

const loginUser = async (req, res) => {
    const { username, password } = req.body;

    try {
        const query = `
            SELECT 'student' AS role, StudentId AS id, FirstName, LastName 
            FROM studentAccount WHERE Username = ? AND Password = ?
            UNION
            SELECT 'nurse' AS role, NurseId AS id, FirstName, LastName 
            FROM nurseAccount WHERE Username = ? AND Password = ?
            UNION
            SELECT 'parent' AS role, ParentId AS id, FirstName, LastName 
            FROM parentAccount WHERE Username = ? AND Password = ?
        `;

        const [rows] = await pool.execute(query, [
            username, password, 
            username, password, 
            username, password
        ]);

        if (rows.length > 0) {
            const user = rows[0];
            // Successful login
            res.status(200).json({
                success: true,
                message: "Login successful",
                user: {
                    role: user.role,
                    id: user.id,
                    firstName: user.FirstName,
                    lastName: user.LastName
                }
            });
        } else {
            res.status(401).json({ success: false, message: "Invalid username or password." });
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "Server error occurred during login." });
    }
};

module.exports = { loginUser };
*/
