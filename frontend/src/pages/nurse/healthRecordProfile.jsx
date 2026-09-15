import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Folder, Lock, FileText } from 'lucide-react';
import '../../styles/nurse/HealthRecordProfile.css';

export default function HealthRecordsProfile() {
    const { studentId } = useParams(); 
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('personal');
    const [loading, setLoading] = useState(true);
    const [reqLoading, setReqLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const [studentHeader, setStudentHeader] = useState(null);
    const [personalInfo, setPersonalInfo] = useState({});
    const [healthInfo, setHealthInfo] = useState({});
    const [emergencyContact, setEmergencyContact] = useState({});
    const [requirementsList, setRequirementsList] = useState([]);

    useEffect(() => {
        const loadStudentData = async () => {
            try {
                setLoading(true);
                const headerRes = await fetch(`http://localhost:3001/api/health-records/student-header/${studentId}`);
                const headerData = await headerRes.json();

                if (headerData.success) {
                    setStudentHeader(headerData.student);

                    const profileRes = await fetch(`http://localhost:3001/api/profile/${studentId}`);
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
                        setEmergencyContact(profileData.emergencyContact || {});
                    }
                } else {
                    setErrorMsg("Target student system database metadata master row missing.");
                }
            } catch (err) {
                setErrorMsg("Exception fault connecting to profile network infrastructure.");
            } finally {
                setLoading(false);
            }
        };

        if (studentId) loadStudentData();
    }, [studentId]);

    useEffect(() => {
        const fetchStudentRequirements = async () => {
            if (activeTab !== 'requirements' || !studentId) return;
            setReqLoading(true);
            try {
                const response = await fetch(`http://localhost:3001/api/students/${studentId}/full-requirements`);
                const data = await response.json();
                if (Array.isArray(data)) {
                    setRequirementsList(data);
                }
            } catch (err) {
                console.error("Failed pipeline loading file requirements structural layout context:", err);
            } finally {
                setReqLoading(false);
            }
        };

        fetchStudentRequirements();
    }, [activeTab, studentId]);

    if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading student medical file index...</div>;

    return (
        <div className="profile-viewer-wrapper">
            <div className="navigation-action-bar">
                <button onClick={() => navigate('/HealthRecords')} className="btn-back-link">
                    <ArrowLeft size={16} /> Back to Records Directory
                </button>
            </div>

            <div className="profile-identity-banner">
                <div className="avatar-icon-housing">
                    <Folder size={26} />
                </div>
                <div className="identity-details-block">
                    <h2>{studentHeader?.first_name} {studentHeader?.last_name}</h2>
                    <p>{studentHeader?.program_id} - {studentHeader?.year_level} Year</p>
                    <span className="student-id-pill">{studentId}</span>
                </div>
                <div className="badge-system-lock">
                    <Lock size={14} /> READ-ONLY VIEW
                </div>
            </div>

            <div className="profile-segment-tabs">
                <button className={activeTab === 'personal' ? 'active' : ''} onClick={() => setActiveTab('personal')}>Personal Info</button>
                <button className={activeTab === 'health' ? 'active' : ''} onClick={() => setActiveTab('health')}>Health Information</button>
                <button className={activeTab === 'emergency' ? 'active' : ''} onClick={() => setActiveTab('emergency')}>Emergency Contact</button>
                <button className={activeTab === 'requirements' ? 'active' : ''} onClick={() => setActiveTab('requirements')}>Requirements Checklist</button>
            </div>

            {errorMsg && <div className="error-message">{errorMsg}</div>}

            <div className="profile-content-area">
                
                {/* 1. PERSONAL INFO TAB */}
                {activeTab === 'personal' && (
                    <div className="profile-details-form-card">
                        <h3>Personal Information</h3>
                        <div className="form-grid-blueprint">
                            <label>Gender
                                <select name="gender" value={personalInfo.gender || ''} disabled={true}>
                                    <option value="">Not Specified</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </label>
                            <label>Date of Birth
                                <input type="date" name="birth_date" value={personalInfo.birth_date || ''} disabled={true} />
                            </label>
                            <label>Age
                                <input type="number" name="age" value={personalInfo.age || ''} disabled={true} />
                            </label>
                            <label>Contact No.
                                <input type="text" name="contact_number" value={personalInfo.contact_number || ''} disabled={true} />
                            </label>
                            <label className="column-full-width">Address
                                <input type="text" name="address" value={personalInfo.address || ''} disabled={true} />
                            </label>
                            <label>Height (cm)
                                <input type="number" step="0.01" name="height_cm" value={personalInfo.height_cm || ''} disabled={true} />
                            </label>
                            <label>Weight (kg)
                                <input type="number" step="0.01" name="weight_kg" value={personalInfo.weight_kg || ''} disabled={true} />
                            </label>
                            <label>Father's Name
                                <input type="text" name="father_name" value={personalInfo.father_name || ''} disabled={true} />
                            </label>
                            <label>Mother's Name
                                <input type="text" name="mother_name" value={personalInfo.mother_name || ''} disabled={true} />
                            </label>
                        </div>
                    </div>
                )}

                {/* 2. HEALTH INFORMATION TAB */}
                {activeTab === 'health' && (
                    <div className="profile-details-form-card scrollable-health-history">
                        <h3>Health History Index</h3>
                        
                        <div className="medical-condition-block">
                            <label className="condition-main-checkbox"><input type="checkbox" name="has_allergies" checked={healthInfo.has_allergies || false} disabled={true} /> History of Allergies</label>
                            {healthInfo.has_allergies && (
                                <div className="medical-sub-fields">
                                    <label>Food: <input type="text" name="allergy_food" value={healthInfo.allergy_food || ''} disabled={true} /></label>
                                    <label>Medicine: <input type="text" name="allergy_medicine" value={healthInfo.allergy_medicine || ''} disabled={true} /></label>
                                    <label>Insect Sting: <input type="text" name="allergy_insect_sting" value={healthInfo.allergy_insect_sting || ''} disabled={true} /></label>
                                    <label>Environmental: <input type="text" name="allergy_environmental" value={healthInfo.allergy_environmental || ''} disabled={true} /></label>
                                    <label>Others: <input type="text" name="allergy_others" value={healthInfo.allergy_others || ''} disabled={true} /></label>
                                    
                                    <h4>Reactions:</h4>
                                    <div className="nested-checkbox-matrix">
                                        <label><input type="checkbox" checked={healthInfo.reaction_diarrhea || false} disabled={true} /> Diarrhea</label>
                                        <label><input type="checkbox" checked={healthInfo.reaction_hives || false} disabled={true} /> Hives</label>
                                        <label><input type="checkbox" checked={healthInfo.reaction_local || false} disabled={true} /> Local Reaction</label>
                                        <label><input type="checkbox" checked={healthInfo.reaction_rash || false} disabled={true} /> Rash</label>
                                        <label><input type="checkbox" checked={healthInfo.reaction_swelling || false} disabled={true} /> Swelling</label>
                                        <label><input type="checkbox" checked={healthInfo.reaction_trouble_breathing || false} disabled={true} /> Trouble Breathing</label>
                                    </div>
                                    <label style={{marginTop: '8px'}}>Other Reaction: <input type="text" value={healthInfo.reaction_others || ''} disabled={true} /></label>
                                    <label>Medication Taken: <input type="text" value={healthInfo.allergy_medication_taken || ''} disabled={true} /></label>
                                </div>
                            )}
                        </div>

                        <div className="medical-condition-block">
                            <label className="condition-main-checkbox"><input type="checkbox" checked={healthInfo.has_asthma || false} disabled={true} /> Asthma</label>
                            {healthInfo.has_asthma && (
                                <div className="medical-sub-fields">
                                    <label>Triggers: <input type="text" value={healthInfo.asthma_triggers || ''} disabled={true} /></label>
                                    <label>Medication Taken: <input type="text" value={healthInfo.asthma_medication_taken || ''} disabled={true} /></label>
                                </div>
                            )}
                        </div>

                        <div className="medical-condition-block">
                            <label className="condition-main-checkbox"><input type="checkbox" checked={healthInfo.has_other_respiratory || false} disabled={true} /> Other Respiratory Problems</label>
                            {healthInfo.has_other_respiratory && (
                                <div className="medical-sub-fields">
                                    <label>Specify: <input type="text" value={healthInfo.other_respiratory_specify || ''} disabled={true} /></label>
                                    <label>Medication Taken: <input type="text" value={healthInfo.other_respiratory_medication || ''} disabled={true} /></label>
                                </div>
                            )}
                        </div>

                        <div className="medical-condition-block">
                            <label className="condition-main-checkbox"><input type="checkbox" checked={healthInfo.has_blood_disorders || false} disabled={true} /> Blood Disorders</label>
                            {healthInfo.has_blood_disorders && (
                                <div className="medical-sub-fields nested-checkbox-matrix">
                                    <label><input type="checkbox" checked={healthInfo.blood_disorder_anemia || false} disabled={true} /> Anemia</label>
                                    <label><input type="checkbox" checked={healthInfo.blood_disorder_leukopenia || false} disabled={true} /> Leukopenia</label>
                                    <label><input type="checkbox" checked={healthInfo.blood_disorder_thrombocytopenia || false} disabled={true} /> Thrombocytopenia</label>
                                </div>
                            )}
                        </div>

                        <div className="medical-condition-block">
                            <label className="condition-main-checkbox"><input type="checkbox" checked={healthInfo.has_chicken_pox || false} disabled={true} /> Chicken Pox</label>
                            {healthInfo.has_chicken_pox && (
                                <div className="medical-sub-fields">
                                    <label>Age: <input type="number" value={healthInfo.chicken_pox_age || ''} disabled={true} /></label>
                                </div>
                            )}
                        </div>

                        <div className="medical-condition-block">
                            <label className="condition-main-checkbox"><input type="checkbox" checked={healthInfo.has_digestive_disorders || false} disabled={true} /> Digestive Disorders</label>
                            {healthInfo.has_digestive_disorders && (
                                <div className="medical-sub-fields">
                                    <div className="nested-checkbox-matrix">
                                        <label><input type="checkbox" checked={healthInfo.digestive_ulcer || false} disabled={true} /> Ulcer</label>
                                        <label><input type="checkbox" checked={healthInfo.digestive_appendicitis || false} disabled={true} /> Appendicitis</label>
                                        <label><input type="checkbox" checked={healthInfo.digestive_gastritis || false} disabled={true} /> Gastritis</label>
                                        <label><input type="checkbox" checked={healthInfo.digestive_hemorrhoids || false} disabled={true} /> Hemorrhoids</label>
                                    </div>
                                    <label style={{marginTop: '10px'}}>Medication Taken: <input type="text" value={healthInfo.digestive_medication_taken || ''} disabled={true} /></label>
                                </div>
                            )}
                        </div>

                        <div className="medical-condition-block">
                            <label className="condition-main-checkbox"><input type="checkbox" checked={healthInfo.has_heart_problems || false} disabled={true} /> Heart Problems</label>
                            {healthInfo.has_heart_problems && (
                                <div className="medical-sub-fields">
                                    <label>Specify: <input type="text" value={healthInfo.heart_problems_specify || ''} disabled={true} /></label>
                                    <label>Medication: <input type="text" value={healthInfo.heart_problems_medication || ''} disabled={true} /></label>
                                </div>
                            )}
                        </div>

                        <div className="medical-condition-block">
                            <label className="condition-main-checkbox"><input type="checkbox" checked={healthInfo.has_kidney_bladder_problems || false} disabled={true} /> Kidney/Bladder Problems</label>
                            {healthInfo.has_kidney_bladder_problems && (
                                <div className="medical-sub-fields">
                                    <label>Specify: <input type="text" value={healthInfo.kidney_bladder_specify || ''} disabled={true} /></label>
                                    <label>Medication: <input type="text" value={healthInfo.kidney_bladder_medication || ''} disabled={true} /></label>
                                </div>
                            )}
                        </div>

                        <div className="medical-condition-block">
                            <label className="condition-main-checkbox"><input type="checkbox" checked={healthInfo.has_seizure_episode || false} disabled={true} /> Seizure Episode</label>
                            {healthInfo.has_seizure_episode && (
                                <div className="medical-sub-fields">
                                    <label>Last Episode Date: <input type="date" value={healthInfo.seizure_last_episode_date || ''} disabled={true} /></label>
                                    <label>Medication: <input type="text" value={healthInfo.seizure_medication_taken || ''} disabled={true} /></label>
                                </div>
                            )}
                        </div>

                        <div className="medical-condition-block">
                            <label className="condition-main-checkbox"><input type="checkbox" checked={healthInfo.has_surgery || false} disabled={true} /> History of Surgery</label>
                            {healthInfo.has_surgery && (
                                <div className="medical-sub-fields">
                                    <label>Specify: <input type="text" value={healthInfo.surgery_specify || ''} disabled={true} /></label>
                                    <label>Date: <input type="date" value={healthInfo.surgery_date || ''} disabled={true} /></label>
                                </div>
                            )}
                        </div>

                        <div className="medical-condition-block">
                            <label className="condition-main-checkbox"><input type="checkbox" checked={healthInfo.has_vision_problem || false} disabled={true} /> Vision Problem</label>
                            {healthInfo.has_vision_problem && (
                                <div className="medical-sub-fields">
                                    <label>Specify: <input type="text" value={healthInfo.vision_specify || ''} disabled={true} /></label>
                                    <div className="nested-checkbox-matrix">
                                        <label><input type="checkbox" checked={healthInfo.vision_with_eyeglasses || false} disabled={true} /> Wears Eyeglasses</label>
                                        <label><input type="checkbox" checked={healthInfo.vision_with_contact_lens || false} disabled={true} /> Wears Contact Lenses</label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. EMERGENCY CONTACT TAB */}
                {activeTab === 'emergency' && (
                    <div className="profile-details-form-card">
                        <h3>Emergency Contact</h3>
                        <div className="form-grid-blueprint">
                            <label>Contact Name
                                <input type="text" value={emergencyContact.contact_name || ''} disabled={true} />
                            </label>
                            <label>Relationship
                                <input type="text" value={emergencyContact.relationship || ''} disabled={true} />
                            </label>
                            <label>Contact Number
                                <input type="text" value={emergencyContact.contact_number || ''} disabled={true} />
                            </label>
                            <label className="column-full-width">Address
                                <input type="text" value={emergencyContact.address || ''} disabled={true} />
                            </label>
                        </div>
                    </div>
                )}

                {/* 4. REQUIREMENTS TAB CHECKLIST */}
                {activeTab === 'requirements' && (
                    <div className="profile-details-form-card requirements-tab-layout">
                        <div>
                            <h3>Medical Requirements Progress Tracking</h3>
                            <p>Review active documentation uploads and submission statuses below.</p>
                        </div>

                        {reqLoading ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Updating checklist criteria view logs...</div>
                        ) : requirementsList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No academic profile file configurations mapped to this account.</div>
                        ) : (
                            <div className="table-responsive-wrapper">
                                <table className="profile-data-table">
                                    <thead>
                                        <tr>
                                            <th>Requirement Name</th>
                                            <th>Classification</th>
                                            <th>Submission Deadline</th>
                                            <th>Status</th>
                                            <th>Nurse Remarks</th>
                                            <th>File Reference</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {requirementsList.map((req) => {
                                            const deadlineDate = req.submission_deadline ? new Date(req.submission_deadline) : null;
                                            const fileIsPresent = !!req.file_url;
                                            const statusLower = req.status?.toLowerCase() || '';

                                            let statusClass = 'warning';
                                            if (['completed', 'submitted'].includes(statusLower)) statusClass = 'complete';
                                            if (['late', 'submitted late', 'overdue', 'missing'].includes(statusLower)) statusClass = 'danger';

                                            return (
                                                <tr key={req.requirement_name}>
                                                    <td style={{ fontWeight: '500' }}>{req.requirement_name}</td>
                                                    <td>
                                                        <span className={`classification-tag ${req.type === 'Special' ? 'special' : 'program'}`}>
                                                            {req.type || 'Program'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {deadlineDate ? deadlineDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'No Deadline'}
                                                    </td>
                                                    <td>
                                                        <span className={`submission-status-label ${statusClass}`}>
                                                            {req.status || 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '0.88rem', color: '#555' }}>
                                                        {req.nurse_remarks || <span style={{ color: '#cbd5e1' }}>—</span>}
                                                    </td>
                                                    <td>
                                                        {fileIsPresent ? (
                                                            <a 
                                                                href={req.file_url} target="_blank" rel="noopener noreferrer"
                                                                className="btn-document-link"
                                                            >
                                                                <FileText size={14} /> Open Document
                                                            </a>
                                                        ) : (
                                                            <span style={{ color: '#999', fontSize: '0.85rem', fontStyle: 'italic' }}>No Upload Found</span>
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
                )}
            </div>
        </div>
    );
}