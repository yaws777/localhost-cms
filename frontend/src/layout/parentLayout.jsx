import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, 
    FileHeart, 
    User, 
    Settings,
    LogOut,
    Bell,
    X,
    MessageSquare,
    Loader2
} from 'lucide-react';
import '../styles/parent/ParentLayout.css'; 
import ParentMessageModal from '../components/student/ParentMessageModal.jsx';
import { useWebPush } from '../hooks/useWebPush';

const ParentLayout = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [parentData, setParentData] = useState(null);
    const [students, setStudents] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');

    const [isMessageOpen, setIsMessageOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const parentIdRef = useRef(null);
    const studentsRef = useRef([]);
    const parentUserIdRef = useRef(null);

    useEffect(() => {
        parentIdRef.current = parentData?.parent_id ? String(parentData.parent_id) : null;
        parentUserIdRef.current = parentData?.user_id ? String(parentData.user_id) : null;
    }, [parentData?.parent_id, parentData?.user_id]);

    useEffect(() => {
        studentsRef.current = students;
    }, [students]);

    const parentUserId = parentData?.user_id ? String(parentData.user_id) : null;
    const { isSubscribed, subscribe } = useWebPush(parentUserId);

    useEffect(() => {
        if (parentUserId && typeof Notification !== 'undefined' && Notification?.permission === 'granted' && !isSubscribed) {
            subscribe();
        }
    }, [parentUserId, isSubscribed, subscribe]);

    const [notifications, setNotifications] = useState([]);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const [activeNotifModal, setActiveNotifModal] = useState(null);

    // Dynamic unread notifications counter
    const unreadNotifCount = notifications.filter(
        n => !n.is_read && n.is_read !== 1 && !n.read
    ).length;

    const fetchUnreadCount = useCallback(async (userId) => {
        if (!userId) return;
        try {
            const res = await fetch(`http://localhost:3001/api/messages/unread-count/${String(userId)}`);
            const data = await res.json();
            if (data.success) {
                setUnreadCount(data.unreadCount || 0);
            }
        } catch (err) {
            console.error('Error fetching unread count:', err);
        }
    }, []);

    const handleRefreshUnreadCount = useCallback(() => {
        if (parentUserIdRef.current) {
            fetchUnreadCount(parentUserIdRef.current);
        }
    }, [fetchUnreadCount]);

    // Fetch notifications with local read-state preservation
    const fetchAllNotifications = useCallback(async (parentId, studentList) => {
        if (!parentId) return;

        try {
            const fetchPromises = [
                fetch(`http://localhost:3001/api/notifications/parent/${String(parentId)}`).then(res => res.json())
            ];

            if (studentList && studentList.length > 0) {
                studentList.forEach(st => {
                    if (st.student_id) {
                        fetchPromises.push(
                            fetch(`http://localhost:3001/api/notifications/student/${String(st.student_id)}`).then(res => res.json())
                        );
                    }
                });
            }

            const results = await Promise.all(fetchPromises);
            
            const combinedNotifs = results.flatMap(res => {
                if (res && res.success && Array.isArray(res.data)) {
                    return res.data;
                }
                if (Array.isArray(res)) {
                    return res;
                }
                return [];
            });

            const uniqueNotifs = Array.from(
                new Map(combinedNotifs.map(item => [item.notification_id, item])).values()
            );

            uniqueNotifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setNotifications(prev => {
                // Collect IDs of notifications locally marked as read
                const localReadIds = new Set(
                    prev.filter(n => n.is_read === 1 || n.is_read === true || n.read === true)
                        .map(n => n.notification_id)
                );

                // Preserve local read state so items stay visible
                return uniqueNotifs.map(item => {
                    if (localReadIds.has(item.notification_id)) {
                        return { ...item, is_read: 1, read: true };
                    }
                    return item;
                });
            });
        } catch (err) {
            console.error("Error fetching notifications:", err);
        }
    }, []);

    useEffect(() => {
        const storedLinkedStudents = localStorage.getItem('linkedStudents');
        let parsedStudents = [];
        if (storedLinkedStudents) {
            try {
                parsedStudents = JSON.parse(storedLinkedStudents);
                if (Array.isArray(parsedStudents)) {
                    setStudents(parsedStudents);
                    studentsRef.current = parsedStudents;
                    if (parsedStudents.length > 0 && !localStorage.getItem('selectedStudentId')) {
                        localStorage.setItem('selectedStudentId', String(parsedStudents[0].student_id));
                    }
                }
            } catch (error) {
                console.error("Error parsing linkedStudents:", error);
            }
        }

        const fetchProfiles = async (userId) => {
            try {
                const parentRes = await fetch(`http://localhost:3001/api/get-parent/${String(userId)}`);
                const parentJson = await parentRes.json();

                if (parentJson.success && parentJson.parent) {
                    setParentData(parentJson.parent);
                    const pid = parentJson.parent.parent_id ? String(parentJson.parent.parent_id) : null;
                    const pUserId = parentJson.parent.user_id ? String(parentJson.parent.user_id) : null;
                    parentIdRef.current = pid;
                    parentUserIdRef.current = pUserId;
                    if (pid) {
                        fetchAllNotifications(pid, parsedStudents);
                    }
                    if (pUserId) {
                        fetchUnreadCount(pUserId);
                    }
                } else {
                    setErrorMsg(parentJson.message || 'Failed to fetch parent data');
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
            let user;
            try {
                user = JSON.parse(storedUser);
            } catch (e) {
                console.error("Invalid user JSON in localStorage:", e);
                navigate('/');
                return;
            }

            const accurateUserId = user.user_id || user.id || user.UserID || user.userId;

            if (accurateUserId) {
                fetchProfiles(accurateUserId);
            } else {
                console.error("No user ID found in localStorage object.");
                setIsLoading(false);
            }
        } else {
            navigate('/');
        }

        const interval = setInterval(() => {
            if (parentIdRef.current) {
                fetchAllNotifications(parentIdRef.current, studentsRef.current);
            }
            if (parentUserIdRef.current) {
                fetchUnreadCount(parentUserIdRef.current);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [navigate, fetchAllNotifications, fetchUnreadCount]);

    const toggleSidebar = () => setIsOpen(!isOpen);
    const closeSidebar = () => setIsOpen(false);

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('parent_id');
        localStorage.removeItem('linkedStudents');
        localStorage.removeItem('selectedStudentId');
        navigate('/');
    };

    const getInitials = () => {
        if (!parentData) return 'PR';
        const first = parentData.first_name ? parentData.first_name[0] : '';
        const last = parentData.last_name ? parentData.last_name[0] : '';
        return (first + last).toUpperCase() || 'PR';
    };

    const handleNotificationClick = async (notif) => {
        setShowNotifDropdown(false);

        // Mark item as read locally without removing it
        setNotifications(prev =>
            prev.map(item =>
                item.notification_id === notif.notification_id ? { ...item, is_read: 1, read: true } : item
            )
        );

        try {
            await fetch(`http://localhost:3001/api/notifications/${notif.notification_id}/read`, {
                method: 'PATCH'
            });
        } catch (err) {
            console.error('Error marking parent notification as read:', err);
        }

        const notifType = notif.type ? notif.type.toLowerCase() : '';
        const notifMsg = notif.message ? notif.message.toLowerCase() : '';

        if (notifType.includes('message') || notifMsg.includes('message')) {
            setIsMessageOpen(true);
        } else if (notifType.includes('clinic') || notifMsg.includes('clinic') || notifMsg.includes('medical')) {
            navigate('/ChildClinicRecords');
        } else if (notifType.includes('profile') || notifMsg.includes('profile')) {
            navigate('/ChildProfile');
        } else {
            setActiveNotifModal(notif);
        }
    };

    // Mark ALL parent and student notifications as read
    const handleMarkAllAsRead = async () => {
        const pId = parentData?.parent_id;
        if (!pId) return;

        try {
            await fetch(`http://localhost:3001/api/notifications/parent/${pId}/read-all`, {
                method: 'PATCH'
            });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1, read: true })));
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
        }
    };

    const primaryStudentId = students[0]?.student_id || localStorage.getItem('selectedStudentId') || '';

    return (
        <div className="parent-layout">
            <style>{`
                @keyframes pmmSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .pmm-spin {
                    animation: pmmSpin 1s linear infinite;
                }
            `}</style>
            
            <button className="mobile-toggle-btn" onClick={toggleSidebar}>
                ☰
            </button>

            {isOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

            <div className={`parent-sidebar ${isOpen ? 'open' : ''}`}>
                <button className="close-sidebar-btn" onClick={closeSidebar} aria-label="Close Sidebar">
                    &times;
                </button>

                <div className="sidebar-header">
                    <h2>STI Baliuag</h2>
                    <p>Parent Portal</p>
                </div>

                <div className="sidebar-profile">
                    <div className="profile-avatar">
                        {getInitials()}
                    </div>
                    <div className="profile-details">
                        <h3 className="profile-name">
                            {isLoading ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <Loader2 size={14} className="pmm-spin" /> Loading...
                                </span>
                            ) : parentData ? (
                                `${parentData.first_name} ${parentData.last_name}`.trim()
                            ) : (
                                'Parent User'
                            )}
                        </h3>
                        <p className="profile-username">
                            {parentData?.username ? `${parentData.username}` : '---'}
                        </p>
                        <span className="profile-id">
                            ID: {parentData?.parent_id || '--------'}
                        </span>
                        
                        {errorMsg && <span className="profile-error" style={{color: '#ff4d4f', fontSize: '0.8em', display: 'block', marginTop: '5px'}}>{errorMsg}</span>}
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/ParentDashboard" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <LayoutDashboard className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Dashboard</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/ChildClinicRecords" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <FileHeart className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Child's Clinic Records</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/ChildProfile" className="nav-link" onClick={closeSidebar}>
                         {({ isActive }) => (
                            <>
                                <User className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Child's Profile</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/MyProfileParent" className="nav-link" onClick={closeSidebar}>
                         {({ isActive }) => (
                            <>
                                <Settings className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>My Profile</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/ParentNotificationSettings" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <Bell className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Notification Settings</span>
                            </>
                        )}
                    </NavLink>

                    <hr className="nav-divider" style={{ margin: '15px 0', borderColor: 'rgba(255,255,255,0.1)' }} />

                    <button 
                        onClick={handleLogout} 
                        className="nav-link logout-btn" 
                        style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--sti-yellow)' }}
                    >
                        <LogOut className="nav-icon" size={16} />
                        <span>Logout</span>
                    </button>
                </nav>
            </div>

            <div className="main-content">
                <div className="parent-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="top-bar-info">
                        <span className="viewing-label">Linked Student(s):</span>
                        
                        {isLoading ? (
                            <span className="student-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#666' }}>
                                <Loader2 size={14} className="pmm-spin" /> Loading Student Info...
                            </span>
                        ) : students && students.length > 0 ? (
                            <div className="student-topbar-details" style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                {students.map((st) => (
                                    <React.Fragment key={st.student_id}>
                                        <span className="student-name" style={{ fontWeight: '600', color: '#111' }}>
                                            {st.first_name} {st.last_name}
                                        </span>
                                        <span className="student-id-badge" style={{ 
                                            background: '#e1ecf4', 
                                            color: '#3973af', 
                                            padding: '2px 8px', 
                                            borderRadius: '4px', 
                                            fontSize: '0.70rem',
                                            fontWeight: '500'
                                        }}>
                                            ID: {st.student_id}
                                        </span>
                                    </React.Fragment>
                                ))}
                            </div>
                        ) : (
                            <span className="student-name">No Linked Students</span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <button 
                            onClick={() => setIsMessageOpen(true)}
                            title="Messages"
                            style={{
                                background: '#f4f6f8',
                                border: 'none',
                                borderRadius: '50%',
                                width: '38px',
                                height: '38px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                position: 'relative'
                            }}
                        >
                            <MessageSquare size={18} color="#333" />
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-2px',
                                    right: '-2px',
                                    background: '#ff4d4f',
                                    color: '#ffffff',
                                    borderRadius: '50%',
                                    minWidth: '18px',
                                    height: '18px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 4px'
                                }}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </button>

                        <div style={{ position: 'relative' }}>
                            <button 
                                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                                style={{
                                    background: '#f4f6f8',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '38px',
                                    height: '38px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    position: 'relative'
                                }}
                                aria-label="Notifications"
                            >
                                <Bell size={18} color="#333" />
                                {unreadNotifCount > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '-2px',
                                        right: '-2px',
                                        background: '#ff4d4f',
                                        color: '#ffffff',
                                        borderRadius: '50%',
                                        minWidth: '18px',
                                        height: '18px',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0 4px'
                                    }}>
                                        {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                                    </span>
                                )}
                            </button>

                            {showNotifDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '45px',
                                    width: '320px',
                                    maxHeight: '380px',
                                    overflowY: 'auto',
                                    backgroundColor: '#ffffff',
                                    boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
                                    borderRadius: '8px',
                                    zIndex: 1000,
                                    border: '1px solid #e8e8e8'
                                }}>
                                    <div style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid #eee',
                                        fontWeight: 'bold',
                                        fontSize: '0.9rem',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        backgroundColor: '#fafafa'
                                    }}>
                                        <span>Notifications</span>
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
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '0.85rem' }}>
                                            No notifications
                                        </div>
                                    ) : (
                                        notifications.map((notif) => {
                                            const isItemRead = notif.is_read === 1 || notif.is_read === true || notif.read === true;
                                            return (
                                                <div 
                                                    key={notif.notification_id}
                                                    onClick={() => handleNotificationClick(notif)}
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
                                                        fontWeight: isItemRead ? 'normal' : '600', 
                                                        fontSize: '0.85rem', 
                                                        color: '#111', 
                                                        marginBottom: '4px',
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
                                                        {notif.title || 'Notification'}
                                                    </div>
                                                    <div style={{ fontSize: '0.78rem', color: '#555', lineHeight: '1.3' }}>
                                                        {notif.message}
                                                    </div>
                                                    <div style={{ fontSize: '0.68rem', color: '#888', marginTop: '6px', textAlign: 'right' }}>
                                                        {new Date(notif.created_at).toLocaleString()}
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

                <div className="page-content">
                    <Outlet context={{ 
                        parentId: parentData?.parent_id || '',
                        userId: parentData?.user_id || '', 
                        firstName: parentData?.first_name || '', 
                        lastName: parentData?.last_name || '', 
                        username: parentData?.username || '', 
                        primaryPhone: parentData?.primary_phone || '', 
                        isSmsVerified: parentData?.is_sms_verified || 0,
                        linkedStudents: students,
                        studentIds: students.map(s => s.student_id),
                        selectedChildId: primaryStudentId,
                        refreshNotifications: () => {
                            if (parentIdRef.current) {
                                fetchAllNotifications(parentIdRef.current, studentsRef.current);
                            }
                        }
                    }} />
                </div>
            </div>

            {isMessageOpen && parentUserId && (
                <ParentMessageModal 
                    userId={parentUserId}
                    parentId={parentData?.parent_id}
                    linkedStudents={students}
                    onClose={() => {
                        setIsMessageOpen(false);
                        handleRefreshUnreadCount();
                    }} 
                    refreshUnreadCount={handleRefreshUnreadCount}
                />
            )}

            {activeNotifModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        padding: '24px',
                        maxWidth: '450px',
                        width: '90%',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                        position: 'relative'
                    }}>
                        <button 
                            onClick={() => setActiveNotifModal(null)}
                            style={{
                                position: 'absolute',
                                top: '16px',
                                right: '16px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={18} color="#666" />
                        </button>

                        <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#111', fontSize: '1.1rem' }}>
                            {activeNotifModal.title}
                        </h3>

                        <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.5', marginBottom: '20px' }}>
                            {activeNotifModal.message}
                        </p>

                        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '20px' }}>
                            Received: {new Date(activeNotifModal.created_at).toLocaleString()}
                        </div>

                        <div style={{ textAlign: 'right' }}>
                            <button 
                                onClick={() => setActiveNotifModal(null)}
                                style={{
                                    backgroundColor: '#003366',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ParentLayout;