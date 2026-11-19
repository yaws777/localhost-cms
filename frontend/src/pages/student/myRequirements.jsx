// MyRequirements.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList,
    ExternalLink,
    Eye,
    Upload,
    CheckCircle,
    Clock,
    XCircle,
    AlertCircle,
    AlertTriangle,
    Lock,
    X,
    FileText
} from 'lucide-react';
import { formatDate } from '../../utils/datetime';
import { useAlert } from '../../context/AlertContext';
import '../../styles/student/MyRequirements.css';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'action', label: 'To submit' },
    { key: 'waiting', label: 'Waiting' },
    { key: 'done', label: 'Completed' }
];

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_STYLE = {
    completed: { cls: 'status-ok-mr', Icon: CheckCircle },
    submitted: { cls: 'status-info-mr', Icon: Clock },
    'waiting for approval': { cls: 'status-info-mr', Icon: Clock },
    rejected: { cls: 'status-crit-mr', Icon: XCircle },
    late: { cls: 'status-warn-mr', Icon: AlertCircle },
    'submitted late': { cls: 'status-warn-mr', Icon: AlertCircle },
    pending: { cls: 'status-warn-mr', Icon: AlertCircle }
};

export default function MyRequirements() {
    const navigate = useNavigate();
    const { showAlert } = useAlert();
    const [loading, setLoading] = useState(true);

    const [studentHeader, setStudentHeader] = useState(null);
    const [studentId, setStudentId] = useState(null);

    const [requirementsList, setRequirementsList] = useState([]);
    const [reqLoading, setReqLoading] = useState(false);
    const [uploadFiles, setUploadFiles] = useState({});
    const [filter, setFilter] = useState('all');

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
                    showAlert('Invalid session.', 'error');
                    return;
                }

                const studentRes = await fetch(`https://localhost-cms.onrender.com/api/get-student/${targetUserId}`);
                const studentData = await studentRes.json();

                if (studentData.success) {
                    setStudentId(studentData.student.student_id);
                    setStudentHeader(studentData.student);
                    fetchStudentRequirements(studentData.student.student_id);
                } else {
                    showAlert('Student record not found.', 'error');
                }
            } catch (err) {
                showAlert('Network error.', 'error');
            } finally {
                setLoading(false);
            }
        };

        loadStudentData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    // Close the preview with Esc
    useEffect(() => {
        if (!previewModal.isOpen) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') closePreviewModal();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewModal.isOpen, previewModal.url, previewModal.isBlob]);

    const fetchStudentRequirements = async (id) => {
        if (!id) return;
        setReqLoading(true);
        try {
            const response = await fetch(`https://localhost-cms.onrender.com/api/students/${id}/full-requirements`);
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
        const form = e.target;
        const targetFile = uploadFiles[reqName];

        if (!targetFile) {
            showAlert('Choose a file first.', 'warning');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', targetFile);
            formData.append('is_late', isPastDeadline);

            const response = await fetch(`https://localhost-cms.onrender.com/api/students/${studentId}/requirements/${encodeURIComponent(reqName)}/submit`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (data.success) {
                showAlert(`"${reqName}" uploaded.`, 'success');
                setUploadFiles(prev => ({ ...prev, [reqName]: null }));
                form.reset();
                fetchStudentRequirements(studentId);
            } else {
                showAlert(data.error || 'Upload failed.', 'error');
            }
        } catch (err) {
            showAlert('Network error.', 'error');
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
                    title: `Preview: ${file.name}`,
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
                title: `Preview: ${file.name}`,
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

    // Describe one requirement row: lock state, filter group, deadline text
    const describe = (req) => {
        const statusKey = req.status?.toLowerCase() || 'pending';
        const isCompleted = statusKey === 'completed';
        const isWaiting = statusKey === 'submitted' || statusKey === 'waiting for approval';
        const deadlineDate = req.submission_deadline ? new Date(req.submission_deadline) : null;
        const now = new Date();
        const isPastDeadline = !!deadlineDate && now > deadlineDate;
        const allowsLate = req.allow_late_submission === 1 || req.allow_late_submission === true || req.allow_late_submission === '1';
        const locked = isCompleted || (isPastDeadline && !allowsLate);

        let group = 'action';
        if (isCompleted) group = 'done';
        else if (isWaiting) group = 'waiting';
        else if (locked) group = 'closed';

        let deadlineNote = '';
        if (deadlineDate && !isCompleted) {
            if (isPastDeadline) {
                const days = Math.floor((now - deadlineDate) / DAY_MS);
                deadlineNote = days < 1 ? 'Overdue' : `${days} day${days === 1 ? '' : 's'} overdue`;
            } else {
                const days = Math.ceil((deadlineDate - now) / DAY_MS);
                deadlineNote = `${days} day${days === 1 ? '' : 's'} left`;
            }
        }

        return { statusKey, isCompleted, deadlineDate, isPastDeadline, allowsLate, locked, group, deadlineNote };
    };

    if (loading) return <div className="loading-state-mr" role="status">Loading...</div>;

    const rows = requirementsList.map((req) => ({ req, info: describe(req) }));
    const countOf = (key) => (key === 'all' ? rows.length : rows.filter((r) => r.info.group === key).length);
    const visibleRows = filter === 'all' ? rows : rows.filter((r) => r.info.group === filter);

    return (
        <div className="wrapper-mr">
            <header className="header-banner-mr">
                <div className="who-mr">
                    <div className="avatar-mr" aria-hidden="true">
                        <ClipboardList size={32} />
                    </div>
                    <div className="header-details-mr">
                        <h2>My Requirements</h2>
                        <p>{studentHeader?.first_name} {studentHeader?.last_name} · {studentHeader?.program_id} · {studentHeader?.year_level} Year</p>
                        <span className="student-id-badge-mr">{studentId}</span>
                    </div>
                </div>
                <div className="stats-mr" role="group" aria-label="Summary">
                    <div className="stat-mr"><b>{countOf('all')}</b><span>Total</span></div>
                    <div className="stat-mr"><b>{countOf('action')}</b><span>To submit</span></div>
                    <div className="stat-mr"><b>{countOf('waiting')}</b><span>Waiting</span></div>
                    <div className="stat-mr"><b>{countOf('done')}</b><span>Completed</span></div>
                </div>
            </header>

            <section className="form-section-mr" aria-labelledby="mr-checklist-title">
                <div className="header-block-mr">
                    <h3 id="mr-checklist-title">Medical Checklist</h3>
                    <div className="tabs-mr" role="group" aria-label="Filter requirements">
                        {FILTERS.map((f) => (
                            <button
                                key={f.key}
                                type="button"
                                className={`tab-mr ${filter === f.key ? 'tab-active-mr' : ''}`}
                                aria-pressed={filter === f.key}
                                onClick={() => setFilter(f.key)}
                            >
                                {f.label}
                                <span className="tab-count-mr">{countOf(f.key)}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {reqLoading ? (
                    <div className="loading-placeholder-mr" role="status">Loading...</div>
                ) : requirementsList.length === 0 ? (
                    <div className="empty-state-mr" role="status">No requirements yet.</div>
                ) : (
                    <div className="table-wrapper-mr">
                        <table className="table-mr" role="table">
                            {/* roles kept: display:block / grid drops native table semantics */}
                            {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
                            <thead role="rowgroup">
                                <tr className="table-head-row-mr" role="row">
                                    <th role="columnheader" scope="col">Requirement</th>
                                    <th role="columnheader" scope="col">Type</th>
                                    <th role="columnheader" scope="col">Deadline</th>
                                    <th role="columnheader" scope="col">Status</th>
                                    <th role="columnheader" scope="col">Nurse remarks</th>
                                    <th role="columnheader" scope="col">Upload</th>
                                </tr>
                            </thead>
                            {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
                            <tbody role="rowgroup">
                                {visibleRows.length === 0 && (
                                    <tr className="table-row-empty-mr" role="row">
                                        <td role="cell" className="empty-state-mr">Nothing here.</td>
                                    </tr>
                                )}
                                {visibleRows.map(({ req, info }, index) => {
                                    const { statusKey, isCompleted, deadlineDate, isPastDeadline, allowsLate, locked, deadlineNote } = info;
                                    const fileIsPresent = !!req.file_url;
                                    const selectedLocalFile = uploadFiles[req.requirement_name];
                                    const statusStyle = STATUS_STYLE[statusKey] || STATUS_STYLE.pending;
                                    const StatusIcon = statusStyle.Icon;
                                    const displayStatus = statusKey === 'submitted'
                                        ? 'Waiting for approval'
                                        : (req.status || 'Pending');
                                    const submitLabel = fileIsPresent ? 'Re-upload' : (isPastDeadline ? 'Submit late' : 'Submit');
                                    const inputId = `mr-file-${index}`;

                                    return (
                                        <tr key={req.requirement_name} role="row" className={`table-row-mr ${locked ? 'locked-row-mr' : ''}`}>
                                            <td role="cell" className="cell-name-mr">
                                                <div className={locked ? 'text-muted-mr' : 'text-dark-mr'}>
                                                    {req.requirement_name}
                                                </div>
                                                {fileIsPresent && (
                                                    <a
                                                        href={req.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="file-link-mr"
                                                    >
                                                        Open original
                                                        <ExternalLink size={14} aria-hidden="true" />
                                                    </a>
                                                )}
                                            </td>
                                            <td role="cell" className="cell-type-mr" data-label="Type">
                                                <span className={req.type === 'Special' ? 'badge-special-mr' : 'badge-program-mr'}>
                                                    {req.type || 'Program'}
                                                </span>
                                            </td>
                                            <td role="cell" className={`cell-deadline-mr ${isPastDeadline && !isCompleted ? 'deadline-past-mr' : ''}`} data-label="Deadline">
                                                {deadlineDate ? formatDate(deadlineDate) : 'No deadline'}
                                                {deadlineNote && <small>{deadlineNote}</small>}
                                            </td>
                                            <td role="cell" className="cell-status-mr" data-label="Status">
                                                <span className={`status-badge-mr ${statusStyle.cls}`}>
                                                    <StatusIcon size={16} aria-hidden="true" />
                                                    {displayStatus}
                                                </span>
                                            </td>
                                            <td role="cell" className="cell-remarks-mr" data-label="Nurse remarks">
                                                {req.nurse_remarks || <span className="no-remarks-mr">none</span>}
                                            </td>
                                            <td role="cell" className="cell-action-mr" data-label="Upload">
                                                {locked ? (
                                                    <span className={`status-lock-mr ${isCompleted ? 'completed-text-mr' : 'closed-text-mr'}`}>
                                                        {isCompleted ? (
                                                            <>
                                                                <CheckCircle size={18} aria-hidden="true" />
                                                                Completed
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Lock size={18} aria-hidden="true" />
                                                                Closed
                                                            </>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <form
                                                        onSubmit={(e) => handleUploadSubmit(e, req.requirement_name, isPastDeadline)}
                                                        className="upload-form-mr"
                                                    >
                                                        <div className="upload-input-group-mr">
                                                            <label
                                                                htmlFor={inputId}
                                                                className={`file-pick-mr ${selectedLocalFile ? '' : 'file-pick-empty-mr'}`}
                                                            >
                                                                <FileText size={16} aria-hidden="true" />
                                                                <span>{selectedLocalFile ? selectedLocalFile.name : 'Choose file'}</span>
                                                                <input
                                                                    id={inputId}
                                                                    type="file"
                                                                    onChange={(e) => handleFileChange(req.requirement_name, e.target.files[0])}
                                                                    className="file-input-mr"
                                                                />
                                                            </label>
                                                            <button
                                                                type="button"
                                                                className="icon-btn-mr btn-local-preview-mr"
                                                                onClick={() => handlePreviewLocal(req.requirement_name)}
                                                                disabled={!selectedLocalFile}
                                                                aria-label="Preview file"
                                                                title="Preview file"
                                                            >
                                                                <Eye size={20} aria-hidden="true" />
                                                            </button>
                                                            <button
                                                                type="submit"
                                                                className={`icon-btn-mr submit-btn-mr ${isPastDeadline ? 'btn-late-mr' : 'btn-normal-mr'}`}
                                                                disabled={!selectedLocalFile}
                                                                aria-label={submitLabel}
                                                                title={submitLabel}
                                                            >
                                                                <Upload size={20} aria-hidden="true" />
                                                            </button>
                                                        </div>
                                                        {isPastDeadline && allowsLate && (
                                                            <span className="late-warning-mr">
                                                                <AlertTriangle size={14} aria-hidden="true" />
                                                                Late allowed
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
            </section>

            {/* File Preview Modal */}
            {previewModal.isOpen && (
                <div className="modal-overlay-mr" onClick={closePreviewModal}>
                    <div
                        className="modal-container-mr"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="mr-preview-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header-mr">
                            <h4 id="mr-preview-title">{previewModal.title}</h4>
                            <button
                                type="button"
                                className="modal-close-btn-mr"
                                onClick={closePreviewModal}
                                aria-label="Close"
                                title="Close"
                                autoFocus
                            >
                                <X size={20} aria-hidden="true" />
                            </button>
                        </div>
                        <div className="modal-body-mr">
                            {previewModal.fileType === 'image' && (
                                <img src={previewModal.url} alt="Document preview" className="preview-image-mr" />
                            )}

                            {previewModal.fileType === 'pdf' && (
                                <iframe src={previewModal.url} title="PDF preview" className="preview-iframe-mr" />
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
                                    <p className="preview-unsupported-text-mr">
                                        <FileText size={18} aria-hidden="true" />
                                        No preview for this format.
                                    </p>
                                    {previewModal.url && (
                                        <a href={previewModal.url} target="_blank" rel="noopener noreferrer" className="download-fallback-mr">
                                            Open file
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
