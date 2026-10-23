// UnavailableDates.jsx
// Dates (or a time window) when a doctor cannot see patients. The nurse and the doctor both manage them.
// Nothing can be booked on these dates; appointments already booked there can be cancelled in one step.
import React, { useState, useEffect, useCallback } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime } from '../../utils/datetime';
import { localDateStr, hhmm } from '../../utils/visitPurpose';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';

const EMPTY = { doctor_id: '', start_date: '', end_date: '', whole_day: true, start_time: '13:00', end_time: '17:00', reason: '' };

const UnavailableDates = ({ doctors, fixedDoctorId, userId, onChanged }) => {
    const { showAlert, showConfirm } = useAlert();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const qs = fixedDoctorId ? `?doctor_id=${encodeURIComponent(fixedDoctorId)}` : '';
            const res = await fetch(`${API}/api/doctor-unavailable-dates${qs}`);
            const data = await res.json();
            if (data.success) setRows(data.unavailable);
        } catch (e) {
            showAlert('Could not load the unavailable dates.', 'error');
        } finally {
            setLoading(false);
        }
    }, [fixedDoctorId, showAlert]);

    useEffect(() => { load(); }, [load]);

    const openForm = () => {
        setForm({ ...EMPTY, doctor_id: fixedDoctorId || '', start_date: localDateStr(), end_date: localDateStr() });
        setError('');
        setShowForm(true);
    };

    const save = async (cancelConflicts = false) => {
        setError('');
        if (!form.doctor_id) { setError('Choose the doctor.'); return; }
        if (!form.start_date || !form.end_date) { setError('Pick the dates.'); return; }
        if (form.end_date < form.start_date) { setError('The end date must be on or after the start date.'); return; }
        if (!form.whole_day && form.end_time <= form.start_time) { setError('The end time must be after the start time.'); return; }

        setBusy(true);
        try {
            const res = await fetch(`${API}/api/doctor-unavailable-dates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    doctor_id: form.doctor_id, start_date: form.start_date, end_date: form.end_date,
                    start_time: form.whole_day ? null : form.start_time, end_time: form.whole_day ? null : form.end_time,
                    reason: form.reason, actor_user_id: userId, cancel_conflicts: cancelConflicts
                })
            });
            const data = await res.json();
            if (data.success) {
                setShowForm(false);
                showAlert(data.message, 'success');
                load();
                onChanged?.();
            } else if (data.needs_confirmation) {
                const ok = await showConfirm(data.message, { danger: true, confirmLabel: 'Cancel those appointments', title: 'Appointments in this period' });
                if (ok) { setBusy(false); await save(true); return; }
            } else {
                setError(data.message || 'Could not save.');
            }
        } catch (e) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (row) => {
        const ok = await showConfirm('Remove these unavailable dates? Students will be able to book the doctor on them again.', { confirmLabel: 'Remove', title: 'Remove unavailable dates' });
        if (!ok) return;
        try {
            const res = await fetch(`${API}/api/doctor-unavailable-dates/${row.unavailable_id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); load(); onChanged?.(); }
            else showAlert(data.message || 'Could not remove.', 'error');
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        }
    };

    const doctorName = (d) => `Dr. ${d.doc_first_name} ${d.doc_last_name}`;

    return (
        <section className="dp-card" aria-label="Unavailable dates">
            <h3 className="dp-card-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CalendarOff size={18} /> Unavailable dates</span>
                <button type="button" className="dp-btn dp-btn-primary dp-btn-sm" onClick={openForm}><Plus size={15} /> Add unavailable dates</button>
            </h3>
            <p className="dp-hint" style={{ marginTop: -6 }}>Students cannot book these days or times. Use it for leave, seminars or any time the doctor is not at the clinic.</p>

            {loading ? <p className="dp-hint">Loading...</p> : rows.length === 0 ? (
                <p className="dp-hint">No upcoming unavailable dates.</p>
            ) : (
                <div className="dp-list">
                    {rows.map((r) => (
                        <div key={r.unavailable_id} className="dp-appt" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                            <div className="dp-appt-main">
                                <h4>
                                    {r.start_date === r.end_date ? formatDate(r.start_date) : `${formatDate(r.start_date)} - ${formatDate(r.end_date)}`}
                                    <span className="dp-chip">{r.start_time ? `${formatTime(hhmm(r.start_time))} - ${formatTime(hhmm(r.end_time))}` : 'Whole day'}</span>
                                </h4>
                                {!fixedDoctorId && <div className="dp-appt-sub">{doctorName(r)}</div>}
                                {r.reason && <div className="dp-appt-sub">{r.reason}</div>}
                            </div>
                            <button type="button" className="dp-btn dp-btn-danger dp-btn-sm" onClick={() => remove(r)}><Trash2 size={15} /> Remove</button>
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add unavailable dates" icon={<CalendarOff size={20} />} size="md">
                <form className="dp-form" onSubmit={(e) => { e.preventDefault(); save(false); }}>
                    {error && <div className="dp-error">{error}</div>}
                    {!fixedDoctorId && (
                        <div className="dp-field">
                            <label>Doctor</label>
                            <select className="dp-select" required value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
                                <option value="">-- Select doctor --</option>
                                {doctors.map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="dp-row">
                        <div className="dp-field">
                            <label>From</label>
                            <input className="dp-input" type="date" required min={localDateStr()} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: form.end_date < e.target.value ? e.target.value : form.end_date })} />
                        </div>
                        <div className="dp-field">
                            <label>Until</label>
                            <input className="dp-input" type="date" required min={form.start_date || localDateStr()} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                        </div>
                    </div>
                    <label className="dp-check"><input type="checkbox" checked={form.whole_day} onChange={(e) => setForm({ ...form, whole_day: e.target.checked })} /> The whole day</label>
                    {!form.whole_day && (
                        <div className="dp-row">
                            <div className="dp-field"><label>From time</label><input className="dp-input" type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                            <div className="dp-field"><label>Until time</label><input className="dp-input" type="time" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                        </div>
                    )}
                    <div className="dp-field">
                        <label>Reason (optional)</label>
                        <input className="dp-input" maxLength={255} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Medical seminar" />
                    </div>
                    <div className="dp-modal-foot">
                        <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                        <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                    </div>
                </form>
            </Modal>
        </section>
    );
};

export default UnavailableDates;
