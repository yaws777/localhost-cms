// ScheduleFormModal.jsx
// Add or edit a doctor's schedule. The Schedules list and the calendar both open this one form, for the nurse and for the doctor.
//   upcoming  : everything can be edited
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
    start_time: '09:00', end_time: '12:00', slot_duration_min: 15, max_patients_per_slot: 1, location: '', notes: '', announcement: '',
    allow_walk_in: true, auto_confirm: false
};

const fromSchedule = (s) => ({
    doctor_id: s.doctor_id, visit_type: s.visit_type, recurrence: s.recurrence, schedule_date: s.schedule_date || '', day_of_week: s.day_of_week ?? 1,
    valid_from: s.valid_from || '', valid_until: s.valid_until || '', start_time: hhmm(s.start_time), end_time: hhmm(s.end_time),
    slot_duration_min: s.slot_duration_min, max_patients_per_slot: s.max_patients_per_slot, location: s.location || '', notes: s.notes || '',
    announcement: s.announcement || '', allow_walk_in: hasWalkIn(s), auto_confirm: !!s.auto_confirm
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

    useEffect(() => {
        if (!isOpen) return;
        const today = todayKey();
        setForm(schedule
            ? fromSchedule(schedule)
            : { ...EMPTY, doctor_id: creator.doctorId || '', schedule_date: today, valid_from: today, valid_until: today, ...preset });
        setError('');
        setBusy(false);
    }, [isOpen, schedule, preset, creator.doctorId]);

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
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
        setBusy(true);
        try {
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
        <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit schedule' : 'Add schedule'} icon={<CalendarPlus size={20} />} size="lg" closeOnBackdrop={false}>
            <form className="dp-form" onSubmit={submit}>
                {error && <div className="dp-error" role="alert">{error}</div>}
                {running && <div className="dp-error">This session is happening now, so its dates and hours are locked. Use Extend to keep it open longer; the rest can still be edited.</div>}
                {hasBookings && !running && <div className="dp-notice">This schedule has upcoming bookings, so only the location, notes, walk-in setting and approval setting can change. Close the schedule to cancel the bookings first.</div>}

                <div className="dp-row">
                    <div className="dp-field">
                        <label htmlFor="sf-doctor">Doctor</label>
                        <select id="sf-doctor" className="dp-select" required disabled={editing || !!creator.doctorId} value={form.doctor_id} onChange={(e) => set({ doctor_id: e.target.value })}>
                            <option value="">-- Select doctor --</option>
                            {doctorChoices.map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name} ({d.specialization})</option>)}
                        </select>
                        {doctorChoices.length === 0 && <small className="dp-hint">No doctor covers {form.visit_type}. Check the doctors' specializations and the consultations they cover.</small>}
                    </div>
                    <div className="dp-field">
                        <label htmlFor="sf-purpose">Purpose of the consultation</label>
                        <select id="sf-purpose" className="dp-select" disabled={hasBookings || running} value={form.visit_type} onChange={(e) => changePurpose(e.target.value)}>
                            {purposeOptions.map((t) => <option key={t} value={t}>{t === 'Any' ? 'Any (student picks)' : t}</option>)}
                        </select>
                    </div>
                </div>
                {doctor && <small className="dp-hint">Dr. {doctor.last_name} covers: {coveredTypes(doctor).join(', ')}.</small>}
                {refusal && <div className="dp-error">{refusal}</div>}

                <div className="dp-field">
                    <label htmlFor="sf-repeat">Repeats</label>
                    <select id="sf-repeat" className="dp-select" disabled={running || hasBookings} value={form.recurrence} onChange={(e) => set({ recurrence: e.target.value })}>
                        <option value="Once">One date only</option>
                        <option value="Weekly">Every week on a weekday</option>
                    </select>
                </div>

                {form.recurrence === 'Once' ? (
                    <div className="dp-field">
                        <label htmlFor="sf-date">Date</label>
                        <input id="sf-date" className="dp-input" type="date" required disabled={running || hasBookings} min={todayKey()} value={form.schedule_date} onChange={(e) => set({ schedule_date: e.target.value })} />
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
                        <input id="sf-start" className="dp-input" type="time" required disabled={running || hasBookings} value={form.start_time} onChange={(e) => set({ start_time: e.target.value })} />
                    </div>
                    <div className="dp-field">
                        <label htmlFor="sf-end">End time</label>
                        <input id="sf-end" className="dp-input" type="time" required disabled={running || hasBookings} value={form.end_time} onChange={(e) => set({ end_time: e.target.value })} />
                    </div>
                    <div className="dp-field">
                        <label htmlFor="sf-slot">Minutes per slot</label>
                        <input id="sf-slot" className="dp-input" type="number" min="5" max="240" step="5" required disabled={hasBookings} value={form.slot_duration_min} onChange={(e) => set({ slot_duration_min: e.target.value })} />
                    </div>
                    <div className="dp-field">
                        <label htmlFor="sf-cap">Patients per slot</label>
                        <input id="sf-cap" className="dp-input" type="number" min="1" max="50" required value={form.max_patients_per_slot} onChange={(e) => set({ max_patients_per_slot: e.target.value })} />
                    </div>
                </div>

                <div className="dp-field">
                    <label htmlFor="sf-location">Location (optional)</label>
                    <input id="sf-location" className="dp-input" type="text" maxLength={100} placeholder="e.g. Clinic Room 1" value={form.location} onChange={(e) => set({ location: e.target.value })} />
                </div>

                <label className="dp-check"><input type="checkbox" checked={form.allow_walk_in} onChange={(e) => set({ allow_walk_in: e.target.checked })} /> Accept walk-ins during this schedule (appointments are still seen first)</label>
                <label className="dp-check"><input type="checkbox" checked={form.auto_confirm} onChange={(e) => set({ auto_confirm: e.target.checked })} /> Confirm students' open-slot bookings automatically (otherwise the nurse or doctor approves each one)</label>

                {form.allow_walk_in && (
                    <div className="dp-field">
                        <label htmlFor="sf-announce">Announcement for students (optional)</label>
                        <textarea id="sf-announce" className="dp-textarea" rows={2} maxLength={500} placeholder="e.g. Walk-ins are welcome. No booking needed, just come to the clinic." value={form.announcement} onChange={(e) => set({ announcement: e.target.value })} />
                    </div>
                )}
                <div className="dp-field">
                    <label htmlFor="sf-notes">Notes for students (optional)</label>
                    <input id="sf-notes" className="dp-input" type="text" maxLength={255} placeholder="e.g. Bring your student ID" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
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
