// MyRequirements.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ClipboardList, 
    ExternalLink, 
    Eye, 
    Upload, 
    CheckCircle, 
    Lock, 
    X, 
    FileText 
} from 'lucide-react';
import { formatDate } from '../../utils/datetime';
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

    // File Preview Modal State
    const [previewModal, setPreviewModal] = useState({
        isOpen: false,
        title: '',
        url: '',
        content: '',
        fileType: 'unknown',
        isBlob: false
    });

    useEffect(() => {
        const loadStudentData = async () => {
            try {
                // 1. Read from sessionStorage first (falling back to localStorage)
                const storedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
                if (!storedUser) {
                    navigate('/');
                    return;
                }
                const user = JSON.parse(storedUser);

                // 2. Resolve target user ID property safely
                const targetUserId = user.user_id || user.id || user.UserID || user.userId;
                if (!targetUserId) {
                    setErrorMsg("Invalid user session context.");
                    return;
                }

                const studentRes = await fetch(`http://localhost:3001/api/get-student/${targetUserId}`);
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

    // Helper: Determine file display category
    const getFileTypeCategory = (mimeOrExt) => {
        const val = mimeOrExt?.toLowerCase() || '';
        if (val.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].some(ext => val.includes(ext))) {
            return 'image';
        }
        if (val.includes('pdf')) {
            return 'pdf';
        }
        if (val.includes('video') || ['mp4', 'webm', 'ogg'].some(ext => val.includes(ext))) {
            return 'video';
        }
        if (val.includes('audio') || ['mp3', 'wav', 'ogg'].some(ext => val.includes(ext))) {
            return 'audio';
        }
        if (val.includes('text') || val.includes('json') || ['txt', 'csv', 'json', 'log'].some(ext => val.includes(ext))) {
            return 'text';
        }
        return 'unknown';
    };

    // Open preview for local selected file (Pre-upload)
    const handlePreviewLocal = (reqName) => {
        const file = uploadFiles[reqName];
        if (!file) return;

        const category = getFileTypeCategory(file.type || file.name);

        if (category === 'text') {
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewModal({
                    isOpen: true,
                    title: `Local File Preview: ${file.name}`,
                    url: '',
                    content: e.target.result,
                    fileType: 'text',
                    isBlob: false
                });
            };
            reader.readAsText(file);
        } else {
            const objectUrl = URL.createObjectURL(file);
            setPreviewModal({
                isOpen: true,
                title: `Local File Preview: ${file.name}`,
                url: objectUrl,
                content: '',
                fileType: category,
                isBlob: true
            });
        }
    };

    // Close Modal & clean up object URLs
    const closePreviewModal = () => {
        if (previewModal.isBlob && previewModal.url) {
            URL.revokeObjectURL(previewModal.url);
        }
        setPreviewModal({
            isOpen: false,
            title: '',
            url: '',
            content: '',
            fileType: 'unknown',
            isBlob: false
        });
    };

    const getStatusColor = (statusStr) => {
        const status = statusStr?.toLowerCase();
        switch (status) {
            case 'completed':
                return 'var(--status-adequate-text)';
            case 'submitted':
            case 'waiting for approval':
                return 'var(--text-brand)';
            case 'rejected':
                return 'var(--status-critical-text)';
            case 'late':
            case 'submitted late':
                return 'var(--status-low-text)';
            case 'pending':
            default:
                return 'var(--status-low-text)';
        }
    };

    if (loading) return <div className="loading-state-mr">Loading requirements...</div>;

    return (
        <div className="wrapper-mr">
            <div className="header-banner-mr">
                <div className="avatar-mr">
                    <ClipboardList size={30} />
                </div>
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
                                        const selectedLocalFile = uploadFiles[req.requirement_name];

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
                                                                Open Original
                                                                <ExternalLink size={12} style={{ marginLeft: '4px' }} />
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
                                                        ? formatDate(deadlineDate) 
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
                                                            {isCompleted ? (
                                                                <>
                                                                    <CheckCircle size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                                    Completed (Upload Closed)
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Lock size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                                    Closed (Deadline Passed)
                                                                </>
                                                            )}
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
                                                                {selectedLocalFile && (
                                                                    <button 
                                                                        type="button" 
                                                                        className="btn-local-preview-mr"
                                                                        onClick={() => handlePreviewLocal(req.requirement_name)}
                                                                        title="Preview selected local file before uploading"
                                                                    >
                                                                        <Eye size={14} style={{ marginRight: '4px' }} />
                                                                        Preview
                                                                    </button>
                                                                )}
                                                                <button 
                                                                    type="submit" 
                                                                    className={`submit-btn-mr ${isPastDeadline ? 'btn-late-mr' : 'btn-normal-mr'}`}
                                                                >
                                                                    <Upload size={14} style={{ marginRight: '4px' }} />
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

            {/* File Preview Modal */}
            {previewModal.isOpen && (
                <div className="modal-overlay-mr" onClick={closePreviewModal}>
                    <div className="modal-container-mr" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-mr">
                            <h4>{previewModal.title}</h4>
                            <button type="button" className="modal-close-btn-mr" onClick={closePreviewModal}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal-body-mr">
                            {previewModal.fileType === 'image' && (
                                <img src={previewModal.url} alt="Requirement Document Preview" className="preview-image-mr" />
                            )}

                            {previewModal.fileType === 'pdf' && (
                                <iframe src={previewModal.url} title="PDF Requirement Preview" className="preview-iframe-mr" />
                            )}

                            {previewModal.fileType === 'video' && (
                                <video src={previewModal.url} controls className="preview-video-mr" />
                            )}

                            {previewModal.fileType === 'audio' && (
                                <audio src={previewModal.url} controls className="preview-audio-mr" />
                            )}

                            {previewModal.fileType === 'text' && (
                                <pre className="preview-text-box-mr">
                                    <code>{previewModal.content}</code>
                                </pre>
                            )}

                            {previewModal.fileType === 'unknown' && (
                                <div className="preview-unsupported-mr">
                                    <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        <FileText size={18} />
                                        Preview unavailable for this file format.
                                    </p>
                                    {previewModal.url && (
                                        <a href={previewModal.url} target="_blank" rel="noopener noreferrer" className="download-fallback-mr">
                                            Download or View File
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}