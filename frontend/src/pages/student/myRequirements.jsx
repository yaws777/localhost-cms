// MyRequirements.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/student/MyProfile.css'; 

export default function MyRequirements() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [studentHeader, setStudentHeader] = useState(null);
    const [studentId, setStudentId] = useState(null);

    const [requirementsList, setRequirementsList] = useState([]);
    const [reqLoading, setReqLoading] = useState(false);
    const [uploadFiles, setUploadFiles] = useState({});

    useEffect(() => {
        const loadStudentData = async () => {
            try {
                const storedUser = localStorage.getItem('user');
                if (!storedUser) {
                    navigate('/');
                    return;
                }
                const user = JSON.parse(storedUser);

                const studentRes = await fetch(`http://localhost:3001/api/get-student/${user.id}`);
                const studentData = await studentRes.json();

                if (studentData.success) {
                    setStudentId(studentData.student.student_id);
                    setStudentHeader(studentData.student);
                    fetchStudentRequirements(studentData.student.student_id);
                } else {
                    setErrorMsg("Student record not found.");
                }
            } catch (err) {
                setErrorMsg("Network error loading student requirements.");
            } finally {
                setLoading(false);
            }
        };

        loadStudentData();
    }, [navigate]);

    const fetchStudentRequirements = async (id) => {
        if (!id) return;
        setReqLoading(true);
        try {
            const response = await fetch(`http://localhost:3001/api/students/${id}/full-requirements`);
            const data = await response.json();
            if (Array.isArray(data)) {
                setRequirementsList(data);
            } else {
                console.error("Invalid response format received for requirements configurations.");
            }
        } catch (err) {
            console.error("Failed fetching medical requirement checklists:", err);
        } finally {
            setReqLoading(false);
        }
    };

    const handleFileChange = (reqName, file) => {
        setUploadFiles(prev => ({ ...prev, [reqName]: file }));
    };

    const handleUploadSubmit = async (e, reqName, isPastDeadline) => {
        e.preventDefault();
        const targetFile = uploadFiles[reqName];

        if (!targetFile) {
            setErrorMsg("Please select a local file to upload.");
            return;
        }

        setErrorMsg('');
        setSuccessMsg('');

        try {
            const formData = new FormData();
            formData.append('file', targetFile);
            formData.append('is_late', isPastDeadline);

            const response = await fetch(`http://localhost:3001/api/students/${studentId}/requirements/${encodeURIComponent(reqName)}/submit`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (data.success) {
                setSuccessMsg(`Document for "${reqName}" uploaded successfully.`);
                setUploadFiles(prev => ({ ...prev, [reqName]: null }));
                e.target.reset();
                fetchStudentRequirements(studentId); 
                setTimeout(() => setSuccessMsg(''), 4000);
            } else {
                setErrorMsg(data.error || "Failed to process document upload request.");
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (err) {
            setErrorMsg("Network execution exception connecting to server.");
        }
    };

    const getStatusColor = (statusStr) => {
        const status = statusStr?.toLowerCase();
        switch (status) {
            case 'completed':
                return '#16a34a'; // Green
            case 'submitted':
            case 'waiting for approval':
                return '#2563eb'; // Blue
            case 'rejected':
                return '#dc2626'; // Red
            case 'late':
            case 'submitted late':
                return '#ea580c'; // Orange
            case 'pending':
            default:
                return '#ca8a04'; // Yellow
        }
    };

    if (loading) return <div style={{ padding: '20px' }}>Loading requirements...</div>;

    return (
        <div className="profile-page-wrapper">
            <div className="profile-header-banner">
                <div className="profile-avatar">📋</div>
                <div className="profile-header-details">
                    <h2>My Requirements</h2>
                    <p>{studentHeader?.first_name} {studentHeader?.last_name} ({studentHeader?.program_id} - {studentHeader?.year_level} Year)</p>
                    <span className="student-id-badge">{studentId}</span>
                </div>
            </div>

            {errorMsg && <div className="error-message" style={{ margin: '15px 0' }}>{errorMsg}</div>}
            {successMsg && <div className="success-message" style={{ margin: '15px 0' }}>{successMsg}</div>}

            <div className="profile-content-area" style={{ marginTop: '20px' }}>
                <div className="profile-form requirements-tab-section">
                    <div className="requirements-header-block" style={{ marginBottom: '20px' }}>
                        <h3>Medical Requirements Checklist</h3>
                        <p style={{ fontSize: '0.9rem', color: '#666' }}>
                            Upload documents from your local folder. Completed items or items past the deadline without late submission allowances are automatically locked.
                        </p>
                    </div>

                    {reqLoading ? (
                        <div className="loading-placeholder" style={{ padding: '20px', textAlign: 'center' }}>
                            Loading requirements checklist...
                        </div>
                    ) : requirementsList.length === 0 ? (
                        <div className="empty-state" style={{ textAlign: 'center', padding: '30px 10px' }}>
                            <p>No requirements assigned to your academic profile at this time.</p>
                        </div>
                    ) : (
                        <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
                            <table className="profile-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #eaeaea', backgroundColor: '#f9f9f9' }}>
                                        <th style={{ padding: '12px' }}>Requirement Name</th>
                                        <th style={{ padding: '12px' }}>Classification</th>
                                        <th style={{ padding: '12px' }}>Submission Deadline</th>
                                        <th style={{ padding: '12px' }}>Status</th>
                                        <th style={{ padding: '12px' }}>Nurse Remarks</th>
                                        <th style={{ padding: '12px' }}>Local Folder Upload Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requirementsList.map((req) => {
                                        const isCompleted = req.status?.toLowerCase() === 'completed';
                                        const deadlineDate = req.submission_deadline ? new Date(req.submission_deadline) : null;
                                        const isPastDeadline = deadlineDate && new Date() > deadlineDate;
                                        const allowsLate = req.allow_late_submission === 1 || req.allow_late_submission === true || req.allow_late_submission === '1';
                                        
                                        // Lock submission if status is Completed OR if past deadline without late permission
                                        const submissionIsLocked = isCompleted || (isPastDeadline && !allowsLate);
                                        const fileIsPresent = !!req.file_url;

                                        const displayStatus = req.status?.toLowerCase() === 'submitted' 
                                            ? 'Waiting for approval' 
                                            : (req.status || 'Pending');

                                        return (
                                            <tr key={req.requirement_name} style={{ borderBottom: '1px solid #eee', backgroundColor: submissionIsLocked ? '#fafafa' : 'transparent' }}>
                                                <td style={{ padding: '12px', fontWeight: '500' }}>
                                                    <div style={{ color: submissionIsLocked ? '#666' : '#333' }}>{req.requirement_name}</div>
                                                    {fileIsPresent && (
                                                        <div style={{ marginTop: '5px' }}>
                                                            <a 
                                                                href={req.file_url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                style={{ fontSize: '0.82rem', color: '#0056b3', textDecoration: 'underline' }}
                                                            >
                                                                View Current Submission
                                                            </a>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px' }}>
                                                    <span style={{
                                                        fontSize: '0.8rem',
                                                        padding: '3px 8px',
                                                        borderRadius: '4px',
                                                        backgroundColor: req.type === 'Special' ? '#fff2e6' : '#e6f7ff',
                                                        color: req.type === 'Special' ? '#d46b08' : '#0050b3'
                                                    }}>
                                                        {req.type || 'Program'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px', color: isPastDeadline ? '#ff4d4f' : '#333' }}>
                                                    {deadlineDate 
                                                        ? deadlineDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) 
                                                        : 'No Specified Deadline'}
                                                </td>
                                                <td style={{ padding: '12px' }}>
                                                    <span style={{
                                                        fontWeight: 'bold',
                                                        fontSize: '0.85rem',
                                                        color: getStatusColor(req.status)
                                                    }}>
                                                        {displayStatus}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px', fontSize: '0.88rem', color: '#555' }}>
                                                    {req.nurse_remarks || <span style={{ color: '#ccc' }}>—</span>}
                                                </td>
                                                <td style={{ padding: '12px' }}>
                                                    {submissionIsLocked ? (
                                                        <span style={{ 
                                                            color: isCompleted ? '#16a34a' : '#ff4d4f', 
                                                            fontSize: '0.85rem', 
                                                            fontWeight: '600' 
                                                        }}>
                                                            {isCompleted ? '✓ Completed (Upload Closed)' : '🔒 Closed (Deadline Passed)'}
                                                        </span>
                                                    ) : (
                                                        <form 
                                                            onSubmit={(e) => handleUploadSubmit(e, req.requirement_name, isPastDeadline)} 
                                                            style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
                                                        >
                                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                <input 
                                                                    type="file" 
                                                                    onChange={(e) => handleFileChange(req.requirement_name, e.target.files[0])}
                                                                    required
                                                                    style={{
                                                                        fontSize: '0.85rem',
                                                                        border: '1px solid #ccc',
                                                                        borderRadius: '4px',
                                                                        padding: '4px',
                                                                        background: '#fff'
                                                                    }}
                                                                />
                                                                <button 
                                                                    type="submit" 
                                                                    style={{
                                                                        padding: '6px 12px',
                                                                        fontSize: '0.85rem',
                                                                        backgroundColor: isPastDeadline ? '#e6a23c' : '#1890ff',
                                                                        color: '#fff',
                                                                        border: 'none',
                                                                        borderRadius: '4px',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    {fileIsPresent ? 'Re-upload' : (isPastDeadline ? 'Submit Late' : 'Submit')}
                                                                </button>
                                                            </div>
                                                            {isPastDeadline && allowsLate && (
                                                                <span style={{ color: '#e6a23c', fontSize: '0.78rem', fontWeight: '500' }}>
                                                                    Allow late Submission.
                                                                </span>
                                                            )}
                                                        </form>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}