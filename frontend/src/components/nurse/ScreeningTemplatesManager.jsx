import React, { useRef, useState } from 'react';
import { Plus, Edit3, Trash2, ArrowUp, ArrowDown, ClipboardList } from 'lucide-react';
import Modal from '../common/Modal';
import ConfirmModal from '../common/ConfirmModal';
import AlertModal from '../common/AlertModal';

const API_BASE = 'http://localhost:3001/api';
const NAME_MAX = 60;
const DESCRIPTION_MAX = 255;
const MAX_FIELDS = 30;

export const FIELD_TYPES = [
  { value: 'number', label: 'Number' },
  { value: 'calculated', label: 'Calculated (formula)' },
  { value: 'text', label: 'Short text' },
  { value: 'select', label: 'Choice list' },
  { value: 'yesno', label: 'Yes / No' }
];
export const fieldTypeLabel = (type) => (FIELD_TYPES.find((t) => t.value === type) || {}).label || type;

const keyNumber = (key) => Number(String(key || '').replace(/\D/g, '')) || 0;
const blankField = (key) => ({ key, label: '', type: 'number', required: false, unit: '', min: '', max: '', optionsText: '', abnormal: [], formulaText: '', decimals: '1', bandsText: '' });

// a formula is stored with field keys ({f1}); the editor shows and takes field labels ({Height})
const keysToLabels = (formula, fields) => String(formula || '').replace(/\{(f\d+)\}/g, (m, k) => {
  const f = fields.find((x) => x.key === k);
  return f ? `{${f.label}}` : m;
});

const bandsToText = (bands) => (bands || []).map((b) => (b.upto === null || b.upto === undefined ? b.label : `${b.upto} ${b.label}`)).join('\n');

// "18.5 Underweight" = below 18.5; a last line without a number = everything above
const textToBands = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
  const m = line.match(/^(-?\d+(?:\.\d+)?)\s+(.+)$/);
  return m ? { upto: Number(m[1]), label: m[2].trim() } : { upto: null, label: line };
});

// server field -> editor field
const toEditorField = (f, all) => ({
  key: f.key,
  label: f.label,
  type: f.type,
  required: !!f.required,
  unit: f.unit || '',
  min: f.min ?? '',
  max: f.max ?? '',
  optionsText: f.type === 'select' ? (f.options || []).join('\n') : '',
  abnormal: f.abnormal_options || [],
  formulaText: f.type === 'calculated' ? keysToLabels(f.formula, all) : '',
  decimals: String(f.decimals ?? 1),
  bandsText: bandsToText(f.bands)
});

const optionsOf = (f) => (f.type === 'yesno' ? ['Yes', 'No'] : [...new Set(f.optionsText.split('\n').map((o) => o.replace(/\s+/g, ' ').trim()).filter(Boolean))]);

/**
 * Nurse list of form templates: the result forms a screening type can use (BMI and Vital Signs are templates too).
 * The nurse builds a form field by field. The page owns the list (templates) so the type form stays in step; onChanged() reloads it.
 */
export default function ScreeningTemplatesManager({ templates, loading, loadError, senderId, onChanged }) {
  const [editor, setEditor] = useState(null); // { id|null, name, description, fields, resultCount, lockedKeys }
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [notice, setNotice] = useState(null);
  const nextKeyRef = useRef(1);

  const openerRef = useRef(null);
  const addButtonRef = useRef(null);
  const remember = (e) => { openerRef.current = e.currentTarget; };
  const restoreFocus = () => {
    setTimeout(() => {
      const target = openerRef.current && document.contains(openerRef.current) ? openerRef.current : addButtonRef.current;
      if (target) target.focus();
    }, 0);
  };
  const closeNotice = () => { setNotice(null); restoreFocus(); };

  const newKey = () => `f${nextKeyRef.current++}`;

  const openAdd = (e) => {
    remember(e);
    setFormError('');
    nextKeyRef.current = 1;
    setEditor({ id: null, name: '', description: '', fields: [blankField(newKey())], resultCount: 0, lockedKeys: [] });
  };

  const openEdit = (t, e) => {
    remember(e);
    setFormError('');
    const all = t.fields || [];
    nextKeyRef.current = Math.max(0, ...all.map((f) => keyNumber(f.key))) + 1;
    setEditor({
      id: t.template_id,
      name: t.name,
      description: t.description || '',
      fields: all.map((f) => toEditorField(f, all)),
      resultCount: Number(t.result_count) || 0,
      // once results exist, a recorded field can be reworded and given new ranges, but not removed or turned into another type
      lockedKeys: Number(t.result_count) > 0 ? all.map((f) => f.key) : []
    });
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor(null);
    setFormError('');
    restoreFocus();
  };

  const isLocked = (f) => !!editor && editor.lockedKeys.includes(f.key);

  const setField = (index, patch) => setEditor((cur) => ({ ...cur, fields: cur.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) }));
  const addField = () => setEditor((cur) => (cur.fields.length >= MAX_FIELDS ? cur : { ...cur, fields: [...cur.fields, blankField(newKey())] }));
  const removeField = (index) => setEditor((cur) => ({ ...cur, fields: cur.fields.filter((_, i) => i !== index) }));
  const moveField = (index, step) => setEditor((cur) => {
    const next = [...cur.fields];
    const to = index + step;
    if (to < 0 || to >= next.length) return cur;
    [next[index], next[to]] = [next[to], next[index]];
    return { ...cur, fields: next };
  });
  const toggleAbnormal = (index, option) => {
    const f = editor.fields[index];
    setField(index, { abnormal: f.abnormal.includes(option) ? f.abnormal.filter((a) => a !== option) : [...f.abnormal, option] });
  };

  // editor field -> payload field (labels in the formula go back to keys); returns { field } or { error }
  const toPayloadField = (f) => {
    const label = f.label.replace(/\s+/g, ' ').trim();
    const out = { key: f.key, label, type: f.type, required: f.required, unit: f.unit.trim() };
    if (f.type === 'number' || f.type === 'calculated') { out.min = f.min; out.max = f.max; }
    if (f.type === 'select' || f.type === 'yesno') {
      out.options = optionsOf(f);
      out.abnormal_options = f.abnormal.filter((a) => out.options.includes(a));
    }
    if (f.type === 'calculated') {
      let unknown = null;
      out.formula = f.formulaText.replace(/\{([^{}]+)\}/g, (m, name) => {
        const target = editor.fields.find((x) => x.type === 'number' && x.label.replace(/\s+/g, ' ').trim().toLowerCase() === name.replace(/\s+/g, ' ').trim().toLowerCase());
        if (!target) { unknown = unknown || name.trim(); return m; }
        return `{${target.key}}`;
      });
      if (unknown) return { error: `The formula of "${label}" uses {${unknown}}, but no number field has that label.` };
      out.decimals = f.decimals;
      out.bands = textToBands(f.bandsText);
    }
    return { field: out };
  };

  const submit = async (e) => {
    e.preventDefault();
    const name = editor.name.replace(/\s+/g, ' ').trim();
    if (!name) { setFormError('Enter a name for the form template.'); return; }
    if (editor.fields.length === 0) { setFormError('Add at least one field to the form.'); return; }
    const missing = editor.fields.findIndex((f) => !f.label.trim());
    if (missing !== -1) { setFormError(`Field ${missing + 1} needs a label.`); return; }
    const thin = editor.fields.findIndex((f) => (f.type === 'select') && optionsOf(f).length < 2);
    if (thin !== -1) { setFormError(`"${editor.fields[thin].label.trim()}" needs at least two choices, one per line.`); return; }

    const fields = [];
    for (const f of editor.fields) {
      const r = toPayloadField(f);
      if (r.error) { setFormError(r.error); return; }
      fields.push(r.field);
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = { name, description: editor.description.trim(), fields, sender_id: senderId };
      const res = await fetch(`${API_BASE}/screening-form-templates${editor.id === null ? '' : `/${editor.id}`}`, {
        method: editor.id === null ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditor(null);
        await onChanged();
        setNotice({ variant: 'success', title: 'Saved', message: data.message || 'Form template saved.' });
      } else {
        setFormError(data.error || 'Could not save the form template.');
      }
    } catch (err) {
      setFormError('Network or server error. The form template was not saved.');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    const t = confirmDelete;
    setConfirmDelete(null);
    try {
      const res = await fetch(`${API_BASE}/screening-form-templates/${t.template_id}?sender_id=${encodeURIComponent(senderId || '')}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      await onChanged();
      setNotice(res.ok
        ? { variant: 'success', title: 'Deleted', message: data.message || 'Form template deleted.' }
        : { variant: 'error', title: 'Not Deleted', message: data.error || 'Could not delete the form template.' });
    } catch (err) {
      setNotice({ variant: 'error', title: 'Not Deleted', message: 'Network or server error.' });
    }
  };

  const nameErrorLinked = formError && /name/i.test(formError);

  return (
    <section className="st-panel-hs" aria-labelledby="tp-heading-hs">
      <div className="st-head-hs">
        <div>
          <h2 id="tp-heading-hs">Form Templates</h2>
          <p className="hint-hs">Build the result form once, then pick it as the result form of a screening type. BMI and Vital Signs are templates too: edit or delete them like any other.</p>
        </div>
        <button type="button" className="btn-hs btn-primary-hs st-btn-hs" ref={addButtonRef} onClick={openAdd}>
          <Plus size={18} aria-hidden="true" /> Add Form Template
        </button>
      </div>

      {loadError && <p className="hint-hs warn-hs" role="alert">{loadError}</p>}

      <div className="st-table-wrap-hs">
        <table className="st-table-hs">
          <caption className="st-sr-hs">Form templates</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Fields</th>
              <th scope="col">Used by</th>
              <th scope="col">Results</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && templates.length === 0 && (
              <tr><td colSpan={5} className="st-empty-hs" role="status">Loading form templates...</td></tr>
            )}
            {!loading && templates.length === 0 && (
              <tr><td colSpan={5} className="st-empty-hs">No form templates yet. Add one to make your own result form.</td></tr>
            )}
            {templates.map((t) => (
              <tr key={t.template_id}>
                <th scope="row" className="st-name-hs">
                  {t.name}
                  {t.description && <span className="tpl-sub-hs">{t.description}</span>}
                </th>
                <td>
                  <ul className="tpl-fieldlist-hs">
                    {(t.fields || []).map((f) => (
                      <li key={f.key}>{f.label}{f.unit ? ` (${f.unit})` : ''} <span className="st-muted-hs">· {fieldTypeLabel(f.type)}{f.required ? ', required' : ''}</span></li>
                    ))}
                  </ul>
                </td>
                <td>{Number(t.type_count) > 0 ? `${t.type_count} screening type(s)` : <span className="st-muted-hs">Not used yet</span>}</td>
                <td>{t.result_count}</td>
                <td>
                  <div className="st-actions-hs">
                    <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs st-btn-hs" onClick={(e) => openEdit(t, e)} aria-label={`Edit ${t.name}`} title="Edit">
                      <Edit3 size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="btn-hs btn-icon-hs btn-danger-hs st-btn-hs" onClick={(e) => { remember(e); setConfirmDelete(t); }} aria-label={`Delete ${t.name}`} title="Delete">
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={!!editor}
        onClose={closeEditor}
        title={editor && editor.id === null ? 'Add Form Template' : 'Edit Form Template'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn-hs btn-secondary-hs st-btn-hs" onClick={closeEditor} disabled={saving}>Cancel</button>
            <button type="submit" form="tpl-form-hs" className="btn-hs btn-primary-hs st-btn-hs" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        {editor && (
          <form id="tpl-form-hs" onSubmit={submit} noValidate className="st-form-hs">
            {formError && <p className="st-error-hs" id="tpl-error-hs" role="alert">{formError}</p>}

            <div className="form-group-hs">
              <label htmlFor="tpl-name-hs">Template name</label>
              <input
                id="tpl-name-hs"
                type="text"
                required
                maxLength={NAME_MAX}
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                aria-invalid={nameErrorLinked ? 'true' : undefined}
                aria-describedby={nameErrorLinked ? 'tpl-error-hs' : undefined}
                autoFocus
              />
            </div>

            <div className="form-group-hs">
              <label htmlFor="tpl-description-hs">Description (optional)</label>
              <textarea
                id="tpl-description-hs"
                rows={2}
                maxLength={DESCRIPTION_MAX}
                value={editor.description}
                onChange={(e) => setEditor({ ...editor, description: e.target.value })}
              />
            </div>

            <h3 className="tpl-heading-hs"><ClipboardList size={18} aria-hidden="true" /> Form fields ({editor.fields.length} of {MAX_FIELDS})</h3>

            <ol className="tpl-fields-hs">
              {editor.fields.map((f, i) => {
                const options = optionsOf(f);
                const id = `tpl-f${i}`;
                const locked = isLocked(f);
                const numberLabels = editor.fields.filter((x) => x.type === 'number' && x.label.trim()).map((x) => `{${x.label.trim()}}`);
                return (
                  <li key={f.key} className="tpl-field-hs">
                    <fieldset className="tpl-fieldset-hs">
                      <legend className="tpl-legend-hs">Field {i + 1}</legend>
                      <div className="tpl-row-hs">
                        <div className="form-group-hs">
                          <label htmlFor={`${id}-label`}>Label</label>
                          <input id={`${id}-label`} type="text" maxLength={60} value={f.label} onChange={(e) => setField(i, { label: e.target.value })} placeholder="e.g. Waist circumference" />
                        </div>
                        <div className="form-group-hs">
                          <label htmlFor={`${id}-type`}>Answer type</label>
                          <select id={`${id}-type`} value={f.type} disabled={locked} onChange={(e) => setField(i, { type: e.target.value, abnormal: [] })}>
                            {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        {(f.type === 'number' || f.type === 'calculated' || f.type === 'text') && (
                          <div className="form-group-hs">
                            <label htmlFor={`${id}-unit`}>Unit (optional)</label>
                            <input id={`${id}-unit`} type="text" maxLength={15} value={f.unit} onChange={(e) => setField(i, { unit: e.target.value })} placeholder="e.g. cm" />
                          </div>
                        )}
                      </div>

                      {f.type === 'calculated' && (
                        <>
                          <div className="form-group-hs">
                            <label htmlFor={`${id}-formula`}>Formula</label>
                            <input
                              id={`${id}-formula`}
                              type="text"
                              value={f.formulaText}
                              onChange={(e) => setField(i, { formulaText: e.target.value })}
                              aria-describedby={`${id}-formula-help`}
                              placeholder="{Weight} / (({Height} / 100) * ({Height} / 100))"
                            />
                            <small id={`${id}-formula-help`} className="hint-hs">
                              Write the label of a number field in curly brackets and use + - * / and ( ). {numberLabels.length > 0 ? `Number fields: ${numberLabels.join(', ')}.` : 'Add number fields first.'} The value is worked out when the result is saved.
                            </small>
                          </div>
                          <div className="form-group-hs">
                            <label htmlFor={`${id}-decimals`}>Decimals shown</label>
                            <input id={`${id}-decimals`} type="number" min="0" max="4" value={f.decimals} onChange={(e) => setField(i, { decimals: e.target.value })} />
                          </div>
                        </>
                      )}

                      {(f.type === 'number' || f.type === 'calculated') && (
                        <div className="tpl-row-hs">
                          <div className="form-group-hs">
                            <label htmlFor={`${id}-min`}>Lowest normal value (optional)</label>
                            <input id={`${id}-min`} type="number" step="any" value={f.min} onChange={(e) => setField(i, { min: e.target.value })} />
                          </div>
                          <div className="form-group-hs">
                            <label htmlFor={`${id}-max`}>Highest normal value (optional)</label>
                            <input id={`${id}-max`} type="number" step="any" value={f.max} onChange={(e) => setField(i, { max: e.target.value })} />
                          </div>
                          <p className="hint-hs tpl-note-hs">An answer outside this range is flagged abnormal.</p>
                        </div>
                      )}

                      {f.type === 'calculated' && (
                        <div className="form-group-hs">
                          <label htmlFor={`${id}-bands`}>Result labels (optional)</label>
                          <textarea
                            id={`${id}-bands`}
                            rows={4}
                            value={f.bandsText}
                            onChange={(e) => setField(i, { bandsText: e.target.value })}
                            aria-describedby={`${id}-bands-help`}
                            placeholder={'18.5 Underweight\n25 Normal\n30 Overweight\nObese'}
                          />
                          <small id={`${id}-bands-help`} className="hint-hs">
                            One per line, lowest first. "18.5 Underweight" means below 18.5. A last line without a number covers everything above.
                          </small>
                        </div>
                      )}

                      {f.type === 'select' && (
                        <div className="form-group-hs">
                          <label htmlFor={`${id}-options`}>Choices (one per line, at least two)</label>
                          <textarea id={`${id}-options`} rows={4} value={f.optionsText} onChange={(e) => setField(i, { optionsText: e.target.value })} placeholder={'Normal\nMild\nSevere'} />
                        </div>
                      )}

                      {(f.type === 'select' || f.type === 'yesno') && options.length > 0 && (
                        <div className="tpl-abn-hs" role="group" aria-label={`Answers of field ${i + 1} that count as abnormal`}>
                          <span className="tpl-abn-title-hs">Counts as abnormal:</span>
                          {options.map((o) => (
                            <label key={o} className="tpl-check-hs">
                              <input type="checkbox" checked={f.abnormal.includes(o)} onChange={() => toggleAbnormal(i, o)} /> {o}
                            </label>
                          ))}
                        </div>
                      )}

                      {f.type !== 'calculated' && (
                        <label className="tpl-check-hs">
                          <input type="checkbox" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} /> Required
                        </label>
                      )}
                      {locked && <small className="hint-hs">Results exist for this field, so it cannot be removed or change type.</small>}
                    </fieldset>

                    <div className="tpl-tools-hs">
                      <button type="button" className="btn-hs btn-secondary-hs st-btn-hs" onClick={() => moveField(i, -1)} disabled={i === 0} aria-label={`Move field ${i + 1} up`}>
                        <ArrowUp size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn-hs btn-secondary-hs st-btn-hs" onClick={() => moveField(i, 1)} disabled={i === editor.fields.length - 1} aria-label={`Move field ${i + 1} down`}>
                        <ArrowDown size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn-hs btn-danger-hs st-btn-hs" onClick={() => removeField(i)} disabled={locked || editor.fields.length === 1} aria-label={`Remove field ${i + 1}`}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>

            <button type="button" className="btn-hs btn-secondary-hs st-btn-hs" onClick={addField} disabled={editor.fields.length >= MAX_FIELDS}>
              <Plus size={16} aria-hidden="true" /> Add field
            </button>
          </form>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!confirmDelete}
        onCancel={() => { setConfirmDelete(null); restoreFocus(); }}
        onConfirm={doDelete}
        title="Delete Form Template"
        message={confirmDelete ? `Permanently delete "${confirmDelete.name}"? This cannot be undone.` : ''}
        confirmLabel="Yes, Delete"
        cancelLabel="Keep"
        danger
      />

      <AlertModal
        isOpen={!!notice}
        onClose={closeNotice}
        variant={notice ? notice.variant : 'info'}
        title={notice ? notice.title : ''}
        message={notice ? notice.message : ''}
      />
    </section>
  );
}
