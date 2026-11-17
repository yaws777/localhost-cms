import React, { useMemo, useRef, useState } from 'react';
import { Plus, Edit3, Trash2, CheckCircle, PauseCircle, Power, Search, ClipboardList, Ear, CalendarDays, Lock, FileText } from 'lucide-react';
import Modal from '../common/Modal';
import { useAlert } from '../../context/AlertContext';
import { FieldSummary } from './ScreeningFormPreview';

const API_BASE = 'http://localhost:3001/api';
const NAME_MAX = 60;
const DESCRIPTION_MAX = 255;

// result form of a type (screening_types.form_kind); CUSTOM = a form template from the Templates tab
export const FORM_LABELS = { BMI: 'BMI form', VITAL_SIGNS: 'Vital Signs form', HEARING: 'Hearing form', CUSTOM: 'Form template' };

const EMPTY_FORM = { name: '', description: '', form_kind: 'CUSTOM', template_id: '' };
const FILTERS = [['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']];

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Nurse list of the Health Screening types as cards: search, status filter, add, edit, deactivate / activate and remove.
 * The page owns the list (types) so its type selects stay in step; onChanged() reloads it.
 */
export default function ScreeningTypesManager({ types, templates = [], loading, loadError, senderId, onChanged }) {
  const { showAlert, showConfirm } = useAlert();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState(null); // { id|null, form, isSystem, scheduleCount }
  const [saving, setSaving] = useState(false);
  const [moveDialog, setMoveDialog] = useState(null); // { type, moveTo, targets }
  const addButtonRef = useRef(null);

  // a removed card takes its buttons with it: focus goes back to Add so it is not lost
  const settleFocus = () => {
    setTimeout(() => {
      if (!document.activeElement || document.activeElement === document.body) addButtonRef.current?.focus();
    }, 0);
  };

  const counts = useMemo(() => {
    const active = types.filter((t) => t.is_active).length;
    return { all: types.length, active, inactive: types.length - active };
  }, [types]);

  const visible = useMemo(() => {
    const q = norm(search);
    return types.filter((t) => {
      if (filter === 'active' && !t.is_active) return false;
      if (filter === 'inactive' && t.is_active) return false;
      return !q || norm(`${t.name} ${t.description || ''}`).includes(q);
    });
  }, [types, search, filter]);

  const templateOf = (id) => templates.find((x) => String(x.template_id) === String(id));

  const openAdd = () => {
    const first = templates.find((x) => !x.is_archived);
    setEditor({ id: null, form: { ...EMPTY_FORM, template_id: first ? String(first.template_id) : '' }, isSystem: false, scheduleCount: 0 });
  };

  const openEdit = (t) => {
    setEditor({
      id: t.screening_type_id,
      form: { name: t.name, description: t.description || '', form_kind: t.form_kind, template_id: t.template_id ? String(t.template_id) : '' },
      isSystem: !!t.is_system,
      scheduleCount: Number(t.schedule_count) || 0
    });
  };

  const closeEditor = () => { if (!saving) setEditor(null); };

  const request = async (path, method, body) => {
    const query = method === 'DELETE' ? `?sender_id=${encodeURIComponent(senderId || '')}${body?.move_to ? `&move_to=${encodeURIComponent(body.move_to)}` : ''}` : '';
    const res = await fetch(`${API_BASE}/screening-types${path}${query}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'DELETE' ? undefined : JSON.stringify({ ...body, sender_id: senderId })
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  const submit = async (e) => {
    e.preventDefault();
    const name = editor.form.name.replace(/\s+/g, ' ').trim();
    if (!name) { showAlert('Enter a name.', 'error'); return; }
    if (name.length > NAME_MAX) { showAlert(`Name is too long (${NAME_MAX} max).`, 'error'); return; }
    if (editor.form.form_kind === 'CUSTOM' && !editor.form.template_id) { showAlert('Pick a template.', 'error'); return; }

    setSaving(true);
    try {
      const payload = { name, description: editor.form.description.trim(), form_kind: editor.form.form_kind };
      if (editor.form.form_kind === 'CUSTOM') payload.template_id = editor.form.template_id;
      const { ok, data } = editor.id === null
        ? await request('', 'POST', payload)
        : await request(`/${editor.id}`, 'PUT', payload);
      if (ok) {
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

  const toggleActive = async (t) => {
    if (t.is_active) {
      const ok = await showConfirm(`Stop new schedules from using "${t.name}"?`, { title: 'Deactivate', confirmLabel: 'Deactivate' });
      if (!ok) return;
    }
    try {
      const { ok, data } = await request(`/${t.screening_type_id}`, 'PUT', { is_active: t.is_active ? 0 : 1 });
      if (ok) {
        await onChanged();
        showAlert(t.is_active ? 'Deactivated.' : 'Activated.', 'success');
      } else {
        showAlert(data.error || 'Not changed.', 'error');
      }
    } catch (err) {
      showAlert('Network or server error.', 'error');
    }
  };

  // Types in use: the schedules move to another active type with the same result form (picked in the dialog).
  const moveTargets = (t) => types.filter((x) => x.screening_type_id !== t.screening_type_id && x.is_active && x.form_kind === t.form_kind && (x.template_id || null) === (t.template_id || null));

  const askDelete = async (t) => {
    if (Number(t.schedule_count) > 0) {
      const targets = moveTargets(t);
      if (targets.length === 0) {
        showAlert(`"${t.name}" has ${t.schedule_count} schedule(s) and no other active type shares its form. Deactivate it instead.`, 'warning', { title: 'Cannot Remove' });
        return;
      }
      setMoveDialog({ type: t, moveTo: String(targets[0].screening_type_id), targets });
      return;
    }
    const ok = await showConfirm(`Remove "${t.name}"? This cannot be undone.`, { title: 'Remove Type', confirmLabel: 'Remove', cancelLabel: 'Keep', danger: true });
    if (ok) doDelete(t, '');
  };

  const doDelete = async (t, moveTo) => {
    setMoveDialog(null);
    try {
      const { ok, data } = await request(`/${t.screening_type_id}`, 'DELETE', moveTo ? { move_to: moveTo } : undefined);
      await onChanged();
      showAlert(ok ? (data.message || 'Removed.') : (data.error || 'Not removed.'), ok ? 'success' : 'error');
    } catch (err) {
      showAlert('Network or server error.', 'error');
    }
    settleFocus();
  };

  const formLocked = editor && (editor.isSystem || editor.scheduleCount > 0);
  const templateLocked = editor && editor.scheduleCount > 0;
  const lockMessage = editor && editor.isSystem ? 'System form: locked' : (editor && editor.scheduleCount > 0 ? `Locked: ${editor.scheduleCount} schedule(s)` : '');
  const pickable = editor ? templates.filter((x) => !x.is_archived || String(x.template_id) === String(editor.form.template_id)) : [];
  const sideTemplate = editor && editor.form.form_kind === 'CUSTOM' ? templateOf(editor.form.template_id) : null;

  return (
    <section className="st-panel-hs" aria-labelledby="st-heading-hs">
      <div className="sx-head-hs">
        <h2 id="st-heading-hs">Screening Types</h2>
        <button type="button" className="btn-hs btn-icon-hs btn-primary-hs" ref={addButtonRef} onClick={openAdd} aria-label="Add screening type" title="Add screening type">
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="sx-toolbar-hs">
        <div className="sx-search-hs">
          <label className="sx-sr-hs" htmlFor="sx-type-search-hs">Search types</label>
          <Search size={18} aria-hidden="true" />
          <input id="sx-type-search-hs" type="text" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
        </div>
        <div className="sx-seg-hs" role="group" aria-label="Status filter">
          {FILTERS.map(([key, label]) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {label} <span className="sx-n-hs">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {loadError && <p className="hint-hs warn-hs" role="alert">{loadError}</p>}

      {loading && types.length === 0 ? (
        <p className="sx-empty-hs" role="status">Loading...</p>
      ) : visible.length === 0 ? (
        <div className="sx-empty-hs" role="status">
          <Search size={24} aria-hidden="true" />
          <p>{types.length === 0 ? 'No screening types yet' : 'No match'}</p>
        </div>
      ) : (
        <div className="sx-grid-hs">
          {visible.map((t) => {
            const tpl = t.form_kind === 'CUSTOM' ? templateOf(t.template_id) : null;
            const formName = t.form_kind === 'CUSTOM' ? (t.template_name || (tpl && tpl.name) || 'Form template') : (FORM_LABELS[t.form_kind] || t.form_kind);
            const fieldCount = tpl ? (tpl.fields || []).length : null;
            return (
              <article key={t.screening_type_id} className={`sx-card-hs ${t.is_active ? '' : 'sx-off-hs'}`} aria-label={t.name}>
                <div className="sx-card-top-hs">
                  <span className="sx-tile-hs">{t.form_kind === 'HEARING' ? <Ear size={22} aria-hidden="true" /> : <ClipboardList size={22} aria-hidden="true" />}</span>
                  <div className="sx-card-title-hs">
                    <h3>{t.name}</h3>
                    {t.is_active
                      ? <span className="sx-chip-hs sx-ok-hs"><CheckCircle size={14} aria-hidden="true" /> Active</span>
                      : <span className="sx-chip-hs sx-warn-hs"><PauseCircle size={14} aria-hidden="true" /> Inactive</span>}
                  </div>
                </div>
                <p className="sx-card-desc-hs">{t.description || 'No description'}</p>
                <div className="sx-card-meta-hs">
                  <span className="sx-chip-hs sx-plain-hs"><FileText size={14} aria-hidden="true" /> {formName}{fieldCount !== null ? ` · ${fieldCount} field(s)` : ''}</span>
                  {t.is_system ? <span className="sx-chip-hs sx-plain-hs"><Lock size={14} aria-hidden="true" /> System</span> : null}
                </div>
                <div className="sx-card-foot-hs">
                  <span className="sx-sch-hs"><CalendarDays size={16} aria-hidden="true" /> {t.schedule_count} schedule(s)</span>
                  <div className="sx-acts-hs">
                    <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs" onClick={() => openEdit(t)} aria-label={`Edit ${t.name}`} title="Edit">
                      <Edit3 size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs" onClick={() => toggleActive(t)} aria-label={`${t.is_active ? 'Deactivate' : 'Activate'} ${t.name}`} title={t.is_active ? 'Deactivate' : 'Activate'}>
                      <Power size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="btn-hs btn-icon-hs sx-ghost-hs sx-danger-ghost-hs" onClick={() => askDelete(t)} aria-label={`Remove ${t.name}`} title="Remove">
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!editor}
        onClose={closeEditor}
        title={editor && editor.id === null ? 'Add Screening Type' : 'Edit Screening Type'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn-hs btn-secondary-hs st-btn-hs" onClick={closeEditor} disabled={saving}>Cancel</button>
            <button type="submit" form="st-form-hs" className="btn-hs btn-primary-hs st-btn-hs" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        }
      >
        {editor && (
          <form id="st-form-hs" onSubmit={submit} noValidate className="st-form-hs sx-editor-hs">
            <div className="sx-editor-main-hs">
              <div className="form-group-hs">
                <label htmlFor="st-name-hs">Name</label>
                <input
                  id="st-name-hs"
                  type="text"
                  maxLength={NAME_MAX}
                  value={editor.form.name}
                  onChange={(e) => setEditor({ ...editor, form: { ...editor.form, name: e.target.value } })}
                  autoComplete="off"
                  autoFocus
                />
                <span className="sx-count-hs">{editor.form.name.length}/{NAME_MAX}</span>
              </div>

              <div className="form-group-hs">
                <label htmlFor="st-description-hs">Description</label>
                <textarea
                  id="st-description-hs"
                  rows={2}
                  maxLength={DESCRIPTION_MAX}
                  value={editor.form.description}
                  onChange={(e) => setEditor({ ...editor, form: { ...editor.form, description: e.target.value } })}
                />
              </div>

              <fieldset className="sx-fieldset-hs">
                <legend>Result form</legend>
                <div className="sx-opts-hs">
                  {[['CUSTOM', 'Form template', 'Pick one you built'], ['HEARING', 'Hearing form', 'Built in']].map(([kind, title, sub]) => (
                    <label key={kind} className="sx-opt-hs">
                      <input
                        type="radio"
                        name="st-kind-hs"
                        value={kind}
                        checked={editor.form.form_kind === kind}
                        disabled={formLocked}
                        onChange={() => setEditor({ ...editor, form: { ...editor.form, form_kind: kind, template_id: kind === 'CUSTOM' ? editor.form.template_id : '' } })}
                      />
                      <span><strong>{title}</strong><small>{sub}</small></span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {editor.form.form_kind === 'CUSTOM' && (
                <fieldset className="sx-fieldset-hs">
                  <legend>Template</legend>
                  {pickable.length === 0 ? (
                    <p className="sx-muted-hs">No templates yet. Add one in the Templates tab.</p>
                  ) : (
                    <div className="sx-opts-hs">
                      {pickable.map((tp) => (
                        <label key={tp.template_id} className="sx-opt-hs">
                          <input
                            type="radio"
                            name="st-template-hs"
                            value={tp.template_id}
                            checked={String(tp.template_id) === String(editor.form.template_id)}
                            disabled={templateLocked}
                            onChange={() => setEditor({ ...editor, form: { ...editor.form, template_id: String(tp.template_id) } })}
                          />
                          <span><strong>{tp.name}</strong><small>{(tp.fields || []).length} field(s){tp.is_archived ? ' · archived' : ''}</small></span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              )}

              {lockMessage && <p className="sx-lock-hs"><Lock size={15} aria-hidden="true" /> {lockMessage}</p>}
            </div>

            <aside className="sx-side-hs" aria-label="Nurse form">
              <h3><ClipboardList size={18} aria-hidden="true" /> Nurse form</h3>
              {editor.form.form_kind === 'HEARING'
                ? <p className="sx-muted-hs">Built-in hearing form.</p>
                : sideTemplate ? <FieldSummary fields={sideTemplate.fields || []} /> : <p className="sx-muted-hs">Pick a template.</p>}
            </aside>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={!!moveDialog}
        onClose={() => setMoveDialog(null)}
        title="Remove Type"
        size="md"
        footer={
          <>
            <button type="button" className="btn-hs btn-secondary-hs st-btn-hs" onClick={() => setMoveDialog(null)}>Keep</button>
            <button type="button" className="btn-hs btn-danger-hs st-btn-hs" onClick={() => doDelete(moveDialog.type, moveDialog.moveTo)}>Remove</button>
          </>
        }
      >
        {moveDialog && (
          <div className="form-group-hs">
            <p id="st-move-text-hs">Remove "{moveDialog.type.name}"? This cannot be undone. Its {moveDialog.type.schedule_count} schedule(s) move to another type.</p>
            <label htmlFor="st-move-to-hs">Move schedules to</label>
            <select
              id="st-move-to-hs"
              value={moveDialog.moveTo}
              aria-describedby="st-move-text-hs"
              onChange={(e) => setMoveDialog({ ...moveDialog, moveTo: e.target.value })}
            >
              {moveDialog.targets.map((x) => <option key={x.screening_type_id} value={x.screening_type_id}>{x.name}</option>)}
            </select>
          </div>
        )}
      </Modal>
    </section>
  );
}
