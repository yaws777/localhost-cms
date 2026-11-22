// VitalsModal.jsx
// The nurse's vital signs of a doctor check-up.
//   mode "in"  - Time in: all four vital signs are required; not normal values are saved and flagged, the student still goes to the doctor.
//   mode "out" - Time out after the check-up: the vital signs and the remarks are optional (remarks are written from the vital signs).
// appt: { appointment_id, student_id, name, label }. onDone() runs after the server saved it.
import React, { useEffect, useMemo, useState } from 'react';
import { HeartPulse, Check, AlertTriangle, CircleAlert, Pill } from 'lucide-react';
import Modal from '../common/Modal';
import { useAlert } from '../../context/AlertContext';
import { API } from '../../utils/scheduling';
import { VITAL_FIELDS, EMPTY_VITALS, vitalState, hasVitals, vitalsRemarks } from '../../utils/vitals';
import '../../styles/scheduling/Vitals.css';

const STATE_TEXT = { normal: 'Normal', abnormal: 'Not normal', invalid: 'Check value' };
const STATE_ICON = { normal: Check, abnormal: AlertTriangle, invalid: CircleAlert };

const SPECIFY_CONDITIONS = ['injury', 'others', 'gastrointestinal issues', 'body pain'];
const EMPTY_DISPENSE = { complaintId: '', specify: '', medicineId: '', batchId: '', quantity: '' };
const isLiveBatch = (b) => {
    if (!b || !(parseInt(b.current_stock, 10) > 0)) return false;
    const exp = new Date(b.expiration_date);
    if (isNaN(exp)) return true;
    exp.setHours(23, 59, 59, 999);
    return exp >= new Date();
};
const expiryText = (d) => { const x = new Date(d); return isNaN(x) ? String(d || '') : x.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }); };

const VitalsModal = ({ appt, mode, userId, onClose, onDone }) => {
    const { showAlert } = useAlert();
    const isIn = mode === 'in';
    const [values, setValues] = useState(EMPTY_VITALS);
    const [note, setNote] = useState('');
    const [noteEdited, setNoteEdited] = useState(false); // the nurse typed her own remarks: stop writing them from the vital signs
    const [busy, setBusy] = useState(false);
    const [dispense, setDispense] = useState(EMPTY_DISPENSE);
    const [complaints, setComplaints] = useState([]);
    const [batches, setBatches] = useState([]);

    // medicine given at time out: conditions and the batches in stock
    useEffect(() => {
        if (isIn || !appt) return undefined;
        let live = true;
        Promise.all([
            fetch(`${API}/api/chief-complaints`).then((r) => r.json()).catch(() => []),
            fetch(`${API}/api/medicines/batches`).then((r) => r.json()).catch(() => [])
        ]).then(([c, b]) => { if (live) { setComplaints(Array.isArray(c) ? c : []); setBatches(Array.isArray(b) ? b : []); } });
        return () => { live = false; };
    }, [isIn, appt]);

    // remarks follow the vital signs until the nurse writes her own
    useEffect(() => {
        if (isIn || noteEdited) return;
        setNote(vitalsRemarks(values));
    }, [isIn, noteEdited, values]);

    const liveBatches = useMemo(
        () => batches.filter((b) => isLiveBatch(b) && String(b.complaint_ids || '').split(',').includes(String(dispense.complaintId))),
        [batches, dispense.complaintId]
    );
    const medicineOptions = useMemo(
        () => Array.from(new Map(liveBatches.map((b) => [b.medicine_id, { id: b.medicine_id, name: b.medicine_name }])).values()).sort((a, b) => String(a.name).localeCompare(String(b.name))),
        [liveBatches]
    );
    const medicineBatches = liveBatches.filter((b) => String(b.medicine_id) === String(dispense.medicineId)).sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date));
    const activeBatch = batches.find((b) => b.batch_id === dispense.batchId);
    const dispenseUnit = activeBatch ? (activeBatch.dispense_unit_of_measure || activeBatch.strength_unit_of_measure || '') : '';
    const dispenseLimit = parseFloat(activeBatch?.dispense_limit) || 0;
    const complaint = complaints.find((c) => String(c.complaint_id) === String(dispense.complaintId));
    const needsSpecify = !!complaint && SPECIFY_CONDITIONS.includes(String(complaint.complaint_name).trim().toLowerCase());
    const setD = (patch) => setDispense((d) => ({ ...d, ...patch }));

    if (!appt) return null;
    const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));
    const states = Object.fromEntries(VITAL_FIELDS.map((f) => [f.key, vitalState(f.key, values[f.key])]));

    const submit = async (e) => {
        e.preventDefault();
        if (busy) return;
        const filled = VITAL_FIELDS.filter((f) => states[f.key] !== 'empty');
        if (isIn && filled.length < VITAL_FIELDS.length) { showAlert('Record all four vital signs.', 'warning'); return; }
        if (filled.some((f) => states[f.key] === 'invalid')) { showAlert('Check the vital signs. A value is not valid.', 'warning'); return; }
        const giving = !isIn && !!dispense.medicineId;
        if (giving) {
            const qty = Number(dispense.quantity);
            if (!dispense.batchId) { showAlert('Choose the batch of the medicine.', 'warning'); return; }
            if (!Number.isInteger(qty) || qty < 1) { showAlert('Quantity must be a whole number above 0.', 'warning'); return; }
            if (dispenseLimit > 0 && qty > dispenseLimit) { showAlert(`Maximum is ${dispenseLimit} ${dispenseUnit}.`, 'warning'); return; }
            if (needsSpecify && !dispense.specify.trim()) { showAlert(`Specify the ${complaint.complaint_name} condition.`, 'warning'); return; }
        }

        setBusy(true);
        try {
            const path = `/api/doctor-visits/${appt.appointment_id}/${isIn ? 'time-in' : 'time-out'}`;
            const body = isIn
                ? { sender_id: userId, student_id: appt.student_id, ...values }
                : {
                    sender_id: userId, student_id: appt.student_id, out_nurse_note: note.trim(),
                    out_blood_pressure: values.blood_pressure, out_temperature: values.temperature, out_pulse_rate: values.pulse_rate, out_respiratory_rate: values.respiratory_rate,
                    ...(giving ? { dispense: { complaint_id: dispense.complaintId, specify_complaint_text: needsSpecify ? dispense.specify.trim() : null, batch_id: dispense.batchId, dosage_consumption_unit_value: dispense.quantity } } : {})
                };
            const res = await fetch(`${API}${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            let data = {};
            try { data = await res.json(); } catch (err) { /* not json */ }
            if (!data.success) { showAlert(data.message || 'Could not save.', 'warning'); return; }
            showAlert(isIn ? `${appt.name} timed in.` : `${appt.name} timed out.`, 'success');
            if (data.abnormal?.length > 0) showAlert(`Not normal${isIn ? '' : ' at time out'}: ${data.abnormal.join('; ')}.`, 'warning');
            onDone?.();
            onClose();
        } catch (err) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen onClose={busy ? undefined : onClose} title={isIn ? 'Time in - vital signs' : 'Time out - vital signs'} icon={<HeartPulse size={20} />} size="md" closeOnBackdrop={false}>
            <form className="dp-form" onSubmit={submit} noValidate>
                <div className="dp-notice"><strong>{appt.label ? `${appt.label} ` : ''}{appt.name}</strong> <span className="dp-hint">{appt.student_id}</span></div>
                <div className="dp-row vitals-grid-vt">
                    {VITAL_FIELDS.map((f) => {
                        const st = states[f.key];
                        const Icon = STATE_ICON[st];
                        return (
                            <div className="dp-field" key={f.key}>
                                <label htmlFor={`vt-${f.key}`}>{f.label} ({f.unit}){isIn ? ' *' : ''}</label>
                                <input
                                    id={`vt-${f.key}`} className="dp-input" inputMode={f.key === 'blood_pressure' ? 'text' : 'decimal'} autoComplete="off"
                                    placeholder={f.placeholder} value={values[f.key]} onChange={(e) => set(f.key, e.target.value)}
                                    aria-describedby={`vt-${f.key}-hint`} aria-invalid={st === 'invalid'}
                                />
                                <small id={`vt-${f.key}-hint`} className={`vt-state-vt ${st}`}>
                                    {Icon ? <><Icon size={14} aria-hidden="true" /> {STATE_TEXT[st]}</> : `Normal ${f.normal}`}
                                </small>
                            </div>
                        );
                    })}
                </div>
                {!isIn && (
                    <div className="dp-field">
                        <label htmlFor="vt-note">Remarks</label>
                        <textarea id="vt-note" className="dp-textarea" rows={2} maxLength={500} value={note} onChange={(e) => { setNote(e.target.value); setNoteEdited(e.target.value.trim() !== ''); }} />
                    </div>
                )}
                {!isIn && (
                    <fieldset className="dp-field vt-dispense-vt">
                        <legend><Pill size={16} aria-hidden="true" /> Medicine given</legend>
                        {Array.isArray(appt.prescriptions) && appt.prescriptions.length > 0 && (
                            <small className="dp-hint">Prescribed: {appt.prescriptions.map((r) => [r.medicine, r.dosage].filter(Boolean).join(' ')).join('; ')}</small>
                        )}
                        <div className="dp-row">
                            <div className="dp-field">
                                <label htmlFor="vt-complaint">Medical condition</label>
                                <select id="vt-complaint" className="dp-select" value={dispense.complaintId} onChange={(e) => setDispense({ ...EMPTY_DISPENSE, complaintId: e.target.value })}>
                                    <option value="">None</option>
                                    {complaints.map((c) => <option key={c.complaint_id} value={c.complaint_id}>{c.complaint_name}</option>)}
                                </select>
                            </div>
                            {dispense.complaintId && (
                                <div className="dp-field">
                                    <label htmlFor="vt-medicine">Medicine</label>
                                    <select id="vt-medicine" className="dp-select" value={dispense.medicineId} onChange={(e) => setD({ medicineId: e.target.value, batchId: '', quantity: '' })}>
                                        <option value="">{medicineOptions.length ? 'No medicine' : 'None in stock'}</option>
                                        {medicineOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        {needsSpecify && dispense.medicineId && (
                            <div className="dp-field">
                                <label htmlFor="vt-specify">Specify condition *</label>
                                <input id="vt-specify" className="dp-input" maxLength={255} value={dispense.specify} onChange={(e) => setD({ specify: e.target.value })} />
                            </div>
                        )}
                        {dispense.medicineId && (
                            <div className="dp-row">
                                <div className="dp-field">
                                    <label htmlFor="vt-batch">Batch expiry *</label>
                                    <select id="vt-batch" className="dp-select" value={dispense.batchId} onChange={(e) => setD({ batchId: e.target.value, quantity: e.target.value ? '1' : '' })}>
                                        <option value="">Choose</option>
                                        {medicineBatches.map((b) => <option key={b.batch_id} value={b.batch_id}>{expiryText(b.expiration_date)} (stock {b.current_stock})</option>)}
                                    </select>
                                </div>
                                {dispense.batchId && (
                                    <div className="dp-field">
                                        <label htmlFor="vt-qty">Quantity ({dispenseUnit}){dispenseLimit > 0 ? ` max ${dispenseLimit}` : ''} *</label>
                                        <input id="vt-qty" className="dp-input" type="number" min="1" step="1" max={dispenseLimit > 0 ? dispenseLimit : undefined} value={dispense.quantity}
                                            onChange={(e) => setD({ quantity: e.target.value ? String(Math.max(1, Math.floor(Number(e.target.value)))) : '' })} />
                                    </div>
                                )}
                            </div>
                        )}
                    </fieldset>
                )}
                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>
                        {busy ? 'Saving...' : isIn ? 'Time in' : hasVitals(values) ? 'Time out' : 'Time out without vitals'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default VitalsModal;
