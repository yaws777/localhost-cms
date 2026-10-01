import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/student/HealthHistoryForm.css';

export default function HealthHistoryForm() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [studentId, setStudentId] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    // Form State Objects
    const [personalInfo, setPersonalInfo] = useState({
        gender: '', birth_date: '', age: '', address: '', contact_number: '',
        height_cm: '', weight_kg: '', father_name: '', mother_name: ''
    });

    const [healthInfo, setHealthInfo] = useState({
        has_allergies: false, allergy_food: '', allergy_medicine: '', allergy_insect_sting: '', allergy_environmental: '', allergy_others: '',
        reaction_diarrhea: false, reaction_hives: false, reaction_local: false, reaction_rash: false, reaction_swelling: false, reaction_trouble_breathing: false, reaction_others: '', allergy_medication_taken: '',
        
        has_asthma: false, asthma_triggers: '', asthma_medication_taken: '',
        has_other_respiratory: false, other_respiratory_specify: '', other_respiratory_medication: '',
        
        has_blood_disorders: false, blood_disorder_anemia: false, blood_disorder_leukopenia: false, blood_disorder_thrombocytopenia: false,
        has_chicken_pox: false, chicken_pox_age: '',
        
        has_digestive_disorders: false, digestive_ulcer: false, digestive_appendicitis: false, digestive_gastritis: false, digestive_hemorrhoids: false, digestive_medication_taken: '',
        
        has_heart_problems: false, heart_problems_specify: '', heart_problems_medication: '',
        has_kidney_bladder_problems: false, kidney_bladder_specify: '', kidney_bladder_medication: '',
        
        has_measles: false, measles_age: '',
        has_metabolic_diseases: false, metabolic_hyperglycemia: false, metabolic_hypoglycemia: false,
        
        has_muscle_bone_disorder: false, muscle_bone_specify: '',
        
        has_seizure_episode: false, seizure_last_episode_date: '', seizure_medication_taken: '',
        
        has_surgery: false, surgery_specify: '', surgery_date: '',
        
        has_vision_problem: false, vision_specify: '', vision_with_eyeglasses: false, vision_with_contact_lens: false,
        has_hearing_problem: false, hearing_specify: '',
        has_other_condition: false, other_condition_specify: ''
    });

    const [emergencyContact, setEmergencyContact] = useState({
        contact_name: '', relationship: '', address: '', contact_number: ''
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            
            if (user.role === 'student' && user.student_id) {
                setStudentId(user.student_id);
            } else {
                fetch(`http://localhost:3001/api/get-student/${user.id}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.success && data.student) {
                            setStudentId(data.student.student_id);
                        } else {
                            setErrorMsg('Could not find student record.');
                        }
                    })
                    .catch(err => setErrorMsg('Network error while fetching student ID.'));
            }
        } else {
            navigate('/');
        }
    }, [navigate]);

    // Helper to compute age from a date string
    const calculateAge = (birthDateString) => {
        if (!birthDateString) return '';
        const today = new Date();
        const birthDate = new Date(birthDateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 0 ? age : '';
    };

    const handlePersonalChange = (e) => {
        const { name, value } = e.target;
        if (name === 'birth_date') {
            const computedAge = calculateAge(value);
            setPersonalInfo(prev => ({
                ...prev,
                birth_date: value,
                age: computedAge
            }));
        } else {
            setPersonalInfo(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleHealthTextChange = (e) => setHealthInfo({ ...healthInfo, [e.target.name]: e.target.value });
    const handleHealthCheckboxChange = (e) => setHealthInfo({ ...healthInfo, [e.target.name]: e.target.checked });
    const handleEmergencyChange = (e) => setEmergencyContact({ ...emergencyContact, [e.target.name]: e.target.value });

    const handleNextToHealth = () => {
        const isComplete = Object.values(personalInfo).every(val => String(val).trim() !== '');
        if (!isComplete) {
            setErrorMsg('Please complete all Personal Information fields before proceeding.');
            return;
        }
        setErrorMsg('');
        setStep(2);
    };

    const handleSubmit = async () => {
        const isEmergencyComplete = Object.values(emergencyContact).every(val => String(val).trim() !== '');
        if (!isEmergencyComplete) {
            setErrorMsg('Please complete all Emergency Contact fields before submitting.');
            return;
        }

        setErrorMsg('');
        try {
            const response = await fetch('http://localhost:3001/api/submit-health-form', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: studentId, personalInfo, healthInfo, emergencyContact })
            });
            const data = await response.json();
            if (data.success) {
                alert('Health History Form Submitted!');
                navigate('/StudentDashboard');
            } else {
                setErrorMsg(data.message || 'Submission failed');
            }
        } catch (error) {
            setErrorMsg('Network error during submission.');
        }
    };

    return (
        <div className="form-container">
            <h2>Student Health History Form</h2>
            {errorMsg && <div className="error-message" style={{color: 'red', fontWeight: 'bold'}}>{errorMsg}</div>}
            
            {/* PAGE 1: PERSONAL INFORMATION */}
            {step === 1 && (
                <div className="form-section">
                    <h3>A. Personal Information</h3>
                    <label>Gender: 
                        <select className="form-select" name="gender" value={personalInfo.gender} onChange={handlePersonalChange}>
                            <option value="" disabled>Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </label>
                    <label>Date of Birth: <input type="date" name="birth_date" value={personalInfo.birth_date} onChange={handlePersonalChange} /></label>
                    <label>Age: <input type="number" name="age" value={personalInfo.age} readOnly placeholder="Auto-calculated" /></label>
                    <label>Address: <input type="text" name="address" value={personalInfo.address} onChange={handlePersonalChange} /></label>
                    <label>Contact No: <input type="text" name="contact_number" value={personalInfo.contact_number} onChange={handlePersonalChange} /></label>
                    <label>Height (cm): <input type="number" name="height_cm" value={personalInfo.height_cm} onChange={handlePersonalChange} /></label>
                    <label>Weight (kg): <input type="number" name="weight_kg" value={personalInfo.weight_kg} onChange={handlePersonalChange} /></label>
                    <label>Father's Name: <input type="text" name="father_name" value={personalInfo.father_name} onChange={handlePersonalChange} /></label>
                    <label>Mother's Name: <input type="text" name="mother_name" value={personalInfo.mother_name} onChange={handlePersonalChange} /></label>
                    
                    <button onClick={handleNextToHealth}>Next</button>
                </div>
            )}

            {/* PAGE 2: HEALTH INFORMATION */}
            {step === 2 && (
                <div className="form-section">
                    <h3>B. Health Information <span>(leave Unchecked if None)</span></h3>

                    <div className="health-block">
                        <label><input type="checkbox" name="has_allergies" checked={healthInfo.has_allergies} onChange={handleHealthCheckboxChange} /> History of Allergies</label>
                        {healthInfo.has_allergies && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}>
                                <label>Food: <input type="text" name="allergy_food" value={healthInfo.allergy_food} onChange={handleHealthTextChange} /></label>
                                <label>Medicine: <input type="text" name="allergy_medicine" value={healthInfo.allergy_medicine} onChange={handleHealthTextChange} /></label>
                                <label>Insect Sting: <input type="text" name="allergy_insect_sting" value={healthInfo.allergy_insect_sting} onChange={handleHealthTextChange} /></label>
                                <label>Environmental: <input type="text" name="allergy_environmental" value={healthInfo.allergy_environmental} onChange={handleHealthTextChange} /></label>
                                <label>Others: <input type="text" name="allergy_others" value={healthInfo.allergy_others} onChange={handleHealthTextChange} /></label>
                                
                                <h4>Reactions:</h4>
                                <label><input type="checkbox" name="reaction_diarrhea" checked={healthInfo.reaction_diarrhea} onChange={handleHealthCheckboxChange} /> Diarrhea</label>
                                <label><input type="checkbox" name="reaction_hives" checked={healthInfo.reaction_hives} onChange={handleHealthCheckboxChange} /> Hives</label>
                                <label><input type="checkbox" name="reaction_local" checked={healthInfo.reaction_local} onChange={handleHealthCheckboxChange} /> Local Reaction</label>
                                <label><input type="checkbox" name="reaction_rash" checked={healthInfo.reaction_rash} onChange={handleHealthCheckboxChange} /> Rash</label>
                                <label><input type="checkbox" name="reaction_swelling" checked={healthInfo.reaction_swelling} onChange={handleHealthCheckboxChange} /> Swelling</label>
                                <label><input type="checkbox" name="reaction_trouble_breathing" checked={healthInfo.reaction_trouble_breathing} onChange={handleHealthCheckboxChange} /> Trouble Breathing</label>
                                <label>Other Reaction: <input type="text" name="reaction_others" value={healthInfo.reaction_others} onChange={handleHealthTextChange} /></label>
                                <label>Medication Taken: <input type="text" name="allergy_medication_taken" value={healthInfo.allergy_medication_taken} onChange={handleHealthTextChange} /></label>
                            </div>
                        )}
                    </div>

                    <div className="health-block">
                        <label><input type="checkbox" name="has_asthma" checked={healthInfo.has_asthma} onChange={handleHealthCheckboxChange} /> Asthma</label>
                        {healthInfo.has_asthma && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}>
                                <label>Triggers: <input type="text" name="asthma_triggers" value={healthInfo.asthma_triggers} onChange={handleHealthTextChange} /></label>
                                <label>Medication Taken: <input type="text" name="asthma_medication_taken" value={healthInfo.asthma_medication_taken} onChange={handleHealthTextChange} /></label>
                            </div>
                        )}
                    </div>

                    <div className="health-block">
                        <label><input type="checkbox" name="has_other_respiratory" checked={healthInfo.has_other_respiratory} onChange={handleHealthCheckboxChange} /> Other Respiratory Illness</label>
                        {healthInfo.has_other_respiratory && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}>
                                <label>Specify: <input type="text" name="other_respiratory_specify" value={healthInfo.other_respiratory_specify} onChange={handleHealthTextChange} /></label>
                                <label>Medication Taken: <input type="text" name="other_respiratory_medication" value={healthInfo.other_respiratory_medication} onChange={handleHealthTextChange} /></label>
                            </div>
                        )}
                    </div>

                    <div className="health-block">
                        <label><input type="checkbox" name="has_blood_disorders" checked={healthInfo.has_blood_disorders} onChange={handleHealthCheckboxChange} /> Blood Disorders</label>
                        {healthInfo.has_blood_disorders && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}>
                                <label><input type="checkbox" name="blood_disorder_anemia" checked={healthInfo.blood_disorder_anemia} onChange={handleHealthCheckboxChange}/> Anemia</label>
                                <label><input type="checkbox" name="blood_disorder_leukopenia" checked={healthInfo.blood_disorder_leukopenia} onChange={handleHealthCheckboxChange}/> Leukopenia</label>
                                <label><input type="checkbox" name="blood_disorder_thrombocytopenia" checked={healthInfo.blood_disorder_thrombocytopenia} onChange={handleHealthCheckboxChange}/> Thrombocytopenia</label>
                            </div>
                        )}
                    </div>

                    <div className="health-block">
                        <label><input type="checkbox" name="has_chicken_pox" checked={healthInfo.has_chicken_pox} onChange={handleHealthCheckboxChange} /> Chicken Pox / Bulutong</label>
                        {healthInfo.has_chicken_pox && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}>
                                <label>Age: <input type="number" name="chicken_pox_age" value={healthInfo.chicken_pox_age} onChange={handleHealthTextChange} /></label>
                            </div>
                        )}
                    </div>

                    <div className="health-block">
                        <label><input type="checkbox" name="has_digestive_disorders" checked={healthInfo.has_digestive_disorders} onChange={handleHealthCheckboxChange} /> Digestive Disorders</label>
                        {healthInfo.has_digestive_disorders && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}>
                                <label><input type="checkbox" name="digestive_ulcer" checked={healthInfo.digestive_ulcer} onChange={handleHealthCheckboxChange}/> Ulcer</label>
                                <label><input type="checkbox" name="digestive_appendicitis" checked={healthInfo.digestive_appendicitis} onChange={handleHealthCheckboxChange}/> Appendicitis</label>
                                <label><input type="checkbox" name="digestive_gastritis" checked={healthInfo.digestive_gastritis} onChange={handleHealthCheckboxChange}/> Gastritis</label>
                                <label><input type="checkbox" name="digestive_hemorrhoids" checked={healthInfo.digestive_hemorrhoids} onChange={handleHealthCheckboxChange}/> Hemorrhoids</label>
                                <label>Medication Taken: <input type="text" name="digestive_medication_taken" value={healthInfo.digestive_medication_taken} onChange={handleHealthTextChange} /></label>
                            </div>
                        )}
                    </div>

                    <div className="health-block">
                        <label><input type="checkbox" name="has_heart_problems" checked={healthInfo.has_heart_problems} onChange={handleHealthCheckboxChange} /> Heart Problems</label>
                        {healthInfo.has_heart_problems && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}><label>Specify: <input type="text" name="heart_problems_specify" onChange={handleHealthTextChange} /></label><label>Medication: <input type="text" name="heart_problems_medication" onChange={handleHealthTextChange} /></label></div>
                        )}
                    </div>
                    <div className="health-block">
                        <label><input type="checkbox" name="has_kidney_bladder_problems" checked={healthInfo.has_kidney_bladder_problems} onChange={handleHealthCheckboxChange} /> Kidney or Bladder Problems</label>
                        {healthInfo.has_kidney_bladder_problems && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}><label>Specify: <input type="text" name="kidney_bladder_specify" onChange={handleHealthTextChange} /></label><label>Medication: <input type="text" name="kidney_bladder_medication" onChange={handleHealthTextChange} /></label></div>
                        )}
                    </div>
                    <div className="health-block">
                        <label><input type="checkbox" name="has_measles" checked={healthInfo.has_measles} onChange={handleHealthCheckboxChange} /> Measles / Tigdas</label>
                        {healthInfo.has_measles && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}><label>Age: <input type="number" name="measles_age" onChange={handleHealthTextChange} /></label></div>
                        )}
                    </div>
                    <div className="health-block">
                        <label><input type="checkbox" name="has_metabolic_diseases" checked={healthInfo.has_metabolic_diseases} onChange={handleHealthCheckboxChange} /> Metabolic Diseases</label>
                        {healthInfo.has_metabolic_diseases && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}><label><input type="checkbox" name="metabolic_hyperglycemia" onChange={handleHealthCheckboxChange}/> Hyperglycemia</label><label><input type="checkbox" name="metabolic_hypoglycemia" onChange={handleHealthCheckboxChange}/> Hypoglycemia</label></div>
                        )}
                    </div>
                    <div className="health-block">
                        <label><input type="checkbox" name="has_muscle_bone_disorder" checked={healthInfo.has_muscle_bone_disorder} onChange={handleHealthCheckboxChange} /> Muscle/Bone/Mobility Disorder</label>
                        {healthInfo.has_muscle_bone_disorder && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}><label>Specify: <input type="text" name="muscle_bone_specify" onChange={handleHealthTextChange} /></label></div>
                        )}
                    </div>
                    <div className="health-block">
                        <label><input type="checkbox" name="has_seizure_episode" checked={healthInfo.has_seizure_episode} onChange={handleHealthCheckboxChange} /> Seizure Episode</label>
                        {healthInfo.has_seizure_episode && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}><label>Date of last episode: <input type="date" name="seizure_last_episode_date" onChange={handleHealthTextChange} /></label><label>Medication: <input type="text" name="seizure_medication_taken" onChange={handleHealthTextChange} /></label></div>
                        )}
                    </div>
                    <div className="health-block">
                        <label><input type="checkbox" name="has_surgery" checked={healthInfo.has_surgery} onChange={handleHealthCheckboxChange} /> Surgery</label>
                        {healthInfo.has_surgery && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}><label>Specify: <input type="text" name="surgery_specify" onChange={handleHealthTextChange} /></label><label>Date: <input type="date" name="surgery_date" onChange={handleHealthTextChange} /></label></div>
                        )}
                    </div>
                    <div className="health-block">
                        <label><input type="checkbox" name="has_vision_problem" checked={healthInfo.has_vision_problem} onChange={handleHealthCheckboxChange} /> Vision Problem</label>
                        {healthInfo.has_vision_problem && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}><label>Specify: <input type="text" name="vision_specify" onChange={handleHealthTextChange} /></label><label><input type="checkbox" name="vision_with_eyeglasses" onChange={handleHealthCheckboxChange}/> with eyeglasses</label><label><input type="checkbox" name="vision_with_contact_lens" onChange={handleHealthCheckboxChange}/> with contact lens</label></div>
                        )}
                    </div>
                    <div className="health-block">
                        <label><input type="checkbox" name="has_hearing_problem" checked={healthInfo.has_hearing_problem} onChange={handleHealthCheckboxChange} /> Hearing Problem</label>
                        {healthInfo.has_hearing_problem && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}><label>Specify: <input type="text" name="hearing_specify" onChange={handleHealthTextChange} /></label></div>
                        )}
                    </div>
                    <div className="health-block">
                        <label><input type="checkbox" name="has_other_condition" checked={healthInfo.has_other_condition} onChange={handleHealthCheckboxChange} /> Other health condition not listed</label>
                        {healthInfo.has_other_condition && (
                            <div className="sub-fields" style={{marginLeft: '20px'}}><label>Specify: <input type="text" name="other_condition_specify" onChange={handleHealthTextChange} /></label></div>
                        )}
                    </div>

                    <button onClick={() => setStep(1)}>Back</button>
                    <button onClick={() => setStep(3)}>Next</button>
                </div>
            )}

            {/* PAGE 3: EMERGENCY CONTACT */}
            {step === 3 && (
                <div className="form-section">
                    <h3>C. Emergency Contact Information</h3>
                    
                    <label>Name: <input type="text" name="contact_name" value={emergencyContact.contact_name} onChange={handleEmergencyChange} /></label>
                    <label>Relationship: <input type="text" name="relationship" value={emergencyContact.relationship} onChange={handleEmergencyChange} /></label>
                    <label>Address: <input type="text" name="address" value={emergencyContact.address} onChange={handleEmergencyChange} /></label>
                    <label>Contact #: <input type="text" name="contact_number" value={emergencyContact.contact_number} onChange={handleEmergencyChange} /></label>

                    <button onClick={() => setStep(2)}>Back</button>
                    <button onClick={handleSubmit} className="btn-primary">Submit Form</button>
                </div>
            )}
        </div>
    );
}