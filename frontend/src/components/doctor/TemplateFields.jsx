// TemplateFields.jsx
// Renders the fields of a doctor's assessment template (used in the check-up form and in the template preview).
// values: { [field.key]: string | string[] }
import React from 'react';

export const FIELD_TYPES = [
    { value: 'text', label: 'Short text' },
    { value: 'textarea', label: 'Long text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'select', label: 'Dropdown (pick one)' },
    { value: 'radio', label: 'Choice (pick one)' },
    { value: 'checkbox', label: 'Checklist (pick many)' },
    { value: 'yesno', label: 'Yes / No' },
    { value: 'heading', label: 'Section heading' }
];

export const emptyValue = (field) => (field.type === 'checkbox' ? [] : '');

// A dropdown with an "Other" option lets the doctor type the answer: the typed text is what is saved
const OTHER = 'Other';
const hasOther = (f) => f.type === 'select' && (f.options || []).includes(OTHER);

// every box says what to type (own placeholder, else the hint, else a short default by type)
export const placeholderOf = (f) => {
    if (f.placeholder) return f.placeholder;
    if (f.hint) return f.hint;
    if (f.type === 'textarea') return 'Type here';
    if (f.type === 'number') return f.unit ? `Number in ${f.unit}` : 'Enter a number';
    if (f.type === 'select') return '-- Select --';
    return 'Type the answer';
};

// Missing required answers, as a list of labels
export const missingRequired = (fields, values) =>
    fields
        .filter((f) => f.required && f.type !== 'heading')
        .filter((f) => {
            const v = values[f.key];
            if (hasOther(f) && v === OTHER) return true; // "Other" picked but not written
            return Array.isArray(v) ? v.length === 0 : String(v ?? '').trim() === '';
        })
        .map((f) => f.label);

// What gets stored with the assessment: a self-contained copy of question + answer
export const toResponses = (fields, values) =>
    fields
        .filter((f) => f.type !== 'heading')
        .map((f) => ({ key: f.key, label: f.label, type: f.type, value: values[f.key] ?? emptyValue(f) }))
        .filter((r) => (Array.isArray(r.value) ? r.value.length > 0 : String(r.value).trim() !== ''));

// actions: { [field.key]: node } shows a small control at the end of that field's label (e.g. write the plan again)
export const TemplateFields = ({ fields, values, onChange, idPrefix = 'tf', actions }) => {
    const set = (key, value) => onChange({ ...values, [key]: value });
    const labelRow = (f, id, required) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <label htmlFor={id}>{f.label}{required}{f.type === 'number' && f.unit ? ` (${f.unit})` : ''}</label>
            {actions && actions[f.key]}
        </div>
    );

    return (
        <>
            {fields.map((f) => {
                const id = `${idPrefix}-${f.key}`;
                const value = values[f.key] ?? emptyValue(f);
                const required = f.required ? <span aria-hidden="true" style={{ color: 'var(--status-critical-text)' }}> *</span> : null;

                if (f.type === 'heading') return <div key={f.key} className="dp-section-label">{f.label}</div>;

                if (f.type === 'checkbox') {
                    return (
                        <div key={f.key} className="dp-field" role="group" aria-label={f.label}>
                            <span className="dp-label">{f.label}{required}</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
                                {(f.options || []).map((o) => (
                                    <label key={o} className="dp-check">
                                        <input type="checkbox" checked={value.includes(o)} onChange={(e) => set(f.key, e.target.checked ? [...value, o] : value.filter((x) => x !== o))} />
                                        {o}
                                    </label>
                                ))}
                            </div>
                            {f.hint && <small>{f.hint}</small>}
                        </div>
                    );
                }

                if (f.type === 'radio' || f.type === 'yesno') {
                    const options = f.type === 'yesno' ? ['Yes', 'No'] : (f.options || []);
                    return (
                        <div key={f.key} className="dp-field" role="radiogroup" aria-label={f.label}>
                            <span className="dp-label">{f.label}{required}</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
                                {options.map((o) => (
                                    <label key={o} className="dp-check">
                                        <input type="radio" name={id} checked={value === o} onChange={() => set(f.key, o)} />
                                        {o}
                                    </label>
                                ))}
                            </div>
                            {f.hint && <small>{f.hint}</small>}
                        </div>
                    );
                }

                return (
                    <div key={f.key} className="dp-field">
                        {labelRow(f, id, required)}
                        {f.type === 'textarea' ? (
                            <textarea id={id} className="dp-textarea" rows={f.key === 'treatment_recommendations' ? 5 : 3} placeholder={placeholderOf(f)} value={value} onChange={(e) => set(f.key, e.target.value)} />
                        ) : f.type === 'select' ? (
                            (() => {
                                const options = f.options || [];
                                const other = hasOther(f);
                                // a saved answer that is not in the list (an older free-text answer) shows as "Other" with its text
                                const custom = other && value !== '' && !options.filter((o) => o !== OTHER).includes(value);
                                return (
                                    <>
                                        <select id={id} className="dp-select" value={custom ? OTHER : value} onChange={(e) => set(f.key, e.target.value)}>
                                            <option value="">{placeholderOf(f)}</option>
                                            {options.map((o) => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                        {custom && (
                                            <input
                                                className="dp-input" style={{ marginTop: 6 }} type="text" maxLength={200} autoFocus={value === OTHER}
                                                aria-label={`${f.label}: write the answer`} placeholder="Write the answer"
                                                value={value === OTHER ? '' : value} onChange={(e) => set(f.key, e.target.value.trim() === '' && e.target.value === '' ? OTHER : e.target.value)}
                                            />
                                        )}
                                    </>
                                );
                            })()
                        ) : (
                            <input id={id} className="dp-input" type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} step={f.type === 'number' ? 'any' : undefined} placeholder={f.type === 'date' ? undefined : placeholderOf(f)} value={value} onChange={(e) => set(f.key, e.target.value)} />
                        )}
                        {f.hint && f.placeholder && <small>{f.hint}</small>}
                    </div>
                );
            })}
        </>
    );
};

export default TemplateFields;
