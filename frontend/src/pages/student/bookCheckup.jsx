// bookCheckup.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CalendarPlus, CalendarClock, MapPin, Stethoscope, X, Clock, Info, ClipboardPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime, formatDateTime } from '../../utils/datetime';
import { visitLabel, sourceLabel, reasonPlaceholder } from '../../utils/visitPurpose';
import { MONTHS, WEEKDAYS, dateKey, todayKey, parseDay, dayLabel, doctorOffers } from '../../utils/scheduling';
import { useSpecializations } from '../../hooks/useSpecializations';
import '../../styles/student/BookCheckup.css';

const API = 'http://localhost:3001';

const to12h = (t) => {
    if (!t) return '';
    const [h, m] = String(t).split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const statusLabel = (b) => {
    if (b.status === 'Scheduled') return b.booking_source === 'Student' ? 'Confirmed' : 'Scheduled';
    return b.status;
};

const EMPTY_REQUEST = { visit_type: '', reason: '', preferred_note: '' };

// The four kinds of update the calendar shows, in the order a day lists them
const KINDS = {
    request: { label: 'My consultation requests', short: 'Request' },
    booking: { label: 'My bookings', short: 'Booking' },
    announce: { label: 'Clinic announcements', short: 'Announcement' },
    available: { label: 'Available schedules', short: 'Open' }
};
const KIND_KEYS = Object.keys(KINDS);

const dayOf = (value) => (value ? String(value).slice(0, 10) : '');

// A request is open until the clinic answers it, or until the appointment it led to has passed
const isOpenRequest = (r) => !['Denied', 'Withdrawn', 'Appointed', 'Booked', 'Fulfilled'].includes(r.status)
    || (['Appointed', 'Booked'].includes(r.status) && r.appointment_start && new Date(String(r.appointment_end).replace(' ', 'T')) >= new Date());

// Where a request sits on the calendar: its appointment, else today while it is still open, else the day it was sent
const requestDay = (r) => {
    if (['Appointed', 'Booked', 'Fulfilled'].includes(r.status) && r.appointment_start) return dayOf(r.appointment_start);
    return isOpenRequest(r) ? todayKey() : dayOf(r.created_at);
};

const statusClass = (status) => `status-${String(status).toLowerCase().replace(/\s+/g, '-')}-bc`;

const BookCheckup = () => {
    const { studentId } = useOutletContext() || {};
    const { showAlert, showConfirm } = useAlert();
    // the purposes come from the specializations: every specialization adds its own visit type
    const { visitTypes } = useSpecializations();

    // only the purposes a doctor with a login account actually covers can be picked
    const [doctors, setDoctors] = useState([]);
    const [doctorsLoaded, setDoctorsLoaded] = useState(false);
    const purposes = useMemo(
        () => visitTypes.filter((t) => doctors.some((d) => d.user_id && doctorOffers(d, t))),
        [visitTypes, doctors]
    );

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
    const [submitting, setSubmitting] = useState(false);

    // consultation requests (waiting list) and the clinic's announcements
    const [requests, setRequests] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [showRequest, setShowRequest] = useState(false);
    const [requestForm, setRequestForm] = useState(EMPTY_REQUEST);

    // the calendar: which kinds of update are shown, the month on screen and the day opened in the side panel
    const [kinds, setKinds] = useState({ request: true, booking: true, announce: true, available: true });
    const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const [selected, setSelected] = useState(todayKey());

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API}/api/doctors`);
                const data = await res.json();
                if (data.success) setDoctors(data.doctors);
            } catch (e) { /* the purpose list stays empty and the form says so */ }
            finally { setDoctorsLoaded(true); }
        })();
    }, []);

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
        if (!requestForm.visit_type) { showAlert('Please select the purpose of the consultation.', 'warning'); return; }
        if (!requestForm.reason.trim()) { showAlert('Please tell the clinic why you need a consultation.', 'warning'); return; }
        setSubmitting(true);
        try {
            const res = await fetch(`${API}/api/student/consultation-requests`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: studentId, ...requestForm })
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
            return 'Approved. You are on the waiting list. Stay active: when a doctor has a schedule, the school nurse will send you a reconfirmation here and in your notifications. Only students who reconfirm can be appointed.';
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

    const openRequests = requests.filter(isOpenRequest);

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

    // ---- calendar data: every update lands on a day ----
    const events = useMemo(() => {
        const list = [];
        requests.forEach((r) => list.push({ kind: 'request', date: requestDay(r), key: `r-${r.request_id}`, item: r }));
        bookings.forEach((b) => list.push({ kind: 'booking', date: dayOf(b.start_time), key: `b-${b.appointment_id}`, item: b }));
        announcements.forEach((a) => list.push({ kind: 'announce', date: dayOf(a.date), key: `a-${a.schedule_id}-${a.date}`, item: a }));
        visibleOccurrences.forEach((o) => list.push({ kind: 'available', date: dayOf(o.date), key: `o-${o.schedule_id}-${o.date}`, item: o }));
        return list.filter((ev) => ev.date);
    }, [requests, bookings, announcements, visibleOccurrences]);

    const kindCount = useMemo(() => {
        const counts = { request: 0, booking: 0, announce: 0, available: 0 };
        events.forEach((ev) => { counts[ev.kind] += 1; });
        return counts;
    }, [events]);

    const eventsByDay = useMemo(() => {
        const map = {};
        events.filter((ev) => kinds[ev.kind]).forEach((ev) => { (map[ev.date] = map[ev.date] || []).push(ev); });
        Object.values(map).forEach((list) => list.sort((a, b) => KIND_KEYS.indexOf(a.kind) - KIND_KEYS.indexOf(b.kind)));
        return map;
    }, [events, kinds]);

    // the month grid always starts on a Sunday and shows six weeks
    const gridDays = useMemo(() => {
        const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const start = new Date(first);
        start.setDate(first.getDate() - first.getDay());
        return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return dateKey(d); });
    }, [cursor]);

    const today = todayKey();
    const goMonth = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
    const jumpToday = () => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(todayKey()); };
    const toggleKind = (k) => setKinds((prev) => ({ ...prev, [k]: !prev[k] }));
    const dayEvents = eventsByDay[selected] || [];
    const awaitingAnswer = requests.filter((r) => r.status === 'Awaiting Reconfirmation').length;

    // when a booking is being moved, its own appointment must not block the slots of the schedule it already holds
    const loadSlots = useCallback(async (occurrence, movingId = '') => {
        setSlotsLoading(true);
        setSelectedSlot('');
        try {
            const res = await fetch(`${API}/api/doctor-schedules/${occurrence.schedule_id}/slots?date=${occurrence.date}&student_id=${studentId}${movingId ? `&exclude_appointment_id=${movingId}` : ''}`);
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
        // the student states the purpose; a block that is for one purpose only already fixes it, otherwise nothing is pre-selected
        setBookVisitType(visitTypes.includes(occurrence.visit_type) ? occurrence.visit_type : '');
        loadSlots(occurrence);
    };

    const openReschedule = async (booking) => {
        // the day the student already holds no longer shows as open (one active booking per schedule), so it is added back here
        const same = occurrences.filter(o => o.schedule_id === booking.schedule_id && o.date !== dayOf(booking.start_time));
        same.unshift({
            schedule_id: booking.schedule_id, date: dayOf(booking.start_time), doctor_name: `Dr. ${booking.doc_first_name} ${booking.doc_last_name}`, location: booking.location
        });
        setPicker({ mode: 'reschedule', occurrence: same[0], options: same, booking });
        loadSlots(same[0], booking.appointment_id);
    };

    const closePicker = () => { setPicker(null); setSlots([]); setSelectedSlot(''); };

    const submit = async () => {
        if (!selectedSlot) { showAlert('Please pick a time slot.', 'warning'); return; }
        if (picker.mode === 'book' && !bookVisitType) { showAlert('Please select the purpose of your consultation.', 'warning'); return; }
        if (picker.mode === 'book' && !reason.trim()) { showAlert('Please tell the clinic why you need a check-up.', 'warning'); return; }
        setSubmitting(true);
        try {
            let res;
            if (picker.mode === 'book') {
                res = await fetch(`${API}/api/student/doctor-bookings`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ student_id: studentId, schedule_id: picker.occurrence.schedule_id, slot_start: selectedSlot, reason, visit_type: bookVisitType })
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
                if (res.status === 409) loadSlots(picker.occurrence, picker.booking ? picker.booking.appointment_id : '');
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
            <div className="booking-line-bc"><Info size={14} /> {sourceLabel(b.booking_source)}</div>
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

    const renderRequest = (r) => {
        const open = isOpenRequest(r);
        return (
            <div key={`r-${r.request_id}`} className={`booking-card-bc request-card-bc ${r.status === 'Awaiting Reconfirmation' ? 'attention-bc' : ''}`}>
                <div className="booking-top-bc">
                    <strong>{visitLabel(r.visit_type, r.purpose_other)}</strong>
                    <span className={`status-pill-bc ${statusClass(r.status)}`}>{r.status}</span>
                </div>
                <div className="booking-reason-bc">Reason: {r.reason}</div>
                <div className="booking-line-bc"><Clock size={14} /> Sent {formatDate(r.created_at)}</div>
                <p className="request-help-bc">{requestHelp(r)}</p>
                {open && (
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
                )}
            </div>
        );
    };

    const renderAnnouncement = (a) => (
        <div key={`a-${a.schedule_id}-${a.date}`} className="booking-card-bc announce-bc">
            <div className="booking-top-bc">
                <strong>Walk-in consultation</strong>
                <span className="tag-bc">{a.visit_type === 'Any' ? 'Any visit' : a.visit_type}</span>
            </div>
            <div className="booking-line-bc"><Stethoscope size={14} /> {a.doctor_name} ({a.specialization})</div>
            {a.covered_visit_types && <div className="booking-line-bc"><Info size={14} /> Covers: {a.covered_visit_types.join(', ')}</div>}
            <div className="booking-line-bc"><Clock size={14} /> {formatDate(a.date)}, {to12h(a.start_time)} - {to12h(a.end_time)}</div>
            {a.location && <div className="booking-line-bc"><MapPin size={14} /> {a.location}</div>}
            <p className="request-help-bc">
                Walk-ins are accepted only while this consultation is in session. Booked and appointed students are seen first, and you can also book an open time slot.
            </p>
            {(a.notes || a.announcement) && <div className="muted-bc">{a.notes || a.announcement}</div>}
        </div>
    );

    const renderOccurrence = (o) => {
        // the student's active booking in this schedule and day, if any: it is changed or cancelled here instead of booking again
        const mine = o.has_my_booking
            ? bookings.find((b) => b.schedule_id === o.schedule_id && dayOf(b.start_time) === o.date && ['Scheduled', 'Waiting for Approval'].includes(b.status))
            : null;
        return (
        <div key={`o-${o.schedule_id}-${o.date}`} className="occurrence-card-bc">
            <div className="occurrence-doc-bc"><Stethoscope size={14} /> <strong>{o.doctor_name}</strong></div>
            <div className="muted-bc">{o.specialization}</div>
            {o.covered_visit_types && <div className="muted-bc">Covers: {o.covered_visit_types.join(', ')}</div>}
            <div className="occurrence-meta-bc"><Clock size={14} /> {to12h(o.start_time)} - {to12h(o.end_time)}</div>
            {o.location && <div className="occurrence-meta-bc"><MapPin size={14} /> {o.location}</div>}
            <div className="occurrence-tags-bc">
                <span className="tag-bc">{o.visit_type === 'Any' ? 'Any visit type' : o.visit_type}</span>
                {mine
                    ? <span className="tag-bc">Your slot: {formatTime(mine.start_time)} - {formatTime(mine.end_time)}</span>
                    : <span className="tag-bc tag-soft-bc">{o.open_slots} of {o.total_slots} slots open</span>}
                <span className="tag-bc tag-soft-bc">{o.auto_confirm ? 'Instant confirmation' : 'Needs approval'}</span>
            </div>
            {o.notes && <div className="muted-bc">{o.notes}</div>}
            {mine ? (
                <div className="booking-actions-bc">
                    <button className="btn-bc btn-primary-bc" onClick={() => openReschedule(mine)}>Change time slot</button>
                    <button className="btn-bc btn-danger-bc" onClick={() => cancelBooking(mine)}>Cancel</button>
                </div>
            ) : (
                <button className="btn-bc btn-primary-bc" onClick={() => openBook(o)}>Choose a time</button>
            )}
        </div>
        );
    };

    const renderEvent = (ev) => {
        if (ev.kind === 'request') return renderRequest(ev.item);
        if (ev.kind === 'booking') return renderBooking(ev.item);
        if (ev.kind === 'announce') return renderAnnouncement(ev.item);
        return renderOccurrence(ev.item);
    };

    return (
        <div className="container-bc">
            <div className="header-bc">
                <div>
                    <h2><CalendarPlus size={22} /> Book a Check-up</h2>
                    <p>Reserve a time slot in a schedule the clinic has opened, or send a consultation request if there is no schedule yet. The nurse or doctor reviews every request.</p>
                    <div className="header-actions-bc">
                        <button type="button" className="btn-bc btn-primary-bc" onClick={() => { setRequestForm({ ...EMPTY_REQUEST, visit_type: purposes.length === 1 ? purposes[0] : '' }); setShowRequest(true); }}>
                            <ClipboardPlus size={16} /> Request a consultation
                        </button>
                    </div>
                </div>
            </div>

            <section className="section-bc" aria-label="Consultation calendar">
                {awaitingAnswer > 0 && (
                    <div className="booking-card-bc attention-bc alert-bc" role="alert">
                        <strong><Info size={15} style={{ verticalAlign: 'middle' }} /> The clinic is waiting for your answer</strong>
                        <p className="request-help-bc">
                            {awaitingAnswer} consultation request{awaitingAnswer > 1 ? 's need' : ' needs'} your reconfirmation.
                        </p>
                        <div className="booking-actions-bc">
                            <button type="button" className="btn-bc btn-light-bc" onClick={() => { setKinds((prev) => ({ ...prev, request: true })); jumpToday(); }}>Show</button>
                        </div>
                    </div>
                )}
                {openRequests.some((r) => r.status === 'Waiting List') && (
                    <div className="booking-card-bc attention-bc alert-bc" role="alert">
                        <strong><Info size={15} style={{ verticalAlign: 'middle' }} /> Stay active</strong>
                        <p className="request-help-bc">
                            Your request was approved. Keep checking your notifications: when a doctor has a schedule, the school nurse will send you a reconfirmation. Answer it so the clinic can appoint you a time.
                        </p>
                    </div>
                )}

                <div className="toolbar-bc">
                    <div className="kind-filters-bc">
                        {KIND_KEYS.map((k) => (
                            <button
                                key={k} type="button" aria-pressed={kinds[k]}
                                className={`kind-chip-bc kind-${k}-bc ${kinds[k] ? 'on-bc' : ''}`} onClick={() => toggleKind(k)}
                            >
                                <i className="kind-dot-bc" /> {KINDS[k].label} ({kindCount[k]})
                            </button>
                        ))}
                    </div>
                    <div className="filters-bc filters-inline-bc">
                        <select value={visitType} onChange={e => setVisitType(e.target.value)} aria-label="Visit type">
                            <option value="">All visit types</option>
                            {purposes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} aria-label="Doctor">
                            <option value="">All doctors</option>
                            {doctorOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="cal-layout-bc">
                    <div className="cal-card-bc">
                        <div className="cal-head-bc">
                            <h3>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h3>
                            <div className="cal-nav-bc">
                                <button type="button" className="btn-bc btn-light-bc cal-icon-bc" onClick={() => goMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
                                <button type="button" className="btn-bc btn-light-bc" onClick={jumpToday}>Today</button>
                                <button type="button" className="btn-bc btn-light-bc cal-icon-bc" onClick={() => goMonth(1)} aria-label="Next month"><ChevronRight size={16} /></button>
                            </div>
                        </div>
                        <div className="cal-grid-bc">
                            {WEEKDAYS.map((w) => <div key={w} className="cal-dow-bc">{w.slice(0, 3)}</div>)}
                            {gridDays.map((day) => {
                                const list = eventsByDay[day] || [];
                                const classes = ['cal-day-bc'];
                                if (parseDay(day).getMonth() !== cursor.getMonth()) classes.push('outside-bc');
                                if (day === today) classes.push('today-bc');
                                if (day === selected) classes.push('selected-bc');
                                return (
                                    <button key={day} type="button" className={classes.join(' ')} onClick={() => setSelected(day)} aria-label={dayLabel(day, { weekday: 'long', month: 'long', day: 'numeric' })}>
                                        <span className="cal-num-bc">{parseDay(day).getDate()}</span>
                                        <span className="cal-marks-bc">
                                            {KIND_KEYS.map((k) => {
                                                const n = list.filter((ev) => ev.kind === k).length;
                                                return n > 0 ? <span key={k} className={`cal-mark-bc kind-${k}-bc`} title={`${n} ${KINDS[k].label.toLowerCase()}`}><i className="kind-dot-bc" />{n}</span> : null;
                                            })}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <aside className="day-panel-bc" aria-label="Selected day">
                        <h3>{dayLabel(selected, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}{selected === today ? ' (today)' : ''}</h3>
                        {loadingSlots && <div className="empty-bc">Loading available schedules...</div>}
                        {dayEvents.length === 0 ? (
                            <div className="empty-bc">
                                <CalendarClock size={28} />
                                <p>
                                    {selected === today && requests.length === 0 && bookings.length === 0
                                        ? 'Nothing here yet. If no schedule suits you, send a consultation request and the clinic will put you on the waiting list.'
                                        : 'Nothing on this day. Pick a day with a marker to see the details.'}
                                </p>
                            </div>
                        ) : (
                            <div className="stack-bc">
                                {dayEvents.map((ev) => (
                                    <div key={ev.key} className="event-bc">
                                        <span className={`event-kind-bc kind-${ev.kind}-bc`}><i className="kind-dot-bc" /> {KINDS[ev.kind].short}</span>
                                        {renderEvent(ev)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </aside>
                </div>
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
                            <select required value={requestForm.visit_type} onChange={e => setRequestForm({ ...requestForm, visit_type: e.target.value })} disabled={purposes.length === 0}>
                                <option value="">{!doctorsLoaded ? 'Loading...' : purposes.length === 0 ? 'No doctor is available yet' : '-- Select the purpose --'}</option>
                                {purposes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            {doctorsLoaded && purposes.length === 0 && (
                                <small className="muted-bc">The clinic has no doctor account for a consultation yet. Please check back later.</small>
                            )}
                        </div>
                        <div className="field-bc">
                            <label>Reason for the consultation</label>
                            <textarea rows="3" maxLength={255} required value={requestForm.reason} onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })} placeholder={reasonPlaceholder(requestForm.visit_type)} />
                        </div>
                        <div className="field-bc">
                            <label>Preferred days or times (optional)</label>
                            <input type="text" maxLength={255} value={requestForm.preferred_note} onChange={e => setRequestForm({ ...requestForm, preferred_note: e.target.value })} placeholder="e.g. Free on Tuesday and Thursday mornings" />
                        </div>
                        <div className="modal-footer-bc">
                            <button type="button" className="btn-bc btn-light-bc" onClick={() => setShowRequest(false)}>Close</button>
                            <button type="submit" className="btn-bc btn-primary-bc" disabled={submitting || !requestForm.visit_type}>{submitting ? 'Sending...' : 'Send request'}</button>
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
                                        loadSlots(next, picker.booking.appointment_id);
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
                                <div className="field-bc">
                                    <label>Purpose of the consultation</label>
                                    <select
                                        value={bookVisitType} required onChange={e => setBookVisitType(e.target.value)}
                                        disabled={visitTypes.includes(picker.occurrence.visit_type)}
                                    >
                                        <option value="">-- Select the purpose --</option>
                                        {visitTypes.filter(t => !picker.occurrence.covered_visit_types || picker.occurrence.covered_visit_types.includes(t)).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    {visitTypes.includes(picker.occurrence.visit_type) && (
                                        <small className="muted-bc">This time block is for {picker.occurrence.visit_type} consultations only.</small>
                                    )}
                                </div>
                                {picker.occurrence.allow_appointment ? (
                                    <p className="request-help-bc">This session is also used by the clinic to appoint students from the waiting list.</p>
                                ) : null}
                                <div className="field-bc">
                                    <label>Reason for the check-up</label>
                                    <textarea rows="3" maxLength={255} value={reason} onChange={e => setReason(e.target.value)} placeholder={reasonPlaceholder(bookVisitType)} />
                                </div>
                            </>
                        )}

                        <div className="modal-footer-bc">
                            <button className="btn-bc btn-light-bc" onClick={closePicker}>Close</button>
                            <button className="btn-bc btn-primary-bc" disabled={submitting || !selectedSlot || (picker.mode === 'book' && !bookVisitType)} onClick={submit}>
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
