import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ChooseStudentProfile() {
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);

    useEffect(() => {
        // Read the students saved in localStorage during login
        const storedStudents = localStorage.getItem('linkedStudents');
        if (storedStudents) {
            setStudents(JSON.parse(storedStudents));
        } else {
            // Guard clause if user tries to jump straight to this URL route manually
            navigate('/');
        }
    }, [navigate]);

    const selectProfile = (studentId) => {
        localStorage.setItem('selectedStudentId', studentId);
        
        // FIX: Removed the removeItem line that was wiping out the student list configuration array.
        // The selection list now safely stays preserved for whenever "Switch Account" is clicked.
        
        navigate('/ParentDashboard');
    };

    return (
        <div className="login-page-wrapper">
            <div className="login-container" style={{ textAlign: 'center' }}>
                <div className="login-brand-header">
                    <div className="login-system-tag">STI Baliuag Clinic System</div>
                    <h2 className="login-title">Select Student Profile</h2>
                </div>
                
                <p style={{ margin: '15px 0', color: '#555', fontSize: '14px' }}>
                    Multiple student accounts are linked to you. Select a student profile to view their clinic details.
                </p>

                <div className="auth-form" style={{ gap: '12px', display: 'flex', flexDirection: 'column' }}>
                    {students.map((student) => (
                        <button
                            key={student.student_id}
                            type="button"
                            className="btn-primary"
                            style={{ padding: '14px', background: '#0275d8' }}
                            onClick={() => selectProfile(student.student_id)}
                        >
                            {student.first_name} {student.last_name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}