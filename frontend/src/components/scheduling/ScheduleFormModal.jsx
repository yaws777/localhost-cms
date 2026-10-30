// ScheduleFormModal.jsx
// Add or edit a doctor's schedule (a session with a queue). The Schedules list and the calendar both open this one form. The doctor sets the
// schedule; when it answers a nurse's schedule request, preset.schedule_request_id links the two.
//   upcoming  : everything can be edited; with students in the queue a one-date session can still be moved here (date / hours + a reason, the students move with it)
//   ongoing   : the session is happening now, so its dates and hours are locked (extend it instead)
//   past      : closed, it cannot be opened for editing at all
import React, { useState, useEffect, useMemo } from 'react';
import { CalendarPlus } from 'lucide-react';
import Modal from '../common/Modal';
import { useAlert } from '../../context/AlertContext';
import { useSpecializations } from '../../hooks/useSpecializations';
import { API, WEEKDAYS, eligibleDoctors, visitRefusal, coveredTypes, hasWalkIn, hhmm, todayKey } from '../../utils/scheduling';
import { creatorBody } from './SessionModals';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const EMPTY = {
    doctor_id: '', visit_type: 'Any', recurrence: 'Once', schedule_date: '', day_of_week: 1, valid_from: '', valid_until: '',
    start_time: '09:00', end_time: '12:00', slot_duration_min: 15, max_patients_per_slot: 1, listing_limit: '', location: '', notes: '',
    allow_walk_in: true
};

const fromSchedule = (s) => ({
    doctor_id: s.doctor_id, visit_type: s.visit_type, recurrence: s.recurrence, schedule_date: s.schedule_date || '', day_of_week: s.day_of_week ?? 1,
    valid_from: s.valid_from || '', valid_until: s.valid_until || '', start_time: hhmm(s.start_time), end_time: hhmm(s.end_time),
    slot_duration_min: s.slot_duration_min, max_patients_per_slot: s.max_patients_per_slot, listing_limit: s.listing_limit ?? '', location: s.location || '', notes: s.notes || s.announcement || '',
    allow_walk_in: hasWalkIn(s)
});

// creator: { nurseId } or { doctorId }; schedule: the schedule being edited (none = add); preset: values for a new one
const ScheduleFormModal = ({ isOpen, schedule, preset, doctors, creator, userId, onClose, onSaved }) => {
    const { showAlert } = useAlert();
    const { visitTypes } = useSpecializations();
    const [form, setForm] = useState(EMPTY);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const editing = !!schedule;
    const running = !!(schedule && schedule.in_session_now);
    const hasBookings = !!(schedule && Number(schedule.active_bookings) > 0);
    // an upcoming one-date session with students in its queue can still be moved: the whole session goes with its students (needs a reason)
    const canMove = hasBookings && !running && !!schedule && schedule.recurrence === 'Once' && !creator.nurseId;
    const lockTiming = running || (hasBookings && !canMove);
    const [reason, setReason] = useState('');
    const moved = canMove && (form.schedule_date !== (schedule.schedule_date || '') || form.start_time !== hhmm(schedule.start_time) || form.end_time !== hhmm(schedule.end_time));

    useEffect(() => {
        if (!isOpen) return;
        const today = todayKey();
        setForm(schedule
            ? fromSchedule(schedule)
            : { ...EMPTY, doctor_id: creator.doctorId || '', schedule_date: today, valid_from: today, valid_until: today, ...preset });
        setError('');
        setReason('');
        setBusy(false);
    }, [isOpen, schedule, preset, creator.doctorId]);

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));

    const accepted = schedule ? Number(schedule.accepted) || 0 : 0;
    const doctor = doctors.find((d) => d.doctor_id === form.doctor_id);

    // the purpose list follows the doctor; the doctor list follows the purpose
    const purposeOptions = useMemo(() => {
        const base = doctor ? visitTypes.filter((t) => coveredTypes(doctor).includes(t)) : visitTypes;
        return ['Any', ...(base.includes(form.visit_type) || form.visit_type === 'Any' ? base : [...base, form.visit_type])];
    }, [doctor, visitTypes, form.visit_type]);
    const doctorChoices = editing || creator.doctorId ? doctors : eligibleDoctors(doctors, form.visit_type);
    const refusal = doctor ? visitRefusal(doctor, form.visit_type) : '';

    const changePurpose = (visit_type) => {
        const stillOk = !form.doctor_id || eligibleDoctors(doctors, visit_type).some((d) => d.doctor_id === form.doctor_id);
        set({ visit_type, doctor_id: stillOk ? form.doctor_id : '' });
    };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (refusal) { setError(refusal); return; }
        if (moved && !reason.trim()) { setError('Give a reason for moving the session. The students and their parents are told.'); return; }
        setBusy(true);
        try {
            if (moved) {
                const mv = await fetch(`${API}/api/doctor-schedules/${schedule.schedule_id}/reschedule`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ schedule_date: form.schedule_date, start_time: form.start_time, end_time: form.end_time, reason: reason.trim(), sender_id: userId })
                });
                const mvData = await mv.json();
                if (!mvData.success) { setError(mvData.message || 'Could not move the session.'); return; }
            }
            const res = await fetch(editing ? `${API}/api/doctor-schedules/${schedule.schedule_id}` : `${API}/api/doctor-schedules`, {
                method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, ...creatorBody(creator), sender_id: userId })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); onSaved?.(); onClose(); }
            else setError(data.message || 'Could not save the schedule.');
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit schedule' : preset && preset.schedule_request_id ? 'Set the schedule you were asked for' : 'Add schedule'} icon={<CalendarPlus size={20} />} size="lg" closeOnBackdrop={false}>
            <form className="dp-form" onSubmit={submit}>
                {error && <div className="dp-error" role="alert">{error}</div>}
                {running && <div className="dp-error">This session is happening now, so its dates and hours are locked. Use Extend to keep it open longer; the rest can still be edited.</div>}
                {hasBookings && !running && canMove && <div className="dp-notice">This schedule already has students in its queue. You can move the date and hours (the whole session moves with its students, who keep their numbers) and change the location, notes and walk-in setting. Close the schedule to cancel their places instead.</div>}
                {hasBookings && !running && !canMove && <div className="dp-notice">This schedule already has students in its queue, so only the location, notes and walk-in setting can change. Close the schedule to cancel their places first.</div>}
                {/* a new schedule is always one date; an existing weekly series keeps its weekday fields */}

                <div className="dp-row">
                    <div className="dp-field">
                        <label htmlFor="sf-doctor">Doctor</label>
                        <select id="sf-doctor" className="dp-select" required disabled={editing || !!creator.doctorId} value={form.doctor_id} onChange={(e) => set({ doctor_id: e.target.value })}>
                            <option value="">-- Select doctor --</option>
                            {doctorChoices.map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name} ({d.specialization})</option>)}
                        </select>
                        {doctorChoices.length === 0 && <small className="dp-hint">No doctor covers {form.visit_type}. Check the doctors' specializations and the check-ups they cover.</small>}
                    </div>
                    <div className="dp-field">
                        <label htmlFor="sf-purpose">Purpose of the check-up</label>
                        <select id="sf-purpose" className="dp-select" disabled={hasBookings || running} value={form.visit_type} onChange={(e) => changePurpose(e.target.value)}>
                            {purposeOptions.map((t) => <option key={t} value={t}>{t === 'Any' ? 'Any (student picks)' : t}</option>)}
                        </select>
                    </div>
                </div>
                {doctor && <small className="dp-hint">Dr. {doctor.last_name} covers: {coveredTypes(doctor).join(', ')}.</small>}
                {refusal && <div className="dp-error">{refusal}</div>}

                {form.recurrence === 'Once' ? (
                    <div className="dp-field">
                        <label htmlFor="sf-date">Date</label>
                        <input id="sf-date" className="dp-input" type="date" required disabled={lockTiming} min={todayKey()} value={form.schedule_date} onChange={(e) => set({ schedule_date: e.target.value })} />
                    </div>
                ) : (
                    <div className="dp-row">
                        <div className="dp-field">
                            <label htmlFor="sf-weekday">Weekday</label>
                            <select id="sf-weekday" className="dp-select" disabled={running || hasBookings} value={form.day_of_week} onChange={(e) => set({ day_of_week: Number(e.target.value) })}>
                                {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
                            </select>
                        </div>
                        <div className="dp-field">
                            <label htmlFor="sf-from">From</label>
                            <input id="sf-from" className="dp-input" type="date" required disabled={running || hasBookings} value={form.valid_from} onChange={(e) => set({ valid_from: e.target.value })} />
                        </div>
                        <div className="dp-field">
                            <label htmlFor="sf-until">Until</label>
                            <input id="sf-until" className="dp-input" type="date" required disabled={running || hasBookings} min={form.valid_from} value={form.valid_until} onChange={(e) => set({ valid_until: e.target.value })} />
                        </div>
                    </div>
                )}

                <div className="dp-row">
                    <div className="dp-field">
                        <label htmlFor="sf-start">Start time</label>
                        <input id="sf-start" className="dp-input" type="time" required disabled={lockTiming} value={form.start_time} onChange={(e) => set({ start_time: e.target.value })} />
                    </div>
                    <div className="dp-field">
                        <label htmlFor="sf-end">End time</label>
                        <input id="sf-end" className="dp-input" type="time" required disabled={lockTiming} value={form.end_time} onChange={(e) => set({ end_time: e.target.value })} />
                    </div>
                </div>

                {moved && (
                    <div className="dp-field">
                        <label htmlFor="sf-reason">Reason for moving the session</label>
                        <textarea id="sf-reason" className="dp-textarea" rows={2} maxLength={255} required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The doctor has a meeting on that day" />
                        <small className="dp-hint">The students in the queue and their parents are told. Their queue numbers stay the same.</small>
                    </div>
                )}

                <div className="dp-field">
                    <label htmlFor="sf-location">Location (optional)</label>
                    <input id="sf-location" className="dp-input" type="text" maxLength={100} placeholder="e.g. Clinic Room 1" value={form.location} onChange={(e) => set({ location: e.target.value })} />
                </div>

                <div className="dp-field">
                    <label htmlFor="sf-limit" title="How many students the nurse can accept into this session">Listing limit</label>
                    <input
                        id="sf-limit" className="dp-input" type="number" min={Math.max(1, accepted)} max={500} required
                        value={form.listing_limit} aria-describedby="sf-limit-hint"
                        onChange={(e) => set({ listing_limit: e.target.value })}
                    />
                    <small id="sf-limit-hint" className="dp-hint">
                        The nurse opens the listing and accepts students until this number is reached; each gets a queue number in the order of acceptance.
                        {accepted > 0 ? `${accepted} already accepted. ` : ''}Walk-ins are called after the listed students.
                    </small>
                </div>
                <label className="dp-check"><input type="checkbox" checked={form.allow_walk_in} onChange={(e) => set({ allow_walk_in: e.target.checked })} /> Accept walk-ins while this check-up is in session (they are called after the appointed students)</label>

                <div className="dp-field">
                    <label htmlFor="sf-notes">Notes for Students (optional)</label>
                    <textarea id="sf-notes" className="dp-textarea" rows={2} maxLength={255} placeholder="Bring your student ID" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
                </div>

                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy || !form.doctor_id}>{busy ? 'Saving...' : 'Save schedule'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default ScheduleFormModal;
