import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, FileBarChart, Stethoscope, FolderHeart, 
    Pill, Boxes, FileCheck, ClipboardCheck, HeartPulse, 
    BriefcaseMedical, AlertTriangle, Vault, LogOut,
    MessageSquare, Users, UserCheck, Bell 
} from 'lucide-react';
import '../styles/nurse/NurseLayout.css';
import { useWebPush } from '../hooks/useWebPush';

export const NurseLayout = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [nurseData, setNurseData] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    
    // Web Push Hook integration
    const nurseUserId = nurseData?.user_id || null;
    const { isSubscribed, subscribe } = useWebPush(nurseUserId);

    // Auto-sync web push subscription
    useEffect(() => {
        if (nurseUserId && typeof Notification !== 'undefined' && Notification?.permission === 'granted' && !isSubscribed) {
            subscribe();
        }
    }, [nurseUserId, isSubscribed, subscribe]);

    // Unread messages & notifications state
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);

    // Derive active user ID dynamically
    const getStoredUserId = () => {
        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return null;
            const user = JSON.parse(storedUser);
            return user.user_id || user.id || user.UserID || user.userId || user.nurse_id || null;
        } catch (e) {
            return null;
        }
    };

    const activeUserId = nurseData?.user_id || nurseData?.nurse_id || getStoredUserId();

    // Fetch unread messages count
    const fetchUnreadCount = useCallback(async (targetUserId) => {
        if (!targetUserId || targetUserId === 'undefined') return;
        try {
            const res = await fetch(`https://localhost-cms.onrender.com/api/messages/unread-count/${targetUserId}`);
            const data = await res.json();
            if (data.success) {
                setUnreadCount(Number(data.unreadCount || 0));
            }
        } catch (err) {
            console.error('Failed to fetch unread message count:', err);
        }
    }, []);

    // Fetch unread notifications
    const fetchNotifications = useCallback(async (nurseId) => {
        if (!nurseId) return;
        try {
            const res = await fetch(`https://localhost-cms.onrender.com/api/notifications/nurse/${nurseId}`);
            const data = await res.json();
            if (data.success) {
                setNotifications(data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
    }, []);

    // Initial Nurse profile fetch
    useEffect(() => {
        const accurateUserId = getStoredUserId();

        if (!accurateUserId) {
            setIsLoading(false);
            navigate('/');
            return;
        }

        const fetchNurseProfile = async () => {
            try {
                const response = await fetch(`https://localhost-cms.onrender.com/api/get-nurse/${accurateUserId}`);
                const data = await response.json();

                if (data.success && data.nurse) {
                    setNurseData(data.nurse);
                    if (data.nurse.nurse_id) {
                        fetchNotifications(data.nurse.nurse_id);
                    }
                } else {
                    setErrorMsg(data.message || 'Failed to fetch nurse data');
                }
            } catch (error) {
                console.error("Fetch error:", error);
                setErrorMsg("Failed to connect to the server.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchNurseProfile();
    }, [navigate, fetchNotifications]);

    // Polling timer & immediate fetch on ID resolution
    useEffect(() => {
        if (!activeUserId) return;

        // Fetch unread count immediately once ID resolves
        fetchUnreadCount(activeUserId);

        const interval = setInterval(() => {
            fetchUnreadCount(activeUserId);
            if (nurseData?.nurse_id) {
                fetchNotifications(nurseData.nurse_id);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [activeUserId, nurseData?.nurse_id, fetchUnreadCount, fetchNotifications]);

    const getNotificationRoute = (notification) => {
        const type = (notification.type || '').toLowerCase();
        const title = (notification.title || '').toLowerCase();
        const msg = (notification.message || '').toLowerCase();

        if (type.includes('requirement') || msg.includes('requirement') || title.includes('submission')) return '/RequirementManagement';
        if (type.includes('visit') || type.includes('consultation') || msg.includes('clinic visit')) return '/VisitLogConsultation';
        if (type.includes('health_record') || type.includes('record')) return '/HealthRecords';
        if (type.includes('dispense') || msg.includes('dispensed')) return '/DispensedMedicine';
        if (type.includes('inventory') || msg.includes('stock')) return '/MedicineInventory';
        if (type.includes('request') || msg.includes('request')) return '/DocumentIssuance';
        if (type.includes('screening')) return '/HealthScreening';
        if (type.includes('doctor')) return '/DoctorVisit';
        if (type.includes('incident')) return '/IncidentReport';
        if (type.includes('insurance') || type.includes('vault')) return '/InsuranceVault';
        if (type.includes('student_account')) return '/ManageStudentAccounts';
        if (type.includes('parent_account')) return '/ManageParentAccounts';
        if (type.includes('message') || type.includes('chat')) return '/NurseMessages';
        if (type.includes('report')) return '/WeeklyReports';
        if (type.includes('setting')) return '/NurseNotificationSettings';

        return '/NurseDashboard';
    };

    const handleNotificationClick = async (notification) => {
        try {
            await fetch(`http://localhost:3001/api/notifications/${notification.notification_id}/read`, {
                method: 'PATCH'
            });
            setNotifications(prev => prev.filter(n => n.notification_id !== notification.notification_id));
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }

        setShowNotifDropdown(false);
        const targetRoute = getNotificationRoute(notification);

        navigate(targetRoute, { 
            state: { 
                notificationId: notification.notification_id,
                navigateId: notification.navigate_id || null
            } 
        });
    };

    const toggleSidebar = () => setIsOpen(!isOpen);
    const closeSidebar = () => setIsOpen(false);

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/');
    };

    const getInitials = () => {
        if (!nurseData) return 'RN';
        const first = nurseData.first_name ? nurseData.first_name[0] : '';
        const last = nurseData.last_name ? nurseData.last_name[0] : '';
        return (first + last).toUpperCase() || 'RN';
    };

    const currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    return (
        <div className="student-layout">
            <button className="mobile-toggle-btn" onClick={toggleSidebar}>☰</button>
            {isOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

            {/* Sidebar - Messages nav item removed */}
            <div className={`student-sidebar ${isOpen ? 'open' : ''}`}>
                <button className="close-sidebar-btn" onClick={closeSidebar} aria-label="Close Sidebar">&times;</button>

                <div className="sidebar-header">
                    <h2>STI Baliuag</h2>
                    <p>Nurse Portal</p>
                </div>

                <div className="sidebar-profile">
                    <div className="profile-avatar">{getInitials()}</div>
                    <div className="profile-details">
                        <h3 className="profile-name">
                            {isLoading ? 'Loading...' : nurseData ? `${nurseData.first_name} ${nurseData.last_name}`.trim() : 'Nurse User'}
                        </h3>
                        <p className="profile-username">{nurseData?.username ? `${nurseData.username}` : '---'}</p>
                        <span className="profile-id">ID: {nurseData?.nurse_id || '--------'}</span>
                        
                        {errorMsg && (
                            <span className="profile-error" style={{ color: '#ff4d4f', fontSize: '0.8em', display: 'block', marginTop: '5px' }}>
                                {errorMsg}
                            </span>
                        )}
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/NurseDashboard" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <LayoutDashboard className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Dashboard</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/WeeklyReports" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <FileBarChart className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Weekly Reports</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/VisitLogConsultation" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <Stethoscope className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Clinic Visit Log</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/HealthRecords" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <FolderHeart className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Health Records</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/DispensedMedicine" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <Pill className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Dispensed Medicine</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/MedicineInventory" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <Boxes className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Medicine Inventory</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/DocumentIssuance" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <FileCheck className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Document Issuance</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/RequirementManagement" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <ClipboardCheck className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Requirement Management</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/HealthScreening" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <HeartPulse className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Health Screening</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/DoctorVisit" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <BriefcaseMedical className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Doctor Visit</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/IncidentReport" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <AlertTriangle className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Incident Report</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/InsuranceVault" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <Vault className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Insurance Vault</span>
                            </>
                        )}
                    </NavLink>
                    
                    <NavLink to="/ManageStudentAccounts" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <Users className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Manage Student Account</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/ManageParentAccounts" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <UserCheck className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Manage Parent Account</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/NurseNotificationSettings" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <Bell className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Notification Settings</span>
                            </>
                        )}
                    </NavLink>
                    
                    <hr className="nav-divider" style={{ margin: '15px 0', borderColor: 'rgba(255,255,255,0.1)' }} />

                    <button onClick={handleLogout} className="nav-link logout-btn" style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'yellow' }}>
                        <LogOut className="nav-icon" size={16} />
                        <span>Logout</span>
                    </button>
                </nav>
            </div>
            
            {/* Top Bar - Message Icon with Unread Count Badge */}
            <div className="student-top-bar">
                <div className="top-bar-left">
                    <span className="system-name">STI Baliuag Clinic Management System</span>
                </div>
                <div className="top-bar-right" style={{ display: 'flex', alignItems: 'center', gap: '20px', overflow: 'visible' }}>
                    
                    {/* Topbar Message Link with Dynamic Badge Counter */}
                    <NavLink 
                        to="/NurseMessages" 
                        className="topbar-message-link" 
                        style={{ 
                            position: 'relative', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: '#333', 
                            textDecoration: 'none',
                            overflow: 'visible',
                            padding: '4px'
                        }} 
                        title="Messages"
                    >
                        <MessageSquare size={22} />
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-8px',
                                backgroundColor: '#ff4d4f',
                                color: '#ffffff',
                                borderRadius: '10px',
                                padding: '2px 6px',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                lineHeight: '1',
                                minWidth: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                zIndex: 20
                            }}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </NavLink>

                    {/* Notifications Icon with Dropdown */}
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <button 
                            onClick={() => setShowNotifDropdown(!showNotifDropdown)} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', display: 'inline-flex', alignItems: 'center', color: '#333', padding: '4px' }}
                            title="Notifications"
                        >
                            <Bell size={22} />
                            {notifications.length > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-6px',
                                    right: '-8px',
                                    backgroundColor: '#ff4d4f',
                                    color: '#ffffff',
                                    borderRadius: '10px',
                                    padding: '2px 6px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    lineHeight: '1',
                                    minWidth: '18px',
                                    height: '18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                    zIndex: 20
                                }}>
                                    {notifications.length > 99 ? '99+' : notifications.length}
                                </span>
                            )}
                        </button>

                        {showNotifDropdown && (
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: '35px',
                                width: '320px',
                                maxHeight: '400px',
                                backgroundColor: '#ffffff',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                borderRadius: '8px',
                                zIndex: 1000,
                                overflowY: 'auto',
                                border: '1px solid #e8e8e8'
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
                                    <span>Unread Notifications</span>
                                    <span style={{ fontSize: '12px', color: '#8c8c8c' }}>{notifications.length} unread</span>
                                </div>

                                {notifications.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#8c8c8c', fontSize: '14px' }}>
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
                                            <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: '#1f1f1f' }}>
                                                {item.title || 'Notification'}
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#595959', marginBottom: '6px', lineHeight: '1.4' }}>
                                                {item.message}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#bfbfbf', textAlign: 'right' }}>
                                                {new Date(item.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <span className="current-date">{currentDate}</span>
                </div>
            </div>

            <div className="main-content">
                <Outlet context={{ 
                    nurseId: nurseData?.nurse_id || '', 
                    userId: activeUserId,
                    firstName: nurseData?.first_name || '', 
                    lastName: nurseData?.last_name || '',
                    username: nurseData?.username || '',
                    refreshUnreadCount: () => fetchUnreadCount(activeUserId),
                    refreshNotifications: () => fetchNotifications(nurseData?.nurse_id)
                }} />
            </div>
        </div>
    );
};

export default NurseLayout;