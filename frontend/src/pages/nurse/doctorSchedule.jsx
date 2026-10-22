// doctorSchedule.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { CalendarPlus, CalendarClock, Edit, Lock, Unlock, Trash2, X, Check, XCircle, Inbox, ArrowLeft, Stethoscope } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime } from '../../utils/datetime';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';

const API = 'http://localhost:3001';

const VISIT_TYPES = ['Any', 'General Checkup', 'Dental Examination', 'Vision Examination', 'Follow-up', 'Referral'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

const EMPTY_FORM = {
    doctor_id: '', visit_type: 'Any', recurrence: 'Once', schedule_date: '', day_of_week: 1,
    valid_from: '', valid_until: '', start_time: '09:00', end_time: '12:00',
    slot_duration_min: 15, max_patients_per_slot: 1, location: '', notes: '', auto_confirm: false
};

const DoctorSchedule = () => {
    const { nurseId, userId } = useOutletContext() || {};
    const { showAlert, showConfirm } = useAlert();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'requests' ? 'requests' : 'schedules');
    const [doctors, setDoctors] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const [doctorFilter, setDoctorFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('Open');
    const [showRequestHistory, setShowRequestHistory] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const [closeTarget, setCloseTarget] = useState(null);
    const [closeReason, setCloseReason] = useState('');
    const [declineTarget, setDeclineTarget] = useState(null);
    const [declineReason, setDeclineReason] = useState('');

    const fetchDoctors = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/doctors`);
            const data = await res.json();
            if (data.success) setDoctors(data.doctors);
        } catch (e) {
            showAlert('Could not load doctors.', 'error');
        }
    }, [showAlert]);

    const fetchSchedules = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/doctor-schedules`);
            const data = await res.json();
            if (data.success) setSchedules(data.schedules);
        } catch (e) {
            showAlert('Could not load doctor schedules.', 'error');
        }
    }, [showAlert]);

    const fetchRequests = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/doctor-bookings?status=${showRequestHistory ? 'all' : 'pending'}`);
            const data = await res.json();
            if (data.success) setRequests(data.bookings);
        } catch (e) {
            showAlert('Could not load booking requests.', 'error');
        }
    }, [showRequestHistory, showAlert]);

    useEffect(() => {
        (async () => {
            await Promise.all([fetchDoctors(), fetchSchedules()]);
            setLoading(false);
        })();
    }, [fetchDoctors, fetchSchedules]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    // Opened from Doctor Visits: ?doctor=<id> pre-selects the doctor and opens the form
    useEffect(() => {
        const doctor = searchParams.get('doctor');
        if (doctor && searchParams.get('new') === '1' && doctors.length > 0) {
            openCreate(doctor);
            setSearchParams({}, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doctors, searchParams]);

    const doctorName = (d) => `Dr. ${d.first_name} ${d.last_name}`;

    const doctorsWithoutSchedule = useMemo(() => {
        const open = new Set(schedules.filter(s => s.status === 'Open' && !s.is_expired).map(s => s.doctor_id));
        return doctors.filter(d => !open.has(d.doctor_id));
    }, [doctors, schedules]);

    const visibleSchedules = useMemo(() => schedules.filter(s => {
        if (doctorFilter && s.doctor_id !== doctorFilter) return false;
        if (statusFilter === 'Open') return s.status === 'Open';
        if (statusFilter === 'Closed') return s.status === 'Closed';
        return true;
    }), [schedules, doctorFilter, statusFilter]);

    const pendingCount = useMemo(() => requests.filter(r => r.status === 'Pending Approval').length, [requests]);

    const openCreate = (doctorId = '') => {
        setEditingId(null);
        setFormError('');
        setForm({ ...EMPTY_FORM, doctor_id: doctorId, schedule_date: todayStr(), valid_from: todayStr(), valid_until: todayStr() });
        setShowModal(true);
    };

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
            const payload = { ...form, nurse_id: nurseId };
            const res = await fetch(editingId ? `${API}/api/doctor-schedules/${editingId}` : `${API}/api/doctor-schedules`, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setShowModal(false);
                showAlert(data.message, 'success');
                fetchSchedules();
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
            if (data.success) { showAlert(data.message, 'success'); fetchSchedules(); fetchRequests(); }
            else showAlert(data.message || 'Failed to close schedule.', 'error');
        } catch (err) {
            showAlert('Server error closing the schedule.', 'error');
        }
    };

    const handleReopen = async (s) => {
        try {
            const res = await fetch(`${API}/api/doctor-schedules/${s.schedule_id}/reopen`, { method: 'PUT' });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); fetchSchedules(); }
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
            if (data.success) { showAlert(data.message, 'success'); fetchSchedules(); }
            else showAlert(data.message || 'Failed to delete schedule.', 'error');
        } catch (err) {
            showAlert('Server error deleting the schedule.', 'error');
        }
    };

    const handleApprove = async (r) => {
        try {
            const res = await fetch(`${API}/api/doctor-bookings/${r.appointment_id}/approve`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_id: userId })
            });
            const data = await res.json();
            if (data.success) { showAlert('Booking approved. The student and parent were notified.', 'success'); fetchRequests(); fetchSchedules(); }
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
            if (data.success) { showAlert('Booking declined. The student and parent were notified.', 'success'); fetchRequests(); fetchSchedules(); }
            else showAlert(data.message || 'Failed to decline.', 'error');
        } catch (err) {
            showAlert('Server error declining the booking.', 'error');
        }
    };

    const whenLabel = (s) => {
        if (s.recurrence === 'Once') return dateLabel(s.schedule_date);
        return `Every ${WEEKDAYS[s.day_of_week]}, ${dateLabel(s.valid_from)} - ${dateLabel(s.valid_until)}`;
    };

    const statusBadge = (s) => {
        if (s.status === 'Closed') return <span className="badge-ds badge-closed-ds">Closed</span>;
        if (s.is_expired) return <span className="badge-ds badge-expired-ds">Ended</span>;
        return <span className="badge-ds badge-open-ds">Open</span>;
    };

    const requestStatusBadge = (status) => {
        const cls = status === 'Pending Approval' ? 'badge-pending-ds' : status === 'Scheduled' || status === 'Completed' ? 'badge-open-ds' : 'badge-closed-ds';
        return <span className={`badge-ds ${cls}`}>{status === 'Scheduled' ? 'Approved' : status}</span>;
    };

    const selectedDoctor = doctors.find(d => d.doctor_id === form.doctor_id);

    return (
        <div className="container-dv">
            <div className="header-dv">
                <div>
                    <h2>Doctor Schedule</h2>
                    <p>Set when each doctor is available. Students book from these slots, and you approve the requests.</p>
                </div>
                <div className="header-actions-dv" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button className="sti-btn-dv sti-btn-secondary-dv" onClick={() => navigate('/DoctorVisit')}>
                        <ArrowLeft size={16} /> Doctor Visits
                    </button>
                    <button className="sti-btn-dv sti-btn-primary-dv" onClick={() => openCreate(doctorFilter)}>
                        <CalendarPlus size={16} /> Add Schedule
                    </button>
                </div>
            </div>

            {doctorsWithoutSchedule.length > 0 && !loading && (
                <div className="no-schedule-panel-ds">
                    <strong>No schedule yet</strong>
                    {doctorsWithoutSchedule.map(d => (
                        <div key={d.doctor_id} className="no-schedule-row-ds">
                            <span><Stethoscope size={14} /> {doctorName(d)} ({d.specialization})</span>
                            <button className="sti-btn-dv sti-btn-secondary-dv" onClick={() => openCreate(d.doctor_id)}>
                                <CalendarPlus size={14} /> Set up schedule
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="tabs-container-dv">
                <div className="tabs-dv">
                    <button className={`tab-btn-dv ${activeTab === 'schedules' ? 'active-dv' : ''}`} onClick={() => setActiveTab('schedules')}>
                        <CalendarClock size={16} /> Schedules
                    </button>
                    <button className={`tab-btn-dv ${activeTab === 'requests' ? 'active-dv' : ''}`} onClick={() => setActiveTab('requests')}>
                        <Inbox size={16} /> Booking Requests {pendingCount > 0 && <span className="count-pill-ds">{pendingCount}</span>}
                    </button>
                </div>
            </div>

            {activeTab === 'schedules' && (
                <>
                    <div className="filters-ds">
                        <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)}>
                            <option value="">All doctors</option>
                            {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>{doctorName(d)}</option>)}
                        </select>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="Open">Open</option>
                            <option value="Closed">Closed</option>
                            <option value="All">All</option>
                        </select>
                    </div>

                    <div className="table-card-dv">
                        <table className="sti-table-dv">
                            <thead>
                                <tr>
                                    <th>Doctor</th><th>Visit Type</th><th>When</th><th>Time</th><th>Slots</th>
                                    <th>Location</th><th>Bookings</th><th>Status</th><th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleSchedules.length === 0 ? (
                                    <tr><td colSpan="9" className="empty-ds">{loading ? 'Loading...' : 'No schedules to show.'}</td></tr>
                                ) : visibleSchedules.map(s => (
                                    <tr key={s.schedule_id}>
                                        <td>Dr. {s.doc_first_name} {s.doc_last_name}<div className="muted-ds">{s.specialization}</div></td>
                                        <td>{s.visit_type}</td>
                                        <td>{whenLabel(s)}{s.next_date && s.recurrence === 'Weekly' && <div className="muted-ds">Next: {dateLabel(s.next_date)}</div>}</td>
                                        <td>{to12h(s.start_time)} - {to12h(s.end_time)}</td>
                                        <td>{s.slot_duration_min} min x {s.max_patients_per_slot}{s.auto_confirm ? <div className="muted-ds">Auto-confirm</div> : null}</td>
                                        <td>{s.location || '-'}</td>
                                        <td>
                                            {s.active_bookings} upcoming
                                            {s.pending_bookings > 0 && <div className="muted-ds">{s.pending_bookings} awaiting approval</div>}
                                        </td>
                                        <td>{statusBadge(s)}{s.status === 'Closed' && s.closed_reason ? <div className="muted-ds">{s.closed_reason}</div> : null}</td>
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
                </>
            )}

            {activeTab === 'requests' && (
                <>
                    <div className="filters-ds">
                        <label className="check-ds">
                            <input type="checkbox" checked={showRequestHistory} onChange={e => setShowRequestHistory(e.target.checked)} />
                            Show approved / declined / cancelled (last 60 days)
                        </label>
                    </div>
                    <div className="table-card-dv">
                        <table className="sti-table-dv">
                            <thead>
                                <tr><th>Student</th><th>Doctor</th><th>Visit Type</th><th>Requested Slot</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {requests.length === 0 ? (
                                    <tr><td colSpan="7" className="empty-ds">No booking requests.</td></tr>
                                ) : requests.map(r => (
                                    <tr key={r.appointment_id}>
                                        <td>{r.student_first_name} {r.student_last_name}<div className="muted-ds">{r.student_id} {r.program_name ? `- ${r.program_name} ${r.year_level || ''}${r.section || ''}` : ''}</div></td>
                                        <td>Dr. {r.doc_first_name} {r.doc_last_name}</td>
                                        <td>{r.visit_type}</td>
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
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

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
                                    {VISIT_TYPES.map(t => <option key={t} value={t}>{t === 'Any' ? 'Any (student picks)' : t}</option>)}
                                </select>
                                {selectedDoctor && (form.visit_type === 'Dental Examination' || form.visit_type === 'Vision Examination') && (
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
                                    Confirm student bookings automatically (no nurse approval)
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
        </div>
    );
};

export default DoctorSchedule;
