import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, CircleCheck,
    CircleHelp, Paperclip, Send, X
} from 'lucide-react';
import '../../styles/student/HealthHistoryForm.css';

// ---------------------------------------------------------------------------
// Form definition
// ---------------------------------------------------------------------------

const PERSONAL_FIELDS = [
    { name: 'gender', label: 'Gender:', type: 'select', span: 'hh-s2' },
    { name: 'birth_date', label: 'Date of Birth:', type: 'date', span: 'hh-s2' },
    { name: 'age', label: 'Age:', type: 'number', span: 'hh-s2', readOnly: true, placeholder: 'Auto-calculated' },
    { name: 'address', label: 'Address:', type: 'text', span: '' },
    { name: 'contact_number', label: 'Contact No:', type: 'text', span: 'hh-s2' },
    { name: 'height_cm', label: 'Height (cm):', type: 'number', span: 'hh-s2' },
    { name: 'weight_kg', label: 'Weight (kg):', type: 'number', span: 'hh-s2' },
    { name: 'father_name', label: "Father's Name:", type: 'text', span: 'hh-s3' },
    { name: 'mother_name', label: "Mother's Name:", type: 'text', span: 'hh-s3' }
];

// Field builders. `group`: at least one member of the same group must be filled.
const text = (name, label, group) => ({ kind: 'text', name, label, group });
const num = (name, label) => ({ kind: 'number', name, label });
const date = (name, label) => ({ kind: 'date', name, label });
// `optional` checkbox sets never block submit (no group)
const checks = (items, title, group) => ({ kind: 'checks', items, title, group });

const CONDITIONS = [
    {
        key: 'has_allergies', label: 'History of Allergies', fields: [
            text('allergy_food', 'Food:', 'type'),
            text('allergy_medicine', 'Medicine:', 'type'),
            text('allergy_insect_sting', 'Insect Sting:', 'type'),
            text('allergy_environmental', 'Environmental:', 'type'),
            text('allergy_others', 'Others:', 'type'),
            checks([
                ['reaction_diarrhea', 'Diarrhea'], ['reaction_hives', 'Hives'], ['reaction_local', 'Local Reaction'],
                ['reaction_rash', 'Rash'], ['reaction_swelling', 'Swelling'], ['reaction_trouble_breathing', 'Trouble Breathing']
            ], 'Reactions:', 'reaction'),
            text('reaction_others', 'Other Reaction:', 'reaction'),
            text('allergy_medication_taken', 'Medication Taken:')
        ]
    },
    { key: 'has_asthma', label: 'Asthma', fields: [text('asthma_triggers', 'Triggers:'), text('asthma_medication_taken', 'Medication Taken:')] },
    { key: 'has_other_respiratory', label: 'Other Respiratory Illness', fields: [text('other_respiratory_specify', 'Specify:'), text('other_respiratory_medication', 'Medication Taken:')] },
    {
        key: 'has_blood_disorders', label: 'Blood Disorders', fields: [
            checks([['blood_disorder_anemia', 'Anemia'], ['blood_disorder_leukopenia', 'Leukopenia'], ['blood_disorder_thrombocytopenia', 'Thrombocytopenia']], null, 'type')
        ]
    },
    { key: 'has_chicken_pox', label: 'Chicken Pox / Bulutong', fields: [num('chicken_pox_age', 'Age:')] },
    {
        key: 'has_digestive_disorders', label: 'Digestive Disorders', fields: [
            checks([['digestive_ulcer', 'Ulcer'], ['digestive_appendicitis', 'Appendicitis'], ['digestive_gastritis', 'Gastritis'], ['digestive_hemorrhoids', 'Hemorrhoids']], null, 'type'),
            text('digestive_medication_taken', 'Medication Taken:')
        ]
    },
    { key: 'has_heart_problems', label: 'Heart Problems', fields: [text('heart_problems_specify', 'Specify:'), text('heart_problems_medication', 'Medication:')] },
    { key: 'has_kidney_bladder_problems', label: 'Kidney or Bladder Problems', fields: [text('kidney_bladder_specify', 'Specify:'), text('kidney_bladder_medication', 'Medication:')] },
    { key: 'has_measles', label: 'Measles / Tigdas', fields: [num('measles_age', 'Age:')] },
    {
        key: 'has_metabolic_diseases', label: 'Metabolic Diseases', fields: [
            checks([['metabolic_hyperglycemia', 'Hyperglycemia'], ['metabolic_hypoglycemia', 'Hypoglycemia']], null, 'type')
        ]
    },
    { key: 'has_muscle_bone_disorder', label: 'Muscle/Bone/Mobility Disorder', fields: [text('muscle_bone_specify', 'Specify:')] },
    { key: 'has_seizure_episode', label: 'Seizure Episode', fields: [date('seizure_last_episode_date', 'Date of last episode:'), text('seizure_medication_taken', 'Medication:')] },
    { key: 'has_surgery', label: 'Surgery', fields: [text('surgery_specify', 'Specify:'), date('surgery_date', 'Date:')] },
    {
        key: 'has_vision_problem', label: 'Vision Problem', fields: [
            text('vision_specify', 'Specify:'),
            checks([['vision_with_eyeglasses', 'with eyeglasses'], ['vision_with_contact_lens', 'with contact lens']])
        ]
    },
    { key: 'has_hearing_problem', label: 'Hearing Problem', fields: [text('hearing_specify', 'Specify:')] },
    { key: 'has_other_condition', label: 'Other health condition not listed', fields: [text('other_condition_specify', 'Specify:')] }
];

const namesOf = (f) => (f.kind === 'checks' ? f.items.map(([name]) => name) : [f.name]);

// field name -> every member of its "at least one" group (to clear them together)
const GROUP_MEMBERS = {};
// condition key -> every field name inside it
const CONDITION_NAMES = {};
CONDITIONS.forEach((c) => {
    const byGroup = {};
    CONDITION_NAMES[c.key] = [];
    c.fields.forEach((f) => {
        CONDITION_NAMES[c.key].push(...namesOf(f));
        if (f.group) {
            byGroup[f.group] = byGroup[f.group] || [];
            byGroup[f.group].push(...namesOf(f));
        }
    });
    Object.values(byGroup).forEach((members) => members.forEach((n) => { GROUP_MEMBERS[n] = members; }));
});

// Checked conditions must have their inputs filled. Returns the invalid field
// names, the condition keys to open and the condition labels for the message.
const findHealthProblems = (info) => {
    const invalidNames = [];
    const keys = [];
    const labels = [];
    CONDITIONS.forEach((c) => {
        if (!info[c.key]) return;
        const missing = [];
        const groups = {};
        c.fields.forEach((f) => {
            if (f.group) {
                groups[f.group] = groups[f.group] || [];
                groups[f.group].push(...namesOf(f));
                return;
            }
            if (f.kind === 'checks') return; // optional checkboxes
            if (String(info[f.name]).trim() === '') missing.push(f.name);
        });
        Object.values(groups).forEach((members) => {
            const filled = members.some((n) => (typeof info[n] === 'boolean' ? info[n] : String(info[n]).trim() !== ''));
            if (!filled) missing.push(...members);
        });
        if (missing.length) {
            invalidNames.push(...missing);
            keys.push(c.key);
            labels.push(c.label);
        }
    });
    return { invalidNames, keys, labels };
};

const MODAL_ICONS = { confirm: CircleHelp, success: CircleCheck, error: CircleAlert };

// ---------------------------------------------------------------------------
// Optional proof file input with a live preview (image thumbnail, or file name for PDFs)
// ---------------------------------------------------------------------------
function ProofUpload({ id, file, onChange }) {
    const [previewUrl, setPreviewUrl] = useState(null);
    // Bumped on Remove so the native file input is remounted and clears its filename
    const [inputKey, setInputKey] = useState(0);

    useEffect(() => {
        if (!file || !file.type.startsWith('image/')) {
            setPreviewUrl(null);
            return undefined;
        }
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    return (
        <div className="hh-proof hh-span-all">
            <label className="hh-lbl" htmlFor={id}>Upload Proof (Optional):</label>
            <input
                key={inputKey}
                id={id}
                className="hh-file"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => onChange(e.target.files[0] || null)}
            />
            {file && (
                <div className="hh-proof-card">
                    <div className="hh-proof-row">
                        <span className="hh-proof-name">
                            <Paperclip className="hh-ic" aria-hidden="true" />
                            <span>{file.name} ({Math.round(file.size / 1024)} KB)</span>
                        </span>
                        <button
                            type="button"
                            className="hh-btn hh-btn-secondary"
                            onClick={() => { onChange(null); setInputKey(k => k + 1); }}
                        >
                            <X className="hh-ic" aria-hidden="true" /> Remove
                        </button>
                    </div>
                    {previewUrl && <img src={previewUrl} alt="Proof preview" />}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Modal: dialog role, focus moves in, Tab stays inside, Esc closes, focus returns
// ---------------------------------------------------------------------------
function ModalDialog({ modal, onDismiss, onConfirm, onOk }) {
    const cardRef = useRef(null);
    const Icon = MODAL_ICONS[modal.type] || CircleAlert;

    useEffect(() => {
        const opener = document.activeElement;
        const primary = cardRef.current && cardRef.current.querySelector('.hh-btn-primary');
        if (primary) primary.focus();
        return () => {
            // Give focus back only if the modal's action did not move it elsewhere
            const active = document.activeElement;
            if (opener && opener.isConnected && (!active || active === document.body)) opener.focus();
        };
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onDismiss();
            return;
        }
        if (e.key !== 'Tab' || !cardRef.current) return;
        const focusable = cardRef.current.querySelectorAll('button');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };

    return (
        <div className="hh-overlay" onKeyDown={handleKeyDown}>
            <div
                ref={cardRef}
                className={`hh-modal modal-${modal.type}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="hh-modal-title"
                aria-describedby="hh-modal-message"
            >
                <div className="hh-modal-head">
                    <span className={`hh-modal-ico is-${modal.type}`}><Icon className="hh-ic" aria-hidden="true" /></span>
                    <h3 id="hh-modal-title">{modal.title}</h3>
                    <button type="button" className="hh-btn hh-btn-icon" onClick={onDismiss} aria-label="Close" title="Close">
                        <X className="hh-ic" aria-hidden="true" />
                    </button>
                </div>
                <div className="hh-modal-body">
                    <p id="hh-modal-message">{modal.message}</p>
                </div>
                <div className="hh-modal-foot">
                    {modal.type === 'confirm' ? (
                        <>
                            <button type="button" className="hh-btn hh-btn-secondary" onClick={onDismiss}>Cancel</button>
                            <button type="button" className="hh-btn hh-btn-primary" onClick={onConfirm}>Confirm</button>
                        </>
                    ) : (
                        <button type="button" className="hh-btn hh-btn-primary" onClick={onOk}>OK</button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function HealthHistoryForm() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [studentId, setStudentId] = useState(null);
    const headingRef = useRef(null);
    const firstRender = useRef(true);

    // Modal State
    const [modal, setModal] = useState({
        isOpen: false,
        type: '', // 'confirm' | 'success' | 'error'
        title: '',
        message: '',
        onConfirm: null,
        onClose: null
    });

    const closeModal = () => {
        setModal(prev => ({ ...prev, isOpen: false }));
    };

    const showError = (message, onCloseCallback) => {
        setModal({
            isOpen: true,
            type: 'error',
            title: 'Error',
            message,
            onConfirm: null,
            onClose: onCloseCallback || null
        });
    };

    const showSuccess = (message, onCloseCallback) => {
        setModal({
            isOpen: true,
            type: 'success',
            title: 'Success',
            message,
            onConfirm: null,
            onClose: onCloseCallback || null
        });
    };

    const showConfirm = (message, onConfirmCallback) => {
        setModal({
            isOpen: true,
            type: 'confirm',
            title: 'Confirm Operation',
            message,
            onConfirm: onConfirmCallback,
            onClose: null
        });
    };

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

    // Which condition cards are expanded. Expanding never checks a condition.
    const [openCards, setOpenCards] = useState({});
    // Field names flagged as missing after a failed submit
    const [invalid, setInvalid] = useState({});

    // Optional proof file per condition, keyed by its has_* flag
    const [proofFiles, setProofFiles] = useState({});

    const handleProofChange = (key, file) => setProofFiles(prev => ({ ...prev, [key]: file }));

    const renderProofInput = (key) => (
        <ProofUpload id={`proof_${key}`} file={proofFiles[key]} onChange={(file) => handleProofChange(key, file)} />
    );

    useEffect(() => {
        // Read from both sessionStorage and localStorage
        const storedUser = sessionStorage.getItem('user') || localStorage.getItem('user');

        if (!storedUser) {
            navigate('/');
            return;
        }

        let user;
        try {
            user = JSON.parse(storedUser);
        } catch (e) {
            showError('Invalid user session.');
            return;
        }

        if (user.role === 'student' && user.student_id) {
            setStudentId(user.student_id);
        } else {
            // Resolve accurate user_id key across login payload variations
            const accurateUserId = user.user_id || user.id || user.UserID || user.userId;

            if (!accurateUserId) {
                showError('User ID missing from active session.');
                return;
            }

            fetch(`http://localhost:3001/api/get-student/${accurateUserId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.student && data.student.student_id) {
                        setStudentId(data.student.student_id);
                    } else {
                        showError(data.message || 'Could not find student record.');
                    }
                })
                .catch(() => showError('Network error while fetching student ID.'));
        }
    }, [navigate]);

    // Move to the top and focus the step heading when the step changes
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        window.scrollTo(0, 0);
        if (headingRef.current) headingRef.current.focus({ preventScroll: true });
    }, [step]);

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

    // Clear the red flag on a field (and on its whole "at least one" group)
    const clearInvalid = (names) => {
        setInvalid(prev => {
            if (!names.some(n => prev[n])) return prev;
            const next = { ...prev };
            names.forEach(n => { delete next[n]; });
            return next;
        });
    };

    const handleHealthTextChange = (e) => {
        const { name, value } = e.target;
        setHealthInfo(prev => ({ ...prev, [name]: value }));
        clearInvalid(GROUP_MEMBERS[name] || [name]);
    };

    const handleHealthCheckboxChange = (e) => {
        const { name, checked } = e.target;
        setHealthInfo(prev => ({ ...prev, [name]: checked }));
        clearInvalid(GROUP_MEMBERS[name] || [name]);
    };

    // The condition checkbox: checking opens its card, unchecking closes it
    const handleConditionToggle = (key, checked) => {
        setHealthInfo(prev => ({ ...prev, [key]: checked }));
        setOpenCards(prev => ({ ...prev, [key]: checked }));
        if (!checked) clearInvalid(CONDITION_NAMES[key]);
    };

    // The title / arrow only expands or collapses, never checks
    const toggleCard = (key) => setOpenCards(prev => ({ ...prev, [key]: !prev[key] }));

    const handleNextToHealth = () => {
        const isComplete = Object.values(personalInfo).every(val => String(val).trim() !== '');
        if (!isComplete) {
            showError('Please complete all Personal Information fields before proceeding.');
            return;
        }
        setStep(2);
    };

    const handleSubmitPrompt = () => {
        if (!studentId) {
            showError('Student ID is missing. Please log in again.');
            return;
        }

        const problems = findHealthProblems(healthInfo);
        if (problems.invalidNames.length) {
            const flags = {};
            problems.invalidNames.forEach(n => { flags[n] = true; });
            setInvalid(flags);
            setOpenCards(prev => {
                const next = { ...prev };
                problems.keys.forEach(k => { next[k] = true; });
                return next;
            });
            showError(
                `Please complete the required fields for: ${problems.labels.join(', ')}.`,
                () => {
                    const first = document.querySelector('.hh-page [aria-invalid="true"]');
                    if (first) first.focus();
                }
            );
            return;
        }

        showConfirm(
            'Are you sure you want to submit this Health History record?',
            executeSubmit
        );
    };

    const executeSubmit = async () => {
        try {
            // student_id first: the upload filename prefix reads it from the body
            const formData = new FormData();
            formData.append('student_id', studentId);
            formData.append('personalInfo', JSON.stringify(personalInfo));
            formData.append('healthInfo', JSON.stringify(healthInfo));
            Object.entries(proofFiles).forEach(([key, file]) => {
                if (file && healthInfo[key]) formData.append(`proof_${key}`, file);
            });

            const response = await fetch('http://localhost:3001/api/submit-health-form', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                showSuccess('Health History Form Submitted Successfully!', () => {
                    navigate('/StudentDashboard');
                });
            } else {
                showError(data.message || 'Submission failed');
            }
        } catch (error) {
            showError('Network error during submission.');
        }
    };

    const selectedCount = CONDITIONS.filter(c => healthInfo[c.key]).length;

    const renderPersonalField = (f) => {
        const control = f.type === 'select' ? (
            <select id={f.name} name={f.name} value={personalInfo.gender} onChange={handlePersonalChange} required>
                <option value="" disabled>Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
            </select>
        ) : (
            <input
                id={f.name}
                type={f.type}
                name={f.name}
                value={personalInfo[f.name]}
                onChange={f.readOnly ? undefined : handlePersonalChange}
                readOnly={f.readOnly}
                placeholder={f.placeholder}
                required
            />
        );
        return (
            <label key={f.name} className={`hh-field is-req ${f.span}`} htmlFor={f.name}>
                <span className="hh-lbl">{f.label}</span>
                {control}
            </label>
        );
    };

    const renderConditionField = (f, checked) => {
        if (f.kind === 'checks') {
            const required = checked && !!f.group;
            const chips = (
                <div className="hh-chips">
                    {f.items.map(([name, label]) => (
                        <label key={name} className="hh-chip">
                            <input
                                type="checkbox"
                                id={name}
                                name={name}
                                checked={healthInfo[name]}
                                onChange={handleHealthCheckboxChange}
                                aria-invalid={invalid[name] ? 'true' : undefined}
                            /> {label}
                        </label>
                    ))}
                </div>
            );
            return f.title ? (
                <fieldset key={f.items[0][0]} className={`hh-group hh-span-all${required ? ' is-req' : ''}`}>
                    <legend>{f.title}</legend>
                    {chips}
                </fieldset>
            ) : (
                <div key={f.items[0][0]} className={`hh-chips-wrap hh-span-all${required ? ' is-req' : ''}`}>
                    {chips}
                </div>
            );
        }
        return (
            <label key={f.name} className={`hh-field${checked ? ' is-req' : ''}`} htmlFor={f.name}>
                <span className="hh-lbl">{f.label}</span>
                <input
                    id={f.name}
                    type={f.kind}
                    name={f.name}
                    value={healthInfo[f.name]}
                    onChange={handleHealthTextChange}
                    required={checked && !f.group}
                    aria-invalid={invalid[f.name] ? 'true' : undefined}
                />
            </label>
        );
    };

    return (
        <div className="hh-page">
            <header className="hh-hero">
                <div className="hh-wrap">
                    <h1>Student Health History Form</h1>
                </div>
            </header>

            {/* GLOBAL MODAL COMPONENT */}
            {modal.isOpen && (
                <ModalDialog
                    modal={modal}
                    onDismiss={closeModal}
                    onConfirm={() => {
                        const action = modal.onConfirm;
                        closeModal();
                        if (action) action();
                    }}
                    onOk={() => {
                        const action = modal.onClose;
                        closeModal();
                        if (action) action();
                    }}
                />
            )}

            <main className="hh-wrap hh-layout">
                <aside className="hh-side">
                    <ol className="hh-steps" aria-label="Form progress">
                        <li className={`hh-step ${step === 1 ? 'is-current' : 'is-done'}`}>
                            <button
                                type="button"
                                aria-current={step === 1 ? 'step' : undefined}
                                onClick={() => { if (step === 2) setStep(1); }}
                            >
                                <span className="hh-num">
                                    {step === 1 ? '1' : <Check className="hh-ic" aria-hidden="true" />}
                                </span>
                                <span>A. Personal Information</span>
                            </button>
                        </li>
                        <li className={`hh-step${step === 2 ? ' is-current' : ''}`}>
                            <button
                                type="button"
                                aria-current={step === 2 ? 'step' : undefined}
                                onClick={() => { if (step === 1) handleNextToHealth(); }}
                            >
                                <span className="hh-num">2</span>
                                <span>B. Health Information</span>
                            </button>
                        </li>
                    </ol>
                </aside>

                <form className="hh-main" noValidate onSubmit={(e) => e.preventDefault()}>
                    {/* PAGE 1: PERSONAL INFORMATION */}
                    {step === 1 && (
                        <>
                            <section className="hh-card" aria-labelledby="hh-h-step1">
                                <h2 id="hh-h-step1" ref={headingRef} tabIndex={-1}>A. Personal Information</h2>
                                <div className="hh-grid">
                                    {PERSONAL_FIELDS.map(renderPersonalField)}
                                </div>
                            </section>
                            <div className="hh-actions is-end">
                                <button type="button" className="hh-btn hh-btn-primary" onClick={handleNextToHealth}>
                                    Next <ArrowRight className="hh-ic" aria-hidden="true" />
                                </button>
                            </div>
                        </>
                    )}

                    {/* PAGE 2: HEALTH INFORMATION */}
                    {step === 2 && (
                        <>
                            <section aria-labelledby="hh-h-step2">
                                <div className="hh-sec-head">
                                    <h2 id="hh-h-step2" ref={headingRef} tabIndex={-1}>
                                        B. Health Information <span className="hh-hint">(leave Unchecked if None)</span>
                                    </h2>
                                    <p className="hh-count" role="status">{selectedCount} selected</p>
                                </div>

                                <div className="hh-conds">
                                    {CONDITIONS.map((c) => {
                                        const checked = healthInfo[c.key];
                                        const isOpen = !!openCards[c.key];
                                        return (
                                            <div key={c.key} className={`hh-cond${checked ? ' is-checked' : ''}${isOpen ? ' is-open' : ''}`}>
                                                <div className="hh-cond-head">
                                                    <label className="hh-cond-check">
                                                        <input
                                                            type="checkbox"
                                                            id={c.key}
                                                            name={c.key}
                                                            aria-label={c.label}
                                                            checked={checked}
                                                            onChange={(e) => handleConditionToggle(c.key, e.target.checked)}
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="hh-cond-btn"
                                                        aria-expanded={isOpen}
                                                        aria-controls={`panel_${c.key}`}
                                                        onClick={() => toggleCard(c.key)}
                                                    >
                                                        <span>{c.label}</span>
                                                        <ChevronDown className="hh-ic hh-chev" aria-hidden="true" />
                                                    </button>
                                                </div>
                                                {isOpen && (
                                                    <div className="hh-panel" id={`panel_${c.key}`}>
                                                        <fieldset className="hh-fields" disabled={!checked}>
                                                            {renderProofInput(c.key)}
                                                            {c.fields.map((f) => renderConditionField(f, checked))}
                                                        </fieldset>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            <div className="hh-actions">
                                <button type="button" className="hh-btn hh-btn-secondary" onClick={() => setStep(1)}>
                                    <ArrowLeft className="hh-ic" aria-hidden="true" /> Back
                                </button>
                                <button type="button" className="hh-btn hh-btn-primary" onClick={handleSubmitPrompt}>
                                    <Send className="hh-ic" aria-hidden="true" /> Submit Form
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </main>
        </div>
    );
}
