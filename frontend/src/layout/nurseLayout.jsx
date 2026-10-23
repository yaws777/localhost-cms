import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, FileBarChart, Stethoscope, FolderHeart,
    Pill, Boxes, FileCheck, ClipboardCheck, HeartPulse,
    BriefcaseMedical, AlertTriangle, Vault, LogOut,
    MessageSquare, Users, UserCheck, Bell, Sun, Moon,
    PanelLeftClose, PanelLeftOpen, UserCog
} from 'lucide-react';
import '../styles/nurse/NurseLayout.css';
import NurseMessageModal from '../components/student/NurseMessageModal.jsx';
import { useWebPush } from '../hooks/useWebPush';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import ConfirmModal from '../components/common/ConfirmModal';
import { formatCurrentDate, formatDateTime } from '../utils/datetime';

const API_BASE_URL = 'http://localhost:3001';

export const NurseLayout = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const { collapsed, toggleCollapsed } = useSidebar();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [nurseData, setNurseData] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    
    // Messaging Modal State
    const [isMessageOpen, setIsMessageOpen] = useState(false);

    // Modal states
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    // Derive active user ID dynamically from session/localStorage
    const getStoredUserId = () => {
        try {
            const storedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
            if (!storedUser) return null;
            const user = JSON.parse(storedUser);
            return user.user_id || user.id || user.UserID || user.userId || null;
        } catch (e) {
            return null;
        }
    };

    const nurseUserId = nurseData?.user_id || getStoredUserId();
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

    const unreadNotifCount = notifications.filter(
        n => !n.is_read && n.is_read !== 1 && n.is_read !== '1' && !n.read
    ).length;

    const activeUserId = nurseUserId;

    // Fetch unread messages count
    const fetchUnreadCount = useCallback(async (targetUserId) => {
        if (!targetUserId || targetUserId === 'undefined') return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/messages/unread-count/${targetUserId}`);
            const data = await res.json();
            if (data.success) {
                setUnreadCount(Number(data.unreadCount || 0));
            }
        } catch (err) {
            console.error('Failed to fetch unread message count:', err);
        }
    }, []);

    // Fetch notifications
    const fetchNotifications = useCallback(async (nurseId) => {
        if (!nurseId) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/notifications/nurse/${nurseId}`);
            const data = await res.json();
            if (data.success) {
                const fetchedNotifications = data.data || [];
                const storageKey = `read_notifs_nurse_${nurseId}`;
                const storedReadIds = JSON.parse(sessionStorage.getItem(storageKey) || '[]');

                setNotifications(prev => {
                    const localReadIds = new Set([
                        ...storedReadIds,
                        ...prev.filter(n => n.is_read === 1 || n.is_read === '1' || n.is_read === true || n.read === true)
                            .map(n => n.notification_id)
                    ]);

                    sessionStorage.setItem(storageKey, JSON.stringify(Array.from(localReadIds)));

                    return fetchedNotifications.map(item => {
                        const isReadInDb = item.is_read === 1 || item.is_read === '1' || item.is_read === true || item.read === true;
                        if (isReadInDb || localReadIds.has(item.notification_id)) {
                            return { ...item, is_read: 1, read: true };
                        }
                        return item;
                    });
                });
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
                const response = await fetch(`${API_BASE_URL}/api/get-nurse/${accurateUserId}`);
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

    // Polling timer
    useEffect(() => {
        if (!activeUserId) return;

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

        // Doctor schedule / booking / appointment notifications must be matched before the generic 'request' and 'visit' rules
        if (type.includes('restock')) return '/ReportsAnalytics?tab=inventory';
        if (type.includes('booking')) return '/DoctorVisit?section=requests';
        if (type.includes('appointment') || type.includes('batch') || type.includes('assessment') || type.includes('doctor_visit')) return '/DoctorVisit';
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
        if (type.includes('doctor_account')) return '/ManageDoctorAccounts';
        if (type.includes('student_account')) return '/ManageStudentAccounts';
        if (type.includes('parent_account')) return '/ManageParentAccounts';
        if (type.includes('message') || type.includes('chat')) {
            setIsMessageOpen(true);
            return null;
        }
        if (type.includes('report')) return '/ReportsAnalytics';
        if (type.includes('setting')) return '/NurseNotificationSettings';

        return '/NurseDashboard';
    };

    const handleNotificationClick = async (notification) => {
        try {
            await fetch(`${API_BASE_URL}/api/notifications/${notification.notification_id}/read`, {
                method: 'PATCH'
            });

            const nurseId = nurseData?.nurse_id;
            if (nurseId) {
                const storageKey = `read_notifs_nurse_${nurseId}`;
                const storedReadIds = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
                if (!storedReadIds.includes(notification.notification_id)) {
                    storedReadIds.push(notification.notification_id);
                    sessionStorage.setItem(storageKey, JSON.stringify(storedReadIds));
                }
            }

            setNotifications(prev => prev.map(n => 
                n.notification_id === notification.notification_id 
                    ? { ...n, is_read: 1, read: true } 
                    : n
            ));
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }

        setShowNotifDropdown(false);
        const targetRoute = getNotificationRoute(notification);

        if (targetRoute) {
            navigate(targetRoute, { 
                state: { 
                    notificationId: notification.notification_id,
                    navigateId: notification.navigate_id || null
                } 
            });
        }
    };

    const handleMarkAllAsRead = async () => {
        const nurseId = nurseData?.nurse_id;
        if (!nurseId) return;

        try {
            await fetch(`${API_BASE_URL}/api/notifications/nurse/${nurseId}/read-all`, {
                method: 'PATCH'
            });

            const storageKey = `read_notifs_nurse_${nurseId}`;
            const allIds = notifications.map(n => n.notification_id);
            const storedReadIds = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
            const updatedReadIds = Array.from(new Set([...storedReadIds, ...allIds]));
            sessionStorage.setItem(storageKey, JSON.stringify(updatedReadIds));

            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1, read: true })));
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
        }
    };

    const toggleSidebar = () => setIsOpen(!isOpen);
    const closeSidebar = () => setIsOpen(false);

    const handleLogoutClick = () => {
        setShowLogoutModal(true);
    };

    const confirmLogout = () => {
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('app_active_user_id');
        setShowLogoutModal(false);
        navigate('/');
    };

    const getInitials = () => {
        if (!nurseData) return 'RN';
        const first = nurseData.first_name ? nurseData.first_name[0] : '';
        const last = nurseData.last_name ? nurseData.last_name[0] : '';
        return (first + last).toUpperCase() || 'RN';
    };

    const currentDate = formatCurrentDate();

    return (
        <div className="student-layout">
            <button className="mobile-toggle-btn" onClick={toggleSidebar}>☰</button>
            {isOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

            {/* Sidebar */}
            <div className={`student-sidebar ${isOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
                <button className="close-sidebar-btn" onClick={closeSidebar} aria-label="Close Sidebar">&times;</button>
                <button
                    className="sidebar-collapse-toggle"
                    onClick={toggleCollapsed}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    aria-label="Toggle sidebar"
                >
                    {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>

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

                    <NavLink to="/ReportsAnalytics" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <FileBarChart className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Reports &amp; Analytics</span>
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

                    <NavLink to="/ManageDoctorAccounts" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <UserCog className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Manage Doctor Account</span>
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

                    <button onClick={handleLogoutClick} className="nav-link logout-btn" style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'yellow' }}>
                        <LogOut className="nav-icon" size={16} />
                        <span>Logout</span>
                    </button>
                </nav>
            </div>
            
            {/* Top Bar */}
            <div className={`student-top-bar ${collapsed ? 'sidebar-collapsed-margin' : ''}`}>
                <div className="top-bar-left">
                    <span className="system-name">STI Baliuag Clinic Management System</span>
                </div>
                <div className="top-bar-right" style={{ display: 'flex', alignItems: 'center', gap: '20px', overflow: 'visible' }}>

                    <button
                        onClick={toggleTheme}
                        className="theme-toggle-btn"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: '#333', padding: '4px' }}
                        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        aria-label="Toggle dark mode"
                    >
                        {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
                    </button>

                    <button
                        onClick={() => setIsMessageOpen(true)}
                        style={{ 
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            position: 'relative', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: '#333', 
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
                    </button>

                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <button 
                            onClick={() => setShowNotifDropdown(!showNotifDropdown)} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', display: 'inline-flex', alignItems: 'center', color: '#333', padding: '4px' }}
                            title="Notifications"
                        >
                            <Bell size={22} />
                            {unreadNotifCount > 0 && (
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
                                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
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
                                backgroundColor: 'var(--bg-card)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                borderRadius: '8px',
                                zIndex: 1000,
                                overflowY: 'auto',
                                border: '1px solid var(--card-border)'
                            }}>
                                <div style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid var(--card-border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backgroundColor: 'var(--bg-elevated)',
                                    borderTopLeftRadius: '8px',
                                    borderTopRightRadius: '8px'
                                }}>
                                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Notifications</span>
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
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                                        No notifications
                                    </div>
                                ) : (
                                    notifications.map((item) => {
                                        const isItemRead = item.is_read === 1 || item.is_read === '1' || item.is_read === true || item.read === true;
                                        return (
                                            <div
                                                key={item.notification_id}
                                                onClick={() => handleNotificationClick(item)}
                                                style={{
                                                    padding: '12px 16px',
                                                    borderBottom: '1px solid var(--card-border)',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.2s',
                                                    backgroundColor: isItemRead ? 'var(--bg-elevated)' : 'var(--bg-card)',
                                                    opacity: isItemRead ? 0.75 : 1
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isItemRead ? 'var(--bg-elevated)' : 'var(--bg-card)'}
                                            >
                                                <div style={{
                                                    fontWeight: isItemRead ? 'normal' : 'bold',
                                                    fontSize: '14px',
                                                    marginBottom: '4px',
                                                    color: 'var(--text-primary)',
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
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', lineHeight: '1.4' }}>
                                                    {item.message}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                                                    {formatDateTime(item.created_at)}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    <span className="current-date">{currentDate}</span>
                </div>
            </div>

            <div className={`main-content ${collapsed ? 'sidebar-collapsed-margin' : ''}`}>
                <Outlet context={{
                    nurseId: nurseData?.nurse_id || '', 
                    userId: nurseData?.user_id || activeUserId || '',
                    user_id: nurseData?.user_id || activeUserId || '',
                    firstName: nurseData?.first_name || '', 
                    lastName: nurseData?.last_name || '',
                    username: nurseData?.username || '',
                    refreshUnreadCount: () => fetchUnreadCount(activeUserId),
                    refreshNotifications: () => fetchNotifications(nurseData?.nurse_id)
                }} />
            </div>

            {isMessageOpen && activeUserId && (
                <NurseMessageModal 
                    userId={activeUserId} 
                    onClose={() => setIsMessageOpen(false)} 
                    refreshUnreadCount={() => fetchUnreadCount(activeUserId)}
                />
            )}

            <ConfirmModal
                isOpen={showLogoutModal}
                onCancel={() => setShowLogoutModal(false)}
                onConfirm={confirmLogout}
                title="Confirm Logout"
                message="Are you sure you want to log out of the STI Baliuag Nurse Portal?"
                confirmLabel="Logout"
                danger
            />
        </div>
    );
};

export default NurseLayout;