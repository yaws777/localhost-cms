import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import '../styles/Login.css';

// Base API URL with environment variable support for Netlify production
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://localhost-cms.onrender.com';

// Safari Private Mode safe localStorage helper
const safeLocalStorage = {
    setItem: (key, value) => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn(`[Storage Warning] Unable to set ${key} in localStorage:`, e);
        }
    },
    getItem: (key) => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn(`[Storage Warning] Unable to get ${key} from localStorage:`, e);
            return null;
        }
    },
    removeItem: (key) => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn(`[Storage Warning] Unable to remove ${key} from localStorage:`, e);
        }
    }
};

export default function Login() {
    const navigate = useNavigate();
    const [isLoginView, setIsLoginView] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
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
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/login`, {
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
                setErrorMsg(data.message || 'Invalid credentials');
            }
        } catch (error) {
            setErrorMsg("Network error. Please check your internet connection or server availability.");
        } finally {
            setIsLoading(false);
        }
    };

    // Sequential Flow Handler for Authenticated User
    const proceedLoginFlow = (data) => {
        safeLocalStorage.setItem('user', JSON.stringify(data.user));

        if (data.user.role === 'student') {
            if (data.isFormCompleted) {
                navigate('/StudentDashboard');
            } else {
                navigate('/HealthHistoryForm');
            }
        } else if (data.user.role === 'nurse') {
            navigate('/NurseDashboard');
        } else if (data.user.role === 'parent') {
            safeLocalStorage.setItem('parent_id', data.user.parent_id);

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

    // Helper to finalize Parent Routing directly to parent portal
    const finalizeParentRouting = (students) => {
        if (students && students.length > 0) {
            safeLocalStorage.setItem('linkedStudents', JSON.stringify(students));
            safeLocalStorage.setItem('selectedStudentId', students[0].student_id);
            navigate('/ParentDashboard');
        } else {
            safeLocalStorage.setItem('linkedStudents', JSON.stringify([]));
            safeLocalStorage.removeItem('selectedStudentId');
            navigate('/ParentDashboard');
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

        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/change-password`, {
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
                setPassModalError(data.message || "Failed to change password.");
            }
        } catch (error) {
            setPassModalError("Failed to update password. Try again later.");
        } finally {
            setIsLoading(false);
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

        if (!isValidPHPhone(parentPhone)) {
            setParentModalError("Please enter a valid Philippine mobile number (e.g., 09171234567 or +639171234567).");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/update-parent-profile`, {
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
                setParentModalError(data.message || "Failed to update profile.");
            }
        } catch (error) {
            setParentModalError("Failed to update details. Try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Forgot Password Handler
    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setRetrievedPassword('');
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, firstName, lastName })
            });
            const data = await response.json();
            
            if (data.success) {
                setRetrievedPassword(`Your password is: ${data.password}`);
            } else {
                setErrorMsg(data.message || "Could not retrieve password.");
            }
        } catch (error) {
            setErrorMsg("Network error. Please try again.");
        } finally {
            setIsLoading(false);
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
                            disabled={isLoading}
                        />
                        
                        <div className="password-input-wrapper">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                required 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                placeholder="Password" 
                                className="auth-input"
                                disabled={isLoading}
                            />
                            <button 
                                type="button" 
                                className="password-toggle-btn" 
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label="Toggle password visibility"
                                disabled={isLoading}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        <button type="submit" className="btn-primary" disabled={isLoading}>
                            {isLoading ? 'Logging in...' : 'Login'}
                        </button>
                        <button 
                            type="button" 
                            onClick={() => { setIsLoginView(false); setErrorMsg(''); setSuccessMsg(''); setRetrievedPassword(''); }} 
                            className="btn-link"
                            disabled={isLoading}
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
                            disabled={isLoading}
                        />
                        <input 
                            type="text" 
                            required 
                            value={firstName} 
                            onChange={(e) => setFirstName(e.target.value)} 
                            placeholder="First Name" 
                            className="auth-input"
                            disabled={isLoading}
                        />
                        <input 
                            type="text" 
                            required 
                            value={lastName} 
                            onChange={(e) => setLastName(e.target.value)} 
                            placeholder="Last Name" 
                            className="auth-input"
                            disabled={isLoading}
                        />
                        <button type="submit" className="btn-primary" disabled={isLoading}>
                            {isLoading ? 'Retrieving...' : 'Retrieve Password'}
                        </button>
                        <button 
                            type="button" 
                            onClick={() => { setIsLoginView(true); setErrorMsg(''); setSuccessMsg(''); setRetrievedPassword(''); }} 
                            className="btn-link"
                            disabled={isLoading}
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
                                    disabled={isLoading}
                                />
                                <button 
                                    type="button" 
                                    className="password-toggle-btn" 
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    aria-label="Toggle new password visibility"
                                    disabled={isLoading}
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
                                    disabled={isLoading}
                                />
                                <button 
                                    type="button" 
                                    className="password-toggle-btn" 
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    aria-label="Toggle confirm password visibility"
                                    disabled={isLoading}
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
                                disabled={!isPasswordStrong || newPassword !== confirmPassword || isLoading}
                            >
                                {isLoading ? 'Updating...' : 'Save & Re-login'}
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
                                disabled={isLoading}
                            />
                            <input 
                                type="text" 
                                required
                                placeholder="Last Name" 
                                value={parentLastName}
                                onChange={(e) => setParentLastName(e.target.value)}
                                className="auth-input"
                                disabled={isLoading}
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
                                    disabled={isLoading}
                                />
                                <small style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '4px', display: 'block', textAlign: 'left' }}>
                                    Must be a valid PH number starting with 09 or +639 (11 digits).
                                </small>
                            </div>
                            <button type="submit" className="btn-primary" disabled={isLoading}>
                                {isLoading ? 'Saving...' : 'Save Profile & Continue'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}