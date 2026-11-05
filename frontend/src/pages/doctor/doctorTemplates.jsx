// doctorTemplates.jsx
// The doctor builds templates of the assessment form (extra questions that appear in the check-up form). A template can be archived and restored.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { LayoutTemplate, Plus, Copy, Edit, Eye, Archive, ArchiveRestore, ClipboardList } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { useAlert } from '../../context/AlertContext';
import { TemplateFields } from '../../components/doctor/TemplateFields';
import FieldBuilder, { blankField, fromApi, toApi } from '../../components/doctor/FieldBuilder';
import { allowedTypes, GENERAL_VISIT_TYPE } from '../../utils/scheduling';
import { CORE_NAMES, CORE_KEYS, STANDARD_FORM_DEFAULT } from '../../utils/standardForm';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';

// Ready-made templates, one set per check-up purpose. The doctor sees the ones for their specialization.
const LIBRARY = [
    {
        name: 'General check-up (vitals and history)',
        visit_type: 'General Check Up',
        description: 'History and a basic physical exam for any general visit.',
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
        name: 'Dental examination',
        visit_type: 'Dental',
        description: 'Teeth, gums and oral habits, with the DMFT count.',
        fields: [
            { type: 'heading', label: 'History' },
            { type: 'text', label: 'Tooth pain location' },
            { type: 'radio', label: 'Brushing frequency', optionsText: 'Once a day\nTwice a day\nLess than once a day' },
            { type: 'yesno', label: 'Wears braces or retainers?' },
            { type: 'heading', label: 'Dental examination' },
            { type: 'select', label: 'Oral hygiene', optionsText: 'Good\nFair\nPoor' },
            { type: 'select', label: 'Gum condition', optionsText: 'Healthy\nGingivitis\nBleeding gums\nSwollen gums\nPeriodontal concern' },
            { type: 'number', label: 'Decayed teeth', unit: 'teeth' },
            { type: 'number', label: 'Missing teeth', unit: 'teeth' },
            { type: 'number', label: 'Filled teeth', unit: 'teeth' },
            { type: 'yesno', label: 'Malocclusion observed?' },
            { type: 'checkbox', label: 'Findings', optionsText: 'Cavities\nPlaque or tartar\nBleeding gums\nSensitivity\nMisaligned teeth' },
            { type: 'textarea', label: 'Tooth / area notes' },
            { type: 'textarea', label: 'Treatment done' },
            { type: 'textarea', label: 'Treatment advised' },
            { type: 'yesno', label: 'Referral needed?' },
            { type: 'text', label: 'Refer to (clinic / specialist)' },
            { type: 'text', label: 'Next visit recommendation' }
        ]
    },
    {
        name: 'Vision examination',
        visit_type: 'Vision',
        description: 'Eye complaints, visual acuity, glasses and eye findings.',
        fields: [
            { type: 'heading', label: 'History' },
            { type: 'checkbox', label: 'Eye complaints', optionsText: 'Blurred vision\nEye strain\nHeadache\nRedness\nItching' },
            { type: 'yesno', label: 'Wears eyeglasses?' },
            { type: 'yesno', label: 'Wears contact lenses?' },
            { type: 'date', label: 'Date of last eye exam' },
            { type: 'heading', label: 'Vision examination' },
            { type: 'text', label: 'Left eye (uncorrected)', hint: '20/20' },
            { type: 'text', label: 'Right eye (uncorrected)', hint: '20/20' },
            { type: 'text', label: 'Left eye (corrected)' },
            { type: 'text', label: 'Right eye (corrected)' },
            { type: 'select', label: 'Color vision', optionsText: 'Not tested\nNormal\nDeficient' },
            { type: 'select', label: 'Eye alignment', optionsText: 'Normal\nSuspected misalignment' },
            { type: 'textarea', label: 'Eye condition findings' },
            { type: 'select', label: 'Recommended action', optionsText: 'No action\nEyeglasses\nRefer to ophthalmologist' }
        ]
    },
    {
        name: 'Counselling referral',
        visit_type: '',
        description: 'Reasons and urgency when the student is referred for counselling.',
        fields: [
            { type: 'textarea', label: 'Presenting concern' },
            { type: 'radio', label: 'Urgency', optionsText: 'Routine\nSoon\nUrgent' },
            { type: 'yesno', label: 'Parent informed?' },
            { type: 'text', label: 'Referred to' }
        ]
    }
];

// Starter for a specialization that has no ready-made template of its own (added by the nurse)
const genericSample = (visitType, specialization) => ({
    name: `${specialization || visitType} assessment`,
    visit_type: visitType,
    description: `Basic findings and advice for ${visitType} visits.`,
    fields: [
        { type: 'textarea', label: 'History related to the concern' },
        { type: 'textarea', label: 'Examination findings' },
        { type: 'select', label: 'Severity', optionsText: 'Mild\nModerate\nSevere' },
        { type: 'textarea', label: 'Advice given' }
    ]
});

// Every doctor can take General Check Up, but the ready-made templates are only for what the specialization itself adds:
// a General Physician gets the General one, a Dentist the Dental one, and so on. A specialization with no ready-made template gets a generic one.
const COUNSELLING = /counsel|psycholog|guidance|mental/i;
const purposesOf = (types) => {
    const own = types.filter((t) => t !== GENERAL_VISIT_TYPE);
    return own.length > 0 ? own : [GENERAL_VISIT_TYPE];
};
const libraryFor = (types, specialization) => {
    const mine = purposesOf(types);
    const out = LIBRARY.filter((s) => (s.visit_type ? mine.includes(s.visit_type) : COUNSELLING.test(specialization)));
    mine.filter((t) => !LIBRARY.some((s) => s.visit_type === t)).forEach((t) => out.push(genericSample(t, specialization)));
    return out;
};

// Placeholders follow the purpose being edited, which comes from the doctor's specialization
const PLACEHOLDERS = {
    'General Check Up': { name: 'e.g. Headache work-up', heading: 'e.g. Physical exam', label: 'e.g. Onset of symptoms', option: 'Fever\nCough\nHeadache' },
    Dental: { name: 'e.g. Oral health screening', heading: 'e.g. Gum and teeth exam', label: 'e.g. Tooth pain location', option: 'Cavities\nPlaque\nBleeding gums' },
    Vision: { name: 'e.g. Eye exam', heading: 'e.g. Visual acuity', label: 'e.g. Wears eyeglasses?', option: 'Blurred vision\nEye strain\nRedness' }
};
const placeholdersFor = (visitType, specialization) => {
    const known = PLACEHOLDERS[visitType];
    if (known) return known;
    const topic = (visitType && visitType !== 'Any' ? visitType : specialization) || 'Check-up';
    return { name: `e.g. ${topic} assessment`, heading: `e.g. ${topic} findings`, label: `e.g. Main concern for ${topic.toLowerCase()}`, option: 'Option one\nOption two' };
};

// A ready-made template as the server stores it. Each purpose-specific one starts as the template in use for its purpose.
const toStarter = (s) => ({
    template_name: s.name, visit_type: s.visit_type || null, description: s.description, is_default: false,
    fields: s.fields.map((f, i) => ({
        key: `f${i + 1}`, label: f.label, type: f.type, required: false, hint: f.hint || '', unit: f.unit || '',
        options: f.optionsText ? f.optionsText.split('\n').map((o) => o.trim()).filter(Boolean) : undefined
    }))
});

const DoctorTemplates = () => {
    const { doctor, doctorId } = useOutletContext();
    const { showAlert } = useAlert();

    const specialization = doctor?.specialization || '';
    const types = useMemo(() => allowedTypes(doctor), [doctor]);
    const mine = useMemo(() => purposesOf(types), [types]);
    const homeType = mine[0];
    const emptyForm = () => ({ template_id: null, template_name: '', visit_type: homeType, description: '', is_default: false, fields: [blankField('text')] });
    const library = useMemo(() => libraryFor(types, specialization), [types, specialization]);

    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState(false);
    const [previewValues, setPreviewValues] = useState({});
    const [viewing, setViewing] = useState(null);
    const [viewValues, setViewValues] = useState({});
    const [showArchived, setShowArchived] = useState(false);

    const seeded = useRef(null);

    const load = useCallback(async () => {
        try {
            // the ready-made templates for the specialization are added to the doctor's list once; after that they are theirs to edit or archive.
            // The ready-made sets of other specializations are archived for a doctor who got them before.
            if (!seeded.current) {
                const keep = new Set(library.map((s) => s.name));
                seeded.current = fetch(`${API}/api/doctor/${doctorId}/templates/seed`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ templates: library.map(toStarter), retire_names: LIBRARY.map((s) => s.name).filter((n) => !keep.has(n)) })
                });
            }
            await seeded.current;
            const res = await fetch(`${API}/api/doctor/${doctorId}/templates?include_inactive=1`);
            const data = await res.json();
            if (data.success) setTemplates(data.templates);
        } catch (e) {
            showAlert('Could not load your templates.', 'error');
        } finally {
            setLoading(false);
        }
    }, [doctorId, showAlert, library]);

    useEffect(() => { load(); }, [load]);

    const openNew = () => { setForm(emptyForm()); setError(''); setPreview(false); setPreviewValues({}); };
    const openView = (item) => { setViewing(item); setViewValues({}); };
    const openEdit = (t) => {
        setForm({ template_id: t.template_id, template_name: t.template_name, visit_type: t.visit_type || '', description: t.description || '', is_default: !!t.is_default, fields: t.fields.map(fromApi) });
        setError('');
        setPreview(false);
        setPreviewValues({});
    };
    // ---- the standard check-up form (editable) ----
    const [standard, setStandard] = useState(null); // the saved form
    const [standardForm, setStandardForm] = useState(null); // the draft while editing
    const [standardBusy, setStandardBusy] = useState(false);
    const [standardError, setStandardError] = useState('');
    const [standardPreview, setStandardPreview] = useState(false);
    const [standardPreviewValues, setStandardPreviewValues] = useState({});
    const loadStandard = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/doctor/${doctorId}/standard-form`);
            const data = await res.json();
            setStandard(data.success ? data.form : STANDARD_FORM_DEFAULT);
        } catch (e) { setStandard(STANDARD_FORM_DEFAULT); }
    }, [doctorId]);
    useEffect(() => { loadStandard(); }, [loadStandard]);

    // the draft keeps the fields in the editor shape (uid, optionsText); the saved form has them as the server stores them
    const openStandard = () => {
        const base = JSON.parse(JSON.stringify({ ...STANDARD_FORM_DEFAULT, ...(standard || {}) }));
        setStandardForm({ prescription_enabled: base.prescription_enabled !== false, fields: (base.fields || []).map(fromApi) });
        setStandardError('');
        setStandardPreview(false);
        setStandardPreviewValues({});
    };

    const saveStandard = async (e, reset = false) => {
        if (e) e.preventDefault();
        setStandardError('');
        if (!reset) {
            if (standardForm.fields.some((f) => !f.label.trim())) { setStandardError('Every field needs a label. Remove the empty ones.'); return; }
            const thin = standardForm.fields.find((f) => ['select', 'radio', 'checkbox'].includes(f.type) && f.optionsText.split('\n').map((o) => o.trim()).filter(Boolean).length < 2);
            if (thin) { setStandardError(`"${thin.label.trim()}" needs at least two options.`); return; }
        }
        setStandardBusy(true);
        try {
            const form = reset ? null : { prescription_enabled: standardForm.prescription_enabled, fields: standardForm.fields.map((f, i) => toApi(f, i, null)) };
            const res = await fetch(`${API}/api/doctor/${doctorId}/standard-form`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctor_id: doctorId, form, reset })
            });
            const data = await res.json();
            if (data.success) { setStandard(data.form); setStandardForm(null); showAlert(data.message, 'success'); }
            else showAlert(data.message || 'Could not save the standard form.', 'error');
        } catch (err) { showAlert('Could not reach the server.', 'error'); } finally { setStandardBusy(false); }
    };
    // the standard form as a look-only template (same View window as any template)
    const openStandardView = () => {
        const cur = standard || STANDARD_FORM_DEFAULT;
        setViewing({ standard: true, template_name: 'Standard check-up form', visit_type: null, description: 'Shown in every check-up.', is_active: true, fields: cur.fields, prescription_enabled: cur.prescription_enabled !== false });
        setViewValues({});
    };
    // Duplicate = a new template with the same fields (the four built-in questions become ordinary template fields)
    const duplicateStandard = async () => {
        const cur = standard || STANDARD_FORM_DEFAULT;
        try {
            const payload = {
                doctor_id: doctorId, template_name: 'Standard check-up form (copy)', visit_type: homeType, description: 'Copy of the standard check-up form.', is_default: false,
                fields: cur.fields.map((f, i) => ({ key: `f${i + 1}`, label: f.label, type: f.type, required: !!f.required, options: f.options, hint: f.hint || '', unit: f.unit || '' }))
            };
            const res = await fetch(`${API}/api/doctor/${doctorId}/templates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); load(); } else showAlert(data.message || 'Could not duplicate.', 'error');
        } catch (e) { showAlert('Could not reach the server.', 'error'); }
    };
    // a standard question that was removed can be added back
    const addCoreBack = (key) => setStandardForm((f) => {
        const d = STANDARD_FORM_DEFAULT.fields.find((x) => x.key === key);
        return { ...f, fields: [...f.fields, { ...fromApi(d), key }] };
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
                description: form.description, is_default: false, fields: form.fields.map(toApi)
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

    // archived templates are hidden from the schedule form and the check-up form until they are restored
    const setArchived = async (t, archived) => {
        try {
            const res = await fetch(`${API}/api/doctor-templates/${t.template_id}/archive`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctor_id: doctorId, archived })
            });
            const data = await res.json();
            if (data.success) { showAlert(archived ? `"${t.template_name}" is archived.` : `"${t.template_name}" is restored.`, 'success'); load(); }
            else showAlert(data.message || 'Could not change the template.', 'error');
        } catch (e) { showAlert('Could not reach the server.', 'error'); }
    };

    // only the templates of this specialization show: a Dentist sees the Dental ones, not General Check Up, counselling or any-purpose templates
    const ofSpecialization = templates.filter((t) => (t.visit_type ? mine.includes(t.visit_type) : COUNSELLING.test(specialization)));
    const activeList = ofSpecialization.filter((t) => t.is_active);
    const archivedList = ofSpecialization.filter((t) => !t.is_active);
    const shown = showArchived ? archivedList : activeList;

    // questions in the standard form: its fields (not headings) + the prescription part
    const std = standard || STANDARD_FORM_DEFAULT;
    const standardCount = (std.fields || []).filter((f) => f.type !== 'heading').length + (std.prescription_enabled === false ? 0 : 1);
    const standardPreviewFields = standardForm ? standardForm.fields.filter((f) => f.label.trim()).map((f, i) => toApi(f, i, 'p')).map((f) => ({ ...f, options: f.options || [] })) : [];
    const stdPh = { heading: 'e.g. Physical exam', label: 'e.g. Allergies to medicine', option: 'Option one\nOption two' };

    const ph = placeholdersFor(form?.visit_type, specialization);
    const typeChoices = form && form.visit_type && !mine.includes(form.visit_type) ? [...mine, form.visit_type] : mine;

    return (
        <>
            <div className="dp-page-head">
                <div>
                    <h2>Assessment Templates</h2>
                    <p>Templates add questions to the check-up form{specialization ? ` for ${specialization}` : ''}, and the answers are saved with the check-up. The doctor picks which template to use when documenting a check-up. The standard form is always shown.</p>
                </div>
                <div className="dp-actions">
                    <button className="dp-btn dp-btn-primary dp-btn-icon" onClick={openNew} style={{ width: '2.75rem', height: '2.75rem' }} aria-label="New template" title="New template"><Plus size={18} /></button>
                </div>
            </div>

            <div className="dp-appt-actions" style={{ justifyContent: 'flex-start', marginBottom: 10 }} role="group" aria-label="Which templates to show">
                <button type="button" className={`dp-btn dp-btn-sm ${!showArchived ? 'dp-btn-primary' : 'dp-btn-ghost'}`} aria-pressed={!showArchived} onClick={() => setShowArchived(false)}>Active ({activeList.length})</button>
                <button type="button" className={`dp-btn dp-btn-sm ${showArchived ? 'dp-btn-primary' : 'dp-btn-ghost'}`} aria-pressed={showArchived} onClick={() => setShowArchived(true)}>Archived ({archivedList.length})</button>
            </div>

            <div className="dp-card dp-table-wrap">
                <table className="dp-table" aria-label="Assessment templates">
                    <thead>
                        <tr>
                            <th scope="col">Template</th>
                            <th scope="col">Used for</th>
                            <th scope="col">Fields</th>
                            <th scope="col">Status</th>
                            <th scope="col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!showArchived && (
                            <tr>
                                <td style={{ overflowWrap: 'anywhere' }}>
                                    <strong>Standard check-up form</strong>
                                    <div className="dp-hint" style={{ margin: 0 }}>Chief complaint, findings, diagnosis, treatment plan and prescription. Shown in every check-up.</div>
                                </td>
                                <td><span className="dp-chip">All purposes</span></td>
                                <td className="nowrap">{standardCount}</td>
                                <td className="nowrap"><span className="dp-chip source">Default</span></td>
                                <td>
                                    <div className="dp-appt-actions dp-row-actions" style={{ justifyContent: 'flex-start' }}>
                                        <button className="dp-btn dp-btn-ghost dp-btn-icon" onClick={openStandardView} aria-label="View the standard check-up form" title="View"><Eye size={16} /></button>
                                        <button className="dp-btn dp-btn-ghost dp-btn-icon" onClick={openStandard} aria-label="Edit the standard check-up form" title="Edit"><Edit size={16} /></button>
                                        <button className="dp-btn dp-btn-ghost dp-btn-icon" onClick={duplicateStandard} aria-label="Duplicate the standard check-up form" title="Duplicate"><Copy size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {loading ? (
                            <tr><td colSpan={5} className="dp-hint">Loading...</td></tr>
                        ) : shown.length === 0 ? (
                            <tr><td colSpan={5} className="dp-hint">{showArchived ? 'No archived templates.' : 'No templates. Use the plus button to add one.'}</td></tr>
                        ) : shown.map((t) => (
                            <tr key={t.template_id}>
                                <td style={{ overflowWrap: 'anywhere' }}>
                                    <strong>{t.template_name}</strong>
                                    {t.description && <div className="dp-hint" style={{ margin: 0 }}>{t.description}</div>}
                                </td>
                                <td><span className="dp-chip">{t.visit_type || 'Any purpose'}</span></td>
                                <td className="nowrap">{t.fields.filter((f) => f.type !== 'heading').length}</td>
                                <td className="nowrap">
                                    {!t.is_active
                                        ? <span className="dp-chip st-no-show"><Archive size={14} aria-hidden="true" /> Archived</span>
                                        : <span className="dp-chip source">Active</span>}
                                </td>
                                <td>
                                    <div className="dp-appt-actions dp-row-actions" style={{ justifyContent: 'flex-start' }}>
                                        <button className="dp-btn dp-btn-ghost dp-btn-icon" onClick={() => openView(t)} aria-label={`View ${t.template_name}`} title="View"><Eye size={16} /></button>
                                        {t.is_active && <button className="dp-btn dp-btn-ghost dp-btn-icon" onClick={() => openEdit(t)} aria-label={`Edit ${t.template_name}`} title="Edit"><Edit size={16} /></button>}
                                        {t.is_active && <button className="dp-btn dp-btn-ghost dp-btn-icon" onClick={() => duplicate(t)} aria-label={`Duplicate ${t.template_name}`} title="Duplicate"><Copy size={16} /></button>}
                                        {t.is_active
                                            ? <button className="dp-btn dp-btn-danger dp-btn-icon" onClick={() => setArchived(t, true)} aria-label={`Archive ${t.template_name}`} title="Archive"><Archive size={16} /></button>
                                            : <button className="dp-btn dp-btn-primary dp-btn-icon" onClick={() => setArchived(t, false)} aria-label={`Restore ${t.template_name}`} title="Restore"><ArchiveRestore size={16} /></button>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={!!standardForm} onClose={() => setStandardForm(null)} title="Edit the standard check-up form" icon={<ClipboardList size={20} />} size="xl" closeOnBackdrop={false}>
                {standardForm && (
                    <form className="dp-form" onSubmit={saveStandard}>
                        {standardError && <div className="dp-error" role="alert">{standardError}</div>}

                        <div className="dp-row">
                            <div className="dp-field" style={{ gridColumn: 'span 2' }}>
                                <label htmlFor="std-name">Template name</label>
                                <input id="std-name" className="dp-input" value="Standard check-up form" readOnly aria-readonly="true" />
                            </div>
                            <div className="dp-field">
                                <label htmlFor="std-purpose">Used for</label>
                                <input id="std-purpose" className="dp-input" value="All purposes" readOnly aria-readonly="true" />
                            </div>
                        </div>
                        <div className="dp-section-label">Fields</div>
                        <FieldBuilder fields={standardForm.fields} onChange={(fields) => setStandardForm((f) => ({ ...f, fields }))} ph={stdPh} idPrefix="std" coreNames={CORE_NAMES} />
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setStandardPreview((v) => !v)}><Eye size={15} /> {standardPreview ? 'Hide preview' : 'Preview'}</button>
                        </div>
                        {standardPreview && (
                            <div className="dp-card" style={{ boxShadow: 'none' }}>
                                <div className="dp-section-label" style={{ marginBottom: 10 }}>Preview in the check-up form</div>
                                <div className="dp-form">
                                    {standardPreviewFields.length === 0 ? <p className="dp-hint">Add a label to a field to see it here.</p> : <TemplateFields fields={standardPreviewFields} values={standardPreviewValues} onChange={setStandardPreviewValues} idPrefix="std-preview" />}
                                </div>
                            </div>
                        )}
                        {CORE_KEYS.filter((k) => !standardForm.fields.some((f) => f.key === k)).length > 0 && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span className="dp-hint" style={{ margin: 0 }}>Removed from the form:</span>
                                {CORE_KEYS.filter((k) => !standardForm.fields.some((f) => f.key === k)).map((k) => (
                                    <button key={k} type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => addCoreBack(k)}><Plus size={15} /> {CORE_NAMES[k]}</button>
                                ))}
                            </div>
                        )}
                        <label className="dp-check"><input type="checkbox" checked={standardForm.prescription_enabled} onChange={(e) => setStandardForm({ ...standardForm, prescription_enabled: e.target.checked })} /> Show the prescription part</label>
                        <div className="dp-modal-foot">
                            <button type="button" className="dp-btn dp-btn-ghost" onClick={() => saveStandard(null, true)} disabled={standardBusy}>Back to default</button>
                            <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setStandardForm(null)}>Cancel</button>
                            <button type="submit" className="dp-btn dp-btn-primary" disabled={standardBusy}>{standardBusy ? 'Saving...' : 'Save'}</button>
                        </div>
                    </form>
                )}
            </Modal>

            <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title={viewing?.template_name || 'Template'} icon={<LayoutTemplate size={20} />} size="lg">
                {viewing && (
                    <div className="dp-form">
                        <div className="dp-appt-chips" style={{ marginTop: 0 }}>
                            <span className="dp-chip">{viewing.standard ? 'All purposes' : (viewing.visit_type || 'Any purpose')}</span>
                        </div>
                        {viewing.description && <p className="dp-hint" style={{ margin: 0 }}>{viewing.description}</p>}
                        <div className="dp-section-label">How it looks in the check-up form</div>
                        <TemplateFields fields={viewing.fields} values={viewValues} onChange={setViewValues} idPrefix="view" />
                        {viewing.standard && viewing.prescription_enabled && <p className="dp-hint" style={{ margin: 0 }}>The prescription part follows these questions.</p>}
                        <div className="dp-modal-foot">
                            <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setViewing(null)}>Close</button>
                            {viewing.is_active && <button type="button" className="dp-btn dp-btn-primary" onClick={() => { const t = viewing; setViewing(null); if (t.standard) openStandard(); else openEdit(t); }}><Edit size={15} /> Edit</button>}
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={!!form} onClose={() => setForm(null)} title={form?.template_id ? 'Edit template' : 'New template'} icon={<LayoutTemplate size={20} />} size="xl" closeOnBackdrop={false}>
                {form && (
                    <form className="dp-form" onSubmit={save}>
                        {error && <div className="dp-error" role="alert">{error}</div>}

                        <div className="dp-row">
                            <div className="dp-field" style={{ gridColumn: 'span 2' }}>
                                <label htmlFor="tpl-name">Template name</label>
                                <input id="tpl-name" className="dp-input" required maxLength={120} value={form.template_name} onChange={(e) => setForm({ ...form, template_name: e.target.value })} placeholder={ph.name} />
                            </div>
                            <div className="dp-field">
                                <label htmlFor="tpl-purpose">Used for</label>
                                <select id="tpl-purpose" className="dp-select" required value={form.visit_type} onChange={(e) => setForm({ ...form, visit_type: e.target.value })}>
                                    {typeChoices.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                                {specialization && <small>Purposes {specialization} can take.</small>}
                            </div>
                        </div>
                        <div className="dp-field">
                            <label htmlFor="tpl-desc">Description (optional)</label>
                            <input id="tpl-desc" className="dp-input" maxLength={255} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                        </div>
                        <div className="dp-section-label">Fields</div>
                        <FieldBuilder fields={form.fields} onChange={(fields) => setForm((f) => ({ ...f, fields }))} ph={ph} minFields={1} idPrefix="f" />
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setPreview((v) => !v)}><Eye size={15} /> {preview ? "Hide preview" : "Preview"}</button>
                        </div>

                        {preview && (
                            <div className="dp-card" style={{ boxShadow: 'none' }}>
                                <div className="dp-section-label" style={{ marginBottom: 10 }}>Preview in the check-up form</div>
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
