// doctorProfile.jsx
import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Phone, KeyRound, Eye, EyeOff, CheckCircle2, Stethoscope } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import DoctorServices from '../../components/scheduling/DoctorServices';
import { initials } from '../../utils/visitPurpose';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';

const strength = (p) => ({
    'At least 8 characters': p.length >= 8,
    'One uppercase letter': /[A-Z]/.test(p),
    'One lowercase letter': /[a-z]/.test(p),
    'One number': /[0-9]/.test(p),
    'One special character (!@#$%^&*)': /[!@#$%^&*(),.?":{}|<>_]/.test(p)
});

const DoctorProfile = () => {
    const { doctor, userId, refreshDoctor } = useOutletContext();
    const { showAlert } = useAlert();

    const [phone, setPhone] = useState(doctor.contact_number || '');
    const [phoneError, setPhoneError] = useState('');
    const [phoneBusy, setPhoneBusy] = useState(false);

    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState(false);
    const [passError, setPassError] = useState('');
    const [passBusy, setPassBusy] = useState(false);

    const checks = strength(next);
    const strong = Object.values(checks).every(Boolean);

    const savePhone = async (e) => {
        e.preventDefault();
        setPhoneError('');
        setPhoneBusy(true);
        try {
            const res = await fetch(`${API}/api/doctor/phone`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, phone }) });
            const data = await res.json();
            if (data.success) { setPhone(data.contact_number); await refreshDoctor(); showAlert('Phone number saved.', 'success'); }
            else setPhoneError(data.message || 'Could not save the phone number.');
        } catch (err) {
            setPhoneError('Could not reach the server.');
        } finally {
            setPhoneBusy(false);
        }
    };

    const savePassword = async (e) => {
        e.preventDefault();
        setPassError('');
        if (!strong) { setPassError('The new password is not strong enough.'); return; }
        if (next !== confirm) { setPassError('The new passwords do not match.'); return; }
        if (next === current) { setPassError('Choose a password different from the current one.'); return; }
        setPassBusy(true);
        try {
            // the current password is checked with the login endpoint first
            const check = await fetch(`${API}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: doctor.username, password: current }) });
            const checkData = await check.json();
            if (!checkData.success) { setPassError('The current password is not correct.'); return; }

            const res = await fetch(`${API}/api/change-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: doctor.username, newPassword: next }) });
            const data = await res.json();
            if (data.success) { setCurrent(''); setNext(''); setConfirm(''); showAlert('Password changed. Use the new password the next time you log in.', 'success'); }
            else setPassError(data.message || 'Could not change the password.');
        } catch (err) {
            setPassError('Could not reach the server.');
        } finally {
            setPassBusy(false);
        }
    };

    return (
        <>
            <div className="dp-page-head">
                <div>
                    <h2>My Profile</h2>
                    <p>Your account details, the check-ups you cover and their listings. The nurse manages your name and specialization.</p>
                </div>
            </div>

            <div className="dp-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
                <section className="dp-card" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                        <span className="dl-avatar" style={{ width: 64, height: 64, fontSize: '1.3rem' }}>{initials(doctor.first_name, doctor.last_name)}</span>
                        <div style={{ minWidth: 0 }}>
                            <h3 style={{ margin: 0, overflowWrap: 'anywhere' }}>Dr. {doctor.first_name} {doctor.last_name}</h3>
                            <div className="dp-hint">{doctor.specialization || 'Physician'}</div>
                        </div>
                    </div>
                    <dl className="dp-kv">
                        <dt>Username</dt><dd>{doctor.username}</dd>
                        <dt>Doctor ID</dt><dd>{doctor.doctor_id}</dd>
                        <dt>Specialization</dt><dd>{doctor.specialization || '-'}</dd>
                        <dt>Phone</dt><dd>{doctor.contact_number || '-'}</dd>
                    </dl>
                </section>

                <section className="dp-card" style={{ margin: 0, gridColumn: '1 / -1' }}>
                    <h3 className="dp-card-title"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Stethoscope size={18} /> Check-ups I cover</span></h3>
                    <DoctorServices doctor={doctor} onSaved={() => refreshDoctor()} />
                </section>

                <section className="dp-card" style={{ margin: 0 }}>
                    <h3 className="dp-card-title"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Phone size={18} /> Recovery phone number</span></h3>
                    <form className="dp-form" onSubmit={savePhone}>
                        <p className="dp-hint" style={{ margin: 0 }}>This number verifies you when you reset a forgotten password.</p>
                        {phoneError && <div className="dp-error">{phoneError}</div>}
                        <div className="dp-field">
                            <label htmlFor="profile-phone">Mobile number</label>
                            <input id="profile-phone" className="dp-input" type="tel" required maxLength={14} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09171234567" />
                        </div>
                        <div><button className="dp-btn dp-btn-primary" type="submit" disabled={phoneBusy}>{phoneBusy ? 'Saving...' : 'Save number'}</button></div>
                    </form>
                </section>

                <section className="dp-card" style={{ margin: 0 }}>
                    <h3 className="dp-card-title"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><KeyRound size={18} /> Change password</span></h3>
                    <form className="dp-form" onSubmit={savePassword}>
                        {passError && <div className="dp-error">{passError}</div>}
                        <div className="dp-field">
                            <label htmlFor="pw-current">Current password</label>
                            <input id="pw-current" className="dp-input" type={show ? 'text' : 'password'} required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
                        </div>
                        <div className="dp-field">
                            <label htmlFor="pw-new">New password</label>
                            <input id="pw-new" className="dp-input" type={show ? 'text' : 'password'} required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
                        </div>
                        <div className="dp-field">
                            <label htmlFor="pw-confirm">Confirm new password</label>
                            <input id="pw-confirm" className="dp-input" type={show ? 'text' : 'password'} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                        </div>
                        <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShow((v) => !v)}>
                            {show ? <EyeOff size={15} /> : <Eye size={15} />} {show ? 'Hide' : 'Show'} passwords
                        </button>
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 3, fontSize: '0.875rem' }}>
                            {Object.entries(checks).map(([label, ok]) => (
                                <li key={label} style={{ color: ok ? '#027a48' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <CheckCircle2 size={14} style={{ opacity: ok ? 1 : 0.35 }} /> {label}
                                </li>
                            ))}
                        </ul>
                        <div><button className="dp-btn dp-btn-primary" type="submit" disabled={passBusy || !strong || next !== confirm}>{passBusy ? 'Saving...' : 'Change password'}</button></div>
                    </form>
                </section>
            </div>
        </>
    );
};

export default DoctorProfile;
