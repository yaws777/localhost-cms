// DoctorServices.jsx
// The check-ups / check-ups a doctor covers. Used by the doctor (My Profile) and by the nurse (Manage Doctor Accounts).
// The choices are the visit types the doctor's specialization takes; the nurse sees the same list when assigning a visit and
// the student sees it when picking a doctor, so a doctor is only given the conditions they actually handle.
import React, { useState, useEffect } from 'react';
import { Stethoscope } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { API, allowedTypes, coveredTypes, GENERAL_VISIT_TYPE } from '../../utils/scheduling';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const DoctorServices = ({ doctor, onSaved, compact = false }) => {
    const { showAlert } = useAlert();
    const [chosen, setChosen] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const allowed = allowedTypes(doctor);
    // reset only when another doctor is shown or the saved list changes, not on every keystroke elsewhere in a form
    const savedKey = JSON.stringify([doctor.covered_visit_types, doctor.allowed_visit_types]);
    useEffect(() => {
        setChosen(coveredTypes(doctor));
        setError('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doctor.doctor_id, savedKey]);

    const toggle = (type) => setChosen((prev) => (prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]));

    const save = async (e) => {
        e.preventDefault();
        setError('');
        if (chosen.length === 0) { setError('Pick at least one check-up.'); return; }
        setBusy(true);
        try {
            const res = await fetch(`${API}/api/doctor/${doctor.doctor_id}/services`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ services: chosen })
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
            {!compact && (
                <p className="dp-hint" style={{ margin: 0 }}>
                    Tick the check-ups you cover. The nurse sees this when appointing students to you, and students only see you for these.
                    {allowed.length === 1 && ` ${doctor.specialization || 'Your specialization'} covers ${allowed[0]} only.`}
                </p>
            )}
            {error && <div className="dp-error">{error}</div>}
            <div className="service-grid-sc">
                {allowed.map((type) => (
                    <label key={type} className="service-option-sc">
                        <input type="checkbox" checked={chosen.includes(type)} onChange={() => toggle(type)} />
                        <span>
                            <strong>{type}</strong>
                            <br />
                            <small style={{ color: 'var(--text-secondary)' }}>{type === GENERAL_VISIT_TYPE ? 'Open to every doctor' : `Added by the ${doctor.specialization || 'specialization'} specialization`}</small>
                        </span>
                    </label>
                ))}
            </div>
            <div><button type="submit" className="dp-btn dp-btn-primary" disabled={busy}><Stethoscope size={15} /> {busy ? 'Saving...' : 'Save check-ups'}</button></div>
        </form>
    );
};

export default DoctorServices;
