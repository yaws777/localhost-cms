import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, FileBarChart, Stethoscope, FolderHeart, 
    Pill, Boxes, FileCheck, ClipboardCheck, HeartPulse, 
    BriefcaseMedical, AlertTriangle, Vault, LogOut,
    MessageSquare, Users, UserCheck, Bell
} from 'lucide-react';
import '../styles/nurse/NurseLayout.css'; 
import { useWebPush } from '../hooks/useWebPush';

const NurseLayout = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [nurseData, setNurseData] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    
    // Web Push Hook integration
    const nurseUserId = nurseData?.user_id || null;
    const { isSubscribed, subscribe } = useWebPush(nurseUserId);

    // Auto-sync web push subscription if browser permission was already granted
    useEffect(() => {
        if (nurseUserId && typeof Notification !== 'undefined' && Notification?.permission === 'granted' && !isSubscribed) {
            subscribe();
        }
    }, [nurseUserId, isSubscribed, subscribe]);

    // State for overall unread contacts count
    const [unreadContactsCount, setUnreadContactsCount] = useState(0);

    // State for notifications
    const [notifications, setNotifications] = useState([]);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);

    // Fetch unread messages count
    const fetchUnreadCount = async (userId) => {
        try {
            const res = await fetch(`http://localhost:3001/api/messages/unread-count/${userId}`);
            const data = await res.json();
            if (data.success) {
                setUnreadContactsCount(data.unreadCount);
            }
        } catch (err) {
            console.error('Failed to fetch unread message count:', err);
        }
    };

    // Fetch unread notifications
    const fetchNotifications = async (nurseId) => {
        if (!nurseId) return;
        try {
            const res = await fetch(`http://localhost:3001/api/notifications/nurse/${nurseId}`);
            const data = await res.json();
            if (data.success) {
                setNotifications(data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
    };

    useEffect(() => {
        const fetchNurseProfile = async (userId) => {
            try {
                const response = await fetch(`http://localhost:3001/api/get-nurse/${userId}`);
                const data = await response.json();

                if (data.success && data.nurse) {
                    setNurseData(data.nurse);
                    // Initial notification fetch
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

        const storedUser = localStorage.getItem('user');
        
        if (storedUser) {
            const user = JSON.parse(storedUser);
            const accurateUserId = user.user_id || user.id || user.UserID || user.userId;

            if (accurateUserId) {
                fetchNurseProfile(accurateUserId);
                fetchUnreadCount(accurateUserId);

                // Setup polling interval for messages and notifications
                const interval = setInterval(() => {
                    fetchUnreadCount(accurateUserId);
                    if (nurseData?.nurse_id) {
                        fetchNotifications(nurseData.nurse_id);
                    }
                }, 5000);

                return () => clearInterval(interval);
            } else {
                setIsLoading(false);
            }
        } else {
            navigate('/');
        }
    }, [navigate, nurseData?.nurse_id]);

    // Handle routing logic based on notification content/type
    const getNotificationRoute = (notification) => {
        const type = (notification.type || '').toLowerCase();
        const title = (notification.title || '').toLowerCase();
        const msg = (notification.message || '').toLowerCase();

        if (type.includes('visit') || msg.includes('visit') || title.includes('consultation')) return '/VisitLogConsultation';
        if (type.includes('health') || msg.includes('health record') || title.includes('health')) return '/HealthRecords';
        if (type.includes('medicine') || msg.includes('dispense')) return '/DispensedMedicine';
        if (type.includes('inventory') || msg.includes('stock')) return '/MedicineInventory';
        if (type.includes('document') || msg.includes('issuance')) return '/DocumentIssuance';
        if (type.includes('requirement') || msg.includes('requirement')) return '/RequirementManagement';
        if (type.includes('screening') || msg.includes('screening')) return '/HealthScreening';
        if (type.includes('doctor') || msg.includes('doctor')) return '/DoctorVisit';
        if (type.includes('incident') || msg.includes('incident')) return '/IncidentReport';
        if (type.includes('insurance') || msg.includes('insurance')) return '/InsuranceVault';
        if (type.includes('student') || msg.includes('student')) return '/ManageStudentAccounts';
        if (type.includes('parent') || msg.includes('parent')) return '/ManageParentAccounts';
        if (type.includes('message') || msg.includes('message')) return '/NurseMessages';

        return '/NurseDashboard'; // Default fallback route
    };

    // Mark notification as read and route to target view
    const handleNotificationClick = async (notification) => {
        try {
            // 1. Call PATCH API to mark notification as read
            await fetch(`http://localhost:3001/api/notifications/${notification.notification_id}/read`, {
                method: 'PATCH'
            });

            // 2. Remove read notification from local state
            setNotifications(prev => prev.filter(n => n.notification_id !== notification.notification_id));
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }

        // 3. Close notification dropdown
        setShowNotifDropdown(false);

        // 4. Navigate to appropriate route within NurseLayout
        const targetRoute = getNotificationRoute(notification);
        navigate(targetRoute);
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
            
            {/* ==================== TOP BAR WITH MESSAGES & NOTIFICATIONS ==================== */}
            <div className="student-top-bar">
                <div className="top-bar-left">
                    <span className="system-name">STI Baliuag Clinic Management System</span>
                </div>
                <div className="top-bar-right" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    
                    {/* Top Bar Message Link & Badge */}
                    <NavLink to="/NurseMessages" className="topbar-message-link" style={{ position: 'relative', display: 'flex', alignItems: 'center', color: '#333', textDecoration: 'none' }} title="Messages">
                        <MessageSquare size={20} />
                        {unreadContactsCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-10px',
                                backgroundColor: '#ff4d4f',
                                color: '#ffffff',
                                borderRadius: '10px',
                                padding: '2px 6px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                lineHeight: '1'
                            }}>
                                {unreadContactsCount}
                            </span>
                        )}
                    </NavLink>

                    {/* Top Bar Notification Bell Dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button 
                            onClick={() => setShowNotifDropdown(!showNotifDropdown)} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', color: '#333', padding: 0 }}
                            title="Notifications"
                        >
                            <Bell size={20} />
                            {notifications.length > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-6px',
                                    right: '-10px',
                                    backgroundColor: '#ff4d4f',
                                    color: '#ffffff',
                                    borderRadius: '10px',
                                    padding: '2px 6px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    lineHeight: '1'
                                }}>
                                    {notifications.length}
                                </span>
                            )}
                        </button>

                        {/* Notification List Dropdown Panel */}
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
                    userId: nurseData?.user_id || '',
                    firstName: nurseData?.first_name || '', 
                    lastName: nurseData?.last_name || '',
                    username: nurseData?.username || '',
                    refreshUnreadCount: () => fetchUnreadCount(nurseData?.user_id),
                    refreshNotifications: () => fetchNotifications(nurseData?.nurse_id)
                }} />
            </div>
        </div>
    );
};

export default NurseLayout;