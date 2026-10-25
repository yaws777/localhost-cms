// doctorTemplates.jsx
// The doctor builds templates of the assessment form (extra questions that appear in the consultation form).
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { LayoutTemplate, Plus, Trash2, Copy, Edit, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { useAlert } from '../../context/AlertContext';
import { useSpecializations } from '../../hooks/useSpecializations';
import { TemplateFields, FIELD_TYPES } from '../../components/doctor/TemplateFields';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';
const OPTION_TYPES = ['select', 'radio', 'checkbox'];

let uidCounter = 0;
const uid = () => `u${Date.now()}_${uidCounter++}`;

const blankField = (type = 'text') => ({ uid: uid(), key: '', label: '', type, required: false, optionsText: '', hint: '', unit: '' });

const fromApi = (f) => ({
    uid: uid(), key: f.key, label: f.label, type: f.type, required: !!f.required,
    optionsText: (f.options || []).join('\n'), hint: f.hint || '', unit: f.unit || ''
});

const toApi = (f, i) => ({
    key: f.key || `f${i + 1}`,
    label: f.label.trim(),
    type: f.type,
    required: f.type === 'heading' ? false : f.required,
    options: OPTION_TYPES.includes(f.type) ? f.optionsText.split('\n').map((o) => o.trim()).filter(Boolean) : undefined,
    hint: f.hint,
    unit: f.unit
});

const SAMPLES = [
    {
        name: 'General check-up (vitals and history)',
        visit_type: 'General Check Up',
        fields: [
            { type: 'heading', label: 'History' },
            { type: 'textarea', label: 'Chief complaint' },
            { type: 'number', label: 'Duration of symptoms', unit: 'days' },
            { type: 'checkbox', label: 'Associated symptoms', optionsText: 'Fever\nCough\nHeadache\nVomiting\nBody pain' },
            { type: 'yesno', label: 'Taking any medication now?' },
            { type: 'heading', label: 'Physical exam' },
            { type: 'select', label: 'General appearance', optionsText: 'Well-appearing\nMildly ill\nIll-looking' },
            { type: 'textarea', label: 'Other exam findings' }
        ]
    },
    {
        name: 'Counselling referral',
        visit_type: '',
        fields: [
            { type: 'textarea', label: 'Presenting concern' },
            { type: 'radio', label: 'Urgency', optionsText: 'Routine\nSoon\nUrgent' },
            { type: 'yesno', label: 'Parent informed?' },
            { type: 'text', label: 'Referred to' }
        ]
    }
];

const EMPTY = { template_id: null, template_name: '', visit_type: '', description: '', is_default: false, fields: [blankField('text')] };

const DoctorTemplates = () => {
    const { doctorId } = useOutletContext();
    const { showAlert, showConfirm } = useAlert();
    const { visitTypes } = useSpecializations();

    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState(false);
    const [previewValues, setPreviewValues] = useState({});

    const load = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/doctor/${doctorId}/templates`);
            const data = await res.json();
            if (data.success) setTemplates(data.templates);
        } catch (e) {
            showAlert('Could not load your templates.', 'error');
        } finally {
            setLoading(false);
        }
    }, [doctorId, showAlert]);

    useEffect(() => { load(); }, [load]);

    const openNew = () => { setForm({ ...EMPTY, fields: [blankField('text')] }); setError(''); setPreview(false); setPreviewValues({}); };
    const openEdit = (t) => {
        setForm({ template_id: t.template_id, template_name: t.template_name, visit_type: t.visit_type || '', description: t.description || '', is_default: !!t.is_default, fields: t.fields.map(fromApi) });
        setError('');
        setPreview(false);
        setPreviewValues({});
    };
    const applySample = (i) => {
        const s = SAMPLES[i];
        if (!s) return;
        setForm({ ...form, template_name: form.template_name || s.name, visit_type: s.visit_type, fields: s.fields.map((f) => ({ ...blankField(f.type), ...f })) });
    };

    const setField = (id, patch) => setForm((f) => ({ ...f, fields: f.fields.map((x) => (x.uid === id ? { ...x, ...patch } : x)) }));
    const moveField = (index, delta) => setForm((f) => {
        const next = [...f.fields];
        const j = index + delta;
        if (j < 0 || j >= next.length) return f;
        [next[index], next[j]] = [next[j], next[index]];
        return { ...f, fields: next };
    });

    const previewFields = useMemo(() => (form ? form.fields.filter((f) => f.label.trim()).map(toApi).map((f) => ({ ...f, options: f.options || [] })) : []), [form]);

    const save = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.template_name.trim()) { setError('Give the template a name.'); return; }
        if (form.fields.some((f) => !f.label.trim())) { setError('Every field needs a label. Remove the empty ones.'); return; }
        setBusy(true);
        try {
            const payload = {
                doctor_id: doctorId, template_name: form.template_name, visit_type: form.visit_type || null,
                description: form.description, is_default: form.is_default, fields: form.fields.map(toApi)
            };
            const res = await fetch(form.template_id ? `${API}/api/doctor-templates/${form.template_id}` : `${API}/api/doctor/${doctorId}/templates`, {
                method: form.template_id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) { setForm(null); showAlert(data.message, 'success'); load(); }
            else setError(data.message || 'Could not save the template.');
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    const duplicate = async (t) => {
        try {
            const res = await fetch(`${API}/api/doctor-templates/${t.template_id}/duplicate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctor_id: doctorId }) });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); load(); } else showAlert(data.message || 'Could not duplicate.', 'error');
        } catch (e) { showAlert('Could not reach the server.', 'error'); }
    };

    const remove = async (t) => {
        const ok = await showConfirm(`Delete the template "${t.template_name}"? Consultations already saved with it keep their answers.`, { danger: true, confirmLabel: 'Delete', title: 'Delete template' });
        if (!ok) return;
        try {
            const res = await fetch(`${API}/api/doctor-templates/${t.template_id}?doctor_id=${encodeURIComponent(doctorId)}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); load(); } else showAlert(data.message || 'Could not delete.', 'error');
        } catch (e) { showAlert('Could not reach the server.', 'error'); }
    };

    return (
        <>
            <div className="dp-page-head">
                <div>
                    <h2>Assessment Templates</h2>
                    <p>Build your own assessment form. A template adds your questions to the consultation form, and the answers are saved with the consultation.</p>
                </div>
                <div className="dp-actions">
                    <button className="dp-btn dp-btn-primary" onClick={openNew}><Plus size={17} /> New template</button>
                </div>
            </div>

            {loading ? <div className="dp-card dp-empty">Loading...</div> : templates.length === 0 ? (
                <div className="dp-card dp-empty">
                    <LayoutTemplate size={36} />
                    <p>You have no template yet. Create one for the visits you do most often.</p>
                    <button className="dp-btn dp-btn-primary" style={{ marginTop: 12 }} onClick={openNew}><Plus size={17} /> New template</button>
                </div>
            ) : (
                <div className="dp-row" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {templates.map((t) => (
                        <section key={t.template_id} className="dp-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <h3 style={{ margin: 0, fontSize: '1.02rem', overflowWrap: 'anywhere' }}>{t.template_name}</h3>
                            <div className="dp-appt-chips" style={{ marginTop: 0 }}>
                                <span className="dp-chip">{t.visit_type || 'Any purpose'}</span>
                                <span className="dp-chip source">{t.fields.filter((f) => f.type !== 'heading').length} fields</span>
                                {!!t.is_default && <span className="dp-chip st-completed">Default</span>}
                            </div>
                            {t.description && <p className="dp-hint" style={{ margin: 0 }}>{t.description}</p>}
                            <div className="dp-appt-actions" style={{ justifyContent: 'flex-start', marginTop: 'auto', paddingTop: 6 }}>
                                <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => openEdit(t)}><Edit size={14} /> Edit</button>
                                <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => duplicate(t)}><Copy size={14} /> Duplicate</button>
                                <button className="dp-btn dp-btn-danger dp-btn-sm" onClick={() => remove(t)}><Trash2 size={14} /> Delete</button>
                            </div>
                        </section>
                    ))}
                </div>
            )}

            <Modal isOpen={!!form} onClose={() => setForm(null)} title={form?.template_id ? 'Edit template' : 'New template'} icon={<LayoutTemplate size={20} />} size="xl" closeOnBackdrop={false}>
                {form && (
                    <form className="dp-form" onSubmit={save}>
                        {error && <div className="dp-error" role="alert">{error}</div>}

                        {!form.template_id && (
                            <div className="dp-field">
                                <label htmlFor="tpl-sample">Start from a sample (optional)</label>
                                <select id="tpl-sample" className="dp-select" defaultValue="" onChange={(e) => { if (e.target.value !== '') applySample(Number(e.target.value)); e.target.value = ''; }}>
                                    <option value="">-- Choose a sample --</option>
                                    {SAMPLES.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="dp-row">
                            <div className="dp-field" style={{ gridColumn: 'span 2' }}>
                                <label htmlFor="tpl-name">Template name</label>
                                <input id="tpl-name" className="dp-input" required maxLength={120} value={form.template_name} onChange={(e) => setForm({ ...form, template_name: e.target.value })} placeholder="e.g. Headache work-up" />
                            </div>
                            <div className="dp-field">
                                <label htmlFor="tpl-purpose">Used for</label>
                                <select id="tpl-purpose" className="dp-select" value={form.visit_type} onChange={(e) => setForm({ ...form, visit_type: e.target.value })}>
                                    <option value="">Any purpose</option>
                                    {visitTypes.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="dp-field">
                            <label htmlFor="tpl-desc">Description (optional)</label>
                            <input id="tpl-desc" className="dp-input" maxLength={255} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                        </div>
                        <label className="dp-check"><input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} /> Use as my default for this purpose (selected automatically in a new consultation)</label>

                        <div className="dp-section-label">Fields</div>
                        {form.fields.map((f, i) => (
                            <div key={f.uid} className="dp-card" style={{ padding: 12, boxShadow: 'none' }}>
                                <div className="dp-row">
                                    <div className="dp-field">
                                        <label htmlFor={`f-type-${f.uid}`}>Type</label>
                                        <select id={`f-type-${f.uid}`} className="dp-select" value={f.type} onChange={(e) => setField(f.uid, { type: e.target.value })}>
                                            {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="dp-field" style={{ gridColumn: 'span 2' }}>
                                        <label htmlFor={`f-label-${f.uid}`}>{f.type === 'heading' ? 'Heading text' : 'Question / label'}</label>
                                        <input id={`f-label-${f.uid}`} className="dp-input" maxLength={200} value={f.label} onChange={(e) => setField(f.uid, { label: e.target.value })} placeholder={f.type === 'heading' ? 'e.g. Physical exam' : 'e.g. Onset of symptoms'} />
                                    </div>
                                </div>

                                {OPTION_TYPES.includes(f.type) && (
                                    <div className="dp-field" style={{ marginTop: 10 }}>
                                        <label htmlFor={`f-opt-${f.uid}`}>Options (one per line, at least two)</label>
                                        <textarea id={`f-opt-${f.uid}`} className="dp-textarea" rows={3} value={f.optionsText} onChange={(e) => setField(f.uid, { optionsText: e.target.value })} />
                                    </div>
                                )}

                                {f.type !== 'heading' && (
                                    <div className="dp-row" style={{ marginTop: 10 }}>
                                        <div className="dp-field" style={{ gridColumn: 'span 2' }}>
                                            <label htmlFor={`f-hint-${f.uid}`}>Hint (optional)</label>
                                            <input id={`f-hint-${f.uid}`} className="dp-input" maxLength={200} value={f.hint} onChange={(e) => setField(f.uid, { hint: e.target.value })} />
                                        </div>
                                        {f.type === 'number' && (
                                            <div className="dp-field">
                                                <label htmlFor={`f-unit-${f.uid}`}>Unit</label>
                                                <input id={`f-unit-${f.uid}`} className="dp-input" maxLength={20} value={f.unit} onChange={(e) => setField(f.uid, { unit: e.target.value })} placeholder="e.g. kg" />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                                    {f.type !== 'heading'
                                        ? <label className="dp-check"><input type="checkbox" checked={f.required} onChange={(e) => setField(f.uid, { required: e.target.checked })} /> Required</label>
                                        : <span />}
                                    <span style={{ display: 'inline-flex', gap: 6 }}>
                                        <button type="button" className="dp-btn dp-btn-ghost dp-btn-icon" onClick={() => moveField(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={16} /></button>
                                        <button type="button" className="dp-btn dp-btn-ghost dp-btn-icon" onClick={() => moveField(i, 1)} disabled={i === form.fields.length - 1} aria-label="Move down"><ArrowDown size={16} /></button>
                                        <button type="button" className="dp-btn dp-btn-danger dp-btn-icon" onClick={() => setForm({ ...form, fields: form.fields.filter((x) => x.uid !== f.uid) })} disabled={form.fields.length === 1} aria-label="Remove field"><Trash2 size={16} /></button>
                                    </span>
                                </div>
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setForm({ ...form, fields: [...form.fields, blankField('text')] })}><Plus size={15} /> Add field</button>
                            <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setForm({ ...form, fields: [...form.fields, blankField('heading')] })}><Plus size={15} /> Add heading</button>
                            <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setPreview((v) => !v)}><Eye size={15} /> {preview ? 'Hide preview' : 'Preview'}</button>
                        </div>

                        {preview && (
                            <div className="dp-card" style={{ boxShadow: 'none' }}>
                                <div className="dp-section-label" style={{ marginBottom: 10 }}>Preview in the consultation form</div>
                                <div className="dp-form">
                                    {previewFields.length === 0 ? <p className="dp-hint">Add a label to a field to see it here.</p> : <TemplateFields fields={previewFields} values={previewValues} onChange={setPreviewValues} idPrefix="preview" />}
                                </div>
                            </div>
                        )}

                        <div className="dp-modal-foot">
                            <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setForm(null)}>Cancel</button>
                            <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save template'}</button>
                        </div>
                    </form>
                )}
            </Modal>
        </>
    );
};

export default DoctorTemplates;
