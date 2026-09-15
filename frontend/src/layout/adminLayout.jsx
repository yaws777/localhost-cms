import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
    Users, 
    UserCheck, 
    LogOut 
} from 'lucide-react';
import '../styles/admin/AdminLayout.css'; 

const AdminLayout = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [adminData, setAdminData] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const fetchAdminProfile = async (userId) => {
            try {
                const response = await fetch(`http://localhost:3001/api/get-admin/${userId}`);
                const data = await response.json();

                if (data.success && data.admin) {
                    setAdminData(data.admin);
                } else {
                    setErrorMsg(data.message || 'Failed to fetch admin data');
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
                fetchAdminProfile(accurateUserId);
            } else {
                console.error("No user ID found in localStorage object.");
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
        if (!adminData) return 'AD';
        const first = adminData.first_name ? adminData.first_name[0] : '';
        const last = adminData.last_name ? adminData.last_name[0] : '';
        return (first + last).toUpperCase() || 'AD';
    };
    
    const currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    return (
        <div className="admin-layout">
        
            {/* Mobile Hamburger Button */}
            <button className="mobile-toggle-btn" onClick={toggleSidebar}>
                ☰
            </button>

            {/* Overlay for mobile when sidebar is open */}
            {isOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

            {/* Sidebar Container */}
            <div className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
                <button className="close-sidebar-btn" onClick={closeSidebar} aria-label="Close Sidebar">
                    &times;
                </button>

                <div className="sidebar-header">
                    <h2>STI Baliuag</h2>
                    <p>Admin Portal</p>
                </div>

                {/* ==================== PROFILE INFO SECTION ==================== */}
                <div className="sidebar-profile">
                    <div className="profile-avatar">
                        {getInitials()}
                    </div>
                    <div className="profile-details">
                        <h3 className="profile-name">
                            {isLoading 
                                ? 'Loading...' 
                                : adminData 
                                    ? `${adminData.first_name} ${adminData.last_name}`.trim() 
                                    : 'Admin User'}
                        </h3>
                        <p className="profile-username">
                            {adminData?.username ? `${adminData.username}` : '---'}
                        </p>
                        <span className="profile-id">
                            ID: {adminData?.admin_id || '--------'}
                        </span>
                        {errorMsg && <span className="profile-error" style={{color: '#ff4d4f', fontSize: '0.8em', display: 'block', marginTop: '5px'}}>{errorMsg}</span>}
                    </div>
                </div>

                {/* ==================== NAVIGATION SECTION ==================== */}
                <nav className="sidebar-nav">
                    
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
                    
                    {/* Divider before logout */}
                    <hr className="nav-divider" style={{ margin: '15px 0', borderColor: 'rgba(255,255,255,0.1)' }} />

                    {/* Logout Button */}
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
            
            <div className="admin-top-bar">
                <div className="top-bar-left">
                    <span className="system-name">STI Baliuag Clinic Management System</span>
                </div>
                <div className="top-bar-right">
                    <span className="current-date">{currentDate}</span>
                </div>
            </div>

            {/* ==================== MAIN CONTENT SECTION ==================== */}
            <div className="main-content">
                <Outlet context={{ 
                    adminId: adminData?.admin_id || '', 
                    userId: adminData?.user_id || '',
                    firstName: adminData?.first_name || '', 
                    lastName: adminData?.last_name || '',
                    username: adminData?.username || ''
                }} />
            </div>

        </div>
    );
};

export default AdminLayout;