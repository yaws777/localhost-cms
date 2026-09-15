import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import '../styles/Login.css'; 

export default function Login() {
    const navigate = useNavigate();
    const [isLoginView, setIsLoginView] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    
    // Login Form State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Forgot Password Form State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [retrievedPassword, setRetrievedPassword] = useState('');

    // Modal Visibility States
    const [showChangePassModal, setShowChangePassModal] = useState(false);
    const [showParentModal, setShowParentModal] = useState(false);

    // Change Password Modal State
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

    // Temporary storage for user login session while completing parent modal
    const [pendingAuthData, setPendingAuthData] = useState(null);

    // Password Criteria Validator
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

    // Philippine Phone Number Validator Helper
    const isValidPHPhone = (phone) => {
        const cleanPhone = phone.replace(/[\s\-()]/g, '');
        return /^(09|\+639)\d{9}$/.test(cleanPhone);
    };

    // Main Login Handler
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
                // STEP 1 & 2: Check for Default Password ("123")
                if (data.isDefaultPassword) {
                    setShowChangePassModal(true);
                    return; // Halt login sequence until password is changed
                }

                // Proceed with regular role-based routing
                proceedLoginFlow(data);
            } else {
                setErrorMsg(data.message);
            }
        } catch (error) {
            setErrorMsg("Network error. Please check if the server is running.");
        }
    };

    // Sequential Flow Handler for Authenticated User
    const proceedLoginFlow = (data) => {
        localStorage.setItem('user', JSON.stringify(data.user));

        // Role Routing
        if (data.user.role_id === 'ADMN' || data.user.role === 'admin') {
            navigate('/ManageStudentAccounts');
        } else if (data.user.role === 'student') {
            if (data.isFormCompleted) {
                navigate('/StudentDashboard');
            } else {
                navigate('/HealthHistoryForm');
            }
        } else if (data.user.role === 'nurse') {
            navigate('/NurseDashboard');
        } else if (data.user.role === 'parent') {
            localStorage.setItem('parent_id', data.user.parent_id);

            // STEP 3: Check Parent Details Completion
            if (data.isProfileIncomplete) {
                setPendingAuthData(data);
                setParentFirstName(data.user.first_name || '');
                setParentLastName(data.user.last_name || '');
                setParentPhone(data.user.primary_phone || '');
                setShowParentModal(true);
                return;
            }

            // STEP 4: Check Linked Students Count
            finalizeParentRouting(data.students);
        }
    };

    // Helper to finalize Parent Routing based on student count
    const finalizeParentRouting = (students) => {
        if (students && students.length > 0) {
            localStorage.setItem('linkedStudents', JSON.stringify(students));

            if (students.length > 1) {
                navigate('/ChooseStudentProfile');
            } else {
                localStorage.setItem('selectedStudentId', students[0].student_id);
                navigate('/ParentDashboard');
            }
        } else {
            setErrorMsg("No student profiles are currently linked to this account.");
        }
    };

    // Submit Password Change
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

    // Submit Parent Setup Details
    const handleParentSetupSubmit = async (e) => {
        e.preventDefault();
        setParentModalError('');

        if (!parentFirstName || !parentLastName || !parentPhone) {
            setParentModalError("All fields are required.");
            return;
        }

        // Philippine Phone Validation
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
                finalizeParentRouting(pendingAuthData.students);
            } else {
                setParentModalError(data.message);
            }
        } catch (error) {
            setParentModalError("Failed to update details. Try again.");
        }
    };

    // Forgot Password Handler
    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setRetrievedPassword('');
        try {
            const response = await fetch('http://localhost:3001/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, firstName, lastName })
            });
            const data = await response.json();
            
            if (data.success) {
                setRetrievedPassword(`Your password is: ${data.password}`);
            } else {
                setErrorMsg(data.message);
            }
        } catch (error) {
            setErrorMsg("Network error. Please try again.");
        }
    };

    return (
        <div className="login-page-wrapper">
            <div className="login-container">
                <div className="login-brand-header">
                    <div className="login-system-tag">STI Baliuag Clinic System</div>
                    <h2 className="login-title">{isLoginView ? 'Login Portal' : 'Account Recovery'}</h2>
                </div>
                
                {errorMsg && <div className="error-message">{errorMsg}</div>}
                {successMsg && <div className="success-message">{successMsg}</div>}
                {retrievedPassword && <div className="success-message">{retrievedPassword}</div>}

                {isLoginView ? (
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
                            {password && (
                                <button 
                                    type="button" 
                                    className="password-toggle-btn" 
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label="Toggle password visibility"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            )}
                        </div>

                        <button type="submit" className="btn-primary">Login</button>
                        <button 
                            type="button" 
                            onClick={() => { setIsLoginView(false); setErrorMsg(''); setSuccessMsg(''); setRetrievedPassword(''); }} 
                            className="btn-link"
                        >
                            Forgot Password?
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleForgotPassword} className="auth-form">
                        <input 
                            type="text" 
                            required 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                            placeholder="Username (@baliuag.sti.edu.ph)" 
                            className="auth-input"
                        />
                        <input 
                            type="text" 
                            required 
                            value={firstName} 
                            onChange={(e) => setFirstName(e.target.value)} 
                            placeholder="First Name" 
                            className="auth-input"
                        />
                        <input 
                            type="text" 
                            required 
                            value={lastName} 
                            onChange={(e) => setLastName(e.target.value)} 
                            placeholder="Last Name" 
                            className="auth-input"
                        />
                        <button type="submit" className="btn-primary">Retrieve Password</button>
                        <button 
                            type="button" 
                            onClick={() => { setIsLoginView(true); setErrorMsg(''); setSuccessMsg(''); setRetrievedPassword(''); }} 
                            className="btn-link"
                        >
                            Back to Login
                        </button>
                    </form>
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
                                {newPassword && (
                                    <button 
                                        type="button" 
                                        className="password-toggle-btn" 
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        aria-label="Toggle new password visibility"
                                    >
                                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                )}
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
                                {confirmPassword && (
                                    <button 
                                        type="button" 
                                        className="password-toggle-btn" 
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        aria-label="Toggle confirm password visibility"
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                )}
                            </div>

                            {/* Password Indicator & Requirement Checklist */}
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