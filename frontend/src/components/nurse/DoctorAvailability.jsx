// DoctorAvailability.jsx
// The "Schedules" tab of the scheduling hub, for the nurse (every doctor) and the doctor (their own).
// The doctor sets the schedules with a listing limit. The nurse asks for one with a schedule request, then opens its listing so students can ask for a place;
// the nurse accepts each ask (the student gets the next queue number of the session).
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    CalendarPlus, Edit, Unlock, Trash2, Stethoscope,
    ChevronDown, ChevronRight, TimerReset, UserPlus, ListChecks, Send, DoorOpen, DoorClosed
} from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate } from '../../utils/datetime';
import { API, WEEKDAYS, coverageLabel, hasWalkIn, to12h } from '../../utils/scheduling';
import { AppointModal, ExtendSessionModal } from '../scheduling/SessionModals';
import ScheduleFormModal from '../scheduling/ScheduleFormModal';
import ScheduleRequests, { ScheduleRequestModal, presetFromRequest } from '../scheduling/ScheduleRequests';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/scheduling/Scheduling.css';

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
// prefill: values from a scheduling-assistant suggestion that open the form (the nurse's opens a schedule request); onAppointFromWaiting(scheduleId, date): open the listing requests of a session
export const DoctorAvailability = ({ doctors, creator, userId, onChanged, prefill, onPrefillUsed, onAppointFromWaiting, refreshKey }) => {
    const { showAlert, showConfirm } = useAlert();
    const [searchParams, setSearchParams] = useSearchParams();

    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [doctorFilter, setDoctorFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('open');
    const [collapsed, setCollapsed] = useState(() => new Set());

    const isNurse = !creator.doctorId;
    const [form, setForm] = useState(null); // { schedule, preset }
    const [requestForm, setRequestForm] = useState(null); // preset of the nurse's schedule request
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

    // the doctor sets a schedule; the nurse asks the doctor for one
    const openCreate = useCallback((doctorId = '', preset = {}) => {
        if (isNurse) setRequestForm({ doctor_id: doctorId, ...preset });
        else setForm({ schedule: null, preset: { doctor_id: doctorId, ...preset } });
    }, [isNurse]);

    // A suggestion of the scheduling assistant opens the form (or the request) already filled in
    useEffect(() => {
        if (!prefill || doctors.length === 0) return;
        if (isNurse) {
            openCreate(prefill.doctor_id, { visit_type: prefill.visit_type, preferred_date: prefill.date, preferred_start: prefill.start_time, preferred_end: prefill.end_time, note: `${prefill.waiting} student(s) are asking for ${prefill.visit_type} check-ups` });
        } else {
            openCreate(prefill.doctor_id, {
                visit_type: prefill.visit_type, schedule_date: prefill.date,
                start_time: prefill.start_time, end_time: prefill.end_time, slot_duration_min: prefill.slot_duration_min,
                max_patients_per_slot: prefill.max_patients_per_slot || 1
            });
        }
        if (onPrefillUsed) onPrefillUsed();
    }, [prefill, doctors, openCreate, onPrefillUsed, isNurse]);

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

    // the nurse opens / closes the listing of a schedule: students see only open listings
    const toggleListing = async (s) => {
        try {
            const res = await fetch(`${API}/api/doctor-schedules/${s.schedule_id}/listing`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ listing_open: !s.listing_open, sender_id: userId })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); changed(); }
            else showAlert(data.message || 'Could not change the listing.', 'error');
        } catch (err) {
            showAlert('Server error changing the listing.', 'error');
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
                ? 'This session is happening right now, so it cannot be deleted. Wait until it ends.'
                : 'This weekly schedule is already running, so it cannot be deleted.', 'warning');
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
                    upcoming: open.reduce((n, s) => n + (Number(s.active_bookings) || 0), 0)
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
            <ScheduleRequests
                role={isNurse ? 'nurse' : 'doctor'} fixedDoctorId={creator.doctorId} nurseId={creator.nurseId} userId={userId}
                refreshKey={refreshKey} onChanged={changed} onSetSchedule={(r) => setForm({ schedule: null, preset: presetFromRequest(r) })}
            />
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
                                    ? <span className="badge-ds badge-pending-ds" title="No students can be appointed to this doctor yet">No active schedule</span>
                                    : <span className="badge-ds badge-open-ds">{g.openCount} active</span>}
                                {g.upcoming > 0 && <span className="badge-ds badge-expired-ds">{g.upcoming} in queue</span>}
                            </div>
                            <div className="group-actions-ds">
                                {!g.removed && (
                                    <button type="button" className="sti-btn-dv sti-btn-secondary-dv" onClick={() => openCreate(id)}>
                                        {isNurse ? <><Send size={14} /> Request schedule</> : <><CalendarPlus size={14} /> Add schedule</>}
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
                                                <th>Check-up service</th><th>When</th><th>Time</th><th>Pace</th>
                                                <th>Location</th><th>Listing</th><th>Status</th><th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {g.rows.map(s => {
                                                const state = scheduleState(s);
                                                return (
                                                    <tr key={s.schedule_id}>
                                                        <td>
                                                            {s.visit_type === 'Any' ? 'Any purpose' : s.visit_type}
                                                            <div className="muted-ds">{hasWalkIn(s) ? 'Walk-ins accepted' : 'No walk-ins'}</div>
                                                                                                                    </td>
                                                        <td>{whenLabel(s)}{s.next_date && s.recurrence === 'Weekly' && state === 'open' && <div className="muted-ds">Next: {dateLabel(s.next_date)}</div>}</td>
                                                        <td>
                                                            {to12h(s.start_time)} - {to12h(s.end_time)}
                                                            {s.extended_minutes > 0 && <div className="muted-ds">Extended +{s.extended_minutes} min</div>}
                                                        </td>
                                                        <td>{s.slot_duration_min} min per patient{s.max_patients_per_slot > 1 ? `, ${s.max_patients_per_slot} at once` : ''}</td>
                                                        <td>{s.location || '-'}</td>
                                                        <td>
                                                            {state === 'open' ? (
                                                                <>
                                                                    <span className={`badge-ds ${s.listing_open ? 'badge-open-ds' : 'badge-expired-ds'}`}>{s.listing_open ? (s.listing_full ? 'Open - full' : 'Open') : 'Closed'}</span>
                                                                    <div className="muted-ds">{s.accepted} of {s.listing_limit} accepted</div>
                                                                    {isNurse && s.pending > 0 && <div className="muted-ds">{s.pending} to accept</div>}
                                                                </>
                                                            ) : '-'}
                                                        </td>
                                                        <td>
                                                            <StateBadge s={s} />
                                                            {s.status === 'Closed' && s.closed_reason ? <div className="muted-ds">{s.closed_reason}</div> : null}
                                                        </td>
                                                        <td>
                                                            <div className="table-actions-dv">
                                                                {state === 'open' && (
                                                                    <>
                                                                        {isNurse && (
                                                                            <button
                                                                                className="icon-btn-ds" onClick={() => toggleListing(s)}
                                                                                title={s.listing_open ? 'Close the listing: students can no longer ask for a place' : 'Open the listing: students can ask for a place in this session'}
                                                                                aria-label={s.listing_open ? 'Close the listing' : 'Open the listing'}
                                                                            >
                                                                                {s.listing_open ? <DoorClosed size={16} /> : <DoorOpen size={16} />}
                                                                            </button>
                                                                        )}
                                                                        {onAppointFromWaiting && (
                                                                            <button className="icon-btn-ds" title="Listing requests of this session" aria-label="Listing requests of this session" onClick={() => onAppointFromWaiting(s.schedule_id, s.next_date)}><ListChecks size={16} /></button>
                                                                        )}
                                                                        <button className="icon-btn-ds" title="Appoint a student directly" aria-label="Appoint a student directly" onClick={() => setAppointTarget(s)}><UserPlus size={16} /></button>
                                                                        {s.in_session_now && (
                                                                            <button className="icon-btn-ds" title="Extend the session (it is happening now)" onClick={() => setExtendTarget(s)}><TimerReset size={16} /></button>
                                                                        )}
                                                                        {!isNurse && <button className="icon-btn-ds" title="Edit" onClick={() => setForm({ schedule: s, preset: null })}><Edit size={16} /></button>}
                                                                    </>
                                                                )}
                                                                {state === 'closed' && (
                                                                    <button className="icon-btn-ds" title="Reopen" onClick={() => handleReopen(s)}><Unlock size={16} /></button>
                                                                )}
                                                                {!isNurse && (
                                                                    <button
                                                                        className="icon-btn-ds danger-ds" onClick={() => handleDelete(s)} disabled={!!s.is_ongoing}
                                                                        title={s.is_ongoing ? (s.in_session_now ? 'Happening now: it cannot be deleted' : 'Ongoing schedule: it cannot be deleted') : 'Delete'}
                                                                    ><Trash2 size={16} /></button>
                                                                )}
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

            <ScheduleRequestModal
                isOpen={!!requestForm} preset={requestForm} doctors={doctors} nurseId={creator.nurseId} userId={userId}
                onClose={() => setRequestForm(null)} onSent={changed}
            />

            <AppointModal isOpen={!!appointTarget} schedule={appointTarget} creator={creator} userId={userId} onClose={() => setAppointTarget(null)} onDone={changed} />
            <ExtendSessionModal schedule={extendTarget} creator={creator} userId={userId} onClose={() => setExtendTarget(null)} onDone={changed} />
        </>
    );
};
