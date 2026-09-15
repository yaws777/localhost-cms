import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, 
    FileText, 
    User, 
    Bell, 
    ClipboardPlus,
    LogOut,
    Lightbulb,
    QrCode,
    MessageSquare,
    Clipboard
} from 'lucide-react';
import '../styles/student/StudentLayout.css'; 
import StudentMessageModal from '../components/student/StudentMessageModal.jsx';

const StudentLayout = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [studentData, setStudentData] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    
    // Messaging States
    const [isMessageOpen, setIsMessageOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [currentUserId, setCurrentUserId] = useState(null);

    const fetchUnreadCount = useCallback(async (userId) => {
        if (!userId) return;
        try {
            const res = await fetch(`http://localhost:3001/api/messages/unread-count/${userId}`);
            const data = await res.json();
            if (data.success) {
                setUnreadCount(data.unreadCount || 0);
            }
        } catch (err) {
            console.error('Error fetching unread count:', err);
        }
    }, []);

    useEffect(() => {
        const fetchStudentProfile = async (userId) => {
            try {
                const response = await fetch(`http://localhost:3001/api/get-student/${userId}`);
                const data = await response.json();

                if (data.success && data.student) {
                    setStudentData(data.student);
                } else {
                    setErrorMsg(data.message || 'Failed to fetch student data');
                }
            } catch (error) {
                console.error("Fetch error:", error);
                setErrorMsg("Failed to connect to the server.");
            } finally {
                setIsLoading(false);
            }
        };

        const storedUser = localStorage.getItem('user');
        
        if (storedUser) {
            const user = JSON.parse(storedUser);
            const accurateUserId = user.user_id || user.id || user.UserID || user.userId;

            if (accurateUserId) {
                setCurrentUserId(accurateUserId);
                fetchStudentProfile(accurateUserId);
                fetchUnreadCount(accurateUserId);

                // Poll total unread count every 5 seconds
                const interval = setInterval(() => {
                    fetchUnreadCount(accurateUserId);
                }, 5000);

                return () => clearInterval(interval);
            } else {
                console.error("No user ID found in localStorage object.");
                setIsLoading(false);
            }
        } else {
            navigate('/');
        }
    }, [navigate, fetchUnreadCount]);

    const toggleSidebar = () => setIsOpen(!isOpen);
    const closeSidebar = () => setIsOpen(false);

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/');
    };

    const getInitials = () => {
        if (!studentData) return 'ST';
        const first = studentData.first_name ? studentData.first_name[0] : '';
        const last = studentData.last_name ? studentData.last_name[0] : '';
        return (first + last).toUpperCase() || 'ST';
    };

    const currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    return (
        <div className="student-layout">
            {/* Mobile Hamburger Button */}
            <button className="mobile-toggle-btn" onClick={toggleSidebar}>
                ☰
            </button>

            {/* Overlay for mobile when sidebar is open */}
            {isOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

            {/* Sidebar Container */}
            <div className={`student-sidebar ${isOpen ? 'open' : ''}`}>
                <button className="close-sidebar-btn" onClick={closeSidebar} aria-label="Close Sidebar">
                    &times;
                </button>

                <div className="sidebar-header">
                    <h2>STI Baliuag</h2>
                    <p>Student Portal</p>
                </div>

                <div className="sidebar-profile">
                    <div className="profile-avatar">
                        {getInitials()}
                    </div>
                    <div className="profile-details">
                        <h3 className="profile-name">
                            {isLoading 
                                ? 'Loading...' 
                                : studentData 
                                    ? `${studentData.first_name} ${studentData.last_name}`.trim() 
                                    : 'Student User'}
                        </h3>
                        <p className="profile-username">
                            {studentData?.username ? `${studentData.username}` : '---'}
                        </p>
                        <span className="profile-id">
                            ID: {studentData?.student_id || '--------'}
                        </span>
                        
                        {errorMsg && <span className="profile-error" style={{color: '#ff4d4f', fontSize: '0.8em', display: 'block', marginTop: '5px'}}>{errorMsg}</span>}
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/StudentDashboard" className="nav-link" onClick={closeSidebar}>
                        <LayoutDashboard className="nav-icon" size={16} />
                        <span>Dashboard</span>
                    </NavLink>

                    <NavLink to="/MyRequirements" className="nav-link" onClick={closeSidebar}>
                        <Clipboard className="nav-icon" size={16} />
                        <span>My Requirements</span>
                    </NavLink>

                    <NavLink to="/MyQr" className="nav-link" onClick={closeSidebar}>
                        <QrCode className="nav-icon" size={16} />
                        <span>My QR Code</span>
                    </NavLink>
                    <NavLink to="/ClinicLogsAndRecords" className="nav-link" onClick={closeSidebar}>
                        <FileText className="nav-icon" size={16} />
                        <span>Clinic Logs & Records</span>
                    </NavLink>
                    <NavLink to="/MyProfile" className="nav-link" onClick={closeSidebar}>
                        <User className="nav-icon" size={16} />
                        <span>My Profile</span>
                    </NavLink>
                    <NavLink to="/RequestModule" className="nav-link" onClick={closeSidebar}>
                        <ClipboardPlus className="nav-icon" size={16} />
                        <span>Request Module</span>
                    </NavLink>
                    <NavLink to="/HealthTips" className="nav-link" onClick={closeSidebar}>
                        <Lightbulb className="nav-icon" size={16} />
                        <span>Health Tips</span>
                    </NavLink>
                    <NavLink to="/StudentNotifications" className="nav-link" onClick={closeSidebar}>
                        <Bell className="nav-icon" size={16} />
                        <span>Notifications</span>
                    </NavLink>

                    <hr className="nav-divider" style={{ margin: '15px 0', borderColor: 'rgba(255,255,255,0.1)' }} />

                    <button 
                        onClick={handleLogout} 
                        className="nav-link logout-btn" 
                        style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'yellow' }}
                    >
                        <LogOut className="nav-icon" size={16} />
                        <span>Logout</span>
                    </button>
                </nav>
            </div>

            {/* TOP BAR WITH LUCIDE MESSAGE BUTTON */}
            <div className="student-top-bar">
                <div className="top-bar-left">
                    <span className="system-name">STI Baliuag Clinic Management System</span>
                </div>
                <div className="top-bar-right">
                    <span className="current-date">{currentDate}</span>

                    {/* TOP BAR LUCIDE MESSAGE BUTTON */}
                    <button 
                        className="top-bar-message-btn" 
                        title="Messages"
                        onClick={() => setIsMessageOpen(true)}
                    >
                        <MessageSquare size={20} />
                        {unreadCount > 0 && (
                            <span className="top-bar-unread-badge">{unreadCount}</span>
                        )}
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT SECTION */}
            <div className="main-content">
                <div className="page-content">
                    <Outlet context={{ 
                        studentId: studentData?.student_id || '', 
                        firstName: studentData?.first_name || '', 
                        lastName: studentData?.last_name || '', 
                        username: studentData?.username || '', 
                        programId: studentData?.program_id || '', 
                        yearLevel: studentData?.year_level || '' 
                    }} />
                </div>
            </div>

            {/* MESSENGER MODAL POPUP */}
            {isMessageOpen && currentUserId && (
                <StudentMessageModal 
                    userId={currentUserId} 
                    onClose={() => setIsMessageOpen(false)} 
                    refreshUnreadCount={() => fetchUnreadCount(currentUserId)}
                />
            )}
        </div>
    );
};

export default StudentLayout;