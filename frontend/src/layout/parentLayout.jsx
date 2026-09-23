import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, 
    FileHeart, 
    User, 
    Settings,
    LogOut,
    RefreshCw,
    Bell,
    X
} from 'lucide-react';
import '../styles/parent/ParentLayout.css'; 
import { useWebPush } from '../hooks/useWebPush';

const ParentLayout = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // State to hold the fetched parent, child profile, and linked students count
    const [parentData, setParentData] = useState(null);
    const [childData, setChildData] = useState(null); 
    const [linkedStudentsCount, setLinkedStudentsCount] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');

    // Web Push Hook integration
    const parentUserId = parentData?.user_id || null;
    const { isSubscribed, subscribe } = useWebPush(parentUserId);

    // Auto-sync web push subscription if browser permission was already granted
    useEffect(() => {
        if (parentUserId && typeof Notification !== 'undefined' && Notification?.permission === 'granted' && !isSubscribed) {
            subscribe();
        }
    }, [parentUserId, isSubscribed, subscribe]);

    // Notification states
    const [notifications, setNotifications] = useState([]);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const [activeNotifModal, setActiveNotifModal] = useState(null);

    useEffect(() => {
        // Read linkedStudents from localStorage to determine if switch option should display
        const storedLinkedStudents = localStorage.getItem('linkedStudents');
        if (storedLinkedStudents) {
            try {
                const parsedStudents = JSON.parse(storedLinkedStudents);
                if (Array.isArray(parsedStudents)) {
                    setLinkedStudentsCount(parsedStudents.length);
                }
            } catch (error) {
                console.error("Error parsing linkedStudents:", error);
            }
        }

        const fetchProfiles = async (userId) => {
            try {
                // 1. Fetch Parent Data
                const parentRes = await fetch(`http://localhost:3001/api/get-parent/${userId}`);
                const parentJson = await parentRes.json();

                if (parentJson.success && parentJson.parent) {
                    setParentData(parentJson.parent);
                } else {
                    setErrorMsg(parentJson.message || 'Failed to fetch parent data');
                }

                // 2. Fetch Selected Child Data
                const selectedStudentId = localStorage.getItem('selectedStudentId');
                if (selectedStudentId) {
                    const childRes = await fetch(`http://localhost:3001/api/get-student-by-studentId/${selectedStudentId}`);
                    const childJson = await childRes.json();
                    
                    if (childJson.success && childJson.student) {
                        setChildData(childJson.student);
                    }
                } else {
                    // If no child is selected, force them to choose
                    navigate('/ChooseStudentProfile');
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
                fetchProfiles(accurateUserId);
            } else {
                console.error("No user ID found in localStorage object.");
                setIsLoading(false);
            }
        } else {
            navigate('/');
        }
    }, [navigate]);

    // Fetch notifications for both parent_id and selected student_id
    useEffect(() => {
        const fetchAllNotifications = async () => {
            if (!parentData?.parent_id) return;

            try {
                const fetchPromises = [
                    fetch(`http://localhost:3001/api/notifications/parent/${parentData.parent_id}`).then(res => res.json())
                ];

                if (childData?.student_id) {
                    fetchPromises.push(
                        fetch(`http://localhost:3001/api/notifications/student/${childData.student_id}`).then(res => res.json())
                    );
                }

                const results = await Promise.all(fetchPromises);
                const combinedNotifs = results.flat();

                // Deduplicate by notification_id if any overlap occurs
                const uniqueNotifs = Array.from(
                    new Map(combinedNotifs.map(item => [item.notification_id, item])).values()
                );

                // Sort descending by creation date
                uniqueNotifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                setNotifications(uniqueNotifs);
            } catch (err) {
                console.error("Error fetching notifications:", err);
            }
        };

        fetchAllNotifications();
    }, [parentData?.parent_id, childData?.student_id]);

    const toggleSidebar = () => setIsOpen(!isOpen);
    const closeSidebar = () => setIsOpen(false);

    // Handles clearing the active student selection when switching accounts
    const handleSwitchAccount = () => {
        localStorage.removeItem('selectedStudentId'); 
        navigate('/ChooseStudentProfile');            
    };

    // Full logout cleanup
    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('selectedStudentId'); 
        localStorage.removeItem('linkedStudents');    
        navigate('/');
    };

    const getInitials = () => {
        if (!parentData) return 'PR';
        const first = parentData.first_name ? parentData.first_name[0] : '';
        const last = parentData.last_name ? parentData.last_name[0] : '';
        return (first + last).toUpperCase() || 'PR';
    };

    // Filter unviewed/unread notifications
    const unviewedNotifications = notifications.filter(n => Number(n.is_read) === 0);

    // Handle clicking individual notification
    const handleNotificationClick = (notif) => {
        setShowNotifDropdown(false);

        // Mark as read locally
        setNotifications(prev =>
            prev.map(item =>
                item.notification_id === notif.notification_id ? { ...item, is_read: 1 } : item
            )
        );

        const notifType = notif.type ? notif.type.toLowerCase() : '';
        const notifMsg = notif.message ? notif.message.toLowerCase() : '';

        // Determine destination page vs in-layout modal based on message or type
        if (notifType.includes('clinic') || notifMsg.includes('clinic') || notifMsg.includes('medical')) {
            navigate('/ChildClinicRecords');
        } else if (notifType.includes('profile') || notifMsg.includes('profile')) {
            navigate('/ChildProfile');
        } else {
            // Open modal in parentLayout without exiting
            setActiveNotifModal(notif);
        }
    };

    return (
        <div className="parent-layout">
        
            {/* Mobile Hamburger Button */}
            <button className="mobile-toggle-btn" onClick={toggleSidebar}>
                ☰
            </button>

            {/* Overlay for mobile when sidebar is open */}
            {isOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

            {/* Sidebar Container */}
            <div className={`parent-sidebar ${isOpen ? 'open' : ''}`}>
                <button className="close-sidebar-btn" onClick={closeSidebar} aria-label="Close Sidebar">
                    &times;
                </button>

                <div className="sidebar-header">
                    <h2>STI Baliuag</h2>
                    <p>Parent Portal</p>
                </div>

                {/* PROFILE INFO SECTION */}
                <div className="sidebar-profile">
                    <div className="profile-avatar">
                        {getInitials()}
                    </div>
                    <div className="profile-details">
                        <h3 className="profile-name">
                            {isLoading 
                                ? 'Loading...' 
                                : parentData 
                                    ? `${parentData.first_name} ${parentData.last_name}`.trim() 
                                    : 'Parent User'}
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

            {/* MAIN CONTENT SECTION */}
            <div className="main-content">
                {/* TOP BAR */}
                <div className="parent-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="top-bar-info">
                        <span className="viewing-label">Active Profile:</span>
                        
                        {childData ? (
                            <div className="student-topbar-details" style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                                <span className="student-name" style={{ fontWeight: '600', color: '#111' }}>
                                    {childData.first_name} {childData.last_name}
                                </span>
                                
                                <span className="student-id-badge" style={{ 
                                    background: '#e1ecf4', 
                                    color: '#3973af', 
                                    padding: '2px 8px', 
                                    borderRadius: '4px', 
                                    fontSize: '0.70rem',
                                    fontWeight: '500'
                                }}>
                                    ID: {childData.student_id}
                                </span>
                            </div>
                        ) : (
                            <span className="student-name">Loading Profile...</span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {/* NOTIFICATION BELL BUTTON */}
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
                                {unviewedNotifications.length > 0 && (
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
                                        {unviewedNotifications.length > 99 ? '99+' : unviewedNotifications.length}
                                    </span>
                                )}
                            </button>

                            {/* UNVIEWED NOTIFICATIONS DROPDOWN */}
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
                                        <span>Unread Notifications</span>
                                        <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'normal' }}>
                                            {unviewedNotifications.length} total
                                        </span>
                                    </div>

                                    {unviewedNotifications.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '0.85rem' }}>
                                            No unread notifications
                                        </div>
                                    ) : (
                                        unviewedNotifications.map((notif) => (
                                            <div 
                                                key={notif.notification_id}
                                                onClick={() => handleNotificationClick(notif)}
                                                style={{
                                                    padding: '12px 16px',
                                                    borderBottom: '1px solid #f0f0f0',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.2s',
                                                    backgroundColor: '#e6f7ff'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bae7ff'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e6f7ff'}
                                            >
                                                <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#111', marginBottom: '4px' }}>
                                                    {notif.title}
                                                </div>
                                                <div style={{ fontSize: '0.78rem', color: '#555', lineHeight: '1.3' }}>
                                                    {notif.message}
                                                </div>
                                                <div style={{ fontSize: '0.68rem', color: '#888', marginTop: '6px' }}>
                                                    {new Date(notif.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Switch Child Button */}
                        {linkedStudentsCount > 1 && (
                            <button 
                                className="btn-switch-child" 
                                onClick={handleSwitchAccount}
                            >
                                <RefreshCw size={14} /> 
                                Switch Child's Profile
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Wrapper */}
                <div className="page-content">
                    <Outlet context={{ 
                        parentId: parentData?.parent_id || '',
                        userId: parentData?.user_id || '', 
                        firstName: parentData?.first_name || '', 
                        lastName: parentData?.last_name || '', 
                        username: parentData?.username || '', 
                        primaryPhone: parentData?.primary_phone || '', 
                        isSmsVerified: parentData?.is_sms_verified || 0,
                        selectedChildId: childData?.student_id || '' 
                    }} />
                </div>
            </div>

            {/* NOTIFICATION DETAIL MODAL */}
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