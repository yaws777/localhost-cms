// DoctorAvailability.jsx
// The "Schedules" and "Booking approvals" tabs of the scheduling hub, for the nurse (every doctor) and the doctor (their own).
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    CalendarPlus, Edit, Lock, Unlock, Trash2, Check, XCircle, Stethoscope,
    ChevronDown, ChevronRight, Search, Inbox, AlertCircle, TimerReset, Bell, UserPlus, ListPlus
} from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime } from '../../utils/datetime';
import { visitLabel } from '../../utils/visitPurpose';
import { Pager, paginate } from '../common/RecordFolders';
import { API, WEEKDAYS, coverageLabel, hasWalkIn, to12h } from '../../utils/scheduling';
import { AppointModal, ExtendSessionModal } from '../scheduling/SessionModals';
import ScheduleFormModal from '../scheduling/ScheduleFormModal';
import { ReasonModal } from '../doctor/AppointmentModals';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/scheduling/Scheduling.css';

const HISTORY_PER_PAGE = 15;

const STATUS_FILTERS = [
    ['open', 'Active'],
    ['ended', 'Past'],
    ['closed', 'Closed'],
    ['all', 'All']
];

const dateLabel = (d) => (d ? formatDate(d) : '');
const doctorName = (d) => `Dr. ${d.first_name} ${d.last_name}`;

// open: not over and not closed (upcoming, or in session now) | ended: its dates are over | closed: switched off
const scheduleState = (s) => (s.status === 'Closed' ? 'closed' : s.is_expired ? 'ended' : 'open');
const STATE_RANK = { open: 0, closed: 1, ended: 2 };
const scheduleDate = (s) => String(s.next_date || s.schedule_date || s.valid_from || '');
const compareSchedules = (a, b) =>
    (STATE_RANK[scheduleState(a)] - STATE_RANK[scheduleState(b)]) || scheduleDate(a).localeCompare(scheduleDate(b));

const whenLabel = (s) => {
    if (s.recurrence === 'Once') return dateLabel(s.schedule_date);
    return `Every ${WEEKDAYS[s.day_of_week]}, ${dateLabel(s.valid_from)} - ${dateLabel(s.valid_until)}`;
};

const StateBadge = ({ s }) => {
    const state = scheduleState(s);
    if (state === 'closed') return <span className="badge-ds badge-closed-ds">Closed</span>;
    if (state === 'ended') return <span className="badge-ds badge-expired-ds">Past</span>;
    if (s.in_session_now) return <span className="badge-ds badge-open-ds">In session</span>;
    return <span className="badge-ds badge-pending-ds">Upcoming</span>;
};

// ---------------------------------------------------------------------------
// Schedules: every doctor with their own schedules underneath
// ---------------------------------------------------------------------------
// creator: { nurseId } or { doctorId } (the doctor portal only ever sees the doctor's own schedules)
// prefill: values from a scheduling-assistant suggestion that open the form; onReconfirm / onAppointFromWaiting(scheduleId, date): open the waiting list for a session
export const DoctorAvailability = ({ doctors, creator, userId, onChanged, prefill, onPrefillUsed, onReconfirm, onAppointFromWaiting, refreshKey }) => {
    const { showAlert, showConfirm } = useAlert();
    const [searchParams, setSearchParams] = useSearchParams();

    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [doctorFilter, setDoctorFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('open');
    const [collapsed, setCollapsed] = useState(() => new Set());

    const [form, setForm] = useState(null); // { schedule, preset }
    const [closeTarget, setCloseTarget] = useState(null);
    const [extendTarget, setExtendTarget] = useState(null);
    const [appointTarget, setAppointTarget] = useState(null);

    const fetchSchedules = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/doctor-schedules${creator.doctorId ? `?doctor_id=${encodeURIComponent(creator.doctorId)}` : ''}`);
            const data = await res.json();
            if (data.success) setSchedules(data.schedules);
        } catch (e) {
            showAlert('Could not load doctor schedules.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showAlert, creator.doctorId]);

    useEffect(() => { fetchSchedules(); }, [fetchSchedules, refreshKey]);

    // a change here also changes the visit lists and the numbers on the page tabs
    const changed = () => { fetchSchedules(); if (onChanged) onChanged(); };

    const openCreate = useCallback((doctorId = '', preset = {}) => setForm({ schedule: null, preset: { doctor_id: doctorId, ...preset } }), []);

    // A suggestion of the scheduling assistant opens the form already filled in
    useEffect(() => {
        if (!prefill || doctors.length === 0) return;
        openCreate(prefill.doctor_id, {
            visit_type: prefill.visit_type, schedule_date: prefill.date,
            start_time: prefill.start_time, end_time: prefill.end_time, slot_duration_min: prefill.slot_duration_min,
            max_patients_per_slot: prefill.max_patients_per_slot || 1, auto_confirm: false
        });
        if (onPrefillUsed) onPrefillUsed();
    }, [prefill, doctors, openCreate, onPrefillUsed]);

    // Sent here from a visit form: ?doctor=<id>&new=1 opens the form for that doctor
    useEffect(() => {
        const doctor = searchParams.get('doctor');
        if (doctor && searchParams.get('new') === '1' && doctors.length > 0) {
            openCreate(doctor);
            const next = new URLSearchParams(searchParams);
            next.delete('doctor');
            next.delete('new');
            setSearchParams(next, { replace: true });
        }
    }, [doctors, searchParams, setSearchParams, openCreate]);

    const handleClose = async (reason) => {
        try {
            const res = await fetch(`${API}/api/doctor-schedules/${closeTarget.schedule_id}/close`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason, sender_id: userId })
            });
            const data = await res.json();
            setCloseTarget(null);
            if (data.success) { showAlert(data.message, 'success'); changed(); }
            else showAlert(data.message || 'Failed to close schedule.', 'error');
        } catch (err) {
            showAlert('Server error closing the schedule.', 'error');
        }
    };

    const handleReopen = async (s) => {
        try {
            const res = await fetch(`${API}/api/doctor-schedules/${s.schedule_id}/reopen`, { method: 'PUT' });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); changed(); }
            else showAlert(data.message || 'Failed to reopen schedule.', 'error');
        } catch (err) {
            showAlert('Server error reopening the schedule.', 'error');
        }
    };

    const handleDelete = async (s) => {
        if (s.is_ongoing) {
            showAlert(s.in_session_now
                ? 'This session is happening right now, so it cannot be deleted. Wait until it ends, or close it.'
                : 'This weekly schedule is already running, so it cannot be deleted. Close it instead.', 'warning');
            return;
        }
        const ok = await showConfirm(`Delete this ${doctorName({ first_name: s.doc_first_name, last_name: s.doc_last_name })} schedule? This cannot be undone.`, { danger: true, confirmLabel: 'Delete', title: 'Delete schedule' });
        if (!ok) return;
        try {
            const res = await fetch(`${API}/api/doctor-schedules/${s.schedule_id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); changed(); }
            else showAlert(data.message || 'Failed to delete schedule.', 'error');
        } catch (err) {
            showAlert('Server error deleting the schedule.', 'error');
        }
    };

    // ---- organize: schedules by doctor, each doctor with their own numbers ----
    const groups = useMemo(() => {
        const byDoctor = new Map();
        schedules.forEach((s) => {
            if (!byDoctor.has(s.doctor_id)) byDoctor.set(s.doctor_id, []);
            byDoctor.get(s.doctor_id).push(s);
        });

        const list = doctors.map(d => ({ doctor: d, all: byDoctor.get(d.doctor_id) || [] }));
        // schedules whose doctor is no longer in the doctor list still need to be reachable
        byDoctor.forEach((rows, id) => {
            if (!doctors.some(d => d.doctor_id === id)) {
                list.push({
                    doctor: { doctor_id: id, first_name: rows[0].doc_first_name, last_name: rows[0].doc_last_name, specialization: rows[0].specialization, covered_visit_types: rows[0].covered_visit_types },
                    all: rows,
                    removed: true
                });
            }
        });

        return list
            .filter(g => !doctorFilter || g.doctor.doctor_id === doctorFilter)
            .map((g) => {
                const open = g.all.filter(s => scheduleState(s) === 'open');
                return {
                    ...g,
                    rows: g.all.filter(s => (statusFilter === 'all' || scheduleState(s) === statusFilter)).sort(compareSchedules),
                    openCount: open.length,
                    upcoming: open.reduce((n, s) => n + (Number(s.active_bookings) || 0), 0),
                    pending: open.reduce((n, s) => n + (Number(s.pending_bookings) || 0), 0)
                };
            })
            .sort((a, b) => `${a.doctor.last_name} ${a.doctor.first_name}`.localeCompare(`${b.doctor.last_name} ${b.doctor.first_name}`));
    }, [doctors, schedules, doctorFilter, statusFilter]);

    const toggleGroup = (id) => setCollapsed(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const emptyText = statusFilter === 'open' ? 'No active schedule.' : statusFilter === 'all' ? 'No schedules yet.' : `No ${statusFilter === 'ended' ? 'past' : statusFilter} schedules.`;

    return (
        <>
            <div className="filters-ds">
                {!creator.doctorId && (
                    <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} aria-label="Doctor">
                        <option value="">All doctors</option>
                        {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>{doctorName(d)}</option>)}
                    </select>
                )}
                <div className="chip-filter-ds" role="group" aria-label="Schedule status">
                    {STATUS_FILTERS.map(([value, label]) => (
                        <button key={value} type="button" className={statusFilter === value ? 'active-ds' : ''} onClick={() => setStatusFilter(value)}>{label}</button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="loading-dv">Loading doctor schedules...</div>
            ) : groups.length === 0 ? (
                <div className="empty-state-dv">
                    <Stethoscope size={36} />
                    <p>No doctors yet. Create a doctor account first, then set up their schedule.</p>
                </div>
            ) : groups.map((g) => {
                const id = g.doctor.doctor_id;
                const isCollapsed = collapsed.has(id);
                return (
                    <section key={id} className="doctor-group-ds">
                        <header className="group-head-ds">
                            <button type="button" className="group-toggle-ds" onClick={() => toggleGroup(id)} aria-expanded={!isCollapsed}>
                                {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                                <span className="group-title-ds">
                                    <strong>{doctorName(g.doctor)}</strong>
                                    <small>{g.doctor.specialization || 'General Physician'} - covers: {coverageLabel(g.doctor)}</small>
                                </span>
                            </button>
                            <div className="group-chips-ds">
                                {g.openCount === 0 && !g.removed
                                    ? <span className="badge-ds badge-pending-ds" title="Nothing can be booked with this doctor yet">No active schedule</span>
                                    : <span className="badge-ds badge-open-ds">{g.openCount} active</span>}
                                {g.upcoming > 0 && <span className="badge-ds badge-expired-ds">{g.upcoming} upcoming</span>}
                                {g.pending > 0 && <span className="badge-ds badge-pending-ds">{g.pending} waiting for approval</span>}
                            </div>
                            <div className="group-actions-ds">
                                {!g.removed && (
                                    <button type="button" className="sti-btn-dv sti-btn-secondary-dv" onClick={() => openCreate(id)}>
                                        <CalendarPlus size={14} /> Add schedule
                                    </button>
                                )}
                            </div>
                        </header>

                        {!isCollapsed && (
                            g.rows.length === 0 ? (
                                <div className="group-empty-ds">{emptyText}</div>
                            ) : (
                                <div className="table-card-dv group-table-ds">
                                    <table className="sti-table-dv">
                                        <thead>
                                            <tr>
                                                <th>Purpose</th><th>When</th><th>Time</th><th>Slots</th>
                                                <th>Location</th><th>Bookings</th><th>Status</th><th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {g.rows.map(s => {
                                                const state = scheduleState(s);
                                                return (
                                                    <tr key={s.schedule_id}>
                                                        <td>
                                                            {s.visit_type === 'Any' ? 'Any purpose' : s.visit_type}
                                                            <div className="muted-ds">{hasWalkIn(s) ? 'Walk-ins accepted' : 'No walk-ins'} - {s.auto_confirm ? 'bookings auto-confirmed' : 'bookings need approval'}</div>
                                                            {s.waiting_count > 0 && state === 'open' && <div className="muted-ds">{s.waiting_count} on the waiting list</div>}
                                                        </td>
                                                        <td>{whenLabel(s)}{s.next_date && s.recurrence === 'Weekly' && state === 'open' && <div className="muted-ds">Next: {dateLabel(s.next_date)}</div>}</td>
                                                        <td>
                                                            {to12h(s.start_time)} - {to12h(s.end_time)}
                                                            {s.extended_minutes > 0 && <div className="muted-ds">Extended +{s.extended_minutes} min</div>}
                                                        </td>
                                                        <td>{s.slot_duration_min} min x {s.max_patients_per_slot}</td>
                                                        <td>{s.location || '-'}</td>
                                                        <td>
                                                            {s.active_bookings} upcoming
                                                            {s.pending_bookings > 0 && <div className="muted-ds">{s.pending_bookings} waiting for approval</div>}
                                                        </td>
                                                        <td>
                                                            <StateBadge s={s} />
                                                            {s.status === 'Closed' && s.closed_reason ? <div className="muted-ds">{s.closed_reason}</div> : null}
                                                        </td>
                                                        <td>
                                                            <div className="table-actions-dv">
                                                                {state === 'open' && (
                                                                    <>
                                                                        <button className="icon-btn-ds" title="Appoint a student" onClick={() => setAppointTarget(s)}><UserPlus size={16} /></button>
                                                                        {onReconfirm && !s.in_session_now && (
                                                                            <button className="icon-btn-ds" title="Reconfirm: ask waiting-list students to reconfirm for this schedule" onClick={() => onReconfirm(s.schedule_id, s.next_date)}><Bell size={16} /></button>
                                                                        )}
                                                                        {onAppointFromWaiting && !s.in_session_now && (
                                                                            <button className="icon-btn-ds" title="Appoint from the waiting list (reconfirmed students)" onClick={() => onAppointFromWaiting(s.schedule_id, s.next_date)}><ListPlus size={16} /></button>
                                                                        )}
                                                                        {s.in_session_now && (
                                                                            <button className="icon-btn-ds" title="Extend the session (it is happening now)" onClick={() => setExtendTarget(s)}><TimerReset size={16} /></button>
                                                                        )}
                                                                        <button className="icon-btn-ds" title="Edit" onClick={() => setForm({ schedule: s, preset: null })}><Edit size={16} /></button>
                                                                        <button className="icon-btn-ds" title="Close schedule" onClick={() => setCloseTarget(s)}><Lock size={16} /></button>
                                                                    </>
                                                                )}
                                                                {state === 'closed' && (
                                                                    <button className="icon-btn-ds" title="Reopen" onClick={() => handleReopen(s)}><Unlock size={16} /></button>
                                                                )}
                                                                <button
                                                                    className="icon-btn-ds danger-ds" onClick={() => handleDelete(s)} disabled={!!s.is_ongoing}
                                                                    title={s.is_ongoing ? (s.in_session_now ? 'Happening now: it cannot be deleted' : 'Ongoing schedule: close it instead of deleting it') : 'Delete'}
                                                                ><Trash2 size={16} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        )}
                    </section>
                );
            })}

            <ScheduleFormModal
                isOpen={!!form} schedule={form ? form.schedule : null} preset={form ? form.preset : null} doctors={doctors}
                creator={creator} userId={userId} onClose={() => setForm(null)} onSaved={changed}
            />

            <ReasonModal
                isOpen={!!closeTarget}
                title="Close schedule"
                message={closeTarget && `Dr. ${closeTarget.doc_first_name} ${closeTarget.doc_last_name} - ${whenLabel(closeTarget)}. ${closeTarget.active_bookings > 0
                    ? `${closeTarget.active_bookings} upcoming booking(s) will be cancelled and the students and parents notified.`
                    : 'There are no upcoming bookings.'}`}
                label="Reason (shown to students)"
                placeholder="e.g. Doctor is unavailable on this date"
                required={false}
                confirmLabel="Close schedule"
                danger
                onSubmit={handleClose}
                onClose={() => setCloseTarget(null)}
            />

            <AppointModal isOpen={!!appointTarget} schedule={appointTarget} creator={creator} userId={userId} onClose={() => setAppointTarget(null)} onDone={changed} />
            <ExtendSessionModal schedule={extendTarget} creator={creator} userId={userId} onClose={() => setExtendTarget(null)} onDone={changed} />
        </>
    );
};

// ---------------------------------------------------------------------------
// Booking requests: what needs an answer first, the handled ones below
// ---------------------------------------------------------------------------
const requestStatusBadge = (status) => {
    const cls = status === 'Waiting for Approval' ? 'badge-pending-ds' : status === 'Scheduled' || status === 'Completed' ? 'badge-open-ds' : 'badge-closed-ds';
    return <span className={`badge-ds ${cls}`}>{status === 'Scheduled' ? 'Approved' : status}</span>;
};

const studentLine = (r) => (
    <>
        {r.student_first_name} {r.student_last_name}
        <div className="muted-ds">{r.student_id} {r.program_name ? `- ${r.program_name} ${r.year_level || ''}${r.section || ''}` : ''}</div>
    </>
);

export const BookingRequests = ({ doctors, userId, onChanged, fixedDoctorId, refreshKey }) => {
    const { showAlert } = useAlert();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [search, setSearch] = useState('');
    const [doctorFilter, setDoctorFilter] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const [declineTarget, setDeclineTarget] = useState(null);

    const fetchRequests = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/doctor-bookings?status=${showHistory ? 'all' : 'pending'}${fixedDoctorId ? `&doctor_id=${encodeURIComponent(fixedDoctorId)}` : ''}`);
            const data = await res.json();
            if (data.success) setRequests(data.bookings);
        } catch (e) {
            showAlert('Could not load booking requests.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showHistory, showAlert, fixedDoctorId]);

    useEffect(() => { fetchRequests(); }, [fetchRequests, refreshKey]);
    useEffect(() => { setHistoryPage(1); }, [search, doctorFilter, showHistory]);

    const changed = () => { fetchRequests(); if (onChanged) onChanged(); };

    const handleApprove = async (r) => {
        try {
            const res = await fetch(`${API}/api/doctor-bookings/${r.appointment_id}/approve`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_id: userId })
            });
            const data = await res.json();
            if (data.success) { showAlert('Booking approved. The student and parent were notified.', 'success'); changed(); }
            else showAlert(data.message || 'Failed to approve.', 'error');
        } catch (err) {
            showAlert('Server error approving the booking.', 'error');
        }
    };

    const handleDecline = async (reason) => {
        try {
            const res = await fetch(`${API}/api/doctor-bookings/${declineTarget.appointment_id}/decline`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason, sender_id: userId })
            });
            const data = await res.json();
            setDeclineTarget(null);
            if (data.success) { showAlert('Booking declined. The student and parent were notified.', 'success'); changed(); }
            else showAlert(data.message || 'Failed to decline.', 'error');
        } catch (err) {
            showAlert('Server error declining the booking.', 'error');
        }
    };

    const { pending, handled } = useMemo(() => {
        const q = search.trim().toLowerCase();
        const matches = (r) => {
            if (doctorFilter && r.doctor_id !== doctorFilter) return false;
            if (!q) return true;
            return `${r.student_first_name} ${r.student_last_name} ${r.student_id} ${r.doc_first_name} ${r.doc_last_name} ${r.visit_type}`.toLowerCase().includes(q);
        };
        const rows = requests.filter(matches);
        const byStart = (a, b) => String(a.start_time).localeCompare(String(b.start_time));
        return {
            pending: rows.filter(r => r.status === 'Waiting for Approval').sort(byStart),
            handled: rows.filter(r => r.status !== 'Waiting for Approval').sort((a, b) => byStart(b, a))
        };
    }, [requests, search, doctorFilter]);

    const handledPage = paginate(handled, historyPage, HISTORY_PER_PAGE);

    const requestRow = (r) => (
        <tr key={r.appointment_id}>
            <td>{studentLine(r)}</td>
            <td>Dr. {r.doc_first_name} {r.doc_last_name}</td>
            <td>{visitLabel(r.visit_type, r.purpose_other)}</td>
            <td>{formatDate(r.start_time)}<div className="muted-ds">{formatTime(r.start_time)} - {formatTime(r.end_time)}{r.location ? ` - ${r.location}` : ''}</div></td>
            <td className="reason-ds">{r.booking_reason || '-'}</td>
            <td>{requestStatusBadge(r.status)}{r.decline_reason ? <div className="muted-ds">{r.decline_reason}</div> : null}</td>
            <td>
                {r.status === 'Waiting for Approval' && new Date(String(r.start_time).replace(' ', 'T')) > new Date() ? (
                    <div className="table-actions-dv">
                        <button className="sti-btn-dv sti-btn-primary-dv" onClick={() => handleApprove(r)}><Check size={14} /> Approve</button>
                        <button className="sti-btn-dv sti-btn-light-dv" onClick={() => setDeclineTarget(r)}><XCircle size={14} /> Decline</button>
                    </div>
                ) : '-'}
            </td>
        </tr>
    );

    const head = (
        <thead>
            <tr><th>Student</th><th>Doctor</th><th>Visit Type</th><th>Requested Slot</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
        </thead>
    );

    return (
        <>
            <div className="filters-ds">
                <div className="search-box-dv">
                    <Search size={16} />
                    <input type="text" placeholder="Search student, ID, doctor or visit type..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {!fixedDoctorId && (
                    <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} aria-label="Doctor">
                        <option value="">All doctors</option>
                        {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>{doctorName(d)}</option>)}
                    </select>
                )}
                <label className="check-ds">
                    <input type="checkbox" checked={showHistory} onChange={e => setShowHistory(e.target.checked)} />
                    Also show approved / declined / cancelled (last 60 days)
                </label>
            </div>

            {loading ? (
                <div className="loading-dv">Loading booking requests...</div>
            ) : (
                <>
                    <h3 className="section-head-ds">
                        <Inbox size={18} /> Waiting for approval <span className="count-pill-ds">{pending.length}</span>
                    </h3>
                    {pending.length === 0 ? (
                        <div className="group-empty-ds"><AlertCircle size={16} /> No booking requests are waiting for approval.</div>
                    ) : (
                        <div className="table-card-dv">
                            <table className="sti-table-dv">{head}<tbody>{pending.map(requestRow)}</tbody></table>
                        </div>
                    )}

                    {showHistory && (
                        <>
                            <h3 className="section-head-ds">Handled requests <span className="count-pill-ds count-muted-ds">{handled.length}</span></h3>
                            {handled.length === 0 ? (
                                <div className="group-empty-ds">Nothing handled in the last 60 days.</div>
                            ) : (
                                <>
                                    <div className="table-card-dv">
                                        <table className="sti-table-dv">{head}<tbody>{handledPage.items.map(requestRow)}</tbody></table>
                                    </div>
                                    <Pager page={handledPage.page} pageCount={handledPage.pageCount} total={handledPage.total} pageSize={HISTORY_PER_PAGE} onPage={setHistoryPage} noun="requests" />
                                </>
                            )}
                        </>
                    )}
                </>
            )}

            <ReasonModal
                isOpen={!!declineTarget}
                title="Decline booking"
                message={declineTarget && `${declineTarget.student_first_name} ${declineTarget.student_last_name} - ${formatDate(declineTarget.start_time)} ${formatTime(declineTarget.start_time)}`}
                label="Reason (shown to the student)"
                placeholder="e.g. Please book the afternoon slots instead"
                confirmLabel="Decline booking"
                danger
                onSubmit={handleDecline}
                onClose={() => setDeclineTarget(null)}
            />
        </>
    );
};
