import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import '../styles/Login.css'; 

import { useMultiAccount } from '../context/MultiAccountContext';

export default function Login() {
    const navigate = useNavigate();
    const { addSession } = useMultiAccount();

    const [isLoginView, setIsLoginView] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    
    // Login Form State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // ---------------- FORGOT PASSWORD FLOW STATES ----------------
    // Step 1: Username | Step 2: Role Identifier Match | Step 3: New Strong Password
    const [forgotStep, setForgotStep] = useState(1);
    const [forgotUsername, setForgotUsername] = useState('');
    const [detectedRole, setDetectedRole] = useState(null); // { role_id, role_name }
    const [forgotIdentifier, setForgotIdentifier] = useState('');
    const [isIdentifierVerified, setIsIdentifierVerified] = useState(false);
    
    const [forgotNewPassword, setForgotNewPassword] = useState('');
    const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
    const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
    const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

    // Modal Visibility States
    const [showChangePassModal, setShowChangePassModal] = useState(false);
    const [showParentModal, setShowParentModal] = useState(false);

    // Change Password Modal State (Default Password flow)
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passModalError, setPassModalError] = useState('');

    // Parent Setup Modal State
    const [parentFirstName, setParentFirstName] = useState('');
    const [parentLastName, setParentLastName] = useState('');
    const [parentPhone, setParentPhone] = useState('');
    const [parentModalError, setParentModalError] = useState('');

    const [pendingAuthData, setPendingAuthData] = useState(null);

    // Password Strength Validator Helper
    const getPasswordRequirements = (pass) => {
        return {
            minLength: pass.length >= 8,
            hasUpper: /[A-Z]/.test(pass),
            hasLower: /[a-z]/.test(pass),
            hasNumber: /[0-9]/.test(pass),
            hasSpecial: /[!@#$%^&*(),.?":{}|<>_]/.test(pass)
        };
    };

    const passReqs = getPasswordRequirements(newPassword);
    const isPasswordStrong = Object.values(passReqs).every(Boolean);

    const forgotPassReqs = getPasswordRequirements(forgotNewPassword);
    const isForgotPassStrong = Object.values(forgotPassReqs).every(Boolean);

    // PH Phone Validator
    const isValidPHPhone = (phone) => {
        const cleanPhone = phone.replace(/[\s\-()]/g, '');
        return /^(09|\+639)\d{9}$/.test(cleanPhone);
    };

    // Toggle between Login & Recovery view
    const handleSwitchView = (toLogin) => {
        setIsLoginView(toLogin);
        setErrorMsg('');
        setSuccessMsg('');
        resetForgotFlow();
    };

    const resetForgotFlow = () => {
        setForgotStep(1);
        setForgotUsername('');
        setDetectedRole(null);
        setForgotIdentifier('');
        setIsIdentifierVerified(false);
        setForgotNewPassword('');
        setForgotConfirmPassword('');
    };

    // ---------------- LOGIN HANDLER ----------------
    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const response = await fetch('http://localhost:3001/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            
            if (data.success) {
                if (data.isDefaultPassword) {
                    setShowChangePassModal(true);
                    return;
                }

                proceedLoginFlow(data);
            } else {
                setErrorMsg(data.message);
            }
        } catch (error) {
            setErrorMsg("Network error. Please check if the server is running.");
        }
    };

    const proceedLoginFlow = (data) => {
        addSession(data.user, data.token || null);
        sessionStorage.setItem('user', JSON.stringify(data.user));

        if (data.user.role === 'student') {
            if (data.isFormCompleted) {
                navigate('/StudentDashboard');
            } else {
                navigate('/HealthHistoryForm');
            }
        } else if (data.user.role === 'nurse') {
            navigate('/NurseDashboard');
        } else if (data.user.role === 'doctor') {
            // a new doctor account is asked for the phone number first thing inside the portal (DoctorLayout)
            navigate('/DoctorDashboard');
        } else if (data.user.role === 'parent') {
            sessionStorage.setItem('parent_id', data.user.parent_id);

            if (data.isProfileIncomplete) {
                setPendingAuthData(data);
                setParentFirstName(data.user.first_name || '');
                setParentLastName(data.user.last_name || '');
                setParentPhone(data.user.primary_phone || '');
                setShowParentModal(true);
                return;
            }

            finalizeParentRouting(data.students);
        }
    };

    const finalizeParentRouting = (students) => {
        if (students && students.length > 0) {
            sessionStorage.setItem('linkedStudents', JSON.stringify(students));
            sessionStorage.setItem('selectedStudentId', students[0].student_id);
        } else {
            sessionStorage.setItem('linkedStudents', JSON.stringify([]));
            sessionStorage.removeItem('selectedStudentId');
        }
        navigate('/ParentDashboard');
    };

    // ---------------- DEFAULT PASSWORD CHANGE ----------------
    const handleChangePasswordSubmit = async (e) => {
        e.preventDefault();
        setPassModalError('');

        if (!isPasswordStrong) {
            setPassModalError("Password does not meet strong criteria.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setPassModalError("Passwords do not match.");
            return;
        }

        try {
            const response = await fetch('http://localhost:3001/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, newPassword })
            });
            const data = await response.json();

            if (data.success) {
                setShowChangePassModal(false);
                setNewPassword('');
                setConfirmPassword('');
                setPassword('');
                setSuccessMsg("Password changed successfully. Please log in again with your new password.");
            } else {
                setPassModalError(data.message);
            }
        } catch (error) {
            setPassModalError("Failed to update password. Try again later.");
        }
    };

    // ---------------- PARENT SETUP HANDLER ----------------
    const handleParentSetupSubmit = async (e) => {
        e.preventDefault();
        setParentModalError('');

        if (!parentFirstName || !parentLastName || !parentPhone) {
            setParentModalError("All fields are required.");
            return;
        }

        if (!isValidPHPhone(parentPhone)) {
            setParentModalError("Please enter a valid Philippine mobile number (e.g., 09171234567 or +639171234567).");
            return;
        }

        try {
            const response = await fetch('http://localhost:3001/api/update-parent-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    parentId: pendingAuthData.user.parent_id,
                    firstName: parentFirstName,
                    lastName: parentLastName,
                    primaryPhone: parentPhone.replace(/[\s\-()]/g, '')
                })
            });
            const data = await response.json();

            if (data.success) {
                setShowParentModal(false);
                const updatedUser = {
                    ...pendingAuthData.user,
                    first_name: parentFirstName,
                    last_name: parentLastName,
                    primary_phone: parentPhone
                };
                addSession(updatedUser, pendingAuthData.token || null);
                finalizeParentRouting(pendingAuthData.students);
            } else {
                setParentModalError(data.message);
            }
        } catch (error) {
            setParentModalError("Failed to update details. Try again.");
        }
    };

    // ---------------- FORGOT PASSWORD STEP 1: VERIFY USERNAME ----------------
    const handleVerifyUsername = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const response = await fetch('http://localhost:3001/api/check-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: forgotUsername })
            });
            const data = await response.json();

            if (data.success) {
                setDetectedRole({ role_id: data.role_id, role_name: data.role_name });
                setForgotStep(2);
            } else {
                setErrorMsg(data.message);
            }
        } catch (error) {
            setErrorMsg("Network error. Please try again.");
        }
    };

    // ---------------- FORGOT PASSWORD STEP 2: VERIFY IDENTIFIER IN DATABASE ----------------
    const handleVerifyIdentifier = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (!forgotIdentifier.trim()) {
            setErrorMsg("Please enter your verification details.");
            return;
        }

        try {
            const response = await fetch('http://localhost:3001/api/verify-identifier', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: forgotUsername,
                    identifier: forgotIdentifier
                })
            });
            const data = await response.json();

            if (data.success) {
                setIsIdentifierVerified(true);
                setForgotStep(3); // Proceed to enter new strong password
            } else {
                setIsIdentifierVerified(false);
                setErrorMsg(data.message || "Identity verification failed. Information does not match.");
            }
        } catch (error) {
            setIsIdentifierVerified(false);
            setErrorMsg("Network error during verification. Please try again.");
        }
    };

    // ---------------- FORGOT PASSWORD STEP 3: SUBMIT NEW STRONG PASSWORD ----------------
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        // Use isIdentifierVerified state check
        if (!isIdentifierVerified) {
            setErrorMsg("Identity verification required before resetting password.");
            return;
        }

        if (!isForgotPassStrong) {
            setErrorMsg("New password does not meet strength requirements.");
            return;
        }

        if (forgotNewPassword !== forgotConfirmPassword) {
            setErrorMsg("Passwords do not match.");
            return;
        }

        try {
            const response = await fetch('http://localhost:3001/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: forgotUsername,
                    identifier: forgotIdentifier,
                    newPassword: forgotNewPassword
                })
            });
            const data = await response.json();
            
            if (data.success) {
                setSuccessMsg(data.message);
                resetForgotFlow();
                setIsLoginView(true);
            } else {
                setErrorMsg(data.message);
            }
        } catch (error) {
            setErrorMsg("Network error. Please try again.");
        }
    };

    // Get dynamic label & placeholder depending on user role
    const getRoleIdentifierConfig = () => {
        if (!detectedRole) return { label: 'Identifier', placeholder: 'Enter Identifier' };

        switch (detectedRole.role_id) {
            case 'STDNT':
                return { 
                    label: 'Student ID Number', 
                    placeholder: 'Enter Student ID (e.g., 02000123456)',
                    helpText: 'Enter your official Student ID as registered in the clinic system.'
                };
            case 'PRNT':
                return { 
                    label: 'Primary Phone Number', 
                    placeholder: 'Enter Mobile Number (e.g., 09171234567)',
                    helpText: 'Enter the mobile phone number registered on your parent profile.'
                };
            case 'NRS':
                return { 
                    label: 'Nurse ID Number', 
                    placeholder: 'Enter Nurse ID (e.g., NRS-1001)',
                    helpText: 'Enter your staff/nurse ID number assigned by administrative staff.'
                };
            case 'DCTR':
                return {
                    label: 'Registered Phone Number',
                    placeholder: 'Enter Mobile Number (e.g., 09171234567)',
                    helpText: 'Enter the mobile number you added when you first logged in to your doctor account.'
                };
            default:
                return { 
                    label: 'Verification Identifier', 
                    placeholder: 'Enter Identifier',
                    helpText: 'Enter your identification code.'
                };
        }
    };

    const roleConfig = getRoleIdentifierConfig();

    return (
        <div className="login-page-wrapper">
            <div className="login-container">
                <div className="login-brand-header">
                    <div className="login-system-tag">STI Baliuag Clinic Management System</div>
                    <h2 className="login-title">{isLoginView ? 'Login Portal' : 'Reset Password'}</h2>
                </div>
                
                {errorMsg && <div className="error-message">{errorMsg}</div>}
                {successMsg && <div className="success-message">{successMsg}</div>}

                {isLoginView ? (
                    /* LOGIN FORM */
                    <form onSubmit={handleLogin} className="auth-form">
                        <input 
                            type="text" 
                            required 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                            placeholder="Username (@baliuag.sti.edu.ph)" 
                            className="auth-input" 
                        />
                        
                        <div className="password-input-wrapper">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                required 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                placeholder="Password" 
                                className="auth-input"
                            />
                            <button 
                                type="button" 
                                className="password-toggle-btn" 
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label="Toggle password visibility"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        <button type="submit" className="btn-primary">Login</button>
                        <button 
                            type="button" 
                            onClick={() => handleSwitchView(false)} 
                            className="btn-link"
                        >
                            Forgot Password?
                        </button>
                    </form>
                ) : (
                    /* FORGOT PASSWORD MULTI-STEP FLOW */
                    <div className="forgot-flow-wrapper">
                        
                        {/* Step Indicators */}
                        <div className="flow-step-indicators" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '0.75rem', fontWeight: '600' }}>
                            <span style={{ color: forgotStep >= 1 ? '#0284c7' : '#9ca3af' }}>1. Username</span>
                            <span style={{ color: forgotStep >= 2 ? '#0284c7' : '#9ca3af' }}>2. Verification</span>
                            <span style={{ color: forgotStep >= 3 && isIdentifierVerified ? '#0284c7' : '#9ca3af' }}>3. New Password</span>
                        </div>

                        {forgotStep === 1 && (
                            /* STEP 1: ENTER USERNAME */
                            <form onSubmit={handleVerifyUsername} className="auth-form">
                                <div style={{ textAlign: 'left', marginBottom: '6px', fontSize: '0.85rem', color: '#4b5563' }}>
                                    Enter your registered username to verify account existence.
                                </div>
                                <input 
                                    type="text" 
                                    required 
                                    value={forgotUsername} 
                                    onChange={(e) => setForgotUsername(e.target.value)} 
                                    placeholder="Enter Username (@baliuag.sti.edu.ph)" 
                                    className="auth-input"
                                />
                                <button type="submit" className="btn-primary">Continue</button>
                                <button 
                                    type="button" 
                                    onClick={() => handleSwitchView(true)} 
                                    className="btn-link"
                                >
                                    Back to Login
                                </button>
                            </form>
                        )}

                        {forgotStep === 2 && (
                            /* STEP 2: VERIFY ROLE IDENTIFIER MATCH IN DATABASE */
                            <form onSubmit={handleVerifyIdentifier} className="auth-form">
                                <div style={{ textAlign: 'left', marginBottom: '8px', padding: '8px', backgroundColor: '#f0f9ff', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#0369a1' }}>
                                        Account Found: <strong>{forgotUsername}</strong> ({detectedRole?.role_name})
                                    </div>
                                </div>

                                <div className="input-group" style={{ textAlign: 'left', marginTop: '6px' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>
                                        {roleConfig.label}
                                    </label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={forgotIdentifier} 
                                        onChange={(e) => setForgotIdentifier(e.target.value)} 
                                        placeholder={roleConfig.placeholder} 
                                        className="auth-input"
                                    />
                                    <small style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                                        {roleConfig.helpText}
                                    </small>
                                </div>

                                <button type="submit" className="btn-primary">
                                    Verify Identity
                                </button>

                                <button 
                                    type="button" 
                                    onClick={() => setForgotStep(1)} 
                                    className="btn-link"
                                >
                                    Back to Step 1
                                </button>
                            </form>
                        )}

                        {forgotStep === 3 && (
                            /* STEP 3: PROCEED TO ENTER NEW STRONG PASSWORD */
                            <form onSubmit={handleResetPassword} className="auth-form">
                                <div style={{ textAlign: 'left', marginBottom: '8px', padding: '8px', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CheckCircle2 size={18} color="#16a34a" />
                                    <span style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: '600' }}>
                                        Identity Verified! Please enter your new strong password.
                                    </span>
                                </div>

                                <div className="password-input-wrapper">
                                    <input 
                                        type={showForgotNewPassword ? "text" : "password"} 
                                        required 
                                        value={forgotNewPassword} 
                                        onChange={(e) => setForgotNewPassword(e.target.value)} 
                                        placeholder="New Strong Password" 
                                        className="auth-input"
                                    />
                                    <button 
                                        type="button" 
                                        className="password-toggle-btn" 
                                        onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                                        aria-label="Toggle password visibility"
                                    >
                                        {showForgotNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                                <div className="password-input-wrapper">
                                    <input 
                                        type={showForgotConfirmPassword ? "text" : "password"} 
                                        required 
                                        value={forgotConfirmPassword} 
                                        onChange={(e) => setForgotConfirmPassword(e.target.value)} 
                                        placeholder="Confirm New Password" 
                                        className="auth-input"
                                    />
                                    <button 
                                        type="button" 
                                        className="password-toggle-btn" 
                                        onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                                        aria-label="Toggle password visibility"
                                    >
                                        {showForgotConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                                {/* Password Strength Checklist */}
                                <div className="password-strength-container">
                                    <div className="strength-header">
                                        <span>Password Strength:</span>
                                        <span className={`strength-badge ${isForgotPassStrong ? 'strong' : 'weak'}`}>
                                            {isForgotPassStrong ? 'STRONG' : 'WEAK'}
                                        </span>
                                    </div>
                                    <ul className="req-checklist">
                                        <li className={forgotPassReqs.minLength ? 'valid' : 'invalid'}>At least 8 characters</li>
                                        <li className={forgotPassReqs.hasUpper ? 'valid' : 'invalid'}>At least 1 uppercase letter</li>
                                        <li className={forgotPassReqs.hasLower ? 'valid' : 'invalid'}>At least 1 lowercase letter</li>
                                        <li className={forgotPassReqs.hasNumber ? 'valid' : 'invalid'}>At least 1 number</li>
                                        <li className={forgotPassReqs.hasSpecial ? 'valid' : 'invalid'}>At least 1 special character (!@#$%^&*)</li>
                                    </ul>
                                </div>

                                <button 
                                    type="submit" 
                                    className="btn-primary"
                                    disabled={!isForgotPassStrong || forgotNewPassword !== forgotConfirmPassword}
                                >
                                    Reset Password
                                </button>

                                <button 
                                    type="button" 
                                    onClick={() => setForgotStep(2)} 
                                    className="btn-link"
                                >
                                    Back to Verification
                                </button>
                            </form>
                        )}

                    </div>
                )}
            </div>

            {/* MODAL 1: CHANGE DEFAULT PASSWORD MODAL */}
            {showChangePassModal && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <h3 className="modal-title">Change Default Password</h3>
                        <p className="modal-subtitle">You are using a default password ("123"). Please set a strong new password to continue.</p>

                        {passModalError && <div className="error-message">{passModalError}</div>}

                        <form onSubmit={handleChangePasswordSubmit} className="auth-form">
                            <div className="password-input-wrapper">
                                <input 
                                    type={showNewPassword ? "text" : "password"} 
                                    required
                                    placeholder="New Password" 
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="auth-input"
                                />
                                <button 
                                    type="button" 
                                    className="password-toggle-btn" 
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    aria-label="Toggle new password visibility"
                                >
                                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            
                            <div className="password-input-wrapper">
                                <input 
                                    type={showConfirmPassword ? "text" : "password"} 
                                    required
                                    placeholder="Confirm New Password" 
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="auth-input"
                                />
                                <button 
                                    type="button" 
                                    className="password-toggle-btn" 
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    aria-label="Toggle confirm password visibility"
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            <div className="password-strength-container">
                                <div className="strength-header">
                                    <span>Password Strength:</span>
                                    <span className={`strength-badge ${isPasswordStrong ? 'strong' : 'weak'}`}>
                                        {isPasswordStrong ? 'STRONG' : 'WEAK'}
                                    </span>
                                </div>
                                <ul className="req-checklist">
                                    <li className={passReqs.minLength ? 'valid' : 'invalid'}>At least 8 characters</li>
                                    <li className={passReqs.hasUpper ? 'valid' : 'invalid'}>At least 1 uppercase letter</li>
                                    <li className={passReqs.hasLower ? 'valid' : 'invalid'}>At least 1 lowercase letter</li>
                                    <li className={passReqs.hasNumber ? 'valid' : 'invalid'}>At least 1 number</li>
                                    <li className={passReqs.hasSpecial ? 'valid' : 'invalid'}>At least 1 special character (!@#$%^&*)</li>
                                </ul>
                            </div>

                            <button 
                                type="submit" 
                                className="btn-primary" 
                                disabled={!isPasswordStrong || newPassword !== confirmPassword}
                            >
                                Save & Re-login
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: PARENT DETAILS SETUP MODAL */}
            {showParentModal && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <h3 className="modal-title">Complete Parent Profile</h3>
                        <p className="modal-subtitle">Please fill in your primary contact information before proceeding.</p>

                        {parentModalError && <div className="error-message">{parentModalError}</div>}

                        <form onSubmit={handleParentSetupSubmit} className="auth-form">
                            <input 
                                type="text" 
                                required
                                placeholder="First Name" 
                                value={parentFirstName}
                                onChange={(e) => setParentFirstName(e.target.value)}
                                className="auth-input"
                            />
                            <input 
                                type="text" 
                                required
                                placeholder="Last Name" 
                                value={parentLastName}
                                onChange={(e) => setParentLastName(e.target.value)}
                                className="auth-input"
                            />
                            <div>
                                <input 
                                    type="tel" 
                                    required
                                    placeholder="Primary Phone Number (e.g., 09171234567)" 
                                    value={parentPhone}
                                    onChange={(e) => setParentPhone(e.target.value)}
                                    className="auth-input"
                                    maxLength={13}
                                />
                                <small style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '4px', display: 'block', textAlign: 'left' }}>
                                    Must be a valid PH number starting with 09 or +639 (11 digits).
                                </small>
                            </div>
                            <button type="submit" className="btn-primary">Save Profile & Continue</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}