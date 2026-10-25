// manageDoctorAccounts.jsx
// The nurse creates and manages doctor accounts. A new account starts with the default password ("123");
// the doctor adds their own phone number (used for password recovery) the first time they log in.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UserPlus, Edit, KeyRound, Power, Search, Stethoscope, Copy, CheckCircle2 } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { useAlert } from '../../context/AlertContext';
import { formatDate } from '../../utils/datetime';
import { fullName, initials } from '../../utils/visitPurpose';
import { coverageLabel } from '../../utils/scheduling';
import { useSpecializations } from '../../hooks/useSpecializations';
import DoctorServices from '../../components/scheduling/DoctorServices';
import { useDpAutoLabels } from '../../utils/autoLabels';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';
const DOMAIN = '@baliuag.sti.edu.ph';

const suggestUsername = (first, last) => {
    const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    return first || last ? `dr.${clean(first)}.${clean(last)}` : '';
};

const call = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return data;
};

// Pick a specialization from the list or add a new one. Every specialization adds its own visit type, which students then see as a purpose of consultation.
const ADD_NEW = '__add__';

const SpecializationPicker = ({ id, value, onChange }) => {
    const { specializations, reload } = useSpecializations();
    const { showAlert } = useAlert();
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const [visitType, setVisitType] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const chosen = specializations.find((x) => x.name === value);

    const add = async () => {
        setError('');
        setBusy(true);
        try {
            const data = await call('/api/specializations', 'POST', { name, visit_type: visitType });
            if (data.success) {
                await reload();
                onChange(data.specialization.name);
                setAdding(false);
                setName('');
                setVisitType('');
                showAlert(data.message, 'success');
            } else setError(data.message || 'Could not add the specialization.');
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="dp-field">
            <label htmlFor={id}>Specialization</label>
            <select id={id} className="dp-select" required={!adding} value={adding ? ADD_NEW : value || ''} onChange={(e) => (e.target.value === ADD_NEW ? setAdding(true) : (setAdding(false), onChange(e.target.value)))}>
                <option value="">-- Select the specialization --</option>
                {specializations.map((x) => <option key={x.specialization_id} value={x.name}>{x.name}</option>)}
                <option value={ADD_NEW}>+ Add a new specialization</option>
            </select>
            {!adding && chosen && <small>Takes {chosen.visit_type === 'General Check Up' ? 'General Check Up' : `General Check Up and ${chosen.visit_type}`} consultations.</small>}
            {adding && (
                <div className="dp-form" style={{ marginTop: 8 }}>
                    {error && <div className="dp-error" role="alert">{error}</div>}
                    <input className="dp-input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Specialization, e.g. Pediatrician" aria-label="New specialization" />
                    <input className="dp-input" maxLength={30} value={visitType} onChange={(e) => setVisitType(e.target.value)} placeholder={`Visit type it adds (default: ${name.trim() || 'Specialization'} Consultation)`} aria-label="Visit type" />
                    <small>Students will see this visit type when they pick the purpose of their consultation.</small>
                    <div className="dp-modal-foot">
                        <button type="button" className="dp-btn dp-btn-ghost" onClick={() => { setAdding(false); setError(''); }}>Cancel</button>
                        <button type="button" className="dp-btn dp-btn-primary" disabled={busy || !name.trim()} onClick={add}>{busy ? 'Adding...' : 'Add specialization'}</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const ManageDoctorAccounts = () => {
    const { nurseId } = useOutletContext() || {};
    const { showAlert, showConfirm } = useAlert();
    useDpAutoLabels();

    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // create / link account
    const [form, setForm] = useState(null); // { link_doctor_id, first_name, last_name, specialization, username, usernameEdited }
    const [formError, setFormError] = useState('');
    const [busy, setBusy] = useState(false);
    const [created, setCreated] = useState(null);

    const [editing, setEditing] = useState(null);
    const [resetting, setResetting] = useState(null);
    const [resetPhone, setResetPhone] = useState(false);

    const load = useCallback(async () => {
        try {
            const data = await call('/api/doctor-accounts', 'GET');
            if (data.success) setDoctors(data.doctors);
        } catch (e) {
            showAlert('Could not load the doctors.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showAlert]);

    useEffect(() => { load(); }, [load]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return doctors.filter((d) => !q || `${d.first_name} ${d.last_name} ${d.username || ''} ${d.specialization || ''}`.toLowerCase().includes(q));
    }, [doctors, search]);

    const openCreate = (doctor = null) => {
        setForm({
            link_doctor_id: doctor?.doctor_id || null,
            first_name: doctor?.first_name || '', last_name: doctor?.last_name || '', specialization: doctor?.specialization || '',
            username: doctor ? suggestUsername(doctor.first_name, doctor.last_name) : '', usernameEdited: false
        });
        setFormError('');
    };

    const setName = (patch) => setForm((f) => {
        const next = { ...f, ...patch };
        if (!next.usernameEdited) next.username = suggestUsername(next.first_name, next.last_name);
        return next;
    });

    const createAccount = async (e) => {
        e.preventDefault();
        setFormError('');
        setBusy(true);
        try {
            const data = await call('/api/doctor-accounts', 'POST', {
                nurse_id: nurseId, link_doctor_id: form.link_doctor_id, first_name: form.first_name, last_name: form.last_name,
                specialization: form.specialization, username: form.username
            });
            if (data.success) { setForm(null); setCreated(data); load(); }
            else setFormError(data.message || 'Could not create the account.');
        } catch (err) {
            setFormError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    const saveEdit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const data = await call(`/api/doctor-accounts/${editing.doctor_id}`, 'PUT', { first_name: editing.first_name, last_name: editing.last_name, specialization: editing.specialization });
            if (data.success) { setEditing(null); showAlert(data.message, 'success'); load(); }
            else showAlert(data.message || 'Could not update the doctor.', 'error');
        } catch (err) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const toggleActive = async (d) => {
        const turnOff = !!d.is_active;
        const ok = await showConfirm(
            turnOff ? `Deactivate the account of Dr. ${d.last_name}? The doctor will not be able to log in.` : `Activate the account of Dr. ${d.last_name}?`,
            { danger: turnOff, confirmLabel: turnOff ? 'Deactivate' : 'Activate', title: turnOff ? 'Deactivate account' : 'Activate account' }
        );
        if (!ok) return;
        const data = await call(`/api/doctor-accounts/${d.doctor_id}/active`, 'PUT', { is_active: turnOff ? 0 : 1 });
        if (data.success) { showAlert(data.message, 'success'); load(); } else showAlert(data.message || 'Could not change the account.', 'error');
    };

    const confirmReset = async () => {
        setBusy(true);
        try {
            const data = await call(`/api/doctor-accounts/${resetting.doctor_id}/reset`, 'POST', { reset_phone: resetPhone });
            if (data.success) { setResetting(null); showAlert(data.message, 'success'); load(); }
            else showAlert(data.message || 'Could not reset the password.', 'error');
        } catch (err) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const copyCredentials = async () => {
        try {
            await navigator.clipboard.writeText(`Username: ${created.username}\nPassword: ${created.default_password}`);
            showAlert('Copied.', 'success');
        } catch (e) {
            showAlert('Could not copy. Select the text and copy it.', 'warning');
        }
    };

    return (
        <div style={{ padding: 4 }}>
            <div className="dp-page-head">
                <div>
                    <h2><Stethoscope size={22} style={{ verticalAlign: '-3px', marginRight: 8 }} />Manage Doctor Accounts</h2>
                    <p>Create the login of a visiting doctor. The doctor signs in with the default password, sets a new one and is asked for a phone number before the dashboard opens. That number is what verifies a forgotten password.</p>
                </div>
                <div className="dp-actions">
                    <button className="dp-btn dp-btn-primary" onClick={() => openCreate()}><UserPlus size={17} /> Create doctor account</button>
                </div>
            </div>

            <div className="dp-filters">
                <div className="dp-search grow">
                    <Search size={16} />
                    <input className="dp-input" type="search" placeholder="Search name, username or specialization" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search doctors" />
                </div>
            </div>

            {loading ? <div className="dp-card dp-empty">Loading...</div> : visible.length === 0 ? (
                <div className="dp-card dp-empty"><Stethoscope size={36} /><p>No doctor found.</p></div>
            ) : (
                <div className="dp-list">
                    {visible.map((d) => (
                        <article key={d.doctor_id} className="dp-appt" style={{ gridTemplateColumns: '48px minmax(0, 1fr) auto' }}>
                            <span className="dl-avatar" style={{ width: 48, height: 48 }}>{initials(d.first_name, d.last_name)}</span>
                            <div className="dp-appt-main">
                                <h4>Dr. {fullName(d.first_name, d.last_name)} <span className="dp-hint">{d.doctor_id}</span></h4>
                                <div className="dp-appt-sub">{d.specialization || 'No specialization'}{d.has_account ? ` - ${d.username}` : ''}</div>
                                <div className="dp-appt-sub">Covers: {coverageLabel(d)}</div>
                                <div className="dp-appt-chips">
                                    {!d.has_account ? <span className="dp-chip st-pending-approval">No login yet</span>
                                        : d.is_active ? <span className="dp-chip st-completed">Account active</span> : <span className="dp-chip st-cancelled">Account inactive</span>}
                                    {d.has_account && (d.phone_confirmed
                                        ? <span className="dp-chip"><CheckCircle2 size={12} /> Phone confirmed {d.contact_number ? `(${d.contact_number})` : ''}</span>
                                        : <span className="dp-chip source">Phone not added yet</span>)}
                                    {d.created_at && <span className="dp-chip source">Added {formatDate(d.created_at)}</span>}
                                </div>
                            </div>
                            <div className="dp-appt-actions">
                                {d.has_account ? (
                                    <>
                                        <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setEditing({ ...d })}><Edit size={15} /> Edit</button>
                                        <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => { setResetting(d); setResetPhone(false); }}><KeyRound size={15} /> Reset password</button>
                                        <button className={`dp-btn dp-btn-sm ${d.is_active ? 'dp-btn-danger' : 'dp-btn-success'}`} onClick={() => toggleActive(d)}><Power size={15} /> {d.is_active ? 'Deactivate' : 'Activate'}</button>
                                    </>
                                ) : (
                                    <>
                                        <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setEditing({ ...d })}><Edit size={15} /> Edit</button>
                                        <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => openCreate(d)}><UserPlus size={15} /> Create login</button>
                                    </>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {/* CREATE */}
            <Modal isOpen={!!form} onClose={() => setForm(null)} title={form?.link_doctor_id ? 'Create login for this doctor' : 'Create doctor account'} icon={<UserPlus size={20} />} size="md" closeOnBackdrop={false}>
                {form && (
                    <form className="dp-form" onSubmit={createAccount}>
                        {formError && <div className="dp-error" role="alert">{formError}</div>}
                        <div className="dp-row">
                            <div className="dp-field"><label htmlFor="da-first">First name</label><input id="da-first" className="dp-input" required maxLength={100} value={form.first_name} onChange={(e) => setName({ first_name: e.target.value })} /></div>
                            <div className="dp-field"><label htmlFor="da-last">Last name</label><input id="da-last" className="dp-input" required maxLength={100} value={form.last_name} onChange={(e) => setName({ last_name: e.target.value })} /></div>
                        </div>
                        <SpecializationPicker id="da-spec" value={form.specialization} onChange={(specialization) => setForm({ ...form, specialization })} />
                        <div className="dp-field">
                            <label htmlFor="da-user">Username</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input id="da-user" className="dp-input" required maxLength={60} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/@.*/, ''), usernameEdited: true })} />
                                <span className="dp-hint" style={{ whiteSpace: 'nowrap' }}>{DOMAIN}</span>
                            </div>
                        </div>
                        <div className="dp-notice">The account starts with the default password <strong>123</strong>. The doctor must change it and add a phone number at the first login.</div>
                        <div className="dp-modal-foot">
                            <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setForm(null)}>Cancel</button>
                            <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Creating...' : 'Create account'}</button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* CREATED */}
            <Modal isOpen={!!created} onClose={() => setCreated(null)} title="Doctor account created" icon={<CheckCircle2 size={20} />} size="sm">
                {created && (
                    <div className="dp-form">
                        <div className="dp-notice" style={{ lineHeight: 1.8 }}>
                            Username: <strong>{created.username}</strong><br />
                            Password: <strong>{created.default_password}</strong> (default)
                        </div>
                        <p className="dp-hint" style={{ margin: 0 }}>Give these to the doctor. At the first login they set a new password and add their phone number.</p>
                        <div className="dp-modal-foot">
                            <button className="dp-btn dp-btn-ghost" onClick={copyCredentials}><Copy size={15} /> Copy</button>
                            <button className="dp-btn dp-btn-primary" onClick={() => setCreated(null)}>Done</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* EDIT */}
            <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit doctor" icon={<Edit size={20} />} size="md">
                {editing && (
                    <form className="dp-form" onSubmit={saveEdit}>
                        <div className="dp-row">
                            <div className="dp-field"><label>First name</label><input className="dp-input" required maxLength={100} value={editing.first_name} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} /></div>
                            <div className="dp-field"><label>Last name</label><input className="dp-input" required maxLength={100} value={editing.last_name} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} /></div>
                        </div>
                        <SpecializationPicker id="da-spec-edit" value={editing.specialization || ''} onChange={(specialization) => setEditing({ ...editing, specialization })} />
                        <div className="dp-modal-foot">
                            <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                            <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                        </div>
                    </form>
                )}
                {editing && (
                    <div style={{ borderTop: '1px solid var(--card-border)', marginTop: 16, paddingTop: 14 }}>
                        <h4 style={{ margin: '0 0 8px' }}>Consultations covered</h4>
                        <p className="dp-hint" style={{ marginTop: 0 }}>The choices follow the saved specialization. Save a changed specialization first.</p>
                        <DoctorServices doctor={editing} compact onSaved={() => load()} />
                    </div>
                )}
            </Modal>

            {/* RESET */}
            <Modal isOpen={!!resetting} onClose={() => setResetting(null)} title="Reset password" icon={<KeyRound size={20} />} size="sm">
                {resetting && (
                    <div className="dp-form">
                        <div className="dp-notice">Dr. {resetting.last_name}'s password goes back to the default <strong>123</strong>. The doctor has to choose a new one at the next login.</div>
                        <label className="dp-check"><input type="checkbox" checked={resetPhone} onChange={(e) => setResetPhone(e.target.checked)} /> Also ask the doctor to confirm the phone number again</label>
                        <div className="dp-modal-foot">
                            <button className="dp-btn dp-btn-ghost" onClick={() => setResetting(null)}>Cancel</button>
                            <button className="dp-btn dp-btn-primary" onClick={confirmReset} disabled={busy}>{busy ? 'Resetting...' : 'Reset password'}</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default ManageDoctorAccounts;
