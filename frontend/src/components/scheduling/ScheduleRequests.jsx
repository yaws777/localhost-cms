// ScheduleRequests.jsx
// The nurse does not set a doctor's schedule: she sends the doctor a schedule request (category, preferred day and time, a note).
// The doctor answers it by setting the schedule (the schedule form opens with the request's values) or declines with a reason.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarClock, Send, Check, XCircle } from 'lucide-react';
import Modal from '../common/Modal';
import { ReasonModal } from '../doctor/AppointmentModals';
import { useAlert } from '../../context/AlertContext';
import { useSpecializations } from '../../hooks/useSpecializations';
import { formatDate } from '../../utils/datetime';
import { API, eligibleDoctors, to12h, todayKey, hhmm } from '../../utils/scheduling';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const STATUS_BADGE = { Pending: 'badge-pending-ds', Scheduled: 'badge-open-ds', Declined: 'badge-closed-ds', Cancelled: 'badge-closed-ds' };

const EMPTY = { doctor_id: '', visit_type: 'Any', preferred_date: '', preferred_start: '', preferred_end: '', note: '' };

// The nurse's form
export const ScheduleRequestModal = ({ isOpen, preset, doctors, nurseId, userId, onClose, onSent }) => {
    const { showAlert } = useAlert();
    const { visitTypes } = useSpecializations();
    const [form, setForm] = useState(EMPTY);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setForm({ ...EMPTY, ...preset });
        setError('');
        setBusy(false);
    }, [isOpen, preset]);

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const choices = form.visit_type === 'Any' ? doctors : eligibleDoctors(doctors, form.visit_type);

    const changeCategory = (visit_type) => {
        const stillOk = !form.doctor_id || visit_type === 'Any' || eligibleDoctors(doctors, visit_type).some((d) => d.doctor_id === form.doctor_id);
        set({ visit_type, doctor_id: stillOk ? form.doctor_id : '' });
    };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            const res = await fetch(`${API}/api/schedule-requests`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, nurse_id: nurseId, sender_id: userId })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); onSent?.(); onClose(); }
            else setError(data.message || 'Could not send the request.');
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Request a schedule" icon={<Send size={20} />} size="md" closeOnBackdrop={false}>
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-notice">The doctor gets your request and sets the schedule. When it is set, open its listing so students can ask for a place.</div>
                {error && <div className="dp-error" role="alert">{error}</div>}
                <div className="dp-row">
                    <div className="dp-field">
                        <label htmlFor="sr-category">Check-up service</label>
                        <select id="sr-category" className="dp-select" value={form.visit_type} onChange={(e) => changeCategory(e.target.value)}>
                            <option value="Any">Any check-up</option>
                            {visitTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="dp-field">
                        <label htmlFor="sr-doctor">Doctor</label>
                        <select id="sr-doctor" className="dp-select" required value={form.doctor_id} onChange={(e) => set({ doctor_id: e.target.value })}>
                            <option value="">-- Select doctor --</option>
                            {choices.map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name} ({d.specialization})</option>)}
                        </select>
                        {choices.length === 0 && <small className="dp-hint">No doctor covers {form.visit_type}.</small>}
                    </div>
                </div>
                <div className="dp-row">
                    <div className="dp-field">
                        <label htmlFor="sr-date">Preferred date (optional)</label>
                        <input id="sr-date" className="dp-input" type="date" min={todayKey()} value={form.preferred_date || ''} onChange={(e) => set({ preferred_date: e.target.value })} />
                    </div>
                    <div className="dp-field">
                        <label htmlFor="sr-start">From (optional)</label>
                        <input id="sr-start" className="dp-input" type="time" value={form.preferred_start || ''} onChange={(e) => set({ preferred_start: e.target.value })} />
                    </div>
                    <div className="dp-field">
                        <label htmlFor="sr-end">To (optional)</label>
                        <input id="sr-end" className="dp-input" type="time" value={form.preferred_end || ''} onChange={(e) => set({ preferred_end: e.target.value })} />
                    </div>
                </div>
                <div className="dp-field">
                    <label htmlFor="sr-note">Note for the doctor (optional)</label>
                    <textarea id="sr-note" className="dp-textarea" rows={2} maxLength={255} value={form.note || ''} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. 12 students are waiting for a check-up" />
                </div>
                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy || !form.doctor_id}>{busy ? 'Sending...' : 'Send request'}</button>
                </div>
            </form>
        </Modal>
    );
};

// The list of requests: the doctor answers them, the nurse follows them
// role: 'nurse' | 'doctor'; onSetSchedule(request) opens the schedule form for the doctor
const ScheduleRequests = ({ role, fixedDoctorId, nurseId, userId, refreshKey, onChanged, onSetSchedule }) => {
    const { showAlert } = useAlert();
    const [requests, setRequests] = useState([]);
    const [declineFor, setDeclineFor] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/schedule-requests${fixedDoctorId ? `?doctor_id=${encodeURIComponent(fixedDoctorId)}` : ''}`);
            const data = await res.json();
            if (data.success) setRequests(data.requests);
        } catch (e) { /* the strip is a convenience */ }
    }, [fixedDoctorId]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const visible = useMemo(() => requests.filter((r) => (role === 'doctor' ? r.status === 'Pending' : true)), [requests, role]);
    if (visible.length === 0) return null;

    const decline = async (reason) => {
        const res = await fetch(`${API}/api/schedule-requests/${declineFor.schedule_request_id}/decline`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ created_by_doctor_id: fixedDoctorId, sender_id: userId, reason })
        });
        const data = await res.json();
        setDeclineFor(null);
        if (data.success) { showAlert(data.message, 'success'); load(); onChanged?.(); } else showAlert(data.message || 'Could not decline.', 'error');
    };

    const cancel = async (r) => {
        const res = await fetch(`${API}/api/schedule-requests/${r.schedule_request_id}/cancel`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nurse_id: nurseId })
        });
        const data = await res.json();
        if (data.success) { showAlert(data.message, 'success'); load(); onChanged?.(); } else showAlert(data.message || 'Could not cancel.', 'error');
    };

    return (
        <section className="doctor-group-ds schedule-requests-sc" aria-label="Schedule requests">
            <header className="group-head-ds">
                <span className="group-title-ds">
                    <strong><CalendarClock size={16} style={{ verticalAlign: 'middle' }} /> Schedule requests</strong>
                    <small>{role === 'doctor' ? 'The nurse asks you for a schedule. Set it or decline with a reason.' : 'Requests you sent to the doctors.'}</small>
                </span>
            </header>
            <div className="table-card-dv group-table-ds">
                <table className="sti-table-dv">
                    <thead><tr><th>{role === 'doctor' ? 'From' : 'Doctor'}</th><th>Check-up service</th><th>Preferred</th><th>Note</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        {visible.map((r) => (
                            <tr key={r.schedule_request_id}>
                                <td>{role === 'doctor' ? (r.nurse_first_name ? `${r.nurse_first_name} ${r.nurse_last_name} (nurse)` : 'The clinic') : `Dr. ${r.doc_first_name} ${r.doc_last_name}`}</td>
                                <td>{r.visit_type === 'Any' ? 'Any check-up' : r.visit_type}</td>
                                <td>
                                    {r.preferred_date ? formatDate(r.preferred_date) : 'Any day'}
                                    {r.preferred_start && <div className="muted-ds">{to12h(r.preferred_start)}{r.preferred_end ? ` - ${to12h(r.preferred_end)}` : ''}</div>}
                                </td>
                                <td>{r.note || '-'}</td>
                                <td>
                                    <span className={`badge-ds ${STATUS_BADGE[r.status] || 'badge-expired-ds'}`}>{r.status}</span>
                                    {r.status === 'Declined' && r.decline_reason && <div className="muted-ds">{r.decline_reason}</div>}
                                </td>
                                <td>
                                    {r.status === 'Pending' && role === 'doctor' && (
                                        <div className="row-actions-sc">
                                            <button type="button" className="sti-btn-dv sti-btn-primary-dv btn-sm-sc" onClick={() => onSetSchedule(r)}><Check size={13} /> Set schedule</button>
                                            <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={() => setDeclineFor(r)}><XCircle size={13} /> Decline</button>
                                        </div>
                                    )}
                                    {r.status === 'Pending' && role !== 'doctor' && (
                                        <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={() => cancel(r)}>Cancel request</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ReasonModal
                isOpen={!!declineFor} title="Decline the schedule request" confirmLabel="Decline" danger label="Reason (shown to the nurse)"
                message={declineFor ? `${declineFor.visit_type === 'Any' ? 'Any check-up' : declineFor.visit_type}${declineFor.preferred_date ? ` on ${formatDate(declineFor.preferred_date)}` : ''}` : ''}
                placeholder="e.g. I am not available that week" onSubmit={decline} onClose={() => setDeclineFor(null)}
            />
        </section>
    );
};

// values the schedule form takes from a request
export const presetFromRequest = (r) => ({
    doctor_id: r.doctor_id, visit_type: r.visit_type, schedule_request_id: r.schedule_request_id,
    ...(r.preferred_date ? { schedule_date: String(r.preferred_date).slice(0, 10) } : {}),
    ...(r.preferred_start ? { start_time: hhmm(r.preferred_start) } : {}),
    ...(r.preferred_end ? { end_time: hhmm(r.preferred_end) } : {})
});

export default ScheduleRequests;
