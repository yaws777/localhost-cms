// ScheduleRequests.jsx
// The nurse does not set a doctor's schedule: she sends the doctor a schedule request (category, preferred day and time, a note).
// The doctor answers it by setting the schedule (the schedule form opens with the request's values) or declines with a reason.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarClock, Send, Check, XCircle, RefreshCw } from 'lucide-react';
import Modal from '../common/Modal';
import TimeRangeFields from '../common/TimeRangeFields';
import { ReasonModal } from '../doctor/AppointmentModals';
import { Pager, paginate } from '../common/RecordFolders';
import { useAlert } from '../../context/AlertContext';
import { useSpecializations } from '../../hooks/useSpecializations';
import { formatDate } from '../../utils/datetime';
import { localTimeStr, minTimeFor, isPastMoment } from '../../utils/visitPurpose';
import { API, eligibleDoctors, doctorOffers, to12h, todayKey, hhmm } from '../../utils/scheduling';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const REQUESTS_PER_PAGE = 6;

const STATUS_BADGE = { Pending: 'badge-pending-ds', Scheduled: 'badge-open-ds', Declined: 'badge-closed-ds', Cancelled: 'badge-closed-ds' };

// the list opens on what still needs an answer; the other states are one click away
const REQUEST_FILTERS = [['Pending', 'Pending'], ['Scheduled', 'Scheduled'], ['Declined', 'Declined'], ['Cancelled', 'Cancelled'], ['All', 'All']];

const EMPTY = { doctor_id: '', visit_type: 'Any', preferred_date: '', preferred_start: '', preferred_end: '', note: '' };

const repeatKeyOf = (r) => `${r.appointment_id}|${r.student_id}`;
const parseRepeats = (raw) => {
    try { const list = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(list) ? list : []; } catch (e) { return []; }
};

// What a pending schedule request already covers, so the same students are not asked for twice:
// the advance listing services with a pending request and the repeats (appointment|student) inside one.
// trigger: any value that changes when the data must be read again (false = do not load)
export const usePendingScheduleRequests = (trigger) => {
    const [pending, setPending] = useState([]);
    useEffect(() => {
        if (trigger === false) return undefined;
        let live = true;
        fetch(`${API}/api/schedule-requests?status=Pending`)
            .then((r) => r.json())
            .then((d) => { if (live && d.success) setPending(d.requests); })
            .catch(() => { /* a convenience: the server refuses a double request too */ });
        return () => { live = false; };
    }, [trigger]);
    return useMemo(() => ({
        advanceServices: new Set(pending.filter((r) => r.for_advance).map((r) => r.visit_type)),
        repeatKeys: new Set(pending.flatMap((r) => parseRepeats(r.repeat_ids).map(repeatKeyOf)))
    }), [pending]);
};

// The nurse's form
export const ScheduleRequestModal = ({ isOpen, preset, doctors, nurseId, userId, onClose, onSent }) => {
    const { showAlert } = useAlert();
    const { visitTypes } = useSpecializations();
    const [form, setForm] = useState(EMPTY);
    const [busy, setBusy] = useState(false);
    const [advanceServices, setAdvanceServices] = useState([]); // services of the advance listing with students waiting for a schedule
    const requested = usePendingScheduleRequests(isOpen ? true : false);
    const fail = (message) => showAlert(message, 'error');

    useEffect(() => {
        if (!isOpen) return;
        // date and time start at now; a preset can still bring its own
        const nowTime = localTimeStr();
        const endMin = Math.min(Number(nowTime.slice(0, 2)) * 60 + Number(nowTime.slice(3)) + 60, 23 * 60 + 59);
        const nowEnd = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
        setForm({ ...EMPTY, preferred_date: todayKey(), preferred_start: nowTime, preferred_end: nowEnd, ...preset });
        setBusy(false);
        let live = true;
        fetch(`${API}/api/advance-listing`)
            .then((r) => r.json())
            .then((d) => { if (live && d.success) setAdvanceServices(d.services.filter((s) => s.waiting > 0)); })
            .catch(() => { /* the choice is a convenience */ });
        return () => { live = false; };
    }, [isOpen, preset]);

    // the repeats of the chosen doctor that wait for a schedule: the nurse can move them into the schedule she asks for (they come before the advance listing)
    const [waitingRepeats, setWaitingRepeats] = useState([]);
    const [pickedRepeats, setPickedRepeats] = useState([]); // keys "appointment_id|student_id"
    useEffect(() => {
        setPickedRepeats([]);
        if (!isOpen || !form.doctor_id) { setWaitingRepeats([]); return undefined; }
        let live = true;
        fetch(`${API}/api/follow-ups?state=needs_time&doctor_id=${encodeURIComponent(form.doctor_id)}`)
            .then((r) => r.json())
            .then((d) => { if (live && d.success) setWaitingRepeats(d.follow_ups); })
            .catch(() => { /* the choice is a convenience */ });
        return () => { live = false; };
    }, [isOpen, form.doctor_id]);

    const repeatKey = repeatKeyOf;
    // only the repeats the check-up service of the request fits (Any = all of them); the ones inside a pending request cannot be asked for again
    const repeatChoices = useMemo(
        () => waitingRepeats.filter((r) => form.visit_type === 'Any' || r.visit_type === form.visit_type || ['Follow-up', 'Referral'].includes(r.visit_type)),
        [waitingRepeats, form.visit_type]
    );
    const isRequested = useCallback((r) => requested.repeatKeys.has(repeatKeyOf(r)), [requested]);
    useEffect(() => { setPickedRepeats((p) => p.filter((k) => repeatChoices.some((r) => repeatKey(r) === k && !isRequested(r)))); }, [repeatChoices, isRequested, repeatKey]);
    const freeRepeats = repeatChoices.filter((r) => !isRequested(r));
    const toggleRepeat = (key) => setPickedRepeats((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const choices = form.visit_type === 'Any' ? doctors : eligibleDoctors(doctors, form.visit_type);
    // the advance listing choices are the services this doctor covers (none = only a normal request); with no doctor picked yet every service shows
    const chosenDoctor = doctors.find((d) => d.doctor_id === form.doctor_id);
    const advanceChoices = chosenDoctor ? advanceServices.filter((s) => doctorOffers(chosenDoctor, s.visit_type)) : advanceServices;

    const changeDoctor = (doctor_id) => {
        const next = doctors.find((d) => d.doctor_id === doctor_id);
        // an advance listing of a service the new doctor does not cover goes back to a normal request
        if (form.advance_listing && next && !doctorOffers(next, form.visit_type)) {
            set({ doctor_id, advance_listing: false, visit_type: 'Any', note: /advance listing$/.test(form.note || '') ? '' : form.note });
        } else {
            set({ doctor_id });
        }
    };

    const changeCategory = (visit_type) => {
        const stillOk = !form.doctor_id || visit_type === 'Any' || eligibleDoctors(doctors, visit_type).some((d) => d.doctor_id === form.doctor_id);
        set({ visit_type, doctor_id: stillOk ? form.doctor_id : '' });
    };

    // For the advance listing or not: picking a service of the advance listing sets the check-up service to it (Dental = dentists only)
    const changeAdvance = (service) => {
        // turning it off removes only the note this choice wrote, never what the nurse typed
        if (!service) { set({ advance_listing: false, note: /advance listing$/.test(form.note || '') ? '' : form.note }); return; }
        const found = advanceServices.find((s) => s.visit_type === service);
        const stillOk = !form.doctor_id || eligibleDoctors(doctors, service).some((d) => d.doctor_id === form.doctor_id);
        set({
            advance_listing: true, visit_type: service, doctor_id: stillOk ? form.doctor_id : '',
            note: found ? `${found.waiting} student(s) in the ${service} advance listing` : form.note
        });
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!form.doctor_id) { fail('Select a doctor.'); return; }
        if (form.preferred_date && isPastMoment(form.preferred_date, form.preferred_start)) { fail('The preferred date and time cannot be in the past.'); return; }
        if (form.preferred_start && form.preferred_end && form.preferred_end <= form.preferred_start) { fail('The end time must be after the start time.'); return; }
        if (form.advance_listing && requested.advanceServices.has(form.visit_type)) { fail(`The ${form.visit_type} advance listing already has a pending schedule request.`); return; }
        setBusy(true);
        try {
            const res = await fetch(`${API}/api/schedule-requests`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form, nurse_id: nurseId, sender_id: userId,
                    repeats: repeatChoices.filter((r) => pickedRepeats.includes(repeatKey(r))).map((r) => ({ appointment_id: r.appointment_id, student_id: r.student_id }))
                })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); onSent?.(); onClose(); }
            else fail(data.message || 'Could not send the request.');
        } catch (err) {
            fail('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Request a schedule" icon={<Send size={20} />} size="lg" closeOnBackdrop={false}>
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-field">
                    <label htmlFor="sr-advance">Advance Listing</label>
                    <select id="sr-advance" className="dp-select" value={form.advance_listing ? form.visit_type : ''} onChange={(e) => changeAdvance(e.target.value)}>
                        <option value="">No, normal request</option>
                        {advanceChoices.map((s) => {
                            const asked = requested.advanceServices.has(s.visit_type);
                            return <option key={s.visit_type} value={s.visit_type} disabled={asked}>Yes, {s.visit_type} ({s.waiting} waiting){asked ? ' - already requested' : ''}</option>;
                        })}
                        {form.advance_listing && !advanceChoices.some((s) => s.visit_type === form.visit_type) && <option value={form.visit_type}>Yes, {form.visit_type}</option>}
                    </select>
                </div>
                <div className="dp-row">
                    <div className="dp-field">
                        <label htmlFor="sr-category">Check-up service</label>
                        <select id="sr-category" className="dp-select" value={form.visit_type} disabled={!!form.advance_listing} onChange={(e) => changeCategory(e.target.value)}>
                            <option value="Any">Any check-up</option>
                            {visitTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="dp-field">
                        <label htmlFor="sr-doctor">Doctor</label>
                        <select id="sr-doctor" className="dp-select" value={form.doctor_id} onChange={(e) => changeDoctor(e.target.value)}>
                            <option value="">-- Select doctor --</option>
                            {choices.map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name} ({d.specialization})</option>)}
                        </select>
                    </div>
                </div>
                {form.doctor_id && (
                    <fieldset className="dp-field" style={{ border: 0, padding: 0, margin: 0 }}>
                        <legend className="dp-label">Follow-ups waiting for a schedule</legend>
                        {repeatChoices.length === 0 ? (
                            <small className="dp-hint">No follow-ups waiting.</small>
                        ) : (
                            <>
                                <small className="dp-hint">Tick students to put first in this schedule.</small>
                                <div style={{ maxHeight: '10rem', overflowY: 'auto', display: 'grid', gap: '0.25rem', marginTop: '0.25rem' }}>
                                    {repeatChoices.map((r) => (
                                        <label key={repeatKey(r)} className="dp-check">
                                            <input type="checkbox" disabled={isRequested(r)} checked={pickedRepeats.includes(repeatKey(r))} onChange={() => toggleRepeat(repeatKey(r))} />
                                            {r.student_first_name} {r.student_last_name} ({r.student_id}) - {r.visit_type}{r.follow_up_date ? `, around ${formatDate(r.follow_up_date)}` : ''}
                                            {isRequested(r) ? ' - already in a pending request' : ''}
                                        </label>
                                    ))}
                                </div>
                                {freeRepeats.length > 0 && (
                                    <button
                                        type="button" className="dp-btn dp-btn-ghost" style={{ marginTop: '0.25rem' }}
                                        onClick={() => setPickedRepeats(pickedRepeats.length === freeRepeats.length ? [] : freeRepeats.map(repeatKey))}
                                    >{pickedRepeats.length === freeRepeats.length ? 'Clear all' : 'Select all'} ({pickedRepeats.length} of {freeRepeats.length} picked)</button>
                                )}
                            </>
                        )}
                    </fieldset>
                )}
                <div className="dp-row">
                    <div className="dp-field">
                        <label htmlFor="sr-date">Preferred date (optional)</label>
                        <input id="sr-date" className="dp-input" type="date" min={todayKey()} value={form.preferred_date || ''} onChange={(e) => set({ preferred_date: e.target.value })} />
                    </div>
                </div>
                <div className="dp-row">
                    <TimeRangeFields
                        idPrefix="sr" required={false} startLabel="From" endLabel="To"
                        start={form.preferred_start} end={form.preferred_end} minStart={minTimeFor(form.preferred_date)}
                        onChange={(preferred_start, preferred_end) => set({ preferred_start, preferred_end })}
                    />
                </div>
                <div className="dp-field">
                    <label htmlFor="sr-note">Note for the doctor (optional)</label>
                    <textarea id="sr-note" className="dp-textarea" rows={2} maxLength={255} value={form.note || ''} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. 12 students are waiting for a check-up" />
                </div>
                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Sending...' : 'Send'}</button>
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
    const [statusFilter, setStatusFilter] = useState('Pending');
    const [page, setPage] = useState(1);
    const [refreshing, setRefreshing] = useState(false);
    useEffect(() => { setPage(1); }, [statusFilter]);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/schedule-requests${fixedDoctorId ? `?doctor_id=${encodeURIComponent(fixedDoctorId)}` : ''}`);
            const data = await res.json();
            if (data.success) setRequests(data.requests);
        } catch (e) { /* the strip is a convenience */ }
    }, [fixedDoctorId]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

    const visible = useMemo(() => requests.filter((r) => statusFilter === 'All' || r.status === statusFilter), [requests, statusFilter]);
    // the doctor keeps the section (and its refresh button) even when no request came yet
    if (requests.length === 0 && role !== 'doctor') return null;
    const paged = paginate(visible, page, REQUESTS_PER_PAGE);

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
                <button type="button" className="icon-btn-ds" title="Refresh" aria-label="Refresh the schedule requests" disabled={refreshing} onClick={refresh}><RefreshCw size={15} aria-hidden="true" /></button>
                <div className="chip-filter-ds" role="group" aria-label="Schedule request status">
                    {REQUEST_FILTERS.map(([value, label]) => (
                        <button key={value} type="button" className={statusFilter === value ? 'active-ds' : ''} aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{label}</button>
                    ))}
                </div>
            </header>
            {visible.length === 0 ? (
                <div className="group-empty-ds">{statusFilter === 'Pending' ? 'No pending schedule requests.' : statusFilter === 'All' ? 'No schedule requests.' : `No ${statusFilter.toLowerCase()} schedule requests.`}</div>
            ) : (
            <div className="table-card-dv group-table-ds">
                <table className="sti-table-dv">
                    <thead><tr><th>{role === 'doctor' ? 'From' : 'Doctor'}</th><th>Check-up service</th><th>Preferred</th><th>Note</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        {paged.items.map((r) => (
                            <tr key={r.schedule_request_id}>
                                <td>{role === 'doctor' ? (r.nurse_first_name ? `${r.nurse_first_name} ${r.nurse_last_name} (nurse)` : 'The clinic') : `Dr. ${r.doc_first_name} ${r.doc_last_name}`}</td>
                                <td>
                                    {r.visit_type === 'Any' ? 'Any check-up' : r.visit_type}
                                    {Number(r.repeat_count) > 0 && <div className="muted-ds">Follow-ups first: {r.repeat_count} student(s)</div>}
                                    {!!r.for_advance && <div className="muted-ds">Advance Listing <span className="paren-sc">(No Schedule Yet)</span>{r.advance_count ? `: ${r.advance_count} student(s)` : ''}</div>}
                                </td>
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
                <Pager page={paged.page} pageCount={paged.pageCount} total={paged.total} pageSize={REQUESTS_PER_PAGE} onPage={setPage} noun="requests" />
            </div>
            )}
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
    ...(r.for_advance ? { advance_count: Number(r.advance_count) || 0 } : {}),
    ...(Number(r.repeat_count) > 0 ? { repeat_count: Number(r.repeat_count) } : {}),
    ...(r.preferred_date ? { schedule_date: String(r.preferred_date).slice(0, 10) } : {}),
    ...(r.preferred_start ? { start_time: hhmm(r.preferred_start) } : {}),
    ...(r.preferred_end ? { end_time: hhmm(r.preferred_end) } : {})
});

export default ScheduleRequests;
