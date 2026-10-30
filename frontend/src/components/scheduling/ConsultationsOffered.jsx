// ConsultationsOffered.jsx (shown as "Check-up Services")
// The check-up services the clinic has (Dental, Vision, ...), used in Manage Doctor Accounts. Each one is linked to the specializations
// that give it, and only doctors with one of those specializations can be assigned to it. A session (and its listing) of
// a service is only set by a doctor assigned to it. The listing itself is per schedule (see the Listings tab of the scheduling hub), not per service.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Edit, Trash2, Unlink, ClipboardList } from 'lucide-react';
import Modal from '../common/Modal';
import { useAlert } from '../../context/AlertContext';
import { useSpecializations } from '../../hooks/useSpecializations';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';
const OTHER = '__other__';

const call = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return data;
};

const emptyForm = { pick: '', other: '', specs: [], presetSpecs: [], newSpec: '', doctorIds: [] };

const ConsultationsOffered = ({ doctors, onChanged }) => {
    const { showAlert, showConfirm } = useAlert();
    const { reload: reloadSpecializations } = useSpecializations();
    const [data, setData] = useState({ consultations: [], suggestions: [], specializations: [] });
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await call('/api/consultations-offered', 'GET');
            if (res.success) setData(res);
        } catch (e) {
            showAlert('Could not load the check-up services.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showAlert]);

    useEffect(() => { load(); }, [load, doctors]);

    const existing = useMemo(() => data.consultations.find((c) => c.visit_type === form?.pick) || null, [data, form?.pick]);
    const isGeneral = !!existing?.is_general;
    const visitType = form ? (form.pick === OTHER ? form.other.trim() : form.pick) : '';

    // doctors that could take it: the specialization is one of the ticked ones (or the one typed under "another specialization")
    const specSet = useMemo(() => new Set([...(form?.specs || []), ...(form?.presetSpecs || []), form?.newSpec || ''].map((s) => s.trim().toLowerCase()).filter(Boolean)), [form]);
    const pool = useMemo(
        () => (!form ? [] : doctors.filter((d) => isGeneral || specSet.has(String(d.specialization || '').trim().toLowerCase()))),
        [doctors, form, isGeneral, specSet]
    );

    // specializations that can still be ticked: the ones not linked to this check-up yet
    const linkable = useMemo(() => {
        const linked = new Set((existing ? existing.specializations : form?.presetSpecs || []).map((s) => s.toLowerCase()));
        return data.specializations.filter((name) => !linked.has(name.toLowerCase()));
    }, [data.specializations, existing, form?.presetSpecs]);

    const openForm = (consultation = null) => {
        setError('');
        setForm(consultation
            ? { ...emptyForm, pick: consultation.visit_type, specs: consultation.specializations, doctorIds: consultation.doctors.filter((d) => d.assigned).map((d) => d.doctor_id) }
            : { ...emptyForm });
    };

    // picking an existing check-up loads what it already has; a preset one comes with its specializations; Other starts empty
    const pickConsultation = (value) => {
        const found = data.consultations.find((c) => c.visit_type === value);
        const preset = data.suggestions.find((s) => s.visit_type === value);
        if (found) setForm({ ...emptyForm, pick: value, specs: found.specializations, doctorIds: found.doctors.filter((d) => d.assigned).map((d) => d.doctor_id) });
        else setForm({ ...emptyForm, pick: value, presetSpecs: preset ? preset.specializations : [] });
    };

    const toggle = (key, value) => setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value] }));

    const save = async (e) => {
        e.preventDefault();
        setError('');
        const specializations = [...new Set([...form.specs, ...form.presetSpecs, form.newSpec.trim()].filter(Boolean))];
        if (form.newSpec.trim().length > 80) { setError('The specialization can be at most 80 characters.'); return; }
        if (!visitType) { setError(form.pick === OTHER ? 'Specify the check-up service.' : 'Pick the check-up service.'); return; }
        if (!isGeneral && specializations.length === 0) { setError('Pick the specialization connected to this check-up.'); return; }
        setBusy(true);
        try {
            const res = await call('/api/consultations-offered', 'POST', {
                visit_type: visitType, specializations,
                doctor_ids: form.doctorIds.filter((id) => pool.some((d) => d.doctor_id === id))
            });
            if (res.success) {
                setForm(null);
                showAlert(res.message, 'success');
                await refresh();
            } else setError(res.message || 'Could not save the check-up service.');
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    const refresh = async () => {
        await reloadSpecializations();
        await load();
        if (onChanged) onChanged();
    };

    // built-in check-ups (General Check Up, Dental, Vision ...) stay
    const removable = (c) => !!c && !c.is_general && !c.is_system;

    const remove = async (c) => {
        const ok = await showConfirm(
            `Remove ${c.visit_type} from the check-up services? Students will no longer see it as a purpose of check-up. Past visits keep their record.`,
            { danger: true, confirmLabel: 'Remove', title: 'Remove check-up service' }
        );
        if (!ok) return;
        setBusy(true);
        try {
            const res = await call(`/api/consultations-offered/${encodeURIComponent(c.visit_type)}`, 'DELETE');
            if (res.success) { setForm(null); showAlert(res.message, 'success'); await refresh(); }
            else showAlert(res.message || 'Could not remove the check-up service.', 'error');
        } catch (err) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const unlink = async (name) => {
        const ok = await showConfirm(
            `Unlink ${name} from ${existing.visit_type}? Doctors with this specialization will no longer be able to take it.`,
            { danger: true, confirmLabel: 'Unlink', title: 'Unlink specialization' }
        );
        if (!ok) return;
        setBusy(true);
        setError('');
        try {
            const res = await call(`/api/consultations-offered/${encodeURIComponent(existing.visit_type)}/specializations/${encodeURIComponent(name)}`, 'DELETE');
            if (res.success) {
                showAlert(res.message, 'success');
                setForm((f) => ({ ...f, specs: f.specs.filter((s) => s !== name) }));
                await refresh();
            } else setError(res.message || 'Could not unlink the specialization.');
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="dp-card mda-card">
            <div className="dp-page-head mda-card-head">
                <div>
                    <h3 className="mda-heading"><ClipboardList size={18} className="mda-heading-icon" aria-hidden="true" />Check-up Services</h3>
                    <p className="dp-hint mda-lead">Each check-up service belongs to one or more specializations. Only doctors with that specialization can be assigned to it, and only those doctors can set a schedule for it. Listings are opened per schedule, in the Listings tab of Doctor Visit.</p>
                </div>
                <div className="dp-actions">
                    <button type="button" className="dp-btn dp-btn-primary" onClick={() => openForm()}><Plus size={17} /> Add check-up service</button>
                </div>
            </div>

            {loading ? <p className="dp-hint">Loading...</p> : (
                <div className="mda-table-wrap">
                    <table className="sti-table-dv mda-table">
                        <thead><tr><th>Check-up service</th><th>Specialization</th><th>Assigned doctors</th><th /></tr></thead>
                        <tbody>
                            {data.consultations.map((c) => {
                                const assigned = c.doctors.filter((d) => d.assigned);
                                return (
                                    <tr key={c.visit_type}>
                                        <td><strong>{c.visit_type}</strong></td>
                                        <td>{c.is_general ? 'Every specialization' : c.specializations.join(', ') || '-'}</td>
                                        <td>{assigned.length === 0 ? <span className="dp-hint">No doctor yet</span> : assigned.map((d) => `Dr. ${d.last_name}`).join(', ')}</td>
                                        <td>
                                            <div className="dp-row-actions">
                                                <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => openForm(c)}><Edit size={14} /> Edit</button>
                                                {removable(c) && <button type="button" className="dp-btn dp-btn-danger dp-btn-sm" disabled={busy} onClick={() => remove(c)}><Trash2 size={14} /> Remove</button>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={!!form} onClose={() => setForm(null)} title={existing ? `Check-up service: ${existing.visit_type}` : 'Add check-up service'} icon={<ClipboardList size={20} />} size="md" closeOnBackdrop={false}>
                {form && (
                    <form className="dp-form" onSubmit={save}>
                        {error && <div className="dp-error" role="alert">{error}</div>}

                        <div className="dp-field">
                            <label htmlFor="co-pick">Check-up service</label>
                            <select id="co-pick" className="dp-select" required value={form.pick} onChange={(e) => pickConsultation(e.target.value)}>
                                <option value="">-- Select the check-up service --</option>
                                <optgroup label="Already offered">
                                    {data.consultations.map((c) => <option key={c.visit_type} value={c.visit_type}>{c.visit_type}</option>)}
                                </optgroup>
                                {data.suggestions.length > 0 && (
                                    <optgroup label="Preset (comes with its specialization)">
                                        {data.suggestions.map((s) => <option key={s.visit_type} value={s.visit_type}>{s.visit_type} - {s.specializations.join(', ')}</option>)}
                                    </optgroup>
                                )}
                                <option value={OTHER}>Other (specify)</option>
                            </select>
                        </div>
                        {form.pick === OTHER && (
                            <div className="dp-field">
                                <label htmlFor="co-other">Specify the check-up service</label>
                                <input id="co-other" className="dp-input" maxLength={30} required value={form.other} onChange={(e) => setForm({ ...form, other: e.target.value })} placeholder="e.g. Asthma Care" />
                                <small>Students will see this as a check-up they can wait for.</small>
                            </div>
                        )}

                        {form.pick && !isGeneral && form.pick !== OTHER && (
                            <div className="dp-field">
                                <span className="dp-label">Connected specialization</span>
                                <div className="mda-spec-list">
                                    {(existing ? existing.specializations : form.presetSpecs).map((name) => {
                                        const canUnlink = !!existing && existing.specializations.length > 1 && existing.links.some((l) => l.name === name && !l.is_system);
                                        return (
                                            <span key={name} className="mda-inline">
                                                <span className="dp-chip dp-chip--neutral">{name}</span>
                                                {canUnlink && <button type="button" className="dp-btn dp-btn-ghost dp-btn-icon" disabled={busy} onClick={() => unlink(name)} aria-label={`Unlink ${name}`} title={`Unlink ${name}`}><Unlink size={14} /></button>}
                                            </span>
                                        );
                                    })}
                                </div>
                                <small>Already set. Only doctors with this specialization can be assigned.</small>
                            </div>
                        )}

                        {form.pick && !isGeneral && (
                            <fieldset className="dp-field mda-fieldset">
                                <legend className="dp-label">{form.pick === OTHER ? 'Connected specialization (required)' : 'Add another specialization'}</legend>
                                {linkable.length > 0 && (
                                    <div className="mda-spec-list">
                                        {linkable.map((name) => (
                                            <label key={name} className="dp-check">
                                                <input type="checkbox" checked={form.specs.includes(name)} onChange={() => toggle('specs', name)} /> {name}
                                            </label>
                                        ))}
                                    </div>
                                )}
                                <label htmlFor="co-newspec">Not on the list? Type a new specialization</label>
                                <input id="co-newspec" className="dp-input" maxLength={80} value={form.newSpec} onChange={(e) => setForm({ ...form, newSpec: e.target.value })} placeholder="e.g. Pulmonologist" />
                                <small>{form.pick === OTHER ? 'Pick the specialization(s) that give this check-up, or type a new one.' : 'It is added to this check-up. '}Only doctors with a linked specialization can be assigned.</small>
                            </fieldset>
                        )}


                        {form.pick && (
                            <div className="dp-field">
                                <label>Assign doctors</label>
                                {pool.length === 0 ? (
                                    <small>{isGeneral ? 'There is no doctor yet.' : 'No doctor has the chosen specialization yet. Create the doctor account with that specialization first.'}</small>
                                ) : (
                                    <div className="mda-doctor-list">
                                        {pool.map((d) => (
                                            <label key={d.doctor_id} className="dp-check">
                                                <input type="checkbox" checked={form.doctorIds.includes(d.doctor_id)} onChange={() => toggle('doctorIds', d.doctor_id)} />
                                                Dr. {d.first_name} {d.last_name} <span className="dp-hint">{d.specialization}{d.has_account ? '' : ' - no login yet'}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                                <small>Only doctors whose specialization is linked to this check-up are listed.</small>
                            </div>
                        )}

                        <div className="dp-modal-foot">
                            {removable(existing) && <button type="button" className="dp-btn dp-btn-danger mda-push-left" disabled={busy} onClick={() => remove(existing)}><Trash2 size={15} /> Remove check-up service</button>}
                            <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setForm(null)}>Cancel</button>
                            <button type="submit" className="dp-btn dp-btn-primary" disabled={busy || !form.pick}>{busy ? 'Saving...' : existing ? 'Save' : 'Add check-up service'}</button>
                        </div>
                    </form>
                )}
            </Modal>
        </section>
    );
};

export default ConsultationsOffered;
