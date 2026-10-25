// DoctorServices.jsx
// The check-ups a doctor takes. Used by the doctor (My Profile) and by the nurse (Manage Doctor Accounts).
// Dental needs a dentist and Vision needs an optometrist / ophthalmologist; the server enforces the same rules.
import React, { useState, useEffect } from 'react';
import { Stethoscope } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { PURPOSES } from '../../utils/visitPurpose';
import { API, servicesOf, specializationFits } from '../../utils/scheduling';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const HINTS = {
    'General Check Up': 'Physical exams, common illnesses, health certificates',
    Dental: 'Needs a dentist specialization',
    Vision: 'Needs an optometrist or ophthalmologist specialization',
    Other: 'Any other concern the student specifies'
};

const DoctorServices = ({ doctor, onSaved, compact = false }) => {
    const { showAlert } = useAlert();
    const [chosen, setChosen] = useState([]);
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    // reset only when another doctor is shown or the saved list changes, not on every keystroke elsewhere in a form
    const savedKey = JSON.stringify(doctor.services_offered || null);
    useEffect(() => {
        const saved = servicesOf(doctor);
        // nothing saved yet = the doctor follows the specialization: show what that already allows
        setChosen(saved && saved.length > 0 ? saved : PURPOSES.filter((p) => specializationFits(doctor, p)));
        setNotes(doctor.services_notes || '');
        setError('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doctor.doctor_id, savedKey, doctor.services_notes]);

    const toggle = (p) => setChosen((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

    const save = async (e) => {
        e.preventDefault();
        setError('');
        if (chosen.length === 0) { setError('Pick at least one check-up.'); return; }
        setBusy(true);
        try {
            const res = await fetch(`${API}/api/doctor/${doctor.doctor_id}/services`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ services: chosen, notes })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); if (onSaved) onSaved(data); }
            else setError(data.message || 'Could not save the check-ups.');
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="dp-form" onSubmit={save}>
            {!compact && <p className="dp-hint" style={{ margin: 0 }}>Choose the check-ups you take. Schedules, appointments and the waiting list only use doctors who offer the check-up.</p>}
            {error && <div className="dp-error">{error}</div>}
            <div className="service-grid-sc">
                {PURPOSES.map((p) => {
                    const allowed = specializationFits(doctor, p);
                    return (
                        <label key={p} className={`service-option-sc ${allowed ? '' : 'disabled-sc'}`} title={allowed ? HINTS[p] : HINTS[p]}>
                            <input type="checkbox" disabled={!allowed} checked={allowed && chosen.includes(p)} onChange={() => toggle(p)} />
                            <span><strong>{p}</strong><br /><small style={{ color: 'var(--text-secondary)' }}>{allowed ? HINTS[p] : HINTS[p]}</small></span>
                        </label>
                    );
                })}
            </div>
            <div className="dp-field">
                <label htmlFor={`services-notes-${doctor.doctor_id}`}>Other specialties or conditions you cover (optional)</label>
                <input id={`services-notes-${doctor.doctor_id}`} className="dp-input" type="text" maxLength={255} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Pediatrics, sports injuries, mental health screening" />
            </div>
            <div><button type="submit" className="dp-btn dp-btn-primary" disabled={busy}><Stethoscope size={15} /> {busy ? 'Saving...' : 'Save check-ups'}</button></div>
        </form>
    );
};

export default DoctorServices;
