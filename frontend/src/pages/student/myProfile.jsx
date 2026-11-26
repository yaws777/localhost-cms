// MyProfile.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../../utils/datetime';
import { AlertTriangle, CheckCircle, Clock, ExternalLink, FileText, Hourglass, Inbox, Lock, MessageSquare, Pencil, Send, Trash2, Upload, X, XCircle } from 'lucide-react';
import { CONDITION_LABELS } from '../../components/common/HealthProofList';
import ProofPreview from '../../components/common/ProofPreview';
import HealthInfoView from '../../components/common/HealthInfoView';
import { useAlert } from '../../context/AlertContext';
import '../../styles/student/MyProfile.css';

export default function MyProfile() {
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useAlert();
    const [activeTab, setActiveTab] = useState('personal');
    const [editingHealth, setEditingHealth] = useState(false);
    const [healthBackup, setHealthBackup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    const [studentHeader, setStudentHeader] = useState(null);
    const [studentId, setStudentId] = useState(null);

    const [personalInfo, setPersonalInfo] = useState({});
    const [healthInfo, setHealthInfo] = useState({});
    const [healthProofs, setHealthProofs] = useState({});
    // New proof files picked while editing the health history, keyed by the condition's has_* flag
    const [proofFiles, setProofFiles] = useState({});
    // bumped on Remove so the native file input is remounted and forgets its file
    const [proofInputKeys, setProofInputKeys] = useState({});
    const [showReview, setShowReview] = useState(false);
    const [saving, setSaving] = useState(false);

    const [requirementsList, setRequirementsList] = useState([]);
    const [reqLoading, setReqLoading] = useState(false);
    const [uploadFiles, setUploadFiles] = useState({});
    const [reqFilter, setReqFilter] = useState('all');
    const [dragOver, setDragOver] = useState(null);

    useEffect(() => {
        const loadData = async () => {
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

                const studentRes = await fetch(`https://localhost-cms.onrender.com/api/get-student/${targetUserId}`);
                const studentData = await studentRes.json();

                if (studentData.success) {
                    setStudentId(studentData.student.student_id);
                    setStudentHeader(studentData.student);

                    const profileRes = await fetch(`https://localhost-cms.onrender.com/api/profile/${studentData.student.student_id}`);
                    const profileData = await profileRes.json();

                    if (profileData.success) {
                        if (profileData.personalInfo?.birth_date) {
                            profileData.personalInfo.birth_date = profileData.personalInfo.birth_date.split('T')[0];
                        }
                        if (profileData.healthInfo?.seizure_last_episode_date) {
                            profileData.healthInfo.seizure_last_episode_date = profileData.healthInfo.seizure_last_episode_date.split('T')[0];
                        }
                        if (profileData.healthInfo?.surgery_date) {
                            profileData.healthInfo.surgery_date = profileData.healthInfo.surgery_date.split('T')[0];
                        }

                        const parsedHealth = { ...profileData.healthInfo };
                        for (let key in parsedHealth) {
                            if (parsedHealth[key] === 1) parsedHealth[key] = true;
                            if (parsedHealth[key] === 0) parsedHealth[key] = false;
                        }
                        
                        setPersonalInfo(profileData.personalInfo || {});
                        setHealthInfo(parsedHealth || {});
                        setHealthProofs(profileData.healthProofs || {});
                    }
                } else {
                    setErrorMsg("Student record not found.");
                }
            } catch (err) {
                setErrorMsg("Network error loading profile.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [navigate]);

    const fetchStudentRequirements = async (id) => {
        if (!id) return;
        setReqLoading(true);
        try {
            const response = await fetch(`https://localhost-cms.onrender.com/api/students/${id}/full-requirements`);
            const data = await response.json();
            if (Array.isArray(data)) {
                setRequirementsList(data);
            } else {
                console.error("Invalid response format received for data configurations.");
            }
        } catch (err) {
            console.error("Failed fetching academic metrics checklists:", err);
        } finally {
            setReqLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'requirements' && studentId) {
            fetchStudentRequirements(studentId);
        }
    }, [activeTab, studentId]);

    const handlePersonalChange = (e) => setPersonalInfo({ ...personalInfo, [e.target.name]: e.target.value });
    const handleHealthChange = (e) => setHealthInfo({ ...healthInfo, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

    const handleFileChange = (reqName, file) => {
        setUploadFiles(prev => ({ ...prev, [reqName]: file }));
    };

    const handleUploadSubmit = async (reqName, isPastDeadline, hasCurrentFile) => {
        const targetFile = uploadFiles[reqName];

        if (!targetFile) {
            showAlert('Choose a file first.', 'warning');
            return;
        }

        if (hasCurrentFile) {
            const ok = await showConfirm('The current file is replaced.', { confirmLabel: 'Replace', title: 'Replace file?' });
            if (!ok) return;
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
                showAlert(`${reqName} submitted.`, 'success');
                setUploadFiles(prev => ({ ...prev, [reqName]: null }));
                fetchStudentRequirements(studentId);
            } else {
                showAlert(data.error || 'Cannot submit the file.', 'error');
            }
        } catch (err) {
            showAlert('Cannot reach the server.', 'error');
        }
    };

    const REQ_GROUPS = {
        todo: { label: 'To do', tone: 'req-tone-todo', Icon: Clock },
        waiting: { label: 'Waiting for approval', tone: 'req-tone-waiting', Icon: Hourglass },
        rejected: { label: 'Rejected', tone: 'req-tone-rejected', Icon: XCircle },
        done: { label: 'Completed', tone: 'req-tone-done', Icon: CheckCircle },
        closed: { label: 'Closed', tone: 'req-tone-closed', Icon: Lock }
    };
    const REQ_ORDER = { todo: 0, waiting: 1, closed: 2, done: 3 };
    const DAY_MS = 86400000;
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const relativeDays = (n) => {
        if (n === 0) return 'Today';
        if (n === 1) return 'Tomorrow';
        if (n > 1) return `In ${n} days`;
        if (n === -1) return 'Yesterday';
        return `${Math.abs(n)} days ago`;
    };
    const fileSizeText = (bytes) => (bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`);

    // One row of the checklist -> status, lock and filter group
    const describeRequirement = (req) => {
        const status = req.status?.toLowerCase();
        const deadlineDate = req.submission_deadline ? new Date(req.submission_deadline) : null;
        const days = deadlineDate ? Math.round((startOfDay(deadlineDate) - startOfDay(new Date())) / DAY_MS) : null;
        const isPast = days !== null && days < 0;
        const allowsLate = req.allow_late_submission === 1 || req.allow_late_submission === true || req.allow_late_submission === '1';
        const isCompleted = status === 'completed';
        const isWaiting = status === 'submitted' || status === 'waiting for approval';
        const locked = isCompleted || (isPast && !allowsLate && !isWaiting);
        let group = 'todo';
        if (isCompleted) group = 'done';
        else if (locked) group = 'closed';
        else if (isWaiting) group = 'waiting';
        const view = group === 'todo' && status === 'rejected' ? 'rejected' : group;
        return { deadlineDate, days, isPast, allowsLate, locked, group, view };
    };

    const requirementRows = requirementsList
        .map((req) => ({ req, info: describeRequirement(req) }))
        .sort((a, b) => {
            const g = REQ_ORDER[a.info.group] - REQ_ORDER[b.info.group];
            if (g) return g;
            if (a.info.group === 'todo') {
                const ar = a.info.view === 'rejected' ? 0 : 1;
                const br = b.info.view === 'rejected' ? 0 : 1;
                if (ar !== br) return ar - br;
            }
            return (a.info.deadlineDate?.getTime() ?? Infinity) - (b.info.deadlineDate?.getTime() ?? Infinity);
        });
    const reqCounts = { all: requirementRows.length, todo: 0, waiting: 0, done: 0, closed: 0 };
    requirementRows.forEach((row) => { reqCounts[row.info.group] += 1; });
    const reqPercent = reqCounts.all ? Math.round((reqCounts.done / reqCounts.all) * 100) : 0;
    const visibleRequirements = requirementRows.filter((row) => reqFilter === 'all' || row.info.group === reqFilter);

    // Ticked conditions: each one needs a proof (a file picked now, or one already saved)
    const tickedConditions = Object.keys(CONDITION_LABELS).filter((key) => healthInfo[key]);
    const missingProofs = () => tickedConditions.filter((key) => !proofFiles[key] && !healthProofs[key]);

    const handleProofChange = (key, file) => setProofFiles((prev) => ({ ...prev, [key]: file || null }));
    const removeProof = (key) => {
        handleProofChange(key, null);
        setProofInputKeys((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    };

    const leaveHealthEdit = () => {
        setEditingHealth(false);
        setProofFiles({});
        setShowReview(false);
    };

    // Esc closes the review window
    useEffect(() => {
        if (!showReview) return undefined;
        const onKey = (e) => { if (e.key === 'Escape' && !saving) setShowReview(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [showReview, saving]);

    // Personal tab: JSON with the personal info only, so a student with an old health history is never blocked here
    const handleSaveChanges = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        try {
            const response = await fetch('https://localhost-cms.onrender.com/api/update-profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: studentId, personalInfo })
            });
            const data = await response.json();
            if (data.success) {
                showAlert('Changes saved.', 'success');
            } else {
                showAlert(data.message || 'Cannot save the changes.', 'error');
            }
        } catch (error) {
            showAlert('Cannot reach the server.', 'error');
        }
    };

    // Health tab, step 1: every ticked condition needs a proof, then the student reviews the files before sending
    const handleReviewHealth = (e) => {
        e.preventDefault();
        const missing = missingProofs();
        if (missing.length > 0) {
            showAlert(`Upload a proof file for: ${missing.map((k) => CONDITION_LABELS[k]).join(', ')}.`, 'warning');
            return;
        }
        setShowReview(true);
    };

    // Health tab, step 2: multipart. student_id goes first because the upload file name is built from it.
    const handleSubmitHealth = async () => {
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('student_id', studentId);
            formData.append('healthInfo', JSON.stringify(healthInfo));
            tickedConditions.forEach((key) => {
                if (proofFiles[key]) formData.append(`proof_${key}`, proofFiles[key]);
            });

            const response = await fetch('https://localhost-cms.onrender.com/api/update-profile', { method: 'PUT', body: formData });
            const data = await response.json();
            if (data.success) {
                const profileRes = await fetch(`https://localhost-cms.onrender.com/api/profile/${studentId}`);
                const profileData = await profileRes.json();
                if (profileData.success) setHealthProofs(profileData.healthProofs || {});
                leaveHealthEdit();
                showAlert('Health history saved.', 'success');
            } else if (Array.isArray(data.missing) && data.missing.length > 0) {
                setShowReview(false);
                showAlert(`Upload a proof file for: ${data.missing.map((k) => CONDITION_LABELS[k] || k).join(', ')}.`, 'warning');
            } else {
                setShowReview(false);
                showAlert(data.message || 'Cannot save the health history.', 'error');
            }
        } catch (error) {
            setShowReview(false);
            showAlert('Cannot reach the server.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading profile...</div>;

    return (
        <div className="profile-page-wrapper">
            <div className="profile-header-banner">
                <div className="profile-avatar" role="img" aria-label={`${studentHeader?.first_name || ''} ${studentHeader?.last_name || ''}`.trim()}>
                    {`${(studentHeader?.first_name || '').trim().charAt(0)}${(studentHeader?.last_name || '').trim().charAt(0)}`.toUpperCase()}
                </div>
                <div className="profile-header-details">
                    <h2>{studentHeader?.first_name} {studentHeader?.last_name}</h2>
                    <p>{studentHeader?.program_id} - {studentHeader?.year_level}{studentHeader?.section}</p>
                    <span className="student-id-badge">{studentId}</span>
                </div>
            </div>

            <div className="profile-tabs">
                <button className={activeTab === 'personal' ? 'active' : ''} onClick={() => setActiveTab('personal')}>Personal Info</button>
                <button className={activeTab === 'health' ? 'active' : ''} onClick={() => setActiveTab('health')}>Health Information</button>
                <button className={activeTab === 'requirements' ? 'active' : ''} onClick={() => setActiveTab('requirements')}>Requirements</button>
            </div>

            {errorMsg && <div className="error-message" role="alert">{errorMsg}</div>}

            <div className="profile-content-area">
                {activeTab === 'personal' && (
                    <form onSubmit={handleSaveChanges} className="profile-form">
                        <h3>Personal Information</h3>
                        <div className="form-grid">
                            <label>Gender *
                                <select name="gender" value={personalInfo.gender || ''} onChange={handlePersonalChange} required>
                                    <option value="">Select</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </label>
                            <label>Date of Birth *
                                <input type="date" name="birth_date" value={personalInfo.birth_date || ''} onChange={handlePersonalChange} required />
                            </label>
                            <label>Age
                                <input type="number" name="age" value={personalInfo.age || ''} onChange={handlePersonalChange} />
                            </label>
                            <label>Contact No. *
                                <input type="text" name="contact_number" value={personalInfo.contact_number || ''} onChange={handlePersonalChange} required />
                            </label>
                            <label className="full-width">Address *
                                <input type="text" name="address" value={personalInfo.address || ''} onChange={handlePersonalChange} required />
                            </label>
                            <label>Height (cm)
                                <input type="number" step="0.01" name="height_cm" value={personalInfo.height_cm || ''} onChange={handlePersonalChange} />
                            </label>
                            <label>Weight (kg)
                                <input type="number" step="0.01" name="weight_kg" value={personalInfo.weight_kg || ''} onChange={handlePersonalChange} />
                            </label>
                            <label>Father's Name
                                <input type="text" name="father_name" value={personalInfo.father_name || ''} onChange={handlePersonalChange} />
                            </label>
                            <label>Mother's Name
                                <input type="text" name="mother_name" value={personalInfo.mother_name || ''} onChange={handlePersonalChange} />
                            </label>
                        </div>
                        <button type="submit" className="btn-primary-save">Save Changes</button>
                    </form>
                )}

                {activeTab === 'health' && !editingHealth && (
                    <div className="profile-form health-form-scroll">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <h3 style={{ margin: 0 }}>Health Information</h3>
                            <button
                                type="button"
                                className="btn-primary-save"
                                aria-label="Edit health history"
                                title="Edit health history"
                                onClick={() => { setHealthBackup(healthInfo); setProofFiles({}); setEditingHealth(true); }}
                                style={{ minWidth: '2.75rem', minHeight: '2.75rem', width: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                            >
                                <Pencil size={18} aria-hidden="true" />
                            </button>
                        </div>
                        <HealthInfoView studentId={studentId} healthInfo={healthInfo} healthProofs={healthProofs} personalInfo={personalInfo} />
                    </div>
                )}

                {activeTab === 'health' && editingHealth && (
                    <form onSubmit={handleReviewHealth} className="profile-form health-form-scroll">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <h3 style={{ margin: 0 }}>Health Information<span className='instruction'> (leave unchecked if none)</span></h3>
                            <button
                                type="button"
                                aria-label="Cancel editing"
                                title="Cancel editing"
                                onClick={() => { if (healthBackup) setHealthInfo(healthBackup); leaveHealthEdit(); }}
                                style={{ minWidth: '2.75rem', minHeight: '2.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '0.0625rem solid var(--card-border)', borderRadius: '0.5rem', color: 'var(--text-primary)', cursor: 'pointer' }}
                            >
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_allergies" checked={healthInfo.has_allergies || false} onChange={handleHealthChange} /> History of Allergies</label>
                            {healthInfo.has_allergies && (
                                <div className="sub-fields">
                                    <label>Food: <input type="text" name="allergy_food" value={healthInfo.allergy_food || ''} onChange={handleHealthChange} /></label>
                                    <label>Medicine: <input type="text" name="allergy_medicine" value={healthInfo.allergy_medicine || ''} onChange={handleHealthChange} /></label>
                                    <label>Insect Sting: <input type="text" name="allergy_insect_sting" value={healthInfo.allergy_insect_sting || ''} onChange={handleHealthChange} /></label>
                                    <label>Environmental: <input type="text" name="allergy_environmental" value={healthInfo.allergy_environmental || ''} onChange={handleHealthChange} /></label>
                                    <label>Others: <input type="text" name="allergy_others" value={healthInfo.allergy_others || ''} onChange={handleHealthChange} /></label>
                                    
                                    <h4>Reactions:</h4>
                                    <div className="checkbox-grid">
                                        <label><input type="checkbox" name="reaction_diarrhea" checked={healthInfo.reaction_diarrhea || false} onChange={handleHealthChange} /> Diarrhea</label>
                                        <label><input type="checkbox" name="reaction_hives" checked={healthInfo.reaction_hives || false} onChange={handleHealthChange} /> Hives</label>
                                        <label><input type="checkbox" name="reaction_local" checked={healthInfo.reaction_local || false} onChange={handleHealthChange} /> Local Reaction</label>
                                        <label><input type="checkbox" name="reaction_rash" checked={healthInfo.reaction_rash || false} onChange={handleHealthChange} /> Rash</label>
                                        <label><input type="checkbox" name="reaction_swelling" checked={healthInfo.reaction_swelling || false} onChange={handleHealthChange} /> Swelling</label>
                                        <label><input type="checkbox" name="reaction_trouble_breathing" checked={healthInfo.reaction_trouble_breathing || false} onChange={handleHealthChange} /> Trouble Breathing</label>
                                    </div>
                                    <label>Other Reaction: <input type="text" name="reaction_others" value={healthInfo.reaction_others || ''} onChange={handleHealthChange} /></label>
                                    <label>Medication Taken: <input type="text" name="allergy_medication_taken" value={healthInfo.allergy_medication_taken || ''} onChange={handleHealthChange} /></label>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_asthma" checked={healthInfo.has_asthma || false} onChange={handleHealthChange} /> Asthma</label>
                            {healthInfo.has_asthma && (
                                <div className="sub-fields">
                                    <label>Triggers: <input type="text" name="asthma_triggers" value={healthInfo.asthma_triggers || ''} onChange={handleHealthChange} /></label>
                                    <label>Medication Taken: <input type="text" name="asthma_medication_taken" value={healthInfo.asthma_medication_taken || ''} onChange={handleHealthChange} /></label>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_other_respiratory" checked={healthInfo.has_other_respiratory || false} onChange={handleHealthChange} /> Other Respiratory Problems</label>
                            {healthInfo.has_other_respiratory && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" name="other_respiratory_specify" value={healthInfo.other_respiratory_specify || ''} onChange={handleHealthChange} /></label>
                                    <label>Medication Taken: <input type="text" name="other_respiratory_medication" value={healthInfo.other_respiratory_medication || ''} onChange={handleHealthChange} /></label>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_blood_disorders" checked={healthInfo.has_blood_disorders || false} onChange={handleHealthChange} /> Blood Disorders</label>
                            {healthInfo.has_blood_disorders && (
                                <div className="sub-fields checkbox-grid">
                                    <label><input type="checkbox" name="blood_disorder_anemia" checked={healthInfo.blood_disorder_anemia || false} onChange={handleHealthChange} /> Anemia</label>
                                    <label><input type="checkbox" name="blood_disorder_leukopenia" checked={healthInfo.blood_disorder_leukopenia || false} onChange={handleHealthChange} /> Leukopenia</label>
                                    <label><input type="checkbox" name="blood_disorder_thrombocytopenia" checked={healthInfo.blood_disorder_thrombocytopenia || false} onChange={handleHealthChange} /> Thrombocytopenia</label>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_chicken_pox" checked={healthInfo.has_chicken_pox || false} onChange={handleHealthChange} /> Chicken Pox</label>
                            {healthInfo.has_chicken_pox && (
                                <div className="sub-fields">
                                    <label>Age: <input type="number" name="chicken_pox_age" value={healthInfo.chicken_pox_age || ''} onChange={handleHealthChange} /></label>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_digestive_disorders" checked={healthInfo.has_digestive_disorders || false} onChange={handleHealthChange} /> Digestive Disorders</label>
                            {healthInfo.has_digestive_disorders && (
                                <div className="sub-fields">
                                    <div className="checkbox-grid">
                                        <label><input type="checkbox" name="digestive_ulcer" checked={healthInfo.digestive_ulcer || false} onChange={handleHealthChange} /> Ulcer</label>
                                        <label><input type="checkbox" name="digestive_appendicitis" checked={healthInfo.digestive_appendicitis || false} onChange={handleHealthChange} /> Appendicitis</label>
                                        <label><input type="checkbox" name="digestive_gastritis" checked={healthInfo.digestive_gastritis || false} onChange={handleHealthChange} /> Gastritis</label>
                                        <label><input type="checkbox" name="digestive_hemorrhoids" checked={healthInfo.digestive_hemorrhoids || false} onChange={handleHealthChange} /> Hemorrhoids</label>
                                    </div>
                                    <label style={{marginTop: '10px'}}>Medication Taken: <input type="text" name="digestive_medication_taken" value={healthInfo.digestive_medication_taken || ''} onChange={handleHealthChange} /></label>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_heart_problems" checked={healthInfo.has_heart_problems || false} onChange={handleHealthChange} /> Heart Problems</label>
                            {healthInfo.has_heart_problems && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" name="heart_problems_specify" value={healthInfo.heart_problems_specify || ''} onChange={handleHealthChange} /></label>
                                    <label>Medication: <input type="text" name="heart_problems_medication" value={healthInfo.heart_problems_medication || ''} onChange={handleHealthChange} /></label>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_kidney_bladder_problems" checked={healthInfo.has_kidney_bladder_problems || false} onChange={handleHealthChange} /> Kidney/Bladder Problems</label>
                            {healthInfo.has_kidney_bladder_problems && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" name="kidney_bladder_specify" value={healthInfo.kidney_bladder_specify || ''} onChange={handleHealthChange} /></label>
                                    <label>Medication: <input type="text" name="kidney_bladder_medication" value={healthInfo.kidney_bladder_medication || ''} onChange={handleHealthChange} /></label>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_measles" checked={healthInfo.has_measles || false} onChange={handleHealthChange} /> Measles</label>
                            {healthInfo.has_measles && (
                                <div className="sub-fields">
                                    <label>Age: <input type="number" name="measles_age" value={healthInfo.measles_age || ''} onChange={handleHealthChange} /></label>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_metabolic_diseases" checked={healthInfo.has_metabolic_diseases || false} onChange={handleHealthChange} /> Metabolic Diseases</label>
                            {healthInfo.has_metabolic_diseases && (
                                <div className="sub-fields checkbox-grid">
                                    <label><input type="checkbox" name="metabolic_hyperglycemia" checked={healthInfo.metabolic_hyperglycemia || false} onChange={handleHealthChange} /> Hyperglycemia</label>
                                    <label><input type="checkbox" name="metabolic_hypoglycemia" checked={healthInfo.metabolic_hypoglycemia || false} onChange={handleHealthChange} /> Hypoglycemia</label>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_muscle_bone_disorder" checked={healthInfo.has_muscle_bone_disorder || false} onChange={handleHealthChange} /> Muscle/Bone Disorder</label>
                            {healthInfo.has_muscle_bone_disorder && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" name="muscle_bone_specify" value={healthInfo.muscle_bone_specify || ''} onChange={handleHealthChange} /></label>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_seizure_episode" checked={healthInfo.has_seizure_episode || false} onChange={handleHealthChange} /> Seizure Episode</label>
                            {healthInfo.has_seizure_episode && (
                                <div className="sub-fields">
                                    <label>Last Episode Date: <input type="date" name="seizure_last_episode_date" value={healthInfo.seizure_last_episode_date || ''} onChange={handleHealthChange} /></label>
                                    <label>Medication: <input type="text" name="seizure_medication_taken" value={healthInfo.seizure_medication_taken || ''} onChange={handleHealthChange} /></label>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_surgery" checked={healthInfo.has_surgery || false} onChange={handleHealthChange} /> History of Surgery</label>
                            {healthInfo.has_surgery && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" name="surgery_specify" value={healthInfo.surgery_specify || ''} onChange={handleHealthChange} /></label>
                                    <label>Date: <input type="date" name="surgery_date" value={healthInfo.surgery_date || ''} onChange={handleHealthChange} /></label>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_vision_problem" checked={healthInfo.has_vision_problem || false} onChange={handleHealthChange} /> Vision Problem</label>
                            {healthInfo.has_vision_problem && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" name="vision_specify" value={healthInfo.vision_specify || ''} onChange={handleHealthChange} /></label>
                                    <div className="checkbox-grid">
                                        <label><input type="checkbox" name="vision_with_eyeglasses" checked={healthInfo.vision_with_eyeglasses || false} onChange={handleHealthChange} /> Wears Eyeglasses</label>
                                        <label><input type="checkbox" name="vision_with_contact_lens" checked={healthInfo.vision_with_contact_lens || false} onChange={handleHealthChange} /> Wears Contact Lenses</label>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_hearing_problem" checked={healthInfo.has_hearing_problem || false} onChange={handleHealthChange} /> Hearing Problem</label>
                            {healthInfo.has_hearing_problem && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" name="hearing_specify" value={healthInfo.hearing_specify || ''} onChange={handleHealthChange} /></label>
                                </div>
                            )}
                        </div>

                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" name="has_other_condition" checked={healthInfo.has_other_condition || false} onChange={handleHealthChange} /> Other Condition</label>
                            {healthInfo.has_other_condition && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" name="other_condition_specify" value={healthInfo.other_condition_specify || ''} onChange={handleHealthChange} /></label>
                                </div>
                            )}
                        </div>

                        {tickedConditions.length > 0 && (
                            <div className="proof-section">
                                <h4>Proof files</h4>
                                {tickedConditions.map((key) => {
                                    const saved = healthProofs[key];
                                    const picked = proofFiles[key];
                                    const needsFile = !saved && !picked;
                                    return (
                                        <div key={key} className="proof-row">
                                            <label htmlFor={`proof-${key}`}>{CONDITION_LABELS[key]}</label>
                                            {needsFile ? (
                                                <span className="proof-chip proof-chip-bad"><AlertTriangle size={14} aria-hidden="true" /> Required</span>
                                            ) : (
                                                <span className="proof-chip proof-chip-ok"><CheckCircle size={14} aria-hidden="true" /> Attached</span>
                                            )}
                                            <div className="proof-controls">
                                                <input
                                                    key={proofInputKeys[key] || 0}
                                                    id={`proof-${key}`}
                                                    type="file"
                                                    accept="image/*,application/pdf"
                                                    onChange={(e) => handleProofChange(key, e.target.files[0])}
                                                />
                                                {picked && (
                                                    <button
                                                        type="button"
                                                        className="proof-remove"
                                                        onClick={() => removeProof(key)}
                                                        aria-label={`Remove new file for ${CONDITION_LABELS[key]}`}
                                                        title="Remove new file"
                                                    >
                                                        <Trash2 size={18} aria-hidden="true" />
                                                    </button>
                                                )}
                                            </div>
                                            <ProofPreview file={picked} saved={picked ? null : saved} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <button type="submit" className="btn-primary-save">Save Health Changes</button>
                    </form>
                )}

                {activeTab === 'requirements' && (
                    <div className="profile-form requirements-tab-section">
                        <div className="req-summary">
                            <div className="req-summary-top">
                                <h3 id="req-heading">Requirements</h3>
                                <p className="req-count"><strong>{reqCounts.done}</strong> of {reqCounts.all} complete</p>
                            </div>
                            <div
                                className="req-bar"
                                role="progressbar"
                                aria-labelledby="req-heading"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={reqPercent}
                            >
                                <span style={{ width: `${reqPercent}%` }} />
                            </div>
                            <div className="req-filters" role="group" aria-label="Filter requirements">
                                {[['all', 'All'], ['todo', 'To do'], ['waiting', 'Waiting'], ['done', 'Done'], ['closed', 'Closed']].map(([key, label]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        className="req-filter"
                                        aria-pressed={reqFilter === key}
                                        onClick={() => setReqFilter(key)}
                                    >
                                        {label}<span className="req-filter-n">{reqCounts[key]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {reqLoading ? (
                            <div className="loading-placeholder req-empty" role="status">Loading...</div>
                        ) : visibleRequirements.length === 0 ? (
                            <div className="empty-state req-empty">
                                <Inbox size={28} aria-hidden="true" />
                                <p>Nothing here.</p>
                            </div>
                        ) : (
                            <ul className="req-list">
                                {visibleRequirements.map(({ req, info }) => {
                                    const group = REQ_GROUPS[info.view];
                                    const StatusIcon = group.Icon;
                                    const picked = uploadFiles[req.requirement_name];
                                    const fileIsPresent = !!req.file_url;
                                    const dueClass = info.isPast ? 'late' : (info.days !== null && info.days <= 3 && info.group === 'todo' ? 'warn' : '');
                                    const submitLabel = info.isPast ? 'Submit late' : (fileIsPresent ? 'Re-upload' : 'Submit');
                                    const inputId = `req-file-${req.requirement_name.replace(/\W+/g, '-')}`;
                                    return (
                                        <li key={req.requirement_name} className="req-card">
                                            <div className="req-head">
                                                <span className={`req-icon ${group.tone}`}><StatusIcon size={22} aria-hidden="true" /></span>
                                                <div className="req-title">
                                                    <h4>{req.requirement_name}</h4>
                                                    <div className="req-meta">
                                                        <span className={`req-chip ${group.tone}`}><StatusIcon size={14} aria-hidden="true" />{group.label}</span>
                                                        <span className="req-tag">{req.type || 'Program'}</span>
                                                        {info.isPast && info.allowsLate && !info.locked && (
                                                            <span className="req-chip req-tone-todo"><AlertTriangle size={14} aria-hidden="true" />Late allowed</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="req-due">
                                                    <span className="req-due-label">Deadline</span>
                                                    <span className="req-due-date">{info.deadlineDate ? formatDate(info.deadlineDate) : 'No deadline'}</span>
                                                    {info.days !== null && (
                                                        <span className={`req-due-rel ${dueClass}`}>
                                                            {dueClass && (info.isPast ? <AlertTriangle size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />)}
                                                            {relativeDays(info.days)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {req.nurse_remarks && (
                                                <div className="req-remarks" role="note">
                                                    <MessageSquare size={18} aria-hidden="true" />
                                                    <div><b>Nurse remarks</b>{req.nurse_remarks}</div>
                                                </div>
                                            )}

                                            {fileIsPresent && (
                                                <div className="req-current">
                                                    <FileText size={18} aria-hidden="true" />
                                                    <a href={req.file_url} target="_blank" rel="noopener noreferrer">
                                                        Current file<ExternalLink size={14} aria-hidden="true" />
                                                    </a>
                                                </div>
                                            )}

                                            {info.group === 'done' && (
                                                <div className="req-locked req-locked-done"><CheckCircle size={18} aria-hidden="true" />Upload closed</div>
                                            )}
                                            {info.group === 'closed' && (
                                                <div className="req-locked req-locked-closed"><Lock size={18} aria-hidden="true" />Deadline passed</div>
                                            )}
                                            {!info.locked && (
                                                <div className="req-upload">
                                                    {picked ? (
                                                        <>
                                                            <div className="req-picked">
                                                                <FileText size={18} aria-hidden="true" />
                                                                <span className="req-picked-name">{picked.name}</span>
                                                                <span className="req-picked-size">{fileSizeText(picked.size)}</span>
                                                                <button
                                                                    type="button"
                                                                    className="req-btn-icon"
                                                                    aria-label={`Remove ${picked.name}`}
                                                                    title="Remove file"
                                                                    onClick={() => handleFileChange(req.requirement_name, null)}
                                                                >
                                                                    <Trash2 size={18} aria-hidden="true" />
                                                                </button>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className={`req-btn-icon ${info.isPast ? 'req-btn-late' : 'req-btn-primary'}`}
                                                                aria-label={submitLabel}
                                                                title={submitLabel}
                                                                onClick={() => handleUploadSubmit(req.requirement_name, info.isPast, fileIsPresent)}
                                                            >
                                                                <Send size={20} aria-hidden="true" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <label
                                                            htmlFor={inputId}
                                                            className={`req-drop${dragOver === req.requirement_name ? ' is-over' : ''}`}
                                                            onDragOver={(e) => { e.preventDefault(); setDragOver(req.requirement_name); }}
                                                            onDragLeave={() => setDragOver(null)}
                                                            onDrop={(e) => {
                                                                e.preventDefault();
                                                                setDragOver(null);
                                                                if (e.dataTransfer.files[0]) handleFileChange(req.requirement_name, e.dataTransfer.files[0]);
                                                            }}
                                                        >
                                                            <Upload size={20} aria-hidden="true" />
                                                            <span>{fileIsPresent ? 'Replace file' : 'Drop file or browse'}</span>
                                                            <input
                                                                id={inputId}
                                                                type="file"
                                                                onChange={(e) => handleFileChange(req.requirement_name, e.target.files[0] || null)}
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}
            </div>

            {/* Review the proof files, then Submit or go Back and change them */}
            {showReview && (
                <div className="proof-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setShowReview(false); }}>
                    <div className="proof-modal" role="dialog" aria-modal="true" aria-labelledby="proof-review-title">
                        <div className="proof-modal-head">
                            <h3 id="proof-review-title">Review proof files</h3>
                            <button type="button" className="proof-remove" onClick={() => setShowReview(false)} disabled={saving} aria-label="Close" title="Close">
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>
                        <div className="proof-modal-body">
                            {tickedConditions.map((key) => (
                                <div key={key} className="proof-review-item">
                                    <h4>{CONDITION_LABELS[key]}</h4>
                                    <ProofPreview file={proofFiles[key]} saved={proofFiles[key] ? null : healthProofs[key]} tall />
                                </div>
                            ))}
                        </div>
                        <div className="proof-modal-foot">
                            <button type="button" className="proof-btn-secondary" onClick={() => setShowReview(false)} disabled={saving} autoFocus>Back</button>
                            <button type="button" className="proof-btn-primary" onClick={handleSubmitHealth} disabled={saving}>{saving ? 'Saving...' : 'Submit'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}