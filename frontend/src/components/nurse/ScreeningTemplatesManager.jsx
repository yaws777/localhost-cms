import React, { useMemo, useRef, useState } from 'react';
import { Plus, Edit3, Trash2, ArrowUp, ArrowDown, ClipboardList, Search, Eye, Copy, Archive, ArchiveRestore, ChevronDown, Lock, X, TriangleAlert } from 'lucide-react';
import Modal from '../common/Modal';
import { useAlert } from '../../context/AlertContext';
import { FIELD_TYPES, fieldMeta, fieldTypeLabel, FormPreview } from './ScreeningFormPreview';

const API_BASE = 'http://localhost:3001/api';
const NAME_MAX = 60;
const DESCRIPTION_MAX = 255;
const MAX_FIELDS = 30;

export { FIELD_TYPES, fieldTypeLabel };

const VIEWS = [['active', 'Active'], ['archive', 'Archive']];

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const keyNumber = (key) => Number(String(key || '').replace(/\D/g, '')) || 0;
const blankField = (key, type = 'number') => ({
  key, label: '', type, required: false, unit: '', min: '', max: '', playMin: '', playMax: '', role: '', playBlock: [],
  options: type === 'select' ? ['Normal', 'Abnormal'] : [], abnormal: [], formulaText: '', decimals: '1', bands: [], fresh: true
});

// a formula is stored with field keys ({f1}); the editor shows and takes field labels ({Height})
const keysToLabels = (formula, fields) => String(formula || '').replace(/\{(f\d+)\}/g, (m, k) => {
  const f = fields.find((x) => x.key === k);
  return f ? `{${f.label}}` : m;
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
  playMin: f.play_min ?? '',
  playMax: f.play_max ?? '',
  role: f.role || '',
  playBlock: [...(f.play_block_options || [])],
  options: f.type === 'select' ? [...(f.options || [])] : [],
  abnormal: [...(f.abnormal_options || [])],
  formulaText: f.type === 'calculated' ? keysToLabels(f.formula, all) : '',
  decimals: String(f.decimals ?? 1),
  bands: (f.bands || []).map((b) => ({ upto: b.upto === null || b.upto === undefined ? '' : String(b.upto), label: b.label }))
});

const optionsOf = (f) => (f.type === 'yesno' ? ['Yes', 'No'] : f.options);

// editor field -> the field shape the preview reads (same as a server field; formula keeps labels, the preview resolves them)
const toPreviewField = (f) => ({
  key: f.key,
  label: f.label,
  type: f.type,
  required: f.required,
  unit: f.unit,
  min: f.min,
  max: f.max,
  play_min: f.playMin,
  play_max: f.playMax,
  options: optionsOf(f),
  abnormal_options: f.abnormal,
  formula: f.formulaText,
  decimals: f.decimals,
  bands: f.bands.map((b) => ({ upto: b.upto === '' ? null : b.upto, label: b.label }))
});

/** The open editor of one field: label, type, normal range, formula, result labels, choices, abnormal answers. */
function FieldBody({ f, locked, numberLabels, patch, onType }) {
  const id = `tpl-${f.key}`;
  const [choice, setChoice] = useState('');
  const formulaRef = useRef(null);

  const addChoice = () => {
    const v = choice.replace(/\s+/g, ' ').trim();
    if (v && !f.options.some((o) => norm(o) === norm(v))) patch({ options: [...f.options, v] });
    setChoice('');
  };
  const removeChoice = (o) => patch({ options: f.options.filter((x) => x !== o), abnormal: f.abnormal.filter((x) => x !== o) });
  const toggleAbnormal = (o) => patch({ abnormal: f.abnormal.includes(o) ? f.abnormal.filter((x) => x !== o) : [...f.abnormal, o] });
  const setBand = (i, p) => patch({ bands: f.bands.map((b, j) => (j === i ? { ...b, ...p } : b)) });

  const insertToken = (label) => {
    const el = formulaRef.current;
    const tok = `{${label}}`;
    const s = el ? el.selectionStart : f.formulaText.length;
    const e = el ? el.selectionEnd : s;
    patch({ formulaText: f.formulaText.slice(0, s) + tok + f.formulaText.slice(e) });
    setTimeout(() => {
      if (el) { el.focus(); el.setSelectionRange(s + tok.length, s + tok.length); }
    }, 0);
  };

  const answerOptions = optionsOf(f);

  return (
    <div className="sx-fb-hs">
      <div className="sx-row-hs">
        <div className="form-group-hs sx-grow-hs">
          <label htmlFor={`${id}-label`}>Label</label>
          <input id={`${id}-label`} type="text" maxLength={60} value={f.label} onChange={(e) => patch({ label: e.target.value })} placeholder="e.g. Waist" autoComplete="off" autoFocus={!!f.fresh} />
        </div>
        {(f.type === 'number' || f.type === 'calculated' || f.type === 'text') && (
          <div className="form-group-hs">
            <label htmlFor={`${id}-unit`}>Unit</label>
            <input id={`${id}-unit`} type="text" maxLength={15} value={f.unit} onChange={(e) => patch({ unit: e.target.value })} placeholder="cm" autoComplete="off" />
          </div>
        )}
      </div>

      <fieldset className="sx-fieldset-hs">
        <legend>Answer type <span className="sx-tname-hs">{fieldTypeLabel(f.type)}</span></legend>
        <div className="sx-typepick-hs" role="radiogroup" aria-label="Answer type">
          {FIELD_TYPES.map(({ value, label, Icon }) => (
            <label key={value} className="sx-tp-hs" title={label}>
              <input type="radio" name={`${id}-type`} value={value} checked={f.type === value} disabled={locked} onChange={() => onType(value)} />
              <span className="sx-tp-box-hs"><Icon size={18} aria-hidden="true" /></span>
              <span className="sx-sr-hs">{label}</span>
            </label>
          ))}
        </div>
        {locked && <p className="sx-lock-hs"><Lock size={15} aria-hidden="true" /> Has results: type locked</p>}
      </fieldset>

      {(f.type === 'number' || f.type === 'calculated') && (
        <div className="sx-row-hs">
          <div className="form-group-hs">
            <label htmlFor={`${id}-min`}>Normal low</label>
            <input id={`${id}-min`} type="number" step="any" value={f.min} onChange={(e) => patch({ min: e.target.value })} />
          </div>
          <div className="form-group-hs">
            <label htmlFor={`${id}-max`}>Normal high</label>
            <input id={`${id}-max`} type="number" step="any" value={f.max} onChange={(e) => patch({ max: e.target.value })} />
          </div>
          {f.type === 'calculated' && (
            <div className="form-group-hs">
              <label htmlFor={`${id}-decimals`}>Decimals</label>
              <input id={`${id}-decimals`} type="number" min="0" max="4" value={f.decimals} onChange={(e) => patch({ decimals: e.target.value })} />
            </div>
          )}
        </div>
      )}

      {(f.type === 'number' || f.type === 'calculated') && (
        <div className="sx-row-hs">
          <div className="form-group-hs">
            <label htmlFor={`${id}-pmin`}>Play low</label>
            <input id={`${id}-pmin`} type="number" step="any" value={f.playMin} onChange={(e) => patch({ playMin: e.target.value })} />
          </div>
          <div className="form-group-hs">
            <label htmlFor={`${id}-pmax`}>Play high</label>
            <input id={`${id}-pmax`} type="number" step="any" value={f.playMax} onChange={(e) => patch({ playMax: e.target.value })} />
          </div>
          {f.type === 'number' && (
            <div className="form-group-hs">
              <label htmlFor={`${id}-role`}>Blood pressure</label>
              <select id={`${id}-role`} value={f.role} onChange={(e) => patch({ role: e.target.value })}>
                <option value="">None</option>
                <option value="systolic">Systolic</option>
                <option value="diastolic">Diastolic</option>
              </select>
            </div>
          )}
        </div>
      )}

      {f.type === 'calculated' && (
        <>
          <div className="form-group-hs">
            <label htmlFor={`${id}-formula`}>Formula</label>
            <input
              id={`${id}-formula`}
              ref={formulaRef}
              type="text"
              value={f.formulaText}
              onChange={(e) => patch({ formulaText: e.target.value })}
              placeholder="{Weight} / (({Height} / 100) * ({Height} / 100))"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="sx-chips-hs" role="group" aria-label="Insert a number field">
              {numberLabels.length > 0
                ? numberLabels.map((l) => <button type="button" key={l} className="sx-chipbtn-hs" onClick={() => insertToken(l)} aria-label={`Insert ${l}`}>{`{${l}}`}</button>)
                : <span className="sx-muted-hs">Add number fields first.</span>}
            </div>
          </div>

          <fieldset className="sx-fieldset-hs">
            <legend>Result labels</legend>
            {f.bands.map((b, i) => (
              <div className="sx-band-hs" key={i}>
                <input type="number" step="any" aria-label={`Below value, row ${i + 1}`} value={b.upto} placeholder="and above" onChange={(e) => setBand(i, { upto: e.target.value })} />
                <input type="text" aria-label={`Label, row ${i + 1}`} value={b.label} placeholder="Label" onChange={(e) => setBand(i, { label: e.target.value })} autoComplete="off" />
                <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs" onClick={() => patch({ bands: f.bands.filter((_, j) => j !== i) })} aria-label={`Remove label ${i + 1}`} title="Remove label">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs" onClick={() => patch({ bands: [...f.bands, { upto: '', label: '' }] })} aria-label="Add result label" title="Add result label">
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </fieldset>
        </>
      )}

      {f.type === 'select' && (
        <div className="form-group-hs">
          <label htmlFor={`${id}-choice`}>Choices</label>
          <ul className="sx-chips-hs">
            {f.options.map((o) => (
              <li key={o} className="sx-pill-hs sx-pill-rm-hs">
                {o}
                <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs" onClick={() => removeChoice(o)} aria-label={`Remove choice ${o}`} title="Remove choice">
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <input
            id={`${id}-choice`}
            type="text"
            maxLength={40}
            value={choice}
            placeholder="Type a choice, press Enter"
            autoComplete="off"
            onChange={(e) => setChoice(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChoice(); } }}
            onBlur={addChoice}
          />
        </div>
      )}

      {(f.type === 'select' || f.type === 'yesno') && answerOptions.length > 0 && (
        <div className="sx-abn-hs" role="group" aria-label="Abnormal answers">
          <span className="sx-muted-hs">Abnormal answers</span>
          <div className="sx-chips-hs">
            {answerOptions.map((o) => (
              <button type="button" key={o} className="sx-pill-hs" aria-pressed={f.abnormal.includes(o)} onClick={() => toggleAbnormal(o)}>
                {f.abnormal.includes(o) && <TriangleAlert size={14} aria-hidden="true" />}{o}
              </button>
            ))}
          </div>
        </div>
      )}

      {(f.type === 'select' || f.type === 'yesno') && answerOptions.length > 0 && (
        <div className="sx-abn-hs" role="group" aria-label="Answers that block play">
          <span className="sx-muted-hs">Not allowed to play</span>
          <div className="sx-chips-hs">
            {answerOptions.map((o) => (
              <button
                type="button"
                key={o}
                className="sx-pill-hs"
                aria-pressed={f.playBlock.includes(o)}
                onClick={() => patch({ playBlock: f.playBlock.includes(o) ? f.playBlock.filter((x) => x !== o) : [...f.playBlock, o] })}
              >
                {f.playBlock.includes(o) && <TriangleAlert size={14} aria-hidden="true" />}{o}
              </button>
            ))}
          </div>
        </div>
      )}

      {f.type !== 'calculated' && (
        <label className="sx-check-hs">
          <input type="checkbox" checked={f.required} onChange={(e) => patch({ required: e.target.checked })} /> Required
        </label>
      )}
    </div>
  );
}

/**
 * Nurse list of form templates in two tabs, Active and Archive. A template is a result form a screening type can use.
 * Active: preview, duplicate, edit, archive. Archive: preview, restore, delete for good.
 * The page owns the list (templates) so the type form stays in step; onChanged() reloads it.
 */
export default function ScreeningTemplatesManager({ templates, types = [], loading, loadError, senderId, onChanged }) {
  const { showAlert, showConfirm } = useAlert();
  const [view, setView] = useState('active');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null); // { id|null, name, description, fields, lockedKeys }
  const [openKey, setOpenKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewOf, setPreviewOf] = useState(null);
  const nextKeyRef = useRef(1);
  const addButtonRef = useRef(null);

  const settleFocus = () => {
    setTimeout(() => {
      if (!document.activeElement || document.activeElement === document.body) addButtonRef.current?.focus();
    }, 0);
  };

  const counts = useMemo(() => {
    const archived = templates.filter((t) => t.is_archived).length;
    return { active: templates.length - archived, archive: archived };
  }, [templates]);

  const visible = useMemo(() => {
    const q = norm(search);
    return templates.filter((t) => !!t.is_archived === (view === 'archive') && (!q || norm(`${t.name} ${t.description || ''}`).includes(q)));
  }, [templates, view, search]);

  const usedBy = (t) => types.filter((x) => x.form_kind === 'CUSTOM' && String(x.template_id) === String(t.template_id));

  const newKey = () => `f${nextKeyRef.current++}`;

  const openAdd = () => {
    nextKeyRef.current = 1;
    const first = blankField(newKey());
    setOpenKey(first.key);
    setEditor({ id: null, name: '', description: '', fields: [first], lockedKeys: [] });
  };

  const openEdit = (t) => {
    const all = t.fields || [];
    nextKeyRef.current = Math.max(0, ...all.map((f) => keyNumber(f.key))) + 1;
    setOpenKey(null);
    setEditor({
      id: t.template_id,
      name: t.name,
      description: t.description || '',
      fields: all.map((f) => toEditorField(f, all)),
      // once results exist, a recorded field can be reworded and given new ranges, but not removed or turned into another type
      lockedKeys: Number(t.result_count) > 0 ? all.map((f) => f.key) : []
    });
  };

  const closeEditor = () => { if (!saving) setEditor(null); };

  const patchField = (key, patch) => setEditor((cur) => ({ ...cur, fields: cur.fields.map((f) => (f.key === key ? { ...f, ...patch, fresh: false } : f)) }));
  const changeType = (key, type) => patchField(key, {
    type,
    abnormal: [],
    options: type === 'select' ? ['Normal', 'Abnormal'] : [],
    bands: [],
    formulaText: ''
  });
  const addField = (type) => {
    if (editor.fields.length >= MAX_FIELDS) { showAlert(`Max ${MAX_FIELDS} fields.`, 'warning'); return; }
    const f = blankField(newKey(), type);
    setEditor((cur) => ({ ...cur, fields: [...cur.fields, f] }));
    setOpenKey(f.key);
  };
  const removeField = (key) => {
    setEditor((cur) => ({ ...cur, fields: cur.fields.filter((f) => f.key !== key) }));
    if (openKey === key) setOpenKey(null);
  };
  const moveField = (index, step) => setEditor((cur) => {
    const next = [...cur.fields];
    const to = index + step;
    if (to < 0 || to >= next.length) return cur;
    [next[index], next[to]] = [next[to], next[index]];
    return { ...cur, fields: next };
  });

  // editor field -> payload field (labels in the formula go back to keys); returns { field } or { error }
  const toPayloadField = (f) => {
    const label = f.label.replace(/\s+/g, ' ').trim();
    const out = { key: f.key, label, type: f.type, required: f.required, unit: f.unit.trim() };
    if (f.type === 'number' || f.type === 'calculated') { out.min = f.min; out.max = f.max; out.play_min = f.playMin; out.play_max = f.playMax; }
    if (f.type === 'number' && f.role) out.role = f.role;
    if (f.type === 'select' || f.type === 'yesno') {
      out.options = optionsOf(f);
      out.abnormal_options = f.abnormal.filter((a) => out.options.includes(a));
      out.play_block_options = f.playBlock.filter((a) => out.options.includes(a));
    }
    if (f.type === 'calculated') {
      let unknown = null;
      out.formula = f.formulaText.replace(/\{([^{}]+)\}/g, (m, name) => {
        const target = editor.fields.find((x) => x.type === 'number' && norm(x.label) === norm(name));
        if (!target) { unknown = unknown || name.trim(); return m; }
        return `{${target.key}}`;
      });
      if (unknown) return { error: `No number field named {${unknown}}.`, key: f.key };
      if (!f.formulaText.trim()) return { error: `${label} needs a formula.`, key: f.key };
      out.decimals = f.decimals;
      out.bands = f.bands.filter((b) => b.label.trim()).map((b) => ({ upto: b.upto === '' ? null : Number(b.upto), label: b.label.trim() }));
    }
    return { field: out };
  };

  const submit = async (e) => {
    e.preventDefault();
    const name = editor.name.replace(/\s+/g, ' ').trim();
    if (!name) { showAlert('Enter a name.', 'error'); return; }
    if (editor.fields.length === 0) { showAlert('Add at least one field.', 'error'); return; }
    const missing = editor.fields.findIndex((f) => !f.label.trim());
    if (missing !== -1) { setOpenKey(editor.fields[missing].key); showAlert(`Field ${missing + 1} needs a label.`, 'error'); return; }
    const thin = editor.fields.find((f) => f.type === 'select' && f.options.length < 2);
    if (thin) { setOpenKey(thin.key); showAlert(`${thin.label.trim()} needs 2 choices.`, 'error'); return; }

    const fields = [];
    for (const f of editor.fields) {
      const r = toPayloadField(f);
      if (r.error) { setOpenKey(r.key); showAlert(r.error, 'error'); return; }
      fields.push(r.field);
    }

    setSaving(true);
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
        showAlert(data.message || 'Saved.', 'success');
      } else {
        showAlert(data.error || 'Not saved.', 'error');
      }
    } catch (err) {
      showAlert('Network or server error. Not saved.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async (t) => {
    const taken = new Set(templates.map((x) => norm(x.name)));
    let name = `${t.name} copy`.slice(0, NAME_MAX);
    for (let n = 2; taken.has(norm(name)); n += 1) name = `${t.name} copy ${n}`.slice(0, NAME_MAX);
    try {
      const res = await fetch(`${API_BASE}/screening-form-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: t.description || '', fields: t.fields, sender_id: senderId })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await onChanged();
        showAlert('Duplicated.', 'success');
      } else {
        showAlert(data.error || 'Not duplicated.', 'error');
      }
    } catch (err) {
      showAlert('Network or server error.', 'error');
    }
  };

  const setArchived = async (t, archived) => {
    if (archived) {
      const used = usedBy(t);
      if (used.length > 0) {
        showAlert(`${t.name} is used by ${used.map((u) => u.name).join(', ')}. Change those first.`, 'warning', { title: 'Cannot Archive' });
        return;
      }
      const ok = await showConfirm(`Archive "${t.name}"? You can restore it later.`, { title: 'Archive Template', confirmLabel: 'Archive', cancelLabel: 'Keep' });
      if (!ok) return;
    }
    try {
      const res = await fetch(`${API_BASE}/screening-form-templates/${t.template_id}/archive`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived, sender_id: senderId })
      });
      const data = await res.json().catch(() => ({}));
      await onChanged();
      showAlert(res.ok ? (archived ? 'Archived.' : 'Restored to Active.') : (data.error || 'Not changed.'), res.ok ? 'success' : 'error');
    } catch (err) {
      showAlert('Network or server error.', 'error');
    }
    settleFocus();
  };

  const doDelete = async (t) => {
    const ok = await showConfirm(`Delete "${t.name}" permanently? This cannot be undone.`, { title: 'Delete Template', confirmLabel: 'Delete', cancelLabel: 'Keep', danger: true });
    if (!ok) return;
    try {
      const res = await fetch(`${API_BASE}/screening-form-templates/${t.template_id}?sender_id=${encodeURIComponent(senderId || '')}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      await onChanged();
      showAlert(res.ok ? 'Deleted.' : (data.error || 'Not deleted.'), res.ok ? 'success' : 'error');
    } catch (err) {
      showAlert('Network or server error.', 'error');
    }
    settleFocus();
  };

  const previewFields = editor ? editor.fields.map(toPreviewField) : [];
  const numberLabelsOf = (fields) => fields.filter((x) => x.type === 'number' && x.label.trim()).map((x) => x.label.trim());

  return (
    <section className="st-panel-hs" aria-labelledby="tp-heading-hs">
      <div className="sx-head-hs">
        <h2 id="tp-heading-hs">Form Templates</h2>
        <button type="button" className="btn-hs btn-icon-hs btn-primary-hs" ref={addButtonRef} onClick={openAdd} aria-label="Add form template" title="Add form template">
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="sx-toolbar-hs">
        <div className="sx-search-hs">
          <label className="sx-sr-hs" htmlFor="sx-tpl-search-hs">Search templates</label>
          <Search size={18} aria-hidden="true" />
          <input id="sx-tpl-search-hs" type="text" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
        </div>
        <div className="sx-seg-hs" role="group" aria-label="Template status">
          {VIEWS.map(([key, label]) => (
            <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>
              {label} <span className="sx-n-hs">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {loadError && <p className="hint-hs warn-hs" role="alert">{loadError}</p>}

      {loading && templates.length === 0 ? (
        <p className="sx-empty-hs" role="status">Loading...</p>
      ) : visible.length === 0 ? (
        <div className="sx-empty-hs" role="status">
          {view === 'archive' && counts.archive === 0 ? <Archive size={24} aria-hidden="true" /> : <Search size={24} aria-hidden="true" />}
          <p>{view === 'archive' && counts.archive === 0 ? 'Archive is empty' : (counts[view] === 0 ? 'No templates yet' : 'No match')}</p>
        </div>
      ) : (
        <div className="sx-tlist-hs">
          {visible.map((t) => {
            const used = usedBy(t);
            const fields = t.fields || [];
            const shown = fields.slice(0, 6);
            return (
              <article key={t.template_id} className={`sx-trow-hs ${t.is_archived ? 'sx-off-hs' : ''}`} aria-label={t.name}>
                <span className="sx-tile-hs"><ClipboardList size={22} aria-hidden="true" /></span>
                <div className="sx-trow-body-hs">
                  <div>
                    <h3>{t.name}</h3>
                    {t.description && <p className="sx-muted-hs">{t.description}</p>}
                  </div>
                  <ul className="sx-chips-hs">
                    {shown.map((f) => {
                      const { Icon } = fieldMeta(f.type);
                      return <li key={f.key} className="sx-fchip-hs"><Icon size={14} aria-hidden="true" />{f.label}</li>;
                    })}
                    {fields.length > shown.length && <li className="sx-chip-hs sx-plain-hs">+{fields.length - shown.length}</li>}
                  </ul>
                  <div className="sx-stats-hs">
                    <span><b>{fields.length}</b> field(s)</span>
                    <span><b>{Number(t.result_count) || 0}</b> result(s)</span>
                    {used.length > 0
                      ? <span>Used by {used.map((u) => <span key={u.screening_type_id} className="sx-chip-hs">{u.name}</span>)}</span>
                      : <span>Not used</span>}
                  </div>
                </div>
                <div className="sx-acts-hs">
                  <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs" onClick={() => setPreviewOf(t)} aria-label={`Preview ${t.name}`} title="Preview">
                    <Eye size={16} aria-hidden="true" />
                  </button>
                  {t.is_archived ? (
                    <>
                      <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs" onClick={() => setArchived(t, false)} aria-label={`Restore ${t.name}`} title="Restore">
                        <ArchiveRestore size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs sx-danger-ghost-hs" onClick={() => doDelete(t)} aria-label={`Delete ${t.name} permanently`} title="Delete permanently">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs" onClick={() => duplicate(t)} aria-label={`Duplicate ${t.name}`} title="Duplicate">
                        <Copy size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs" onClick={() => openEdit(t)} aria-label={`Edit ${t.name}`} title="Edit">
                        <Edit3 size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs" onClick={() => setArchived(t, true)} aria-label={`Archive ${t.name}`} title="Archive">
                        <Archive size={16} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!editor}
        onClose={closeEditor}
        title={editor && editor.id === null ? 'Add Form Template' : 'Edit Form Template'}
        size="xl"
        footer={
          <>
            <button type="button" className="btn-hs btn-secondary-hs st-btn-hs" onClick={closeEditor} disabled={saving}>Cancel</button>
            <button type="submit" form="tpl-form-hs" className="btn-hs btn-primary-hs st-btn-hs" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        {editor && (
          <form
            id="tpl-form-hs"
            onSubmit={submit}
            noValidate
            className="st-form-hs sx-editor-hs sx-editor-wide-hs"
            onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'radio') e.preventDefault(); }}
          >
            <div className="sx-editor-main-hs">
              <div className="form-group-hs">
                <label htmlFor="tpl-name-hs">Template name</label>
                <input id="tpl-name-hs" type="text" maxLength={NAME_MAX} value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} autoComplete="off" autoFocus />
              </div>
              <div className="form-group-hs">
                <label htmlFor="tpl-description-hs">Description</label>
                <input id="tpl-description-hs" type="text" maxLength={DESCRIPTION_MAX} value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} autoComplete="off" />
              </div>

              <div className="sx-sect-head-hs">
                <h3>Fields {editor.fields.length}/{MAX_FIELDS}</h3>
                <div className="sx-addbar-hs" role="group" aria-label="Add field">
                  {FIELD_TYPES.map(({ value, label, Icon }) => (
                    <button type="button" key={value} className="btn-hs btn-icon-hs btn-primary-hs" onClick={() => addField(value)} aria-label={`Add ${label} field`} title={`Add ${label} field`}>
                      <Icon size={18} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>

              <ol className="sx-flist-hs">
                {editor.fields.map((f, i) => {
                  const open = openKey === f.key;
                  const locked = editor.lockedKeys.includes(f.key);
                  const { Icon } = fieldMeta(f.type);
                  return (
                    <li key={f.key} className={`sx-fld-hs ${open ? 'sx-open-hs' : ''}`}>
                      <div className="sx-fld-head-hs">
                        <button type="button" className="sx-fld-toggle-hs" aria-expanded={open} aria-controls={`tpl-body-${f.key}`} onClick={() => setOpenKey(open ? null : f.key)}>
                          <span className="sx-tile-hs sx-tile-sm-hs"><Icon size={16} aria-hidden="true" /></span>
                          <span className={`sx-ttl-hs ${f.label.trim() ? '' : 'sx-none-hs'}`}>{f.label.trim() || 'Untitled field'}</span>
                          {f.required && <span className="sx-chip-hs sx-plain-hs">Required</span>}
                          {locked && <span className="sx-chip-hs sx-plain-hs" title="Has results"><Lock size={13} aria-hidden="true" /></span>}
                          <ChevronDown size={18} className="sx-chev-hs" aria-hidden="true" />
                        </button>
                        <div className="sx-fld-tools-hs">
                          <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs" onClick={() => moveField(i, -1)} disabled={i === 0} aria-label={`Move ${f.label || 'field'} up`} title="Move up">
                            <ArrowUp size={16} aria-hidden="true" />
                          </button>
                          <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs" onClick={() => moveField(i, 1)} disabled={i === editor.fields.length - 1} aria-label={`Move ${f.label || 'field'} down`} title="Move down">
                            <ArrowDown size={16} aria-hidden="true" />
                          </button>
                          <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs sx-danger-ghost-hs" onClick={() => removeField(f.key)} disabled={locked || editor.fields.length === 1} aria-label={`Remove ${f.label || 'field'}`} title="Remove">
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      {open && (
                        <div id={`tpl-body-${f.key}`}>
                          <FieldBody
                            f={f}
                            locked={locked}
                            numberLabels={numberLabelsOf(editor.fields)}
                            patch={(p) => patchField(f.key, p)}
                            onType={(type) => changeType(f.key, type)}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            <aside className="sx-side-hs" aria-label="Nurse form">
              <h3><ClipboardList size={18} aria-hidden="true" /> Nurse form</h3>
              <FormPreview fields={previewFields} />
            </aside>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={!!previewOf}
        onClose={() => setPreviewOf(null)}
        title={previewOf ? previewOf.name : ''}
        size="md"
        footer={<button type="button" className="btn-hs btn-primary-hs st-btn-hs" onClick={() => setPreviewOf(null)}>Close</button>}
      >
        {previewOf && <FormPreview fields={previewOf.fields || []} />}
      </Modal>
    </section>
  );
}
