import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, CalendarClock, CalendarDays, ClipboardPlus, FolderHeart, LayoutTemplate,
    UserRound, LogOut, Bell, Sun, Moon, Search, Menu, Phone
} from 'lucide-react';
import '../styles/doctor/DoctorLayout.css';
import stiLogo from '../assets/sti-logof.png';
import Modal from '../components/common/Modal';
import ConfirmModal from '../components/common/ConfirmModal';
import { useTheme } from '../context/ThemeContext';
import { useWebPush } from '../hooks/useWebPush';
import { formatDateTime } from '../utils/datetime';
import { initials } from '../utils/visitPurpose';
import { useDpAutoLabels } from '../utils/autoLabels';

const API = 'http://localhost:3001';

const PAGE_TITLES = {
    '/DoctorDashboard': 'Dashboard',
    '/DoctorAppointments': 'Appointments',
    '/DoctorMySchedule': 'My Schedule',
    '/DoctorConsultations': 'Consultations',
    '/DoctorPatients': 'Patient Records',
    '/DoctorTemplates': 'Assessment Templates',
    '/DoctorProfile': 'My Profile'
};

const NAV = [
    { to: '/DoctorDashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { to: '/DoctorAppointments', label: 'Appointments', Icon: CalendarClock, badge: 'requests' },
    { to: '/DoctorMySchedule', label: 'My Schedule', Icon: CalendarDays },
    { to: '/DoctorConsultations', label: 'Consultations', Icon: ClipboardPlus },
    { to: '/DoctorPatients', label: 'Patient Records', Icon: FolderHeart },
    { to: '/DoctorTemplates', label: 'Templates', Icon: LayoutTemplate },
    { to: '/DoctorProfile', label: 'My Profile', Icon: UserRound }
];

const getStoredUser = () => {
    try {
        const stored = sessionStorage.getItem('user') || localStorage.getItem('user');
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        return null;
    }
};

const isUnread = (n) => !(n.is_read === 1 || n.is_read === '1' || n.is_read === true || n.read === true);

const notificationRoute = (n) => {
    const type = String(n.type || '').toUpperCase();
    if (type.includes('BOOKING_REQUEST')) return '/DoctorAppointments?tab=requests';
    if (type.includes('ASSESSMENT')) return '/DoctorConsultations';
    if (type.includes('BOOKING') || type.includes('APPOINTMENT') || type.includes('BATCH')) return '/DoctorAppointments';
    return '/DoctorDashboard';
};

export const DoctorLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { theme, toggleTheme } = useTheme();
    useDpAutoLabels();

    const storedUser = getStoredUser();
    const userId = storedUser?.id || storedUser?.user_id || null;

    const [doctor, setDoctor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showLogout, setShowLogout] = useState(false);
    const [globalSearch, setGlobalSearch] = useState('');

    const [notifications, setNotifications] = useState([]);
    const [showNotif, setShowNotif] = useState(false);
    const [pendingRequests, setPendingRequests] = useState(0);
    const notifRef = useRef(null);

    // first login: the phone number is required before the dashboard opens
    const [phone, setPhone] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [phoneSaving, setPhoneSaving] = useState(false);

    const { isSubscribed, subscribe } = useWebPush(userId);
    useEffect(() => {
        if (userId && typeof Notification !== 'undefined' && Notification?.permission === 'granted' && !isSubscribed) {
            subscribe();
        }
    }, [userId, isSubscribed, subscribe]);

    const loadDoctor = useCallback(async () => {
        if (!userId) return null;
        try {
            const res = await fetch(`${API}/api/get-doctor/${userId}`);
            const data = await res.json();
            if (data.success) {
                setDoctor(data.doctor);
                setPhone((p) => p || data.doctor.contact_number || '');
                return data.doctor;
            }
            setErrorMsg(data.message || 'Could not load your profile.');
        } catch (e) {
            setErrorMsg('Could not reach the server.');
        }
        return null;
    }, [userId]);

    useEffect(() => {
        if (!userId || (storedUser && storedUser.role && storedUser.role !== 'doctor')) {
            navigate('/');
            return;
        }
        loadDoctor().finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, loadDoctor, navigate]);

    const fetchNotifications = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await fetch(`${API}/api/notifications/user/${userId}`);
            const data = await res.json();
            if (data.success) setNotifications(data.data || []);
        } catch (e) { /* the next poll tries again */ }
    }, [userId]);

    const fetchPending = useCallback(async () => {
        if (!doctor?.doctor_id) return;
        try {
            const res = await fetch(`${API}/api/doctor/${doctor.doctor_id}/appointments?scope=requests&pageSize=1`);
            const data = await res.json();
            if (data.success) setPendingRequests(data.total);
        } catch (e) { /* ignore */ }
    }, [doctor?.doctor_id]);

    const phoneReady = !!doctor?.phone_confirmed;

    useEffect(() => {
        if (!phoneReady) return undefined;
        fetchNotifications();
        fetchPending();
        const timer = setInterval(() => { fetchNotifications(); fetchPending(); }, 15000);
        return () => clearInterval(timer);
    }, [phoneReady, fetchNotifications, fetchPending]);

    useEffect(() => { setSidebarOpen(false); setShowNotif(false); }, [location.pathname]);

    useEffect(() => {
        const close = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const unreadCount = notifications.filter(isUnread).length;

    const openNotification = async (n) => {
        setShowNotif(false);
        if (isUnread(n)) {
            setNotifications((prev) => prev.map((x) => (x.notification_id === n.notification_id ? { ...x, is_read: 1 } : x)));
            fetch(`${API}/api/notifications/${n.notification_id}/read`, { method: 'PATCH' }).catch(() => {});
        }
        navigate(notificationRoute(n));
    };

    const markAllRead = async () => {
        setNotifications((prev) => prev.map((x) => ({ ...x, is_read: 1 })));
        fetch(`${API}/api/notifications/user/${userId}/read-all`, { method: 'PATCH' }).catch(() => {});
    };

    const savePhone = async (e) => {
        e.preventDefault();
        setPhoneError('');
        setPhoneSaving(true);
        try {
            const res = await fetch(`${API}/api/doctor/phone`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, phone })
            });
            const data = await res.json();
            if (data.success) await loadDoctor();
            else setPhoneError(data.message || 'Could not save the phone number.');
        } catch (err) {
            setPhoneError('Could not reach the server.');
        } finally {
            setPhoneSaving(false);
        }
    };

    const confirmLogout = () => {
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('app_active_user_id');
        setShowLogout(false);
        navigate('/');
    };

    const submitSearch = (e) => {
        e.preventDefault();
        const q = globalSearch.trim();
        navigate(q ? `/DoctorPatients?q=${encodeURIComponent(q)}` : '/DoctorPatients');
        setGlobalSearch('');
    };

    const title = PAGE_TITLES[location.pathname] || 'Doctor Portal';
    const displayName = doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : 'Doctor';

    if (loading) {
        return <div className="dl-shell"><div className="dl-loading">Loading your portal...</div></div>;
    }

    if (!doctor) {
        return (
            <div className="dl-shell">
                <div className="dl-loading" style={{ flexDirection: 'column', gap: 12 }}>
                    <p>{errorMsg || 'Your doctor profile was not found.'}</p>
                    <button className="dp-btn dp-btn-primary" onClick={() => navigate('/')}>Back to login</button>
                </div>
            </div>
        );
    }

    return (
        <div className="dl-shell">
            {sidebarOpen && <div className="dl-overlay" onClick={() => setSidebarOpen(false)} />}

            <aside className={`dl-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Doctor navigation">
                <div className="dl-brand">
                    <img src={stiLogo} alt="STI" />
                    <div className="dl-brand-text">
                        <strong>STI Clinic</strong>
                        <span>Doctor Portal</span>
                    </div>
                </div>

                <nav className="dl-nav">
                    {NAV.map(({ to, label, Icon, badge }) => (
                        <NavLink key={to} to={to} className={({ isActive }) => `dl-nav-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
                            <Icon size={19} />
                            <span>{label}</span>
                            {badge === 'requests' && pendingRequests > 0 && <span className="dl-nav-count">{pendingRequests}</span>}
                        </NavLink>
                    ))}
                </nav>

                <div className="dl-sidebar-foot">
                    <button type="button" className="dl-nav-link dl-logout" onClick={() => setShowLogout(true)}>
                        <LogOut size={19} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            <div className="dl-main">
                <header className="dl-topbar">
                    <button type="button" className="dl-icon-btn dl-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
                        <Menu size={20} />
                    </button>
                    <h1 className="dl-title">{title}</h1>
                    <div className="dl-spacer" />

                    <form className="dl-search" onSubmit={submitSearch} role="search">
                        <Search size={18} />
                        <input type="search" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="Search a patient" aria-label="Search a patient" />
                    </form>

                    <button type="button" className="dl-icon-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle dark mode">
                        {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
                    </button>

                    <div ref={notifRef} style={{ position: 'relative' }}>
                        <button type="button" className="dl-icon-btn" onClick={() => setShowNotif((v) => !v)} aria-label="Notifications">
                            <Bell size={19} />
                            {unreadCount > 0 && <span className="dl-dot">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                        </button>
                        {showNotif && (
                            <div className="dl-pop" role="dialog" aria-label="Notifications">
                                <div className="dl-pop-head">
                                    <span>Notifications</span>
                                    {unreadCount > 0 && <button type="button" onClick={markAllRead}>Mark all as read</button>}
                                </div>
                                {notifications.length === 0 ? (
                                    <div className="dl-pop-empty">No notifications yet</div>
                                ) : notifications.map((n) => (
                                    <button key={n.notification_id} type="button" className={`dl-notif ${isUnread(n) ? 'unread' : ''}`} onClick={() => openNotification(n)}>
                                        <strong>{n.title || 'Notification'}</strong>
                                        <p>{n.message}</p>
                                        <small>{formatDateTime(n.created_at)}</small>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button type="button" className="dl-user-chip" onClick={() => navigate('/DoctorProfile')} title="My profile">
                        <span className="dl-avatar">{initials(doctor.first_name, doctor.last_name)}</span>
                        <span className="who">
                            <strong>{displayName}</strong>
                            <span>{doctor.specialization || 'Physician'}</span>
                        </span>
                    </button>
                </header>

                <main className="dl-content">
                    {phoneReady ? (
                        <Outlet context={{
                            doctor,
                            doctorId: doctor.doctor_id,
                            userId,
                            user_id: userId,
                            firstName: doctor.first_name,
                            lastName: doctor.last_name,
                            refreshDoctor: loadDoctor,
                            refreshNotifications: fetchNotifications,
                            refreshPending: fetchPending
                        }} />
                    ) : (
                        <div className="dl-loading">Please add your phone number to continue.</div>
                    )}
                </main>
            </div>

            {/* NEW ACCOUNT: phone number first (it is what verifies a forgotten password) */}
            <Modal
                isOpen={!phoneReady}
                title="Add your phone number"
                icon={<Phone size={20} />}
                size="sm"
                closeOnBackdrop={false}
            >
                <form className="dp-form" onSubmit={savePhone}>
                    <div className="dp-notice">
                        Welcome, {displayName}. Before you continue, enter your mobile number. It is used to verify you if you ever forget your password.
                    </div>
                    {phoneError && <div className="dp-error">{phoneError}</div>}
                    <div className="dp-field">
                        <label htmlFor="doctor-phone">Mobile number</label>
                        <input id="doctor-phone" className="dp-input" type="tel" required autoFocus maxLength={14} placeholder="09171234567 or +639171234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
                        <small>Philippine mobile number starting with 09 or +639.</small>
                    </div>
                    <div className="dp-modal-foot">
                        <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setShowLogout(true)}>Log out</button>
                        <button type="submit" className="dp-btn dp-btn-primary" disabled={phoneSaving}>{phoneSaving ? 'Saving...' : 'Save and continue'}</button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                isOpen={showLogout}
                onCancel={() => setShowLogout(false)}
                onConfirm={confirmLogout}
                title="Confirm Logout"
                message="Are you sure you want to log out of the STI Baliuag Doctor Portal?"
                confirmLabel="Logout"
                danger
            />
        </div>
    );
};

export default DoctorLayout;
