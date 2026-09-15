import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye } from 'lucide-react'; 
import '../../styles/nurse/HealthRecords.css'; 

export default function HealthRecord() {
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchStudents = useCallback(async (queryValue) => {
        setLoading(true);
        setErrorMsg('');
        try {
            const queryParams = new URLSearchParams({ search: queryValue }).toString();
            const response = await fetch(`http://localhost:3001/api/health-records/students?${queryParams}`);
            const data = await response.json();

            if (data.success) {
                setStudents(data.students);
            } else {
                setErrorMsg(data.message || "Failed to retrieve records.");
            }
        } catch (err) {
            setErrorMsg("Network error loading search system catalog data index.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStudents(searchTerm);
    }, [searchTerm, fetchStudents]);

    return (
        <div className="directory-page-wrapper">
            <div className="directory-header-block">
                <h2>Student Health Records</h2>
                <p>Search profiles and review medical information checklist histories.</p>
            </div>

            <div className="search-input-container">
                <div className="search-icon-inside">
                    <Search size={18} />
                </div>
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by student details..." 
                    className="main-search-input"
                />
            </div>

            {errorMsg && <div className="error-message">{errorMsg}</div>}

            <div className="directory-card-panel">
                <h3>Directory Results ({students.length})</h3>
                {loading ? (
                    <div className="status-placeholder">Querying structural schema indices...</div>
                ) : students.length === 0 ? (
                    <div className="status-placeholder">No matching student files found.</div>
                ) : (
                    <div className="table-responsive-wrapper">
                        <table className="profile-data-table">
                            <thead>
                                <tr>
                                    <th>Student ID</th>
                                    <th>Last Name</th>
                                    <th>First Name</th>
                                    <th>Program</th>
                                    <th>Year Level</th>
                                    <th style={{ textAlign: 'center' }}>Action Lookup</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student) => (
                                    <tr key={student.student_id}>
                                        <td style={{ fontWeight: 'bold' }}>{student.student_id}</td>
                                        <td>{student.last_name}</td>
                                        <td>{student.first_name}</td>
                                        <td>
                                            <span className="program-tag-badge">
                                                {student.program_id}
                                            </span>
                                        </td>
                                        <td>{student.year_level}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button 
                                                onClick={() => navigate(`/health-records/view/${student.student_id}`)}
                                                className="btn-view-profile"
                                            >
                                                <Eye size={15} /> View Profile
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}