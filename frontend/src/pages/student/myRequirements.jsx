// MyRequirements.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/student/MyRequirements.css';

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
                return '#15803d'; // STI Emerald Success Green
            case 'submitted':
            case 'waiting for approval':
                return '#002b49'; // STI Navy Blue
            case 'rejected':
                return '#dc2626'; // Standard Red
            case 'late':
            case 'submitted late':
                return '#d97706'; // STI Gold / Amber
            case 'pending':
            default:
                return '#b45309'; // Dark Gold / Brown-Yellow
        }
    };

    if (loading) return <div className="loading-state-mr">Loading requirements...</div>;

    return (
        <div className="wrapper-mr">
            <div className="header-banner-mr">
                <div className="avatar-mr">📋</div>
                <div className="header-details-mr">
                    <h2>My Requirements</h2>
                    <p>{studentHeader?.first_name} {studentHeader?.last_name} ({studentHeader?.program_id} - {studentHeader?.year_level} Year)</p>
                    <span className="student-id-badge-mr">{studentId}</span>
                </div>
            </div>

            {errorMsg && <div className="error-message-mr">{errorMsg}</div>}
            {successMsg && <div className="success-message-mr">{successMsg}</div>}

            <div className="content-area-mr">
                <div className="form-section-mr">
                    <div className="header-block-mr">
                        <h3>Medical Requirements Checklist</h3>
                        <p className="header-desc-mr">
                            Upload documents from your local folder. Completed items or items past the deadline without late submission allowances are automatically locked.
                        </p>
                    </div>

                    {reqLoading ? (
                        <div className="loading-placeholder-mr">
                            Loading requirements checklist...
                        </div>
                    ) : requirementsList.length === 0 ? (
                        <div className="empty-state-mr">
                            <p>No requirements assigned to your academic profile at this time.</p>
                        </div>
                    ) : (
                        <div className="table-wrapper-mr">
                            <table className="table-mr">
                                <thead>
                                    <tr className="table-head-row-mr">
                                        <th>Requirement Name</th>
                                        <th>Classification</th>
                                        <th>Submission Deadline</th>
                                        <th>Status</th>
                                        <th>Nurse Remarks</th>
                                        <th>Local Folder Upload Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requirementsList.map((req) => {
                                        const isCompleted = req.status?.toLowerCase() === 'completed';
                                        const deadlineDate = req.submission_deadline ? new Date(req.submission_deadline) : null;
                                        const isPastDeadline = deadlineDate && new Date() > deadlineDate;
                                        const allowsLate = req.allow_late_submission === 1 || req.allow_late_submission === true || req.allow_late_submission === '1';
                                        
                                        const submissionIsLocked = isCompleted || (isPastDeadline && !allowsLate);
                                        const fileIsPresent = !!req.file_url;

                                        const displayStatus = req.status?.toLowerCase() === 'submitted' 
                                            ? 'Waiting for approval' 
                                            : (req.status || 'Pending');

                                        return (
                                            <tr key={req.requirement_name} className={`table-row-mr ${submissionIsLocked ? 'locked-row-mr' : ''}`}>
                                                <td className="cell-name-mr" data-label="Requirement Name">
                                                    <div className={submissionIsLocked ? 'text-muted-mr' : 'text-dark-mr'}>
                                                        {req.requirement_name}
                                                    </div>
                                                    {fileIsPresent && (
                                                        <div className="file-link-container-mr">
                                                            <a 
                                                                href={req.file_url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="file-link-mr"
                                                            >
                                                                View Current Submission
                                                            </a>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="cell-type-mr" data-label="Classification">
                                                    <span className={req.type === 'Special' ? 'badge-special-mr' : 'badge-program-mr'}>
                                                        {req.type || 'Program'}
                                                    </span>
                                                </td>
                                                <td className={`cell-deadline-mr ${isPastDeadline ? 'deadline-past-mr' : ''}`} data-label="Deadline">
                                                    {deadlineDate 
                                                        ? deadlineDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) 
                                                        : 'No Specified Deadline'}
                                                </td>
                                                <td className="cell-status-mr" data-label="Status">
                                                    <span 
                                                        className="status-badge-mr" 
                                                        style={{ color: getStatusColor(req.status) }}
                                                    >
                                                        {displayStatus}
                                                    </span>
                                                </td>
                                                <td className="cell-remarks-mr" data-label="Nurse Remarks">
                                                    {req.nurse_remarks || <span className="no-remarks-mr">None</span>}
                                                </td>
                                                <td className="cell-action-mr" data-label="Upload Action">
                                                    {submissionIsLocked ? (
                                                        <span className={`status-lock-mr ${isCompleted ? 'completed-text-mr' : 'closed-text-mr'}`}>
                                                            {isCompleted ? '✓ Completed (Upload Closed)' : '🔒 Closed (Deadline Passed)'}
                                                        </span>
                                                    ) : (
                                                        <form 
                                                            onSubmit={(e) => handleUploadSubmit(e, req.requirement_name, isPastDeadline)} 
                                                            className="upload-form-mr"
                                                        >
                                                            <div className="upload-input-group-mr">
                                                                <input 
                                                                    type="file" 
                                                                    onChange={(e) => handleFileChange(req.requirement_name, e.target.files[0])}
                                                                    required
                                                                    className="file-input-mr"
                                                                />
                                                                <button 
                                                                    type="submit" 
                                                                    className={`submit-btn-mr ${isPastDeadline ? 'btn-late-mr' : 'btn-normal-mr'}`}
                                                                >
                                                                    {fileIsPresent ? 'Re-upload' : (isPastDeadline ? 'Submit Late' : 'Submit')}
                                                                </button>
                                                            </div>
                                                            {isPastDeadline && allowsLate && (
                                                                <span className="late-warning-mr">
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