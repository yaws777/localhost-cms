import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, 
    FileText, 
    User, 
    ClipboardPlus,
    LogOut,
    Lightbulb,
    QrCode,
    MessageSquare,
    Clipboard,
    Bell
} from 'lucide-react';
import '../styles/student/StudentLayout.css'; 
import StudentMessageModal from '../components/student/StudentMessageModal.jsx';
import { useWebPush } from '../hooks/useWebPush';

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

    // Web Push Hook integration
    const { isSubscribed, subscribe } = useWebPush(currentUserId);

    // Auto-sync web push subscription if browser permission was already granted
    useEffect(() => {
        if (currentUserId && typeof Notification !== 'undefined' && Notification?.permission === 'granted' && !isSubscribed) {
            subscribe();
        }
    }, [currentUserId, isSubscribed, subscribe]);

    // Notification States
    const [notifications, setNotifications] = useState([]);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);

    // Fetch unread messages count
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

    // Fetch unread student notifications
    const fetchNotifications = useCallback(async (studentId) => {
        if (!studentId) return;
        try {
            const res = await fetch(`http://localhost:3001/api/notifications/student/${studentId}`);
            const data = await res.json();
            if (data.success) {
                setNotifications(data.data || []);
            }
        } catch (err) {
            console.error('Error fetching student notifications:', err);
        }
    }, []);

    useEffect(() => {
        const fetchStudentProfile = async (userId) => {
            try {
                const response = await fetch(`http://localhost:3001/api/get-student/${userId}`);
                const data = await response.json();

                if (data.success && data.student) {
                    setStudentData(data.student);
                    if (data.student.student_id) {
                        fetchNotifications(data.student.student_id);
                    }
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

                // Poll messages and notifications every 5 seconds
                const interval = setInterval(() => {
                    fetchUnreadCount(accurateUserId);
                    if (studentData?.student_id) {
                        fetchNotifications(studentData.student_id);
                    }
                }, 5000);

                return () => clearInterval(interval);
            } else {
                console.error("No user ID found in localStorage object.");
                setIsLoading(false);
            }
        } else {
            navigate('/');
        }
    }, [navigate, fetchUnreadCount, fetchNotifications, studentData?.student_id]);

    // Navigate to sub-routes or trigger modals based on notification content
    const handleNotificationClick = async (notification) => {
        try {
            // 1. Mark notification as read
            await fetch(`http://localhost:3001/api/notifications/${notification.notification_id}/read`, {
                method: 'PATCH'
            });

            // 2. Remove read item locally
            setNotifications(prev => prev.filter(n => n.notification_id !== notification.notification_id));
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }

        setShowNotifDropdown(false);

        const type = (notification.type || '').toLowerCase();
        const title = (notification.title || '').toLowerCase();
        const msg = (notification.message || '').toLowerCase();

        // 3. Perform internal routing without exiting StudentLayout
        if (type.includes('message') || msg.includes('message') || title.includes('message')) {
            setIsMessageOpen(true);
        } else if (type.includes('requirement') || msg.includes('requirement') || title.includes('requirement')) {
            navigate('/MyRequirements');
        } else if (type.includes('log') || type.includes('record') || msg.includes('clinic') || msg.includes('consultation') || msg.includes('visit')) {
            navigate('/ClinicLogsAndRecords');
        } else if (type.includes('request') || msg.includes('request')) {
            navigate('/RequestModule');
        } else if (type.includes('tip') || msg.includes('health tip')) {
            navigate('/HealthTips');
        } else if (type.includes('qr') || msg.includes('qr')) {
            navigate('/MyQr');
        } else if (type.includes('profile') || msg.includes('profile')) {
            navigate('/MyProfile');
        } else {
            navigate('/StudentDashboard');
        }
    };

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
                    <NavLink to="/StudentNotificationSettings" className="nav-link" onClick={closeSidebar}>
                        <Bell className="nav-icon" size={16} />
                        <span>Notification Settings</span>
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

            {/* TOP BAR WITH MESSAGES AND NOTIFICATION BELL */}
            <div className="student-top-bar">
                <div className="top-bar-left">
                    <span className="system-name">STI Baliuag Clinic Management System</span>
                </div>
                <div className="top-bar-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span className="current-date">{currentDate}</span>

                    {/* MESSAGE BUTTON */}
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

                    {/* NOTIFICATION BELL BUTTON & DROPDOWN */}
                    <div style={{ position: 'relative' }}>
                        <button 
                            className="top-bar-message-btn" 
                            title="Notifications"
                            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                        >
                            <Bell size={20} />
                            {notifications.length > 0 && (
                                <span className="top-bar-unread-badge">{notifications.length}</span>
                            )}
                        </button>

                        {/* DROPDOWN CONTAINER */}
                        {showNotifDropdown && (
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: '40px',
                                width: '320px',
                                maxHeight: '380px',
                                backgroundColor: '#ffffff',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                borderRadius: '8px',
                                zIndex: 1000,
                                overflowY: 'auto',
                                border: '1px solid #e8e8e8',
                                textAlign: 'left'
                            }}>
                                <div style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid #f0f0f0',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backgroundColor: '#fafafa',
                                    borderTopLeftRadius: '8px',
                                    borderTopRightRadius: '8px'
                                }}>
                                    <span style={{ color: '#1f1f1f', fontSize: '14px' }}>Notifications</span>
                                    <span style={{ fontSize: '12px', color: '#8c8c8c' }}>{notifications.length} unread</span>
                                </div>

                                {notifications.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#8c8c8c', fontSize: '13px' }}>
                                        No unread notifications
                                    </div>
                                ) : (
                                    notifications.map((item) => (
                                        <div 
                                            key={item.notification_id}
                                            onClick={() => handleNotificationClick(item)}
                                            style={{
                                                padding: '12px 16px',
                                                borderBottom: '1px solid #f0f0f0',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s',
                                                backgroundColor: '#ffffff'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                        >
                                            <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px', color: '#1f1f1f' }}>
                                                {item.title || 'Notification'}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#595959', marginBottom: '6px', lineHeight: '1.4' }}>
                                                {item.message}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#bfbfbf', textAlign: 'right' }}>
                                                {new Date(item.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT SECTION */}
            <div className="main-content">
                <div className="page-content">
                    <Outlet context={{ 
                        studentId: studentData?.student_id || '', 
                        userId: studentData?.user_id || '',
                        firstName: studentData?.first_name || '', 
                        lastName: studentData?.last_name || '', 
                        username: studentData?.username || '', 
                        programId: studentData?.program_id || '', 
                        yearLevel: studentData?.year_level || '',
                        refreshNotifications: () => fetchNotifications(studentData?.student_id)
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