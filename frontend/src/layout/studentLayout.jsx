import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, 
    FileText, 
    User, 
    ClipboardPlus,
    LogOut,
    Lightbulb,
    MessageSquare,
    Clipboard,
    Bell,
    Download
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import '../styles/student/StudentLayout.css'; 
import StudentMessageModal from '../components/student/StudentMessageModal.jsx';
import { useWebPush } from '../hooks/useWebPush';

const StudentLayout = () => {
    const navigate = useNavigate();
    const sidebarQrRef = useRef(null);

    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [studentData, setStudentData] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    
    // Messaging States
    const [isMessageOpen, setIsMessageOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [currentUserId, setCurrentUserId] = useState(null);

    // Refs to store user & student IDs for polling without re-triggering main useEffect
    const studentIdRef = useRef(null);
    const currentUserIdRef = useRef(null);

    // Keep refs in sync with state
    useEffect(() => {
        studentIdRef.current = studentData?.student_id || null;
    }, [studentData?.student_id]);

    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

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

    // Calculate unread notifications count dynamically
    const unreadNotifCount = notifications.filter(
        n => !n.is_read && n.is_read !== 1 && !n.read
    ).length;

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

    // Fetch notifications with local read-state preservation
    const fetchNotifications = useCallback(async (studentId) => {
        if (!studentId) return;
        try {
            const res = await fetch(`http://localhost:3001/api/notifications/student/${studentId}`);
            const data = await res.json();
            if (data.success) {
                const fetchedNotifications = data.data || [];
                setNotifications(prev => {
                    // Collect IDs of notifications that were already marked as read locally
                    const localReadIds = new Set(
                        prev.filter(n => n.is_read === 1 || n.is_read === true || n.read === true)
                            .map(n => n.notification_id)
                    );

                    // Merge fetched items while preserving local read status so they stay visible
                    return fetchedNotifications.map(item => {
                        if (localReadIds.has(item.notification_id)) {
                            return { ...item, is_read: 1, read: true };
                        }
                        return item;
                    });
                });
            }
        } catch (err) {
            console.error('Error fetching student notifications:', err);
        }
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        
        if (!storedUser) {
            navigate('/');
            return;
        }

        let user;
        try {
            user = JSON.parse(storedUser);
        } catch (e) {
            console.error("Invalid user object in localStorage:", e);
            navigate('/');
            return;
        }

        const accurateUserId = user.user_id || user.id || user.UserID || user.userId;

        if (!accurateUserId) {
            console.error("No user ID found in localStorage object.");
            setIsLoading(false);
            return;
        }

        setCurrentUserId(accurateUserId);

        const fetchStudentProfile = async () => {
            try {
                const response = await fetch(`http://localhost:3001/api/get-student/${accurateUserId}`);
                const data = await response.json();

                if (data.success && data.student) {
                    setStudentData(data.student);
                    if (data.student.student_id) {
                        studentIdRef.current = data.student.student_id;
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

        // Fetch student profile and unread count once on mount
        fetchStudentProfile();
        fetchUnreadCount(accurateUserId);

        // Poll messages and notifications every 5 seconds using refs to avoid re-triggering main effect
        const interval = setInterval(() => {
            if (currentUserIdRef.current) {
                fetchUnreadCount(currentUserIdRef.current);
            }
            if (studentIdRef.current) {
                fetchNotifications(studentIdRef.current);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [navigate, fetchUnreadCount, fetchNotifications]);

    // Handle downloading the sidebar QR code with solid white background
    const handleDownloadSidebarQr = () => {
        if (!sidebarQrRef.current || !studentData?.student_id) return;

        const originalCanvas = sidebarQrRef.current.querySelector('canvas');
        if (originalCanvas) {
            const padding = 20; // White border padding around the QR code
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = originalCanvas.width + padding * 2;
            offscreenCanvas.height = originalCanvas.height + padding * 2;

            const ctx = offscreenCanvas.getContext('2d');
            if (ctx) {
                // Fill canvas with solid white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

                // Draw QR code onto white canvas centered
                ctx.drawImage(originalCanvas, padding, padding);

                const url = offscreenCanvas.toDataURL('image/png');
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = `QR_${studentData.student_id}.png`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            }
        }
    };

    // Navigate to sub-routes or trigger modals based on notification content
    const handleNotificationClick = async (notification) => {
        try {
            // 1. Mark notification as read on the backend
            await fetch(`http://localhost:3001/api/notifications/${notification.notification_id}/read`, {
                method: 'PATCH'
            });

            // 2. Update item locally to read state without removing it from the array
            setNotifications(prev => prev.map(n => 
                n.notification_id === notification.notification_id 
                    ? { ...n, is_read: 1, read: true } 
                    : n
            ));
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
        } else if (type.includes('Doctor','Incident','Visit') || type.includes('record') || msg.includes('clinic','Incident','Doctor') || msg.includes('consultation') || msg.includes('visit')) {
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

    // Mark ALL notifications as read without removing items
    const handleMarkAllAsRead = async () => {
        const studentId = studentData?.student_id;
        if (!studentId) return;

        try {
            await fetch(`http://localhost:3001/api/notifications/student/${studentId}/read-all`, {
                method: 'PATCH'
            });
            // Update all notifications as read in local state
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1, read: true })));
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
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

                        {/* Student QR Code in Sidebar with Download Button */}
                        {studentData?.student_id && (
                            <div style={{ marginTop: '10px', textAlign: 'center' }}>
                                <div 
                                    ref={sidebarQrRef}
                                    className="sidebar-qr-box" 
                                    style={{ 
                                        padding: '8px', 
                                        backgroundColor: '#ffffff', 
                                        borderRadius: '8px', 
                                        display: 'inline-block',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                                    }}
                                >
                                    <QRCodeCanvas
                                        value={studentData.student_id}
                                        size={110}
                                        level="H"
                                        bgColor="#ffffff"
                                        fgColor="#000000"
                                        includeMargin={false}
                                    />
                                </div>
                                <button
                                    onClick={handleDownloadSidebarQr}
                                    style={{
                                        marginTop: '8px',
                                        padding: '5px 12px',
                                        backgroundColor: '#ffd100',
                                        color: '#004b87',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'fixed',
                                        width: 'fit-content',
                                        gap: '5px'
                                    }}
                                >
                                    <Download size={14} />                               
                                </button>
                            </div>
                        )}
                        
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
                            {unreadNotifCount > 0 && (
                                <span className="top-bar-unread-badge">{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</span>
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
                                    {unreadNotifCount > 0 && (
                                        <button 
                                            onClick={handleMarkAllAsRead}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#1890ff',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                padding: 0,
                                                fontWeight: '500'
                                            }}
                                        >
                                            Mark all as read
                                        </button>
                                    )}
                                </div>

                                {notifications.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#8c8c8c', fontSize: '13px' }}>
                                        No notifications
                                    </div>
                                ) : (
                                    notifications.map((item) => {
                                        const isItemRead = item.is_read === 1 || item.is_read === true || item.read === true;
                                        return (
                                            <div 
                                                key={item.notification_id}
                                                onClick={() => handleNotificationClick(item)}
                                                style={{
                                                    padding: '12px 16px',
                                                    borderBottom: '1px solid #f0f0f0',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.2s',
                                                    backgroundColor: isItemRead ? '#f9f9f9' : '#ffffff',
                                                    opacity: isItemRead ? 0.75 : 1
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isItemRead ? '#f9f9f9' : '#ffffff'}
                                            >
                                                <div style={{ 
                                                    fontWeight: isItemRead ? 'normal' : 'bold', 
                                                    fontSize: '13px', 
                                                    marginBottom: '4px', 
                                                    color: '#1f1f1f',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    {!isItemRead && (
                                                        <span style={{
                                                            width: '6px',
                                                            height: '6px',
                                                            backgroundColor: '#1890ff',
                                                            borderRadius: '50%',
                                                            display: 'inline-block'
                                                        }} />
                                                    )}
                                                    {item.title || 'Notification'}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#595959', marginBottom: '6px', lineHeight: '1.4' }}>
                                                    {item.message}
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#bfbfbf', textAlign: 'right' }}>
                                                    {new Date(item.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                        );
                                    })
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
                        refreshNotifications: () => {
                            if (studentIdRef.current) {
                                fetchNotifications(studentIdRef.current);
                            }
                        }
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