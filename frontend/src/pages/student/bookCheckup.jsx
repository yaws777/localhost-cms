// bookCheckup.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CalendarPlus, CalendarClock, MapPin, Stethoscope, X, Clock, Info, Megaphone, ClipboardPlus } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime, formatDateTime } from '../../utils/datetime';
import { PURPOSES, visitLabel } from '../../utils/visitPurpose';
import '../../styles/student/BookCheckup.css';

const API = 'http://localhost:3001';

const BOOKABLE_TYPES = PURPOSES;

const to12h = (t) => {
    if (!t) return '';
    const [h, m] = String(t).split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const statusLabel = (b) => {
    if (b.status === 'Scheduled') return b.booking_source === 'Student' ? 'Confirmed' : 'Scheduled';
    return b.status;
};

const EMPTY_REQUEST = { visit_type: 'General Check Up', purpose_other: '', reason: '', preferred_note: '' };

const statusClass = (status) => `status-${String(status).toLowerCase().replace(/\s+/g, '-')}-bc`;

const BookCheckup = () => {
    const { studentId } = useOutletContext() || {};
    const { showAlert, showConfirm } = useAlert();

    const [bookings, setBookings] = useState([]);
    const [occurrences, setOccurrences] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [visitType, setVisitType] = useState('');
    const [doctorFilter, setDoctorFilter] = useState('');

    // slot picker: { mode: 'book' | 'reschedule', occurrence, booking? }
    const [picker, setPicker] = useState(null);
    const [slots, setSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [reason, setReason] = useState('');
    const [bookVisitType, setBookVisitType] = useState('General Check Up');
    const [purposeOther, setPurposeOther] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // consultation requests (waiting list) and the clinic's announcements
    const [requests, setRequests] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [showRequest, setShowRequest] = useState(false);
    const [requestForm, setRequestForm] = useState(EMPTY_REQUEST);

    const fetchRequests = useCallback(async () => {
        if (!studentId) return;
        try {
            const res = await fetch(`${API}/api/student/${studentId}/consultation-requests`);
            const data = await res.json();
            if (data.success) setRequests(data.requests);
        } catch (e) {
            showAlert('Could not load your consultation requests.', 'error');
        }
    }, [studentId, showAlert]);

    const fetchAnnouncements = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/doctor-schedules/announcements`);
            const data = await res.json();
            if (data.success) setAnnouncements(data.announcements);
        } catch (e) { /* announcements are optional */ }
    }, []);

    useEffect(() => { fetchRequests(); fetchAnnouncements(); }, [fetchRequests, fetchAnnouncements]);

    const sendRequest = async (e) => {
        e.preventDefault();
        if (!requestForm.reason.trim()) { showAlert('Please tell the clinic why you need a consultation.', 'warning'); return; }
        if (requestForm.visit_type === 'Other' && !requestForm.purpose_other.trim()) { showAlert('Please specify the purpose of your consultation.', 'warning'); return; }
        setSubmitting(true);
        try {
            const res = await fetch(`${API}/api/student/consultation-requests`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: studentId, ...requestForm, purpose_other: requestForm.visit_type === 'Other' ? requestForm.purpose_other : undefined })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); setShowRequest(false); setRequestForm(EMPTY_REQUEST); fetchRequests(); }
            else showAlert(data.message || 'Could not send the request.', 'error');
        } catch (err) {
            showAlert('Server error. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const answerReconfirm = async (r, response) => {
        if (response === 'No') {
            const ok = await showConfirm('Tell the clinic you are no longer interested? Your request will be withdrawn.', { danger: true, confirmLabel: 'Not interested', cancelLabel: 'Back', title: 'Withdraw request' });
            if (!ok) return;
        }
        try {
            const res = await fetch(`${API}/api/student/consultation-requests/${r.request_id}/reconfirm`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId, response })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); fetchRequests(); }
            else showAlert(data.message || 'Could not send your answer.', 'error');
        } catch (err) {
            showAlert('Server error. Please try again.', 'error');
        }
    };

    const withdrawRequest = async (r) => {
        const ok = await showConfirm(`Withdraw your ${visitLabel(r.visit_type, r.purpose_other)} consultation request?`, { danger: true, confirmLabel: 'Withdraw', cancelLabel: 'Keep it', title: 'Withdraw request' });
        if (!ok) return;
        try {
            const res = await fetch(`${API}/api/student/consultation-requests/${r.request_id}/withdraw`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); fetchRequests(); }
            else showAlert(data.message || 'Could not withdraw the request.', 'error');
        } catch (err) {
            showAlert('Server error. Please try again.', 'error');
        }
    };

    const requestHelp = (r) => {
        if (r.status === 'Waiting for Approval') return 'The nurse or doctor is reviewing your request.';
        if (r.status === 'Denied') return r.review_reason ? `Denied: ${r.review_reason}` : 'The clinic denied this request.';
        if (r.status === 'Waiting List') {
            return r.notified_schedule_id && r.last_notified_at
                ? `You are on the waiting list. Last notice: Dr. ${r.notified_doc_first_name} ${r.notified_doc_last_name}, ${formatDate(r.notified_date)}, ${to12h(r.notified_start_time)} - ${to12h(r.notified_end_time)}${r.notified_schedule_type === 'Walk-in' ? ' (walk-in, no booking needed)' : r.notified_schedule_type === 'Open Slot' ? ' (book a time below)' : ''}.`
                : 'Approved. You are on the waiting list and will be notified when a doctor has a schedule.';
        }
        if (r.status === 'Awaiting Reconfirmation') {
            return `Dr. ${r.notified_doc_first_name} ${r.notified_doc_last_name} will hold appointments on ${formatDate(r.notified_date)}, ${to12h(r.notified_start_time)} - ${to12h(r.notified_end_time)}${r.notified_location ? ` (${r.notified_location})` : ''}. Are you still interested?`;
        }
        if (r.status === 'Reconfirmed') return 'Thanks for confirming. The clinic will appoint you a time and notify you.';
        if (['Appointed', 'Booked', 'Fulfilled'].includes(r.status) && r.appointment_start) {
            return `${r.status === 'Fulfilled' ? 'Seen' : r.status}: ${formatDateTime(r.appointment_start)} with Dr. ${r.appt_doc_first_name} ${r.appt_doc_last_name}.`;
        }
        if (r.status === 'Withdrawn') return 'You withdrew this request.';
        return '';
    };

    const openRequests = requests.filter((r) => !['Denied', 'Withdrawn', 'Appointed', 'Booked', 'Fulfilled'].includes(r.status) || (['Appointed', 'Booked'].includes(r.status) && r.appointment_start && new Date(String(r.appointment_end).replace(' ', 'T')) >= new Date()));
    const pastRequests = requests.filter((r) => !openRequests.includes(r));

    const fetchBookings = useCallback(async () => {
        if (!studentId) return;
        try {
            const res = await fetch(`${API}/api/student/${studentId}/doctor-bookings`);
            const data = await res.json();
            if (data.success) setBookings(data.bookings);
        } catch (e) {
            showAlert('Could not load your bookings.', 'error');
        }
    }, [studentId, showAlert]);

    const fetchOccurrences = useCallback(async () => {
        if (!studentId) return;
        setLoadingSlots(true);
        try {
            const qs = new URLSearchParams({ student_id: studentId });
            if (visitType) qs.set('visit_type', visitType);
            const res = await fetch(`${API}/api/doctor-schedules/open?${qs.toString()}`);
            const data = await res.json();
            if (data.success) setOccurrences(data.occurrences);
        } catch (e) {
            showAlert('Could not load available doctor schedules.', 'error');
        } finally {
            setLoadingSlots(false);
        }
    }, [studentId, visitType, showAlert]);

    useEffect(() => { fetchBookings(); }, [fetchBookings]);
    useEffect(() => { fetchOccurrences(); }, [fetchOccurrences]);

    const doctorOptions = useMemo(() => {
        const map = new Map();
        occurrences.forEach(o => map.set(o.doctor_id, `${o.doctor_name} (${o.specialization})`));
        return [...map.entries()];
    }, [occurrences]);

    const visibleOccurrences = useMemo(
        () => occurrences.filter(o => !doctorFilter || o.doctor_id === doctorFilter),
        [occurrences, doctorFilter]
    );

    const upcoming = bookings.filter(b => new Date(b.end_time.replace(' ', 'T')) >= new Date() && ['Scheduled', 'Waiting for Approval'].includes(b.status));
    const history = bookings.filter(b => !upcoming.includes(b));

    const loadSlots = useCallback(async (occurrence) => {
        setSlotsLoading(true);
        setSelectedSlot('');
        try {
            const res = await fetch(`${API}/api/doctor-schedules/${occurrence.schedule_id}/slots?date=${occurrence.date}&student_id=${studentId}`);
            const data = await res.json();
            setSlots(data.success ? data.slots : []);
        } catch (e) {
            showAlert('Could not load the time slots.', 'error');
            setSlots([]);
        } finally {
            setSlotsLoading(false);
        }
    }, [studentId, showAlert]);

    const openBook = (occurrence) => {
        setPicker({ mode: 'book', occurrence });
        setReason('');
        setBookVisitType(occurrence.visit_type === 'Any' ? 'General Check Up' : occurrence.visit_type);
        setPurposeOther('');
        loadSlots(occurrence);
    };

    const openReschedule = async (booking) => {
        // other open days of the same schedule
        const same = occurrences.filter(o => o.schedule_id === booking.schedule_id);
        if (same.length === 0) {
            showAlert('There are no other open days for this doctor schedule. You can cancel this booking and book another doctor.', 'warning');
            return;
        }
        setPicker({ mode: 'reschedule', occurrence: same[0], options: same, booking });
        loadSlots(same[0]);
    };

    const closePicker = () => { setPicker(null); setSlots([]); setSelectedSlot(''); };

    const submit = async () => {
        if (!selectedSlot) { showAlert('Please pick a time slot.', 'warning'); return; }
        if (picker.mode === 'book' && !reason.trim()) { showAlert('Please tell the clinic why you need a check-up.', 'warning'); return; }
        if (picker.mode === 'book' && bookVisitType === 'Other' && !purposeOther.trim()) { showAlert('Please specify the purpose of your visit.', 'warning'); return; }
        setSubmitting(true);
        try {
            let res;
            if (picker.mode === 'book') {
                res = await fetch(`${API}/api/student/doctor-bookings`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ student_id: studentId, schedule_id: picker.occurrence.schedule_id, slot_start: selectedSlot, reason, visit_type: bookVisitType, purpose_other: bookVisitType === 'Other' ? purposeOther : undefined })
                });
            } else {
                res = await fetch(`${API}/api/student/doctor-bookings/${picker.booking.appointment_id}/reschedule`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ student_id: studentId, slot_start: selectedSlot })
                });
            }
            const data = await res.json();
            if (data.success) {
                showAlert(data.message, 'success');
                closePicker();
                fetchBookings();
                fetchOccurrences();
                fetchRequests();
            } else {
                showAlert(data.message || 'Could not complete the booking.', 'error');
                if (res.status === 409) loadSlots(picker.occurrence);
            }
        } catch (e) {
            showAlert('Server error. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const cancelBooking = async (b) => {
        const ok = await showConfirm(`Cancel your ${visitLabel(b.visit_type, b.purpose_other)} on ${formatDate(b.start_time)} at ${formatTime(b.start_time)}?`, { danger: true, confirmLabel: 'Cancel booking', cancelLabel: 'Keep it', title: 'Cancel booking' });
        if (!ok) return;
        try {
            const res = await fetch(`${API}/api/student/doctor-bookings/${b.appointment_id}/cancel`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId })
            });
            const data = await res.json();
            if (data.success) { showAlert('Booking cancelled.', 'success'); fetchBookings(); fetchOccurrences(); }
            else showAlert(data.message || 'Could not cancel the booking.', 'error');
        } catch (e) {
            showAlert('Server error. Please try again.', 'error');
        }
    };

    const renderBooking = (b) => (
        <div key={b.appointment_id} className="booking-card-bc">
            <div className="booking-top-bc">
                <strong>{visitLabel(b.visit_type, b.purpose_other)}</strong>
                <span className={`status-pill-bc ${statusClass(b.status)}`}>{statusLabel(b)}</span>
            </div>
            <div className="booking-line-bc"><Stethoscope size={14} /> Dr. {b.doc_first_name} {b.doc_last_name} ({b.specialization})</div>
            <div className="booking-line-bc"><Clock size={14} /> {formatDate(b.start_time)}, {formatTime(b.start_time)} - {formatTime(b.end_time)}</div>
            {b.location && <div className="booking-line-bc"><MapPin size={14} /> {b.location}</div>}
            {b.booking_reason && <div className="booking-reason-bc">Reason: {b.booking_reason}</div>}
            {b.decline_reason && ['Declined', 'Cancelled'].includes(b.status) && <div className="booking-note-bc"><Info size={14} /> {b.decline_reason}</div>}
            {Number(b.can_change) === 1 && (
                <div className="booking-actions-bc">
                    <button className="btn-bc btn-light-bc" onClick={() => openReschedule(b)}>Reschedule</button>
                    <button className="btn-bc btn-danger-bc" onClick={() => cancelBooking(b)}>Cancel</button>
                </div>
            )}
        </div>
    );

    return (
        <div className="container-bc">
            <div className="header-bc">
                <div>
                    <h2><CalendarPlus size={22} /> Book a Check-up</h2>
                    <p>Reserve a time slot in a schedule the clinic has opened, or send a consultation request if there is no schedule yet. The nurse or doctor reviews every request.</p>
                    <div className="header-actions-bc">
                        <button type="button" className="btn-bc btn-primary-bc" onClick={() => { setRequestForm(EMPTY_REQUEST); setShowRequest(true); }}>
                            <ClipboardPlus size={16} /> Request a consultation
                        </button>
                    </div>
                </div>
            </div>

            <section className="section-bc">
                <h3>My Consultation Requests</h3>
                {openRequests.length === 0 ? (
                    <div className="empty-bc">You have no open consultation request. If no schedule suits you, send a request and the clinic will put you on the waiting list.</div>
                ) : (
                    <div className="booking-grid-bc">
                        {openRequests.map(r => (
                            <div key={r.request_id} className={`booking-card-bc request-card-bc ${r.status === 'Awaiting Reconfirmation' ? 'attention-bc' : ''}`}>
                                <div className="booking-top-bc">
                                    <strong>{visitLabel(r.visit_type, r.purpose_other)}</strong>
                                    <span className={`status-pill-bc ${statusClass(r.status)}`}>{r.status}</span>
                                </div>
                                <div className="booking-reason-bc">Reason: {r.reason}</div>
                                <div className="booking-line-bc"><Clock size={14} /> Sent {formatDate(r.created_at)}</div>
                                <p className="request-help-bc">{requestHelp(r)}</p>
                                <div className="booking-actions-bc">
                                    {r.status === 'Awaiting Reconfirmation' && (
                                        <>
                                            <button className="btn-bc btn-primary-bc" onClick={() => answerReconfirm(r, 'Yes')}>Yes, I'm still interested</button>
                                            <button className="btn-bc btn-light-bc" onClick={() => answerReconfirm(r, 'No')}>Not anymore</button>
                                        </>
                                    )}
                                    {Number(r.can_withdraw) === 1 && r.status !== 'Awaiting Reconfirmation' && (
                                        <button className="btn-bc btn-danger-bc" onClick={() => withdrawRequest(r)}>Withdraw</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {pastRequests.length > 0 && (
                    <details className="history-bc">
                        <summary>Earlier requests ({pastRequests.length})</summary>
                        <div className="booking-grid-bc">
                            {pastRequests.map(r => (
                                <div key={r.request_id} className="booking-card-bc request-card-bc">
                                    <div className="booking-top-bc">
                                        <strong>{visitLabel(r.visit_type, r.purpose_other)}</strong>
                                        <span className={`status-pill-bc ${statusClass(r.status)}`}>{r.status}</span>
                                    </div>
                                    <div className="booking-reason-bc">Reason: {r.reason}</div>
                                    <p className="request-help-bc">{requestHelp(r)}</p>
                                </div>
                            ))}
                        </div>
                    </details>
                )}
            </section>

            {announcements.length > 0 && (
                <section className="section-bc">
                    <h3><Megaphone size={18} style={{ verticalAlign: 'middle' }} /> Clinic announcements</h3>
                    <div className="booking-grid-bc">
                        {announcements.slice(0, 8).map(a => (
                            <div key={`${a.schedule_id}-${a.date}`} className={`booking-card-bc announce-bc ${a.schedule_type === 'Appointment' ? 'appointment-bc' : ''}`}>
                                <div className="booking-top-bc">
                                    <strong>{a.schedule_type === 'Walk-in' ? 'Walk-in consultation' : 'Consultation by appointment'}</strong>
                                    <span className="tag-bc">{a.visit_type === 'Any' ? 'Any visit' : a.visit_type}</span>
                                </div>
                                <div className="booking-line-bc"><Stethoscope size={14} /> {a.doctor_name} ({a.specialization})</div>
                                <div className="booking-line-bc"><Clock size={14} /> {formatDate(a.date)}, {to12h(a.start_time)} - {to12h(a.end_time)}</div>
                                {a.location && <div className="booking-line-bc"><MapPin size={14} /> {a.location}</div>}
                                <p className="request-help-bc">
                                    {a.announcement || (a.schedule_type === 'Walk-in' ? 'No booking needed. Just come to the clinic during these hours.' : 'Send a consultation request. The clinic will appoint you a time.')}
                                </p>
                                {a.notes && <div className="muted-bc">{a.notes}</div>}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="section-bc">
                <h3>My Bookings</h3>
                {upcoming.length === 0 ? (
                    <div className="empty-bc">You have no upcoming bookings.</div>
                ) : (
                    <div className="booking-grid-bc">{upcoming.map(renderBooking)}</div>
                )}
                {history.length > 0 && (
                    <details className="history-bc">
                        <summary>Past and cancelled bookings ({history.length})</summary>
                        <div className="booking-grid-bc">{history.map(renderBooking)}</div>
                    </details>
                )}
            </section>

            <section className="section-bc">
                <h3>Available Schedules</h3>
                <div className="filters-bc">
                    <select value={visitType} onChange={e => setVisitType(e.target.value)} aria-label="Visit type">
                        <option value="">All visit types</option>
                        {BOOKABLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} aria-label="Doctor">
                        <option value="">All doctors</option>
                        {doctorOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                </div>

                {loadingSlots ? (
                    <div className="empty-bc">Loading available schedules...</div>
                ) : visibleOccurrences.length === 0 ? (
                    <div className="empty-bc">
                        <CalendarClock size={28} />
                        <p>No open doctor schedules right now. The clinic has not set one up yet, or all slots are taken. Please check back later.</p>
                    </div>
                ) : (
                    <div className="occurrence-grid-bc">
                        {visibleOccurrences.map(o => (
                            <div key={`${o.schedule_id}-${o.date}`} className="occurrence-card-bc">
                                <div className="occurrence-date-bc">{formatDate(o.date)}</div>
                                <div className="occurrence-doc-bc"><Stethoscope size={14} /> {o.doctor_name}</div>
                                <div className="muted-bc">{o.specialization}</div>
                                <div className="occurrence-meta-bc"><Clock size={14} /> {to12h(o.start_time)} - {to12h(o.end_time)}</div>
                                {o.location && <div className="occurrence-meta-bc"><MapPin size={14} /> {o.location}</div>}
                                <div className="occurrence-tags-bc">
                                    <span className="tag-bc">{o.visit_type === 'Any' ? 'Any visit type' : o.visit_type}</span>
                                    <span className="tag-bc tag-soft-bc">{o.open_slots} of {o.total_slots} slots open</span>
                                    <span className="tag-bc tag-soft-bc">{o.auto_confirm ? 'Instant confirmation' : 'Needs approval'}</span>
                                </div>
                                {o.notes && <div className="muted-bc">{o.notes}</div>}
                                <button className="btn-bc btn-primary-bc" onClick={() => openBook(o)}>Choose a time</button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {showRequest && (
                <div className="modal-overlay-bc" role="dialog" aria-modal="true">
                    <form className="modal-bc" onSubmit={sendRequest}>
                        <div className="modal-header-bc">
                            <h3>Request a consultation</h3>
                            <button type="button" className="close-bc" onClick={() => setShowRequest(false)} aria-label="Close"><X size={20} /></button>
                        </div>
                        <p className="request-help-bc" style={{ marginBottom: 12 }}>
                            Use this when no schedule fits you. The nurse or doctor reviews your request. If approved, you join the waiting list and are notified when a doctor has a schedule.
                        </p>
                        <div className="field-bc">
                            <label>Purpose of the consultation</label>
                            <select value={requestForm.visit_type} onChange={e => setRequestForm({ ...requestForm, visit_type: e.target.value })}>
                                {BOOKABLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        {requestForm.visit_type === 'Other' && (
                            <div className="field-bc">
                                <label>Please specify</label>
                                <input type="text" maxLength={150} value={requestForm.purpose_other} onChange={e => setRequestForm({ ...requestForm, purpose_other: e.target.value })} placeholder="e.g. Counselling, wound check" />
                            </div>
                        )}
                        <div className="field-bc">
                            <label>Reason for the consultation</label>
                            <textarea rows="3" maxLength={255} required value={requestForm.reason} onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })} placeholder="e.g. Toothache for 2 days, or I need a yearly check-up" />
                        </div>
                        <div className="field-bc">
                            <label>Preferred days or times (optional)</label>
                            <input type="text" maxLength={255} value={requestForm.preferred_note} onChange={e => setRequestForm({ ...requestForm, preferred_note: e.target.value })} placeholder="e.g. Free on Tuesday and Thursday mornings" />
                        </div>
                        <div className="modal-footer-bc">
                            <button type="button" className="btn-bc btn-light-bc" onClick={() => setShowRequest(false)}>Close</button>
                            <button type="submit" className="btn-bc btn-primary-bc" disabled={submitting}>{submitting ? 'Sending...' : 'Send request'}</button>
                        </div>
                    </form>
                </div>
            )}

            {picker && (
                <div className="modal-overlay-bc" role="dialog" aria-modal="true">
                    <div className="modal-bc">
                        <div className="modal-header-bc">
                            <h3>{picker.mode === 'book' ? 'Pick a time slot' : 'Reschedule booking'}</h3>
                            <button className="close-bc" onClick={closePicker} aria-label="Close"><X size={20} /></button>
                        </div>

                        {picker.mode === 'reschedule' && picker.options.length > 1 && (
                            <div className="field-bc">
                                <label>Day</label>
                                <select
                                    value={picker.occurrence.date}
                                    onChange={e => {
                                        const next = picker.options.find(o => o.date === e.target.value);
                                        setPicker({ ...picker, occurrence: next });
                                        loadSlots(next);
                                    }}
                                >
                                    {picker.options.map(o => <option key={o.date} value={o.date}>{formatDate(o.date)}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="picker-summary-bc">
                            <strong>{picker.occurrence.doctor_name}</strong> - {formatDate(picker.occurrence.date)}
                            {picker.occurrence.location ? ` - ${picker.occurrence.location}` : ''}
                        </div>

                        {slotsLoading ? (
                            <div className="empty-bc">Loading slots...</div>
                        ) : (
                            <div className="slot-grid-bc">
                                {slots.map(s => (
                                    <button
                                        key={s.start_time}
                                        type="button"
                                        disabled={!s.available}
                                        className={`slot-bc ${selectedSlot === s.start_time ? 'slot-selected-bc' : ''}`}
                                        onClick={() => setSelectedSlot(s.start_time)}
                                        title={s.mine ? 'You already have an appointment at this time' : s.past ? 'This time has passed' : !s.available ? 'Fully booked' : 'Available'}
                                    >
                                        {to12h(s.start_time.slice(11))}
                                        <small>{s.mine ? 'Yours' : s.past ? 'Passed' : s.available ? `${s.capacity - s.booked} left` : 'Full'}</small>
                                    </button>
                                ))}
                            </div>
                        )}

                        {picker.mode === 'book' && (
                            <>
                                {picker.occurrence.visit_type === 'Any' && (
                                    <div className="field-bc">
                                        <label>Purpose of the visit</label>
                                        <select value={bookVisitType} onChange={e => setBookVisitType(e.target.value)}>
                                            {BOOKABLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                )}
                                {bookVisitType === 'Other' && (
                                    <div className="field-bc">
                                        <label>Please specify</label>
                                        <input type="text" maxLength={150} value={purposeOther} onChange={e => setPurposeOther(e.target.value)} placeholder="e.g. Counselling, wound check" />
                                    </div>
                                )}
                                <div className="field-bc">
                                    <label>Reason for the check-up</label>
                                    <textarea rows="3" maxLength={255} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Toothache for 2 days, or yearly check-up" />
                                </div>
                            </>
                        )}

                        <div className="modal-footer-bc">
                            <button className="btn-bc btn-light-bc" onClick={closePicker}>Close</button>
                            <button className="btn-bc btn-primary-bc" disabled={submitting || !selectedSlot} onClick={submit}>
                                {submitting ? 'Saving...' : picker.mode === 'book' ? (picker.occurrence.auto_confirm ? 'Book now' : 'Send request') : 'Move booking'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookCheckup;
