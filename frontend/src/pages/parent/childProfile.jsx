import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import '../../styles/parent/ChildProfile.css';

export default function ChildProfile() {
    const navigate = useNavigate();
    
    // Get selectedChildId from ParentLayout Outlet context
    const outletContext = useOutletContext();
    const studentId = outletContext?.selectedChildId || localStorage.getItem('selectedStudentId');

    const [activeTab, setActiveTab] = useState('personal');
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    const [studentHeader, setStudentHeader] = useState(null);
    const [personalInfo, setPersonalInfo] = useState({});
    const [healthInfo, setHealthInfo] = useState({});
    const [emergencyContact, setEmergencyContact] = useState({});

    const [requirementsList, setRequirementsList] = useState([]);
    const [reqLoading, setReqLoading] = useState(false);

    // Helper function to extract initials
    const getInitials = (firstName, lastName) => {
        const firstInitial = firstName ? firstName.trim().charAt(0) : '';
        const lastInitial = lastName ? lastName.trim().charAt(0) : '';
        return `${firstInitial}${lastInitial}`.toUpperCase();
    };

    // Fetch Student Header and Profile Information
    useEffect(() => {
        const loadProfileData = async () => {
            if (!studentId) {
                navigate('/ChooseStudentProfile');
                return;
            }

            setLoading(true);
            setErrorMsg('');

            try {
                // Fetch Student Header Details
                const studentRes = await fetch(`http://localhost:3001/api/get-student-by-studentId/${studentId}`);
                const studentData = await studentRes.json();

                if (studentData.success) {
                    setStudentHeader(studentData.student);

                    // Fetch Profile Data (Personal, Health, Emergency)
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
                    setErrorMsg("Child record not found.");
                }
            } catch (err) {
                console.error("Error loading child profile:", err);
                setErrorMsg("Network error loading child profile.");
            } finally {
                setLoading(false);
            }
        };

        loadProfileData();
    }, [studentId, navigate]);

    // Fetch Academic/Medical Requirements
    useEffect(() => {
        const fetchRequirements = async () => {
            if (activeTab !== 'requirements' || !studentId) return;
            setReqLoading(true);
            try {
                const response = await fetch(`http://localhost:3001/api/students/${studentId}/full-requirements`);
                const data = await response.json();
                if (Array.isArray(data)) {
                    setRequirementsList(data);
                }
            } catch (err) {
                console.error("Failed fetching requirements checklist:", err);
            } finally {
                setReqLoading(false);
            }
        };

        fetchRequirements();
    }, [activeTab, studentId]);

    if (loading) return <div className="profile-page-wrapper">Loading child profile...</div>;

    return (
        <div className="profile-page-wrapper">
            {/* Header Banner */}
            <div className="profile-header-banner">
                <div className="profile-avatar">
                    {getInitials(studentHeader?.first_name, studentHeader?.last_name)}
                </div>
                <div className="profile-header-details">
                    <h2>{studentHeader?.first_name} {studentHeader?.last_name}</h2>
                    <p>{studentHeader?.program_id || 'N/A'} - {studentHeader?.year_level ? `${studentHeader.year_level} Year` : 'Student'}</p>
                    <span className="student-id-badge">{studentId}</span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="profile-tabs">
                <button className={activeTab === 'personal' ? 'active' : ''} onClick={() => setActiveTab('personal')}>Personal Info</button>
                <button className={activeTab === 'health' ? 'active' : ''} onClick={() => setActiveTab('health')}>Health Information</button>
                <button className={activeTab === 'emergency' ? 'active' : ''} onClick={() => setActiveTab('emergency')}>Emergency Contact</button>
                <button className={activeTab === 'requirements' ? 'active' : ''} onClick={() => setActiveTab('requirements')}>Requirements</button>
            </div>

            {errorMsg && <div className="error-message">{errorMsg}</div>}

            <div className="profile-content-area">

                {/* 1. PERSONAL INFO TAB (READ ONLY) */}
                {activeTab === 'personal' && (
                    <div className="profile-form">
                        <h3>Personal Information <span className="instruction">(View Only)</span></h3>
                        <div className="form-grid">
                            <label>Gender
                                <input type="text" value={personalInfo.gender || 'N/A'} readOnly disabled />
                            </label>
                            <label>Date of Birth
                                <input type="text" value={personalInfo.birth_date || 'N/A'} readOnly disabled />
                            </label>
                            <label>Age
                                <input type="text" value={personalInfo.age || 'N/A'} readOnly disabled />
                            </label>
                            <label>Contact No.
                                <input type="text" value={personalInfo.contact_number || 'N/A'} readOnly disabled />
                            </label>
                            <label className="full-width">Address
                                <input type="text" value={personalInfo.address || 'N/A'} readOnly disabled />
                            </label>
                            <label>Height (cm)
                                <input type="text" value={personalInfo.height_cm || 'N/A'} readOnly disabled />
                            </label>
                            <label>Weight (kg)
                                <input type="text" value={personalInfo.weight_kg || 'N/A'} readOnly disabled />
                            </label>
                            <label>Father's Name
                                <input type="text" value={personalInfo.father_name || 'N/A'} readOnly disabled />
                            </label>
                            <label>Mother's Name
                                <input type="text" value={personalInfo.mother_name || 'N/A'} readOnly disabled />
                            </label>
                        </div>
                    </div>
                )}

                {/* 2. HEALTH INFORMATION TAB (READ ONLY) */}
                {activeTab === 'health' && (
                    <div className="profile-form health-form-scroll">
                        <h3>Health Information <span className="instruction">(View Only)</span></h3>

                        {/* Allergies */}
                        <div className="health-block">
                            <label className="main-checkbox">
                                <input type="checkbox" checked={healthInfo.has_allergies || false} disabled /> History of Allergies
                            </label>
                            {healthInfo.has_allergies && (
                                <div className="sub-fields">
                                    <label>Food: <input type="text" value={healthInfo.allergy_food || 'None'} readOnly disabled /></label>
                                    <label>Medicine: <input type="text" value={healthInfo.allergy_medicine || 'None'} readOnly disabled /></label>
                                    <label>Insect Sting: <input type="text" value={healthInfo.allergy_insect_sting || 'None'} readOnly disabled /></label>
                                    <label>Environmental: <input type="text" value={healthInfo.allergy_environmental || 'None'} readOnly disabled /></label>
                                    <label>Others: <input type="text" value={healthInfo.allergy_others || 'None'} readOnly disabled /></label>

                                    <h4>Reactions:</h4>
                                    <div className="checkbox-grid">
                                        <label><input type="checkbox" checked={healthInfo.reaction_diarrhea || false} disabled /> Diarrhea</label>
                                        <label><input type="checkbox" checked={healthInfo.reaction_hives || false} disabled /> Hives</label>
                                        <label><input type="checkbox" checked={healthInfo.reaction_local || false} disabled /> Local Reaction</label>
                                        <label><input type="checkbox" checked={healthInfo.reaction_rash || false} disabled /> Rash</label>
                                        <label><input type="checkbox" checked={healthInfo.reaction_swelling || false} disabled /> Swelling</label>
                                        <label><input type="checkbox" checked={healthInfo.reaction_trouble_breathing || false} disabled /> Trouble Breathing</label>
                                    </div>
                                    <label>Other Reaction: <input type="text" value={healthInfo.reaction_others || 'None'} readOnly disabled /></label>
                                    <label>Medication Taken: <input type="text" value={healthInfo.allergy_medication_taken || 'None'} readOnly disabled /></label>
                                </div>
                            )}
                        </div>

                        {/* Asthma */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_asthma || false} disabled /> Asthma</label>
                            {healthInfo.has_asthma && (
                                <div className="sub-fields">
                                    <label>Triggers: <input type="text" value={healthInfo.asthma_triggers || 'None'} readOnly disabled /></label>
                                    <label>Medication Taken: <input type="text" value={healthInfo.asthma_medication_taken || 'None'} readOnly disabled /></label>
                                </div>
                            )}
                        </div>

                        {/* Other Respiratory */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_other_respiratory || false} disabled /> Other Respiratory Problems</label>
                            {healthInfo.has_other_respiratory && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" value={healthInfo.other_respiratory_specify || 'None'} readOnly disabled /></label>
                                    <label>Medication Taken: <input type="text" value={healthInfo.other_respiratory_medication || 'None'} readOnly disabled /></label>
                                </div>
                            )}
                        </div>

                        {/* Blood Disorders */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_blood_disorders || false} disabled /> Blood Disorders</label>
                            {healthInfo.has_blood_disorders && (
                                <div className="sub-fields checkbox-grid">
                                    <label><input type="checkbox" checked={healthInfo.blood_disorder_anemia || false} disabled /> Anemia</label>
                                    <label><input type="checkbox" checked={healthInfo.blood_disorder_leukopenia || false} disabled /> Leukopenia</label>
                                    <label><input type="checkbox" checked={healthInfo.blood_disorder_thrombocytopenia || false} disabled /> Thrombocytopenia</label>
                                </div>
                            )}
                        </div>

                        {/* Chicken Pox */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_chicken_pox || false} disabled /> Chicken Pox</label>
                            {healthInfo.has_chicken_pox && (
                                <div className="sub-fields">
                                    <label>Age: <input type="text" value={healthInfo.chicken_pox_age || 'N/A'} readOnly disabled /></label>
                                </div>
                            )}
                        </div>

                        {/* Digestive Disorders */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_digestive_disorders || false} disabled /> Digestive Disorders</label>
                            {healthInfo.has_digestive_disorders && (
                                <div className="sub-fields">
                                    <div className="checkbox-grid">
                                        <label><input type="checkbox" checked={healthInfo.digestive_ulcer || false} disabled /> Ulcer</label>
                                        <label><input type="checkbox" checked={healthInfo.digestive_appendicitis || false} disabled /> Appendicitis</label>
                                        <label><input type="checkbox" checked={healthInfo.digestive_gastritis || false} disabled /> Gastritis</label>
                                        <label><input type="checkbox" checked={healthInfo.digestive_hemorrhoids || false} disabled /> Hemorrhoids</label>
                                    </div>
                                    <label style={{ marginTop: '10px' }}>Medication Taken: <input type="text" value={healthInfo.digestive_medication_taken || 'None'} readOnly disabled /></label>
                                </div>
                            )}
                        </div>

                        {/* Heart Problems */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_heart_problems || false} disabled /> Heart Problems</label>
                            {healthInfo.has_heart_problems && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" value={healthInfo.heart_problems_specify || 'None'} readOnly disabled /></label>
                                    <label>Medication: <input type="text" value={healthInfo.heart_problems_medication || 'None'} readOnly disabled /></label>
                                </div>
                            )}
                        </div>

                        {/* Kidney/Bladder */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_kidney_bladder_problems || false} disabled /> Kidney/Bladder Problems</label>
                            {healthInfo.has_kidney_bladder_problems && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" value={healthInfo.kidney_bladder_specify || 'None'} readOnly disabled /></label>
                                    <label>Medication: <input type="text" value={healthInfo.kidney_bladder_medication || 'None'} readOnly disabled /></label>
                                </div>
                            )}
                        </div>

                        {/* Measles */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_measles || false} disabled /> Measles</label>
                            {healthInfo.has_measles && (
                                <div className="sub-fields">
                                    <label>Age: <input type="text" value={healthInfo.measles_age || 'N/A'} readOnly disabled /></label>
                                </div>
                            )}
                        </div>

                        {/* Metabolic Diseases */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_metabolic_diseases || false} disabled /> Metabolic Diseases</label>
                            {healthInfo.has_metabolic_diseases && (
                                <div className="sub-fields checkbox-grid">
                                    <label><input type="checkbox" checked={healthInfo.metabolic_hyperglycemia || false} disabled /> Hyperglycemia</label>
                                    <label><input type="checkbox" checked={healthInfo.metabolic_hypoglycemia || false} disabled /> Hypoglycemia</label>
                                </div>
                            )}
                        </div>

                        {/* Muscle/Bone */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_muscle_bone_disorder || false} disabled /> Muscle/Bone Disorder</label>
                            {healthInfo.has_muscle_bone_disorder && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" value={healthInfo.muscle_bone_specify || 'None'} readOnly disabled /></label>
                                </div>
                            )}
                        </div>

                        {/* Seizure */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_seizure_episode || false} disabled /> Seizure Episode</label>
                            {healthInfo.has_seizure_episode && (
                                <div className="sub-fields">
                                    <label>Last Episode Date: <input type="text" value={healthInfo.seizure_last_episode_date || 'N/A'} readOnly disabled /></label>
                                    <label>Medication: <input type="text" value={healthInfo.seizure_medication_taken || 'None'} readOnly disabled /></label>
                                </div>
                            )}
                        </div>

                        {/* Surgery */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_surgery || false} disabled /> History of Surgery</label>
                            {healthInfo.has_surgery && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" value={healthInfo.surgery_specify || 'None'} readOnly disabled /></label>
                                    <label>Date: <input type="text" value={healthInfo.surgery_date || 'N/A'} readOnly disabled /></label>
                                </div>
                            )}
                        </div>

                        {/* Vision */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_vision_problem || false} disabled /> Vision Problem</label>
                            {healthInfo.has_vision_problem && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" value={healthInfo.vision_specify || 'None'} readOnly disabled /></label>
                                    <div className="checkbox-grid">
                                        <label><input type="checkbox" checked={healthInfo.vision_with_eyeglasses || false} disabled /> Wears Eyeglasses</label>
                                        <label><input type="checkbox" checked={healthInfo.vision_with_contact_lens || false} disabled /> Wears Contact Lenses</label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Hearing */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_hearing_problem || false} disabled /> Hearing Problem</label>
                            {healthInfo.has_hearing_problem && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" value={healthInfo.hearing_specify || 'None'} readOnly disabled /></label>
                                </div>
                            )}
                        </div>

                        {/* Other Condition */}
                        <div className="health-block">
                            <label className="main-checkbox"><input type="checkbox" checked={healthInfo.has_other_condition || false} disabled /> Other Condition</label>
                            {healthInfo.has_other_condition && (
                                <div className="sub-fields">
                                    <label>Specify: <input type="text" value={healthInfo.other_condition_specify || 'None'} readOnly disabled /></label>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. EMERGENCY CONTACT TAB (READ ONLY) */}
                {activeTab === 'emergency' && (
                    <div className="profile-form">
                        <h3>Emergency Contact <span className="instruction">(View Only)</span></h3>
                        <div className="form-grid">
                            <label>Contact Name
                                <input type="text" value={emergencyContact.contact_name || 'N/A'} readOnly disabled />
                            </label>
                            <label>Relationship
                                <input type="text" value={emergencyContact.relationship || 'N/A'} readOnly disabled />
                            </label>
                            <label>Contact Number
                                <input type="text" value={emergencyContact.contact_number || 'N/A'} readOnly disabled />
                            </label>
                            <label className="full-width">Address
                                <input type="text" value={emergencyContact.address || 'N/A'} readOnly disabled />
                            </label>
                        </div>
                    </div>
                )}

                {/* 4. REQUIREMENTS TAB (READ ONLY VIEW) */}
                {activeTab === 'requirements' && (
                    <div className="profile-form requirements-tab-section">
                        <div className="requirements-header-block" style={{ marginBottom: '20px' }}>
                            <h3>Medical Requirements Checklist <span className="instruction" style={{ fontSize: '0.9rem' }}>(View Only)</span></h3>
                            <p style={{ fontSize: '0.9rem', color: '#666' }}>
                                View your child's medical document submission status and uploaded files.
                            </p>
                        </div>

                        {reqLoading ? (
                            <div className="loading-placeholder" style={{ padding: '20px', textAlign: 'center' }}>
                                Loading requirements checklist...
                            </div>
                        ) : requirementsList.length === 0 ? (
                            <div className="empty-state" style={{ textAlign: 'center', padding: '30px 10px' }}>
                                <p>No requirements assigned to student profile.</p>
                            </div>
                        ) : (
                            <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
                                <table className="profile-data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #eaeaea', backgroundColor: '#f9f9f9' }}>
                                            <th style={{ padding: '12px' }}>Requirement Name</th>
                                            <th style={{ padding: '12px' }}>Classification</th>
                                            <th style={{ padding: '12px' }}>Deadline</th>
                                            <th style={{ padding: '12px' }}>Status</th>
                                            <th style={{ padding: '12px' }}>Nurse Remarks</th>
                                            <th style={{ padding: '12px' }}>Submitted File</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {requirementsList.map((req) => {
                                            const deadlineDate = req.submission_deadline ? new Date(req.submission_deadline) : null;
                                            return (
                                                <tr key={req.requirement_name} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '12px', fontWeight: '500' }}>
                                                        {req.requirement_name}
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
                                                    <td style={{ padding: '12px' }}>
                                                        {deadlineDate 
                                                            ? deadlineDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) 
                                                            : 'No Deadline'}
                                                    </td>
                                                    <td style={{ padding: '12px' }}>
                                                        <span style={{
                                                            fontWeight: 'bold',
                                                            fontSize: '0.85rem',
                                                            color: ['completed', 'submitted'].includes(req.status?.toLowerCase()) ? 'green' : 
                                                                   ['late', 'submitted late'].includes(req.status?.toLowerCase()) ? 'orange' : 'red'
                                                        }}>
                                                            {req.status || 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px', fontSize: '0.88rem', color: '#555' }}>
                                                        {req.nurse_remarks || <span style={{ color: '#ccc' }}>—</span>}
                                                    </td>
                                                    <td style={{ padding: '12px' }}>
                                                        {req.file_url ? (
                                                            <a 
                                                                href={req.file_url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                style={{ fontSize: '0.85rem', color: '#0056b3', textDecoration: 'underline' }}
                                                            >
                                                                View Document
                                                            </a>
                                                        ) : (
                                                            <span style={{ color: '#999', fontSize: '0.85rem' }}>Not Uploaded</span>
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