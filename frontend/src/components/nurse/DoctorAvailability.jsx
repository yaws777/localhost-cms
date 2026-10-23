// DoctorAvailability.jsx
// The "Availability" and "Booking Requests" sections of the Doctor Visits page
// (these used to be the separate Doctor Schedule page).
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    CalendarPlus, Edit, Lock, Unlock, Trash2, X, Check, XCircle, Stethoscope, UserPlus,
    ChevronDown, ChevronRight, Search, Inbox, AlertCircle
} from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime } from '../../utils/datetime';
import { visitLabel } from '../../utils/visitPurpose';
import { Pager, paginate } from '../common/RecordFolders';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';

const API = 'http://localhost:3001';
const HISTORY_PER_PAGE = 15;

const VISIT_TYPES = ['Any', 'General Check Up', 'Dental', 'Vision', 'Other'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STATUS_FILTERS = [
    ['open', 'Active'],
    ['ended', 'Ended'],
    ['closed', 'Closed'],
    ['all', 'All']
];

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
const to12h = (t) => {
    if (!t) return '';
    const [h, m] = String(t).split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const dateLabel = (d) => (d ? formatDate(d) : '');
const doctorName = (d) => `Dr. ${d.first_name} ${d.last_name}`;

// open: students can book it | ended: its dates are over | closed: a nurse switched it off
const scheduleState = (s) => (s.status === 'Closed' ? 'closed' : s.is_expired ? 'ended' : 'open');
const STATE_RANK = { open: 0, closed: 1, ended: 2 };
const scheduleDate = (s) => String(s.next_date || s.schedule_date || s.valid_from || '');
const compareSchedules = (a, b) =>
    (STATE_RANK[scheduleState(a)] - STATE_RANK[scheduleState(b)]) || scheduleDate(a).localeCompare(scheduleDate(b));

const whenLabel = (s) => {
    if (s.recurrence === 'Once') return dateLabel(s.schedule_date);
    return `Every ${WEEKDAYS[s.day_of_week]}, ${dateLabel(s.valid_from)} - ${dateLabel(s.valid_until)}`;
};

const EMPTY_FORM = {
    doctor_id: '', visit_type: 'Any', recurrence: 'Once', schedule_date: '', day_of_week: 1,
    valid_from: '', valid_until: '', start_time: '09:00', end_time: '12:00',
    slot_duration_min: 15, max_patients_per_slot: 1, location: '', notes: '', auto_confirm: false
};

const StateBadge = ({ s }) => {
    const state = scheduleState(s);
    if (state === 'closed') return <span className="badge-ds badge-closed-ds">Closed</span>;
    if (state === 'ended') return <span className="badge-ds badge-expired-ds">Ended</span>;
    return <span className="badge-ds badge-open-ds">Open</span>;
};

// ---------------------------------------------------------------------------
// Availability: every doctor with their own schedules underneath
// ---------------------------------------------------------------------------
// creatorDoctorId: the doctor portal posts the doctor's own blocks (no nurse involved)
export const DoctorAvailability = ({ doctors, nurseId, userId, onChanged, onAddDoctor, onEditDoctor, creatorDoctorId }) => {
    const { showAlert, showConfirm } = useAlert();
    const [searchParams, setSearchParams] = useSearchParams();

    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [doctorFilter, setDoctorFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('open');
    const [collapsed, setCollapsed] = useState(() => new Set());

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const [closeTarget, setCloseTarget] = useState(null);
    const [closeReason, setCloseReason] = useState('');

    const fetchSchedules = useCallback(async () => {
        try {
            // the doctor portal only ever sees the doctor's own schedules
            const res = await fetch(`${API}/api/doctor-schedules${creatorDoctorId ? `?doctor_id=${encodeURIComponent(creatorDoctorId)}` : ''}`);
            const data = await res.json();
            if (data.success) setSchedules(data.schedules);
        } catch (e) {
            showAlert('Could not load doctor schedules.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showAlert, creatorDoctorId]);

    useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

    // a change here also changes the visit lists and the numbers on the page tabs
    const changed = () => { fetchSchedules(); if (onChanged) onChanged(); };

    const openCreate = useCallback((doctorId = '') => {
        setEditingId(null);
        setFormError('');
        setForm({ ...EMPTY_FORM, doctor_id: doctorId, schedule_date: todayStr(), valid_from: todayStr(), valid_until: todayStr() });
        setShowModal(true);
    }, []);

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

    const openEdit = (s) => {
        setEditingId(s.schedule_id);
        setFormError('');
        setForm({
            doctor_id: s.doctor_id, visit_type: s.visit_type, recurrence: s.recurrence,
            schedule_date: s.schedule_date || '', day_of_week: s.day_of_week ?? 1,
            valid_from: s.valid_from || '', valid_until: s.valid_until || '',
            start_time: hhmm(s.start_time), end_time: hhmm(s.end_time),
            slot_duration_min: s.slot_duration_min, max_patients_per_slot: s.max_patients_per_slot,
            location: s.location || '', notes: s.notes || '', auto_confirm: !!s.auto_confirm
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setFormError('');
        setSaving(true);
        try {
            const payload = creatorDoctorId ? { ...form, created_by_doctor_id: creatorDoctorId } : { ...form, nurse_id: nurseId };
            const res = await fetch(editingId ? `${API}/api/doctor-schedules/${editingId}` : `${API}/api/doctor-schedules`, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setShowModal(false);
                showAlert(data.message, 'success');
                changed();
            } else {
                setFormError(data.message || 'Failed to save schedule.');
            }
        } catch (err) {
            setFormError('Server error saving the schedule.');
        } finally {
            setSaving(false);
        }
    };

    const handleClose = async () => {
        try {
            const res = await fetch(`${API}/api/doctor-schedules/${closeTarget.schedule_id}/close`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: closeReason, sender_id: userId })
            });
            const data = await res.json();
            setCloseTarget(null);
            setCloseReason('');
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
                    doctor: { doctor_id: id, first_name: rows[0].doc_first_name, last_name: rows[0].doc_last_name, specialization: rows[0].specialization },
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
                    rows: g.all.filter(s => statusFilter === 'all' || scheduleState(s) === statusFilter).sort(compareSchedules),
                    openCount: open.length,
                    upcoming: open.reduce((n, s) => n + (Number(s.active_bookings) || 0), 0),
                    pending: open.reduce((n, s) => n + (Number(s.pending_bookings) || 0), 0)
                };
            })
            .sort((a, b) => `${a.doctor.last_name} ${a.doctor.first_name}`.localeCompare(`${b.doctor.last_name} ${b.doctor.first_name}`));
    }, [doctors, schedules, doctorFilter, statusFilter]);

    const totals = useMemo(() => ({
        doctors: groups.length,
        open: groups.reduce((n, g) => n + g.openCount, 0),
        upcoming: groups.reduce((n, g) => n + g.upcoming, 0),
        pending: groups.reduce((n, g) => n + g.pending, 0)
    }), [groups]);

    const toggleGroup = (id) => setCollapsed(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const selectedDoctor = doctors.find(d => d.doctor_id === form.doctor_id);
    const emptyText = statusFilter === 'open' ? 'No active schedule.' : statusFilter === 'all' ? 'No schedules yet.' : `No ${statusFilter} schedules.`;

    return (
        <>
            <p className="summary-ds">
                <strong>{totals.doctors}</strong> doctor{totals.doctors === 1 ? '' : 's'} - <strong>{totals.open}</strong> active schedule{totals.open === 1 ? '' : 's'} - <strong>{totals.upcoming}</strong> upcoming booking{totals.upcoming === 1 ? '' : 's'}
                {totals.pending > 0 && <> - <strong className="warn-text-ds">{totals.pending} awaiting approval</strong></>}
            </p>

            <div className="filters-ds">
                <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} aria-label="Doctor">
                    <option value="">All doctors</option>
                    {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>{doctorName(d)}</option>)}
                </select>
                <div className="chip-filter-ds" role="group" aria-label="Schedule status">
                    {STATUS_FILTERS.map(([value, label]) => (
                        <button key={value} type="button" className={statusFilter === value ? 'active-ds' : ''} onClick={() => setStatusFilter(value)}>{label}</button>
                    ))}
                </div>
                {onAddDoctor && (
                    <div className="filters-actions-ds">
                        <button type="button" className="sti-btn-dv sti-btn-primary-dv" onClick={onAddDoctor}>
                            <UserPlus size={16} /> Add Doctor
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="loading-dv">Loading doctor schedules...</div>
            ) : groups.length === 0 ? (
                <div className="empty-state-dv">
                    <Stethoscope size={36} />
                    <p>No doctors yet. Add a doctor profile first, then set up their schedule.</p>
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
                                    <small>{g.doctor.specialization || 'General Physician'}{g.doctor.contact_number ? ` - ${g.doctor.contact_number}` : ''}</small>
                                </span>
                            </button>
                            <div className="group-chips-ds">
                                {g.openCount === 0 && !g.removed
                                    ? <span className="badge-ds badge-pending-ds" title="Nothing can be booked with this doctor yet">No active schedule</span>
                                    : <span className="badge-ds badge-open-ds">{g.openCount} active</span>}
                                {g.upcoming > 0 && <span className="badge-ds badge-expired-ds">{g.upcoming} upcoming</span>}
                                {g.pending > 0 && <span className="badge-ds badge-pending-ds">{g.pending} awaiting approval</span>}
                            </div>
                            <div className="group-actions-ds">
                                {!g.removed && onEditDoctor && (
                                    <button type="button" className="icon-btn-ds" title="Edit doctor profile" onClick={() => onEditDoctor(g.doctor)}><Edit size={16} /></button>
                                )}
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
                                                <th>Visit Type</th><th>When</th><th>Time</th><th>Slots</th>
                                                <th>Location</th><th>Bookings</th><th>Status</th><th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {g.rows.map(s => (
                                                <tr key={s.schedule_id}>
                                                    <td>{s.visit_type}</td>
                                                    <td>{whenLabel(s)}{s.next_date && s.recurrence === 'Weekly' && <div className="muted-ds">Next: {dateLabel(s.next_date)}</div>}</td>
                                                    <td>{to12h(s.start_time)} - {to12h(s.end_time)}</td>
                                                    <td>{s.slot_duration_min} min x {s.max_patients_per_slot}{s.auto_confirm ? <div className="muted-ds">Auto-confirm</div> : null}</td>
                                                    <td>{s.location || '-'}</td>
                                                    <td>
                                                        {s.active_bookings} upcoming
                                                        {s.pending_bookings > 0 && <div className="muted-ds">{s.pending_bookings} awaiting approval</div>}
                                                    </td>
                                                    <td><StateBadge s={s} />{s.status === 'Closed' && s.closed_reason ? <div className="muted-ds">{s.closed_reason}</div> : null}</td>
                                                    <td>
                                                        <div className="table-actions-dv">
                                                            <button className="icon-btn-ds" title="Edit" onClick={() => openEdit(s)}><Edit size={16} /></button>
                                                            {s.status === 'Open'
                                                                ? <button className="icon-btn-ds" title="Close schedule" onClick={() => { setCloseTarget(s); setCloseReason(''); }}><Lock size={16} /></button>
                                                                : <button className="icon-btn-ds" title="Reopen" onClick={() => handleReopen(s)}><Unlock size={16} /></button>}
                                                            <button className="icon-btn-ds danger-ds" title="Delete" onClick={() => handleDelete(s)}><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        )}
                    </section>
                );
            })}

            {/* ADD / EDIT SCHEDULE */}
            {showModal && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv">
                        <div className="modal-header-dv">
                            <h3>{editingId ? 'Edit Doctor Schedule' : 'Add Doctor Schedule'}</h3>
                            <button className="close-btn-dv" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            {formError && <div className="error-banner-dv">{formError}</div>}

                            <div className="form-group-dv">
                                <label>Doctor</label>
                                <select required disabled={!!editingId} value={form.doctor_id} onChange={e => setForm({ ...form, doctor_id: e.target.value })}>
                                    <option value="">-- Select Doctor --</option>
                                    {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>{doctorName(d)} ({d.specialization})</option>)}
                                </select>
                            </div>

                            <div className="form-group-dv">
                                <label>Visit Type</label>
                                <select value={form.visit_type} onChange={e => setForm({ ...form, visit_type: e.target.value })}>
                                    {(VISIT_TYPES.includes(form.visit_type) ? VISIT_TYPES : [...VISIT_TYPES, form.visit_type]).map(t => <option key={t} value={t}>{t === 'Any' ? 'Any (student picks)' : t}</option>)}
                                </select>
                                {selectedDoctor && (form.visit_type === 'Dental' || form.visit_type === 'Vision') && (
                                    <small className="hint-ds">Dental needs a Dentist and Vision needs an Optometrist/Ophthalmologist on the doctor profile.</small>
                                )}
                            </div>

                            <div className="form-group-dv">
                                <label>Repeats</label>
                                <select value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
                                    <option value="Once">One date only</option>
                                    <option value="Weekly">Every week on a weekday</option>
                                </select>
                            </div>

                            {form.recurrence === 'Once' ? (
                                <div className="form-group-dv">
                                    <label>Date</label>
                                    <input type="date" required min={todayStr()} value={form.schedule_date} onChange={e => setForm({ ...form, schedule_date: e.target.value })} />
                                </div>
                            ) : (
                                <>
                                    <div className="form-group-dv">
                                        <label>Weekday</label>
                                        <select value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: Number(e.target.value) })}>
                                            {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-row-dv">
                                        <div className="form-group-dv">
                                            <label>From</label>
                                            <input type="date" required value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} />
                                        </div>
                                        <div className="form-group-dv">
                                            <label>Until</label>
                                            <input type="date" required min={form.valid_from} value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="form-row-dv">
                                <div className="form-group-dv">
                                    <label>Start Time</label>
                                    <input type="time" required value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
                                </div>
                                <div className="form-group-dv">
                                    <label>End Time</label>
                                    <input type="time" required value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-row-dv">
                                <div className="form-group-dv">
                                    <label>Minutes per slot</label>
                                    <input type="number" min="5" max="240" step="5" required value={form.slot_duration_min} onChange={e => setForm({ ...form, slot_duration_min: e.target.value })} />
                                </div>
                                <div className="form-group-dv">
                                    <label>Patients per slot</label>
                                    <input type="number" min="1" max="50" required value={form.max_patients_per_slot} onChange={e => setForm({ ...form, max_patients_per_slot: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-group-dv">
                                <label>Location</label>
                                <input type="text" maxLength={100} placeholder="e.g. Clinic Room 1" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                            </div>

                            <div className="form-group-dv">
                                <label>Notes for students (optional)</label>
                                <input type="text" maxLength={255} placeholder="e.g. Bring your student ID" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                            </div>

                            <div className="form-group-dv">
                                <label className="check-ds">
                                    <input type="checkbox" checked={form.auto_confirm} onChange={e => setForm({ ...form, auto_confirm: e.target.checked })} />
                                    Confirm student bookings automatically (no approval needed)
                                </label>
                            </div>

                            <div className="modal-footer-dv">
                                <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="sti-btn-dv sti-btn-primary-dv" disabled={saving}>{saving ? 'Saving...' : 'Save Schedule'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CLOSE SCHEDULE */}
            {closeTarget && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv">
                        <div className="modal-header-dv">
                            <h3>Close schedule</h3>
                            <button className="close-btn-dv" onClick={() => setCloseTarget(null)}><X size={20} /></button>
                        </div>
                        <p className="hint-ds">
                            Dr. {closeTarget.doc_first_name} {closeTarget.doc_last_name} - {whenLabel(closeTarget)}.
                            {closeTarget.active_bookings > 0
                                ? ` ${closeTarget.active_bookings} upcoming booking(s) will be cancelled and the students and parents notified.`
                                : ' There are no upcoming bookings.'}
                        </p>
                        <div className="form-group-dv">
                            <label>Reason (shown to students)</label>
                            <textarea rows="2" value={closeReason} onChange={e => setCloseReason(e.target.value)} placeholder="e.g. Doctor is unavailable on this date" />
                        </div>
                        <div className="modal-footer-dv">
                            <button className="sti-btn-dv sti-btn-light-dv" onClick={() => setCloseTarget(null)}>Keep open</button>
                            <button className="sti-btn-dv sti-btn-primary-dv" onClick={handleClose}>Close schedule</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// ---------------------------------------------------------------------------
// Booking requests: what needs an answer first, the handled ones below
// ---------------------------------------------------------------------------
const requestStatusBadge = (status) => {
    const cls = status === 'Pending Approval' ? 'badge-pending-ds' : status === 'Scheduled' || status === 'Completed' ? 'badge-open-ds' : 'badge-closed-ds';
    return <span className={`badge-ds ${cls}`}>{status === 'Scheduled' ? 'Approved' : status}</span>;
};

const studentLine = (r) => (
    <>
        {r.student_first_name} {r.student_last_name}
        <div className="muted-ds">{r.student_id} {r.program_name ? `- ${r.program_name} ${r.year_level || ''}${r.section || ''}` : ''}</div>
    </>
);

export const BookingRequests = ({ doctors, userId, onChanged }) => {
    const { showAlert } = useAlert();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [search, setSearch] = useState('');
    const [doctorFilter, setDoctorFilter] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const [declineTarget, setDeclineTarget] = useState(null);
    const [declineReason, setDeclineReason] = useState('');

    const fetchRequests = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/doctor-bookings?status=${showHistory ? 'all' : 'pending'}`);
            const data = await res.json();
            if (data.success) setRequests(data.bookings);
        } catch (e) {
            showAlert('Could not load booking requests.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showHistory, showAlert]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);
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

    const handleDecline = async () => {
        if (!declineReason.trim()) { showAlert('Please give a reason for declining.', 'warning'); return; }
        try {
            const res = await fetch(`${API}/api/doctor-bookings/${declineTarget.appointment_id}/decline`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: declineReason, sender_id: userId })
            });
            const data = await res.json();
            setDeclineTarget(null);
            setDeclineReason('');
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
            pending: rows.filter(r => r.status === 'Pending Approval').sort(byStart),
            handled: rows.filter(r => r.status !== 'Pending Approval').sort((a, b) => byStart(b, a))
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
                {r.status === 'Pending Approval' ? (
                    <div className="table-actions-dv">
                        <button className="sti-btn-dv sti-btn-primary-dv" onClick={() => handleApprove(r)}><Check size={14} /> Approve</button>
                        <button className="sti-btn-dv sti-btn-light-dv" onClick={() => { setDeclineTarget(r); setDeclineReason(''); }}><XCircle size={14} /> Decline</button>
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
                <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} aria-label="Doctor">
                    <option value="">All doctors</option>
                    {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>{doctorName(d)}</option>)}
                </select>
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
                        <Inbox size={18} /> Awaiting approval <span className="count-pill-ds">{pending.length}</span>
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

            {/* DECLINE REQUEST */}
            {declineTarget && (
                <div className="modal-overlay-dv">
                    <div className="modal-content-dv">
                        <div className="modal-header-dv">
                            <h3>Decline booking</h3>
                            <button className="close-btn-dv" onClick={() => setDeclineTarget(null)}><X size={20} /></button>
                        </div>
                        <p className="hint-ds">{declineTarget.student_first_name} {declineTarget.student_last_name} - {formatDate(declineTarget.start_time)} {formatTime(declineTarget.start_time)}</p>
                        <div className="form-group-dv">
                            <label>Reason (shown to the student)</label>
                            <textarea rows="2" required value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder="e.g. Please book the afternoon slots instead" />
                        </div>
                        <div className="modal-footer-dv">
                            <button className="sti-btn-dv sti-btn-light-dv" onClick={() => setDeclineTarget(null)}>Cancel</button>
                            <button className="sti-btn-dv sti-btn-primary-dv" onClick={handleDecline}>Decline booking</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
