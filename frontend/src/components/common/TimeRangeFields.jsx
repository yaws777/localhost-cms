// TimeRangeFields.jsx
// One start / end time control for every schedule form: Start + Length + End.
//   - change Start: End moves with it, the length stays
//   - pick a Length: End = Start + Length
//   - change End: the length follows (shown as "Custom" when it is not in the list)
// Renders a fragment of three fields, so the parent puts it inside its own row. `variant` picks the field classes:
// 'dp' (doctor / scheduling forms) or 'hs' (Health Screening).
import React, { useEffect, useRef } from 'react';

const LENGTHS = [15, 30, 45, 60, 90, 120, 180, 240];
const LAST_MIN = 23 * 60 + 59;

export const toMinutes = (t) => {
    const [h, m] = String(t || '').split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};
export const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
export const lengthText = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);

const CLASSES = {
    dp: { group: 'dp-field', input: 'dp-input', select: 'dp-select' },
    hs: { group: 'form-group-hs', input: '', select: '' }
};

export default function TimeRangeFields({
    start, end, onChange, variant = 'dp', idPrefix = 'tr', disabled = false, required = true, minStart,
    startLabel = 'Start', endLabel = 'End', lengthLabel = 'Length', lengths = LENGTHS, defaultLength = 60, extra = null
}) {
    const c = CLASSES[variant] || CLASSES.dp;
    const endRef = useRef(null);
    const s = toMinutes(start);
    const e = toMinutes(end);
    const len = Number.isFinite(s) && Number.isFinite(e) ? e - s : NaN;
    const reversed = Number.isFinite(len) && len <= 0;

    useEffect(() => {
        if (endRef.current) endRef.current.setCustomValidity(reversed ? 'The end time must be after the start time.' : '');
    }, [reversed]);

    const endFrom = (startMin, length) => toHHMM(Math.min(startMin + length, LAST_MIN));

    const changeStart = (value) => {
        const next = toMinutes(value);
        if (!Number.isFinite(next)) { onChange(value, end); return; }
        const keep = len > 0 ? len : defaultLength;
        // an empty optional end stays empty; otherwise it follows the start
        onChange(value, end || required ? endFrom(next, keep) : '');
    };
    const changeLength = (value) => {
        if (!Number.isFinite(s) || !value) return;
        onChange(start, endFrom(s, Number(value)));
    };

    const listed = lengths.includes(len);

    return (
        <>
            <div className={c.group}>
                <label htmlFor={`${idPrefix}-start`}>{startLabel}</label>
                <input
                    id={`${idPrefix}-start`} className={c.input} type="time" step={300} required={required}
                    disabled={disabled} min={minStart || undefined} value={start || ''} onChange={(ev) => changeStart(ev.target.value)}
                />
            </div>
            <div className={c.group}>
                <label htmlFor={`${idPrefix}-len`}>{lengthLabel}</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                        id={`${idPrefix}-len`} className={c.select} style={{ flex: 1, minWidth: 0 }} disabled={disabled || !Number.isFinite(s)}
                        value={Number.isFinite(len) && len > 0 ? len : ''} onChange={(ev) => changeLength(ev.target.value)}
                    >
                        {!(len > 0) && <option value="">--</option>}
                        {len > 0 && !listed && <option value={len}>{lengthText(len)}</option>}
                        {lengths.map((l) => <option key={l} value={l}>{lengthText(l)}</option>)}
                    </select>
                    {extra}
                </div>
            </div>
            <div className={c.group}>
                <label htmlFor={`${idPrefix}-end`}>{endLabel}</label>
                <input
                    id={`${idPrefix}-end`} ref={endRef} className={c.input} type="time" step={300} required={required}
                    disabled={disabled} min={start || undefined} value={end || ''} aria-invalid={reversed || undefined}
                    onChange={(ev) => onChange(start, ev.target.value)}
                />
            </div>
        </>
    );
}
