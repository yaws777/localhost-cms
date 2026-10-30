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
import ConsultationsOffered from '../../components/scheduling/ConsultationsOffered';
import { useDpAutoLabels } from '../../utils/autoLabels';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';
const DOMAIN = '@baliuag.sti.edu.ph';

// {lastname}.{specialization}@baliuag.sti.edu.ph, e.g. bernardo.physician (the specialization part is its last word: General Physician -> physician)
const suggestUsername = (last, specialization) => {
    const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const lastWord = clean(String(specialization || '').trim().split(/\s+/).pop());
    return [clean(last), lastWord].filter(Boolean).join('.');
};

const call = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return data;
};

// Pick a preset specialization (already connected to its check-up service) or add another under "Other". Every specialization adds
// its own visit type, which students then see as a purpose of check-up.
const OTHER_SPECIALIZATION = '__other_specialization__';
const OTHER_CONSULTATION = '__other_consultation__';

const SpecializationPicker = ({ id, value, onChange }) => {
    const { specializations, specializationNames, visitTypes, generalVisitType, reload } = useSpecializations();
    const { showAlert } = useAlert();
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const [pick, setPick] = useState(''); // a preset check-up service, or OTHER_CONSULTATION
    const [other, setOther] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    // every preset specialization is already connected to its consultation(s) offered (General Check Up is open to all)
    const consultationsOf = (n) => [...new Set(specializations.filter((x) => x.name === n).map((x) => x.visit_type))];
    const presetConsultations = visitTypes.filter((t) => t !== generalVisitType);
    const visitType = pick === OTHER_CONSULTATION ? other.trim() : pick;

    const reset = () => { setAdding(false); setName(''); setPick(''); setOther(''); setError(''); };

    const add = async () => {
        setError('');
        setBusy(true);
        try {
            const data = await call('/api/specializations', 'POST', { name, visit_type: visitType });
            if (data.success) {
                await reload();
                onChange(data.specialization.name);
                reset();
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
            <select id={id} className="dp-select" required={!adding} value={adding ? OTHER_SPECIALIZATION : value || ''} onChange={(e) => (e.target.value === OTHER_SPECIALIZATION ? setAdding(true) : (setAdding(false), onChange(e.target.value)))}>
                <option value="">-- Select the specialization --</option>
                <optgroup label="Preset (connected to its check-up service)">
                    {specializationNames.map((n) => <option key={n} value={n}>{n} - {consultationsOf(n).join(', ')}</option>)}
                </optgroup>
                <option value={OTHER_SPECIALIZATION}>Other (specify)</option>
            </select>
            {!adding && value && specializations.some((x) => x.name === value) && <small>Check-up services: {consultationsOf(value).join(', ')}.</small>}
            {adding && (
                <div className="dp-form mda-gap-top">
                    {error && <div className="dp-error" role="alert">{error}</div>}
                    <div className="dp-field">
                        <label htmlFor={`${id}-name`}>Specify the specialization</label>
                        <input id={`${id}-name`} className="dp-input" maxLength={80} required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Allergist" />
                    </div>
                    <div className="dp-field">
                        <label htmlFor={`${id}-offered`}>Check-up service</label>
                        <select id={`${id}-offered`} className="dp-select" required value={pick} onChange={(e) => setPick(e.target.value)}>
                            <option value="">-- Select the check-up service --</option>
                            <optgroup label="Preset">
                                {presetConsultations.map((t) => <option key={t} value={t}>{t}</option>)}
                            </optgroup>
                            <option value={OTHER_CONSULTATION}>Other (specify)</option>
                        </select>
                    </div>
                    {pick === OTHER_CONSULTATION && (
                        <div className="dp-field">
                            <label htmlFor={`${id}-offered-other`}>Specify the check-up service</label>
                            <input id={`${id}-offered-other`} className="dp-input" maxLength={30} required value={other} onChange={(e) => setOther(e.target.value)} placeholder="e.g. Asthma Care" />
                        </div>
                    )}
                    <small>Students will see this check-up when they pick the purpose of their check-up.</small>
                    <div className="dp-modal-foot">
                        <button type="button" className="dp-btn dp-btn-ghost" onClick={reset}>Cancel</button>
                        <button type="button" className="dp-btn dp-btn-primary" disabled={busy || !name.trim() || !visitType} onClick={add}>{busy ? 'Adding...' : 'Add specialization'}</button>
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
    const [loadError, setLoadError] = useState('');
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
            if (data.success) { setDoctors(data.doctors); setLoadError(''); }
            else setLoadError(data.message || 'Could not load the doctors.');
        } catch (e) {
            setLoadError('Could not reach the server.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return doctors.filter((d) => !q || `${d.first_name} ${d.last_name} ${d.username || ''} ${d.specialization || ''}`.toLowerCase().includes(q));
    }, [doctors, search]);

    const openCreate = (doctor = null) => {
        setForm({
            link_doctor_id: doctor?.doctor_id || null,
            first_name: doctor?.first_name || '', last_name: doctor?.last_name || '', specialization: doctor?.specialization || '',
            username: doctor ? suggestUsername(doctor.last_name, doctor.specialization) : '', usernameEdited: false
        });
        setFormError('');
    };

    const setName = (patch) => setForm((f) => {
        const next = { ...f, ...patch };
        if (!next.usernameEdited) next.username = suggestUsername(next.last_name, next.specialization);
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

    // the username is edited without the school domain, like in the create form
    const openEdit = (d) => setEditing({ ...d, username: String(d.username || '').split('@')[0] });

    const saveEdit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const data = await call(`/api/doctor-accounts/${editing.doctor_id}`, 'PUT', {
                first_name: editing.first_name, last_name: editing.last_name, specialization: editing.specialization,
                ...(editing.has_account ? { username: editing.username } : {})
            });
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
        <div className="mda">
            <div className="dp-page-head">
                <div>
                    <h2><Stethoscope size={22} className="mda-heading-icon" aria-hidden="true" />Manage Doctor Accounts</h2>
                    <p>Create the login of a visiting doctor. The doctor signs in with the default password, sets a new one and is asked for a phone number before the dashboard opens. That number is what verifies a forgotten password.</p>
                </div>
                <div className="dp-actions">
                    <button className="dp-btn dp-btn-primary" onClick={() => openCreate()}><UserPlus size={17} /> Create doctor account</button>
                </div>
            </div>

            <ConsultationsOffered doctors={doctors} onChanged={load} />

            <div className="dp-filters">
                <div className="dp-search grow">
                    <Search size={16} />
                    <input className="dp-input" type="search" placeholder="Search name, username or specialization" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search doctors" />
                </div>
            </div>

            {loading ? <div className="dp-card dp-empty" role="status" aria-live="polite">Loading...</div> : loadError ? (
                <div className="dp-card dp-empty">
                    <div className="dp-error" role="alert">{loadError}</div>
                    <p><button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => { setLoading(true); load(); }}>Try again</button></p>
                </div>
            ) : visible.length === 0 ? (
                doctors.length === 0 ? (
                    <div className="dp-card dp-empty">
                        <Stethoscope size={36} />
                        <p>No doctor accounts yet.</p>
                        <p><button type="button" className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => openCreate()}><UserPlus size={15} /> Create doctor account</button></p>
                    </div>
                ) : (
                    <div className="dp-card dp-empty"><Stethoscope size={36} /><p>No doctor matches your search.</p></div>
                )
            ) : (
                <div className="dp-list">
                    {visible.map((d) => (
                        <article key={d.doctor_id} className="dp-appt dp-appt--account">
                            <span className="dl-avatar dl-avatar--lg">{initials(d.first_name, d.last_name)}</span>
                            <div className="dp-appt-main">
                                <h4>Dr. {fullName(d.first_name, d.last_name)} <span className="dp-hint">{d.doctor_id}</span></h4>
                                <div className="dp-appt-sub">{d.specialization || 'No specialization'}{d.has_account ? ` - ${d.username}` : ''}</div>
                                <div className="dp-appt-sub">Covers: {coverageLabel(d)}</div>
                                <div className="dp-appt-chips">
                                    {!d.has_account ? <span className="dp-chip dp-chip--warning">No login yet</span>
                                        : d.is_active ? <span className="dp-chip dp-chip--success">Account active</span> : <span className="dp-chip dp-chip--danger">Account inactive</span>}
                                    {d.has_account && (d.phone_confirmed
                                        ? <span className="dp-chip"><CheckCircle2 size={12} /> Phone confirmed {d.contact_number ? `(${d.contact_number})` : ''}</span>
                                        : <span className="dp-chip dp-chip--warning">Phone not added yet</span>)}
                                    {d.created_at && <span className="dp-chip source">Added {formatDate(d.created_at)}</span>}
                                </div>
                            </div>
                            <div className="dp-appt-actions">
                                {d.has_account ? (
                                    <>
                                        <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => openEdit(d)}><Edit size={15} /> Edit</button>
                                        <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => { setResetting(d); setResetPhone(false); }}><KeyRound size={15} /> Reset password</button>
                                        <button className={`dp-btn dp-btn-sm ${d.is_active ? 'dp-btn-danger' : 'dp-btn-success'}`} onClick={() => toggleActive(d)}><Power size={15} /> {d.is_active ? 'Deactivate' : 'Activate'}</button>
                                    </>
                                ) : (
                                    <>
                                        <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => openEdit(d)}><Edit size={15} /> Edit</button>
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
                        <SpecializationPicker id="da-spec" value={form.specialization} onChange={(specialization) => setName({ specialization })} />
                        <div className="dp-field">
                            <label htmlFor="da-user">Username</label>
                            <div className="mda-username">
                                <input id="da-user" className="dp-input" required maxLength={60} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/@.*/, ''), usernameEdited: true })} />
                                <span className="dp-hint mda-domain">{DOMAIN}</span>
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
                        <div className="dp-notice mda-credentials">
                            Username: <strong>{created.username}</strong><br />
                            Password: <strong>{created.default_password}</strong> (default)
                        </div>
                        <p className="dp-hint mda-flush">Give these to the doctor. At the first login they set a new password and add their phone number.</p>
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
                            <div className="dp-field"><label htmlFor="da-first-edit">First name</label><input id="da-first-edit" className="dp-input" required maxLength={100} value={editing.first_name} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} /></div>
                            <div className="dp-field"><label htmlFor="da-last-edit">Last name</label><input id="da-last-edit" className="dp-input" required maxLength={100} value={editing.last_name} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} /></div>
                        </div>
                        {editing.has_account && (
                            <div className="dp-field">
                                <label htmlFor="da-user-edit">Username</label>
                                <div className="mda-username">
                                    <input id="da-user-edit" className="dp-input" required minLength={3} maxLength={60} value={editing.username} onChange={(e) => setEditing({ ...editing, username: e.target.value.replace(/@.*/, '') })} />
                                    <span className="dp-hint mda-domain">{DOMAIN}</span>
                                </div>
                                <small>Letters, numbers, dots, dashes and underscores. The doctor signs in with the new username after you save.</small>
                            </div>
                        )}
                        <SpecializationPicker id="da-spec-edit" value={editing.specialization || ''} onChange={(specialization) => setEditing({ ...editing, specialization })} />
                        <div className="dp-modal-foot">
                            <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                            <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                        </div>
                    </form>
                )}
                {editing && (
                    <div className="mda-section">
                        <h4 className="mda-section-title">Check-ups covered</h4>
                        <p className="dp-hint mda-flush">The choices follow the saved specialization. Save a changed specialization first.</p>
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
