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

// Missing required answers, as a list of labels
export const missingRequired = (fields, values) =>
    fields
        .filter((f) => f.required && f.type !== 'heading')
        .filter((f) => {
            const v = values[f.key];
            return Array.isArray(v) ? v.length === 0 : String(v ?? '').trim() === '';
        })
        .map((f) => f.label);

// What gets stored with the assessment: a self-contained copy of question + answer
export const toResponses = (fields, values) =>
    fields
        .filter((f) => f.type !== 'heading')
        .map((f) => ({ key: f.key, label: f.label, type: f.type, value: values[f.key] ?? emptyValue(f) }))
        .filter((r) => (Array.isArray(r.value) ? r.value.length > 0 : String(r.value).trim() !== ''));

export const TemplateFields = ({ fields, values, onChange, idPrefix = 'tf' }) => {
    const set = (key, value) => onChange({ ...values, [key]: value });

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
                        <label htmlFor={id}>{f.label}{required}{f.type === 'number' && f.unit ? ` (${f.unit})` : ''}</label>
                        {f.type === 'textarea' ? (
                            <textarea id={id} className="dp-textarea" rows={3} value={value} onChange={(e) => set(f.key, e.target.value)} />
                        ) : f.type === 'select' ? (
                            <select id={id} className="dp-select" value={value} onChange={(e) => set(f.key, e.target.value)}>
                                <option value="">-- Select --</option>
                                {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        ) : (
                            <input id={id} className="dp-input" type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} step={f.type === 'number' ? 'any' : undefined} value={value} onChange={(e) => set(f.key, e.target.value)} />
                        )}
                        {f.hint && <small>{f.hint}</small>}
                    </div>
                );
            })}
        </>
    );
};

export default TemplateFields;
