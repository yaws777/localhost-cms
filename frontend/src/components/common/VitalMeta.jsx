// VitalMeta.jsx
// Under a read-only vital sign box: the status chip (Normal / High / Low, icon + text) and the normal range.
//   status: 'Normal' | 'High' | 'Low' | '' | range: 'Range 36.1-37.8 °C' | '' (see vitalMeta in utils/vitals.js)
import React from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import '../../styles/common/VitalMeta.css';

export const VitalMeta = ({ status, range }) => {
    if (!status && !range) return null;
    const bad = !!status && status !== 'Normal';
    return (
        <div className="vm-meta">
            {status && (
                <span className={`vm-status ${bad ? 'vm-bad' : 'vm-ok'}`}>
                    {bad ? <AlertTriangle size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                    {status}
                </span>
            )}
            {range && <span className="vm-range">{range}</span>}
        </div>
    );
};

export default VitalMeta;
