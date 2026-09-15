import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, 
    FileHeart, 
    User, 
    Bell, 
    Settings,
    LogOut,
    RefreshCw
} from 'lucide-react';
import '../styles/parent/ParentLayout.css'; 

const ParentLayout = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // State to hold the fetched parent, child profile, and linked students count
    const [parentData, setParentData] = useState(null);
    const [childData, setChildData] = useState(null); 
    const [linkedStudentsCount, setLinkedStudentsCount] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');

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

    const toggleSidebar = () => setIsOpen(!isOpen);
    const closeSidebar = () => setIsOpen(false);

    // Handles clearing the active student selection when switching accounts
    const handleSwitchAccount = () => {
        localStorage.removeItem('selectedStudentId'); // Remove only the active student ID
        navigate('/ChooseStudentProfile');            // Redirect back to profile selector
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

                    <NavLink to="/ParentNotifications" className="nav-link" onClick={closeSidebar}>
                         {({ isActive }) => (
                            <>
                                <Bell className={`nav-icon ${isActive ? 'icon-active' : ''}`} size={16} />
                                <span>Notifications</span>
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

                    {/* Divider before logout */}
                    <hr className="nav-divider" style={{ margin: '15px 0', borderColor: 'rgba(255,255,255,0.1)' }} />

                    {/* Logout Button */}
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
                <div className="parent-top-bar">
                    <div className="top-bar-info">
                        <span className="viewing-label">Active Profile:</span>
                        
                        {/* Check if childData has finished fetching from the server */}
                        {childData ? (
                            <div className="student-topbar-details" style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                                
                                {/* 1. Getting First Name and Last Name */}
                                <span className="student-name" style={{ fontWeight: '600', color: '#111' }}>
                                    {childData.first_name} {childData.last_name}
                                </span>
                                
                                {/* 2. Getting the Student ID */}
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

                    {/* Only show the switch button when there are 2 or more linked student profiles */}
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
        </div>
    );
};

export default ParentLayout;