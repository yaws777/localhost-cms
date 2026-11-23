// StudentHealthCard.jsx
// What the doctor reads before and during a check-up: the vital signs the nurse recorded at time in (and time out),
// the recent vital signs of the student and the health information the student reported.
//   <StudentHealthCard studentId appointmentId />   the card itself (also inside ConsultationModal)
//   <StudentHealthModal appt onClose />             the same card in a modal (HeartPulse button on queue and check-up rows)
import React, { useState, useEffect } from 'react';
import { HeartPulse, AlertTriangle, ShieldAlert, Check } from 'lucide-react';
import Modal from '../common/Modal';
import { API } from '../../utils/scheduling';
import { formatTime } from '../../utils/datetime';
import { VITAL_FIELDS, vitalState, bpKind } from '../../utils/vitals';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Vitals.css';

const tiles = (values, prefix = '') => VITAL_FIELDS.map((f) => {
    const value = values[`${prefix}${f.key}`];
    return { ...f, value: value || '', state: vitalState(f.key, value) };
});

const VitalTiles = ({ values, prefix }) => (
    <div className="hs-tiles">
        {tiles(values, prefix).map((t) => (
            <div key={t.key} className={`hs-tile ${t.state === 'abnormal' ? 'abnormal' : ''}`}>
                <small>{t.label}</small>
                <strong>{t.value ? `${t.value} ${t.unit}` : '-'}</strong>
                <small>Range {t.normal} {t.unit}</small>
                {t.state === 'abnormal' && <span className="hs-flag"><AlertTriangle size={14} aria-hidden="true" /> {t.key === 'blood_pressure' ? bpKind(t.value) : 'Not normal'}</span>}
                {t.state === 'normal' && <span className="hs-flag hs-flag-ok"><Check size={14} aria-hidden="true" /> Normal</span>}
            </div>
        ))}
    </div>
);

export const StudentHealthCard = ({ studentId, appointmentId }) => {
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let live = true;
        setData(null);
        setFailed(false);
        const qs = appointmentId ? `?appointment_id=${encodeURIComponent(appointmentId)}` : '';
        fetch(`${API}/api/students/${encodeURIComponent(studentId)}/health-snapshot${qs}`)
            .then((r) => r.json())
            .then((d) => { if (live) { if (d.success) setData(d); else setFailed(true); } })
            .catch(() => { if (live) setFailed(true); });
        return () => { live = false; };
    }, [studentId, appointmentId]);

    if (failed) return <p className="dp-hint" role="status">Health information could not be loaded.</p>;
    if (!data) return <p className="dp-hint" role="status">Loading health information...</p>;

    // only the vital signs of this check-up, recorded by the nurse; earlier visits are not shown
    const { current, conditions } = data;
    const hasOut = current && (current.out_blood_pressure || current.out_temperature || current.out_pulse_rate || current.out_respiratory_rate || current.out_nurse_note);

    return (
        <div className="hs-card">
            <section aria-label="Vital signs at time in">
                <h4 className="hs-title"><HeartPulse size={16} aria-hidden="true" /> Vital signs {current ? `at time in (${formatTime(current.time_in)})` : ''}</h4>
                {current
                    ? <VitalTiles values={current} />
                    : <p className="dp-hint">No vital signs yet. The nurse records them at time in.</p>}
            </section>

            {hasOut && (
                <section aria-label="Vital signs at time out">
                    <h4 className="hs-sub">At time out{current.time_out ? ` (${formatTime(current.time_out)})` : ''}</h4>
                    <VitalTiles values={current} prefix="out_" />
                    {current.out_nurse_note && <p className="dp-hint">Nurse remarks: {current.out_nurse_note}</p>}
                </section>
            )}

            <section aria-label="Health information">
                <h4 className="hs-title"><ShieldAlert size={16} aria-hidden="true" /> Health information</h4>
                {!data.has_health_record ? (
                    <p className="dp-hint">No health record submitted.</p>
                ) : conditions.length === 0 ? (
                    <p className="dp-hint">No known conditions.</p>
                ) : (
                    <ul className="hs-conditions">
                        {conditions.map((c) => <li key={c} className={`dp-chip ${/^Allerg/.test(c) ? 'abnormal' : 'attention'}`}>{c}</li>)}
                    </ul>
                )}
            </section>

        </div>
    );
};

export const StudentHealthModal = ({ appt, onClose }) => {
    if (!appt) return null;
    const name = appt.student_name || `${appt.student_first_name || ''} ${appt.student_last_name || ''}`.trim();
    return (
        <Modal isOpen onClose={onClose} title={`Health information - ${name}`} icon={<HeartPulse size={20} />} size="lg">
            <StudentHealthCard studentId={appt.student_id} appointmentId={appt.appointment_id} />
        </Modal>
    );
};

export default StudentHealthCard;
