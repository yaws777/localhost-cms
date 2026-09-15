// MyProfile.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/student/MyProfile.css'; 

export default function MyProfile() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('personal');
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [studentHeader, setStudentHeader] = useState(null);
    const [studentId, setStudentId] = useState(null);

    const [personalInfo, setPersonalInfo] = useState({});
    const [healthInfo, setHealthInfo] = useState({});
    const [emergencyContact, setEmergencyContact] = useState({});

    const [requirementsList, setRequirementsList] = useState([]);
    const [reqLoading, setReqLoading] = useState(false);
    const [uploadFiles, setUploadFiles] = useState({});

    useEffect(() => {
        const loadData = async () => {
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

                    const profileRes = await fetch(`http://localhost:3001/api/profile/${studentData.student.student_id}`);
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
            const response = await fetch(`http://localhost:3001/api/students/${id}/full-requirements`);
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
    const handleEmergencyChange = (e) => setEmergencyContact({ ...emergencyContact, [e.target.name]: e.target.value });

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
                setErrorMsg(data.error || "Failed to process target structural upload requirement request.");
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (err) {
            setErrorMsg("Network execution layout exception error connecting to service.");
        }
    };

    const handleSaveChanges = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const response = await fetch('http://localhost:3001/api/update-profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: studentId,
                    personalInfo,
                    healthInfo,
                    emergencyContact
                })
            });
            const data = await response.json();
            if (data.success) {
                setSuccessMsg("Changes saved successfully!");
                setTimeout(() => setSuccessMsg(''), 3000);
            } else {
                setErrorMsg(data.message);
            }
        } catch (error) {
            setErrorMsg("Network error saving changes.");
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

    if (loading) return <div>Loading profile...</div>;

    return (
        <div className="profile-page-wrapper">
            <div className="profile-header-banner">
                <div className="profile-avatar">👤</div>
                <div className="profile-header-details">
                    <h2>{studentHeader?.first_name} {studentHeader?.last_name}</h2>
                    <p>{studentHeader?.program_id} - {studentHeader?.year_level} Year</p>
                    <span className="student-id-badge">{studentId}</span>
                </div>
            </div>

            <div className="profile-tabs">
                <button className={activeTab === 'personal' ? 'active' : ''} onClick={() => setActiveTab('personal')}>Personal Info</button>
                <button className={activeTab === 'health' ? 'active' : ''} onClick={() => setActiveTab('health')}>Health Information</button>
                <button className={activeTab === 'emergency' ? 'active' : ''} onClick={() => setActiveTab('emergency')}>Emergency Contact</button>
                <button className={activeTab === 'requirements' ? 'active' : ''} onClick={() => setActiveTab('requirements')}>Requirements</button>
            </div>

            {errorMsg && <div className="error-message">{errorMsg}</div>}
            {successMsg && <div className="success-message">{successMsg}</div>}

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

                {activeTab === 'health' && (
                    <form onSubmit={handleSaveChanges} className="profile-form health-form-scroll">
                        <h3>Health Information<span className='instruction'> (leave unchecked if none)</span></h3>
                        
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

                        <button type="submit" className="btn-primary-save">Save Health Changes</button>
                    </form>
                )}

                {activeTab === 'emergency' && (
                    <form onSubmit={handleSaveChanges} className="profile-form">
                        <h3>Emergency Contact</h3>
                        <div className="form-grid">
                            <label>Contact Name *
                                <input type="text" name="contact_name" value={emergencyContact.contact_name || ''} onChange={handleEmergencyChange} required />
                            </label>
                            <label>Relationship *
                                <input type="text" name="relationship" value={emergencyContact.relationship || ''} onChange={handleEmergencyChange} required />
                            </label>
                            <label>Contact Number *
                                <input type="text" name="contact_number" value={emergencyContact.contact_number || ''} onChange={handleEmergencyChange} required />
                            </label>
                            <label className="full-width">Address *
                                <input type="text" name="address" value={emergencyContact.address || ''} onChange={handleEmergencyChange} required />
                            </label>
                        </div>
                        <button type="submit" className="btn-primary-save">Save Changes</button>
                    </form>
                )}

                {activeTab === 'requirements' && (
                    <div className="profile-form requirements-tab-section">
                        <div className="requirements-header-block" style={{ marginBottom: '20px' }}>
                            <h3>Medical Requirements Checklist</h3>
                            <p style={{ fontSize: '0.9rem', color: '#666' }}>
                                Upload structural files from your local folder. Rows with passed deadlines and disabled late configurations will be blocked securely.
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
                                            
                                            // Lock upload if completed OR if deadline passed without late permission
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
                )}
            </div>
        </div>
    );
}