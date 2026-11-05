// FieldBuilder.jsx
// The editor for a list of form fields (add, edit, move, remove). Used by the assessment templates and by the standard check-up form
// (extra questions of a doctor). Fields are kept in an editor shape (with a `uid` and `optionsText`) and converted with fromApi / toApi.
import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { FIELD_TYPES } from './TemplateFields';

export const OPTION_TYPES = ['select', 'radio', 'checkbox'];

let uidCounter = 0;
const uid = () => `u${Date.now()}_${uidCounter++}`;

export const blankField = (type = 'text') => ({ uid: uid(), key: '', label: '', type, required: false, optionsText: '', hint: '', unit: '' });

export const fromApi = (f) => ({
    uid: uid(), key: f.key, label: f.label, type: f.type, required: !!f.required,
    optionsText: (f.options || []).join('\n'), hint: f.hint || '', unit: f.unit || ''
});

// keyPrefix + position gives a key to a new field; a saved field keeps its key. keyPrefix null = the server gives the key.
export const toApi = (f, i, keyPrefix = 'f') => ({
    key: f.key || (keyPrefix === null ? '' : `${keyPrefix}${i + 1}`),
    label: f.label.trim(),
    type: f.type,
    required: f.type === 'heading' ? false : f.required,
    options: OPTION_TYPES.includes(f.type) ? f.optionsText.split('\n').map((o) => o.trim()).filter(Boolean) : undefined,
    hint: f.hint,
    unit: f.unit
});

// ph: placeholders { heading, label, option }. minFields: fewest fields the list can keep (a template needs one).
// coreNames: { key: name } of the fields that are saved in the assessment itself (they always hold an answer, so they cannot be a heading)
const FieldBuilder = ({ fields, onChange, ph = {}, minFields = 0, idPrefix = 'f', coreNames = {} }) => {
    const setField = (id, patch) => onChange(fields.map((x) => (x.uid === id ? { ...x, ...patch } : x)));
    const move = (index, delta) => {
        const next = [...fields];
        const j = index + delta;
        if (j < 0 || j >= next.length) return;
        [next[index], next[j]] = [next[j], next[index]];
        onChange(next);
    };

    return (
        <>
            {fields.length === 0 && <p className="dp-hint" style={{ margin: 0 }}>No fields yet.</p>}
            {fields.map((f, i) => (
                <div key={f.uid} className="dp-card" style={{ padding: 12, boxShadow: 'none' }}>
                    {coreNames[f.key] && <div className="dp-appt-chips" style={{ marginTop: 0, marginBottom: 8 }}><span className="dp-chip source">{coreNames[f.key]}: saved in the assessment</span></div>}
                    <div className="dp-row">
                        <div className="dp-field">
                            <label htmlFor={`${idPrefix}-type-${f.uid}`}>Type</label>
                            <select id={`${idPrefix}-type-${f.uid}`} className="dp-select" value={f.type} onChange={(e) => setField(f.uid, { type: e.target.value })}>
                                {FIELD_TYPES.filter((t) => !(coreNames[f.key] && t.value === 'heading')).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="dp-field" style={{ gridColumn: 'span 2' }}>
                            <label htmlFor={`${idPrefix}-label-${f.uid}`}>{f.type === 'heading' ? 'Heading text' : 'Question / label'}</label>
                            <input id={`${idPrefix}-label-${f.uid}`} className="dp-input" maxLength={200} value={f.label} onChange={(e) => setField(f.uid, { label: e.target.value })} placeholder={f.type === 'heading' ? ph.heading : ph.label} />
                        </div>
                    </div>

                    {OPTION_TYPES.includes(f.type) && (
                        <div className="dp-field" style={{ marginTop: 10 }}>
                            <label htmlFor={`${idPrefix}-opt-${f.uid}`}>Options (one per line, at least two)</label>
                            <textarea id={`${idPrefix}-opt-${f.uid}`} className="dp-textarea" rows={3} value={f.optionsText} placeholder={ph.option} onChange={(e) => setField(f.uid, { optionsText: e.target.value })} />
                        </div>
                    )}

                    {f.type !== 'heading' && (
                        <div className="dp-row" style={{ marginTop: 10 }}>
                            <div className="dp-field" style={{ gridColumn: 'span 2' }}>
                                <label htmlFor={`${idPrefix}-hint-${f.uid}`}>Hint (optional)</label>
                                <input id={`${idPrefix}-hint-${f.uid}`} className="dp-input" maxLength={200} value={f.hint} onChange={(e) => setField(f.uid, { hint: e.target.value })} />
                            </div>
                            {f.type === 'number' && (
                                <div className="dp-field">
                                    <label htmlFor={`${idPrefix}-unit-${f.uid}`}>Unit</label>
                                    <input id={`${idPrefix}-unit-${f.uid}`} className="dp-input" maxLength={20} value={f.unit} onChange={(e) => setField(f.uid, { unit: e.target.value })} placeholder="e.g. kg" />
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                        {f.type !== 'heading'
                            ? <label className="dp-check"><input type="checkbox" checked={f.required} onChange={(e) => setField(f.uid, { required: e.target.checked })} /> Required</label>
                            : <span />}
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                            <button type="button" className="dp-btn dp-btn-ghost dp-btn-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up"><ArrowUp size={16} /></button>
                            <button type="button" className="dp-btn dp-btn-ghost dp-btn-icon" onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label="Move down" title="Move down"><ArrowDown size={16} /></button>
                            <button type="button" className="dp-btn dp-btn-danger dp-btn-icon" onClick={() => onChange(fields.filter((x) => x.uid !== f.uid))} disabled={fields.length <= minFields} aria-label="Remove field" title="Remove field"><Trash2 size={16} /></button>
                        </span>
                    </div>
                </div>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => onChange([...fields, blankField('text')])}><Plus size={15} /> Add field</button>
                <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => onChange([...fields, blankField('heading')])}><Plus size={15} /> Add heading</button>
            </div>
        </>
    );
};

export default FieldBuilder;
