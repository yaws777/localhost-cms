// VitalHint.jsx
// Under a vital sign input: the normal range always, and "Normal" / "Not normal" as soon as a value is typed (icon + text, never color alone).
// Same ranges as utils/vitals.js and the server (readVitals).
import React from 'react';
import { Check, AlertTriangle, CircleAlert } from 'lucide-react';
import { VITAL_FIELDS, vitalState, bpKind } from '../../utils/vitals';
import '../../styles/scheduling/Vitals.css';

const STATE_TEXT = { normal: 'Normal', abnormal: 'Not normal', invalid: 'Check value' };
const STATE_ICON = { normal: Check, abnormal: AlertTriangle, invalid: CircleAlert };

const VitalHint = ({ fieldKey, value, id }) => {
    const f = VITAL_FIELDS.find((x) => x.key === fieldKey);
    if (!f) return null;
    const st = vitalState(fieldKey, value);
    const Icon = STATE_ICON[st];
    const text = st === 'abnormal' && fieldKey === 'blood_pressure' ? bpKind(value) : STATE_TEXT[st];
    return (
        <small id={id} className={`vt-hint-vt ${st}`} aria-live="polite">
            <span className="vt-range-vt">Range {f.normal} {f.unit}</span>
            {Icon && <span className={`vt-state-vt ${st}`}><Icon size={14} aria-hidden="true" /> {text}</span>}
        </small>
    );
};

export default VitalHint;
