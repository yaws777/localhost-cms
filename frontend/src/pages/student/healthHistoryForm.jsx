import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, Check, CircleAlert, CircleCheck,
    CircleHelp, Send, X
} from 'lucide-react';
import HealthConditionsEditor, { CONDITIONS, useHealthConditions } from '../../components/common/HealthConditionsEditor';
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

const MODAL_ICONS = { confirm: CircleHelp, success: CircleCheck, error: CircleAlert };

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

    // Health conditions: values, open cards, red flags and proof files (shared with the nurse's edit)
    const health = useHealthConditions();

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

        const problems = health.validate();
        if (problems.invalidNames.length) {
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
            formData.append('healthInfo', JSON.stringify(health.info));
            health.filesToSend().forEach(([key, file]) => formData.append(`proof_${key}`, file));

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

    const selectedCount = CONDITIONS.filter(c => health.info[c.key]).length;

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

                                <HealthConditionsEditor editor={health} />
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
