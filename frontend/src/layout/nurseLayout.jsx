import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, FileBarChart, Stethoscope, FolderHeart, 
    Pill, Boxes, FileCheck, ClipboardCheck, HeartPulse, 
    BriefcaseMedical, AlertTriangle, Bell, Vault, LogOut,
    MessageSquare 
} from 'lucide-react';
import '../styles/nurse/NurseLayout.css'; 

const NurseLayout = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [nurseData, setNurseData] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    
    // State for overall unread contacts count
    const [unreadContactsCount, setUnreadContactsCount] = useState(0);

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

    useEffect(() => {
        const fetchNurseProfile = async (userId) => {
            try {
                const response = await fetch(`http://localhost:3001/api/get-nurse/${userId}`);
                const data = await response.json();

                if (data.success && data.nurse) {
                    setNurseData(data.nurse);
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

                const interval = setInterval(() => fetchUnreadCount(accurateUserId), 5000);
                return () => clearInterval(interval);
            } else {
                setIsLoading(false);
            }
        } else {
            navigate('/');
        }
    }, [navigate]);

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

                    <NavLink to="/NurseNotifications" className="nav-link" onClick={closeSidebar}>
                        {({ isActive }) => (
                            <>
                                <Bell className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Notifications</span>
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
            
            {/* ==================== TOP BAR WITH MESSAGES BUTTON ==================== */}
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
                    refreshUnreadCount: () => fetchUnreadCount(nurseData?.user_id)
                }} />
            </div>
        </div>
    );
};

export default NurseLayout;