// UnavailableDates.jsx
// A button (Calendar tab of the doctor's My Schedule) that opens the form for dates, or a time window, when the doctor cannot see patients.
// Nothing can be booked or requested on these dates; appointments already booked there can be cancelled in one step.
// The dates show on the calendar (the nurse sees them too) and are removed from the day panel there.
import React, { useState } from 'react';
import { CalendarOff } from 'lucide-react';
import Modal from '../common/Modal';
import { useAlert } from '../../context/AlertContext';
import { localDateStr } from '../../utils/visitPurpose';
import '../../styles/doctor/DoctorLayout.css';

const API = 'https://localhost-cms.onrender.com';

const EMPTY = { doctor_id: '', start_date: '', end_date: '', whole_day: true, start_time: '13:00', end_time: '17:00', reason: '' };

const UnavailableDates = ({ doctors = [], fixedDoctorId, userId, onChanged, defaultDate }) => {
    const { showAlert, showConfirm } = useAlert();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const openForm = () => {
        const start = defaultDate && defaultDate >= localDateStr() ? defaultDate : localDateStr();
        setForm({ ...EMPTY, doctor_id: fixedDoctorId || '', start_date: start, end_date: start });
        setError('');
        setShowForm(true);
    };

    const save = async (cancelConflicts = false) => {
        setError('');
        if (!form.doctor_id) { setError('Choose the doctor.'); return; }
        if (!form.start_date || !form.end_date) { setError('Pick the dates.'); return; }
        if (form.end_date < form.start_date) { setError('The end date must be on or after the start date.'); return; }
        if (!form.whole_day && form.end_time <= form.start_time) { setError('The end time must be after the start time.'); return; }

        setBusy(true);
        try {
            const res = await fetch(`${API}/api/doctor-unavailable-dates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    doctor_id: form.doctor_id, start_date: form.start_date, end_date: form.end_date,
                    start_time: form.whole_day ? null : form.start_time, end_time: form.whole_day ? null : form.end_time,
                    reason: form.reason, actor_user_id: userId, cancel_conflicts: cancelConflicts
                })
            });
            const data = await res.json();
            if (data.success) {
                setShowForm(false);
                showAlert(data.message, 'success');
                onChanged?.();
            } else if (data.needs_confirmation) {
                const ok = await showConfirm(data.message, { danger: true, confirmLabel: 'Cancel those appointments', title: 'Appointments in this period' });
                if (ok) { setBusy(false); await save(true); return; }
            } else {
                setError(data.message || 'Could not save.');
            }
        } catch (e) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <button type="button" className="sti-btn-dv sti-btn-secondary-dv" onClick={openForm}><CalendarOff size={15} /> Unavailable dates</button>

            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add unavailable dates" icon={<CalendarOff size={20} />} size="md">
                <form className="dp-form" onSubmit={(e) => { e.preventDefault(); save(false); }}>
                    <p className="dp-hint">The nurse cannot ask for a schedule on these days or times, and students cannot book them. Use it for leave, seminars or any time the doctor is not at the clinic.</p>
                    {error && <div className="dp-error" role="alert">{error}</div>}
                    {!fixedDoctorId && (
                        <div className="dp-field">
                            <label htmlFor="ud-doctor">Doctor</label>
                            <select id="ud-doctor" className="dp-select" required value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
                                <option value="">-- Select doctor --</option>
                                {doctors.map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="dp-row">
                        <div className="dp-field">
                            <label htmlFor="ud-from">From</label>
                            <input id="ud-from" className="dp-input" type="date" required min={localDateStr()} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: form.end_date < e.target.value ? e.target.value : form.end_date })} />
                        </div>
                        <div className="dp-field">
                            <label htmlFor="ud-until">Until</label>
                            <input id="ud-until" className="dp-input" type="date" required min={form.start_date || localDateStr()} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                        </div>
                    </div>
                    <label className="dp-check"><input type="checkbox" checked={form.whole_day} onChange={(e) => setForm({ ...form, whole_day: e.target.checked })} /> The whole day</label>
                    {!form.whole_day && (
                        <div className="dp-row">
                            <div className="dp-field"><label htmlFor="ud-from-time">From time</label><input id="ud-from-time" className="dp-input" type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                            <div className="dp-field"><label htmlFor="ud-until-time">Until time</label><input id="ud-until-time" className="dp-input" type="time" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                        </div>
                    )}
                    <div className="dp-field">
                        <label htmlFor="ud-reason">Reason (optional)</label>
                        <input id="ud-reason" className="dp-input" maxLength={255} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Medical seminar" />
                    </div>
                    <div className="dp-modal-foot">
                        <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                        <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                    </div>
                </form>
            </Modal>
        </>
    );
};

export default UnavailableDates;
