/*const pool = require('../database/connection');

const forgotPassword = async (req, res) => {
    const { username, firstName, lastName } = req.body;

    try {
        const query = `
            SELECT Password FROM studentAccount WHERE Username = ? AND FirstName = ? AND LastName = ?
            UNION
            SELECT Password FROM nurseAccount WHERE Username = ? AND FirstName = ? AND LastName = ?
            UNION
            SELECT Password FROM parentAccount WHERE Username = ? AND FirstName = ? AND LastName = ?
        `;

        const [rows] = await pool.execute(query, [
            username, firstName, lastName,
            username, firstName, lastName,
            username, firstName, lastName
        ]);

        if (rows.length > 0) {
            res.status(200).json({ 
                success: true, 
                password: rows[0].Password 
            });
        } else {
            res.status(404).json({ success: false, message: "User details do not match our records." });
        }
    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ success: false, message: "Server error occurred." });
    }
};

module.exports = { forgotPassword };*/   