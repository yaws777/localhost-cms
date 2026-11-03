import React, { useRef, useState } from 'react';
import { Plus, Edit3, Trash2, CheckCircle, PauseCircle, Power, PowerOff } from 'lucide-react';
import Modal from '../common/Modal';
import ConfirmModal from '../common/ConfirmModal';
import AlertModal from '../common/AlertModal';

const API_BASE = 'http://localhost:3001/api';
const NAME_MAX = 60;
const DESCRIPTION_MAX = 255;

// result form of a type (screening_types.form_kind); CUSTOM = a form template from the Form Templates tab
export const FORM_LABELS = { BMI: 'BMI form', VITAL_SIGNS: 'Vital Signs form', HEARING: 'Hearing form', CUSTOM: 'Form template' };
const CUSTOM_FORMS = ['HEARING', 'CUSTOM'];

const EMPTY_FORM = { name: '', description: '', form_kind: 'BMI', template_id: '' };

/**
 * Nurse list of the Health Screening types: add, edit, deactivate / activate and remove.
 * The page owns the list (types) so its type selects stay in step; onChanged() reloads it.
 */
export default function ScreeningTypesManager({ types, templates = [], loading, loadError, senderId, onChanged }) {
  const [editor, setEditor] = useState(null); // { id|null, form, isSystem, scheduleCount }
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [notice, setNotice] = useState(null); // { variant, title, message }

  // The control that started the action. Its row can be gone once the list reloads, so focus falls back to Add.
  const openerRef = useRef(null);
  const addButtonRef = useRef(null);
  const remember = (e) => { openerRef.current = e.currentTarget; };
  const restoreFocus = () => {
    setTimeout(() => {
      const target = openerRef.current && document.contains(openerRef.current) ? openerRef.current : addButtonRef.current;
      if (target) target.focus();
    }, 0);
  };
  const closeNotice = () => {
    setNotice(null);
    restoreFocus();
  };

  const openAdd = (e) => {
    remember(e);
    setFormError('');
    setEditor({ id: null, form: { ...EMPTY_FORM }, isSystem: false, scheduleCount: 0 });
  };

  const openEdit = (t, e) => {
    remember(e);
    setFormError('');
    setEditor({
      id: t.screening_type_id,
      form: { name: t.name, description: t.description || '', form_kind: t.form_kind, template_id: t.template_id ?? '' },
      isSystem: !!t.is_system,
      scheduleCount: Number(t.schedule_count) || 0
    });
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor(null);
    setFormError('');
    restoreFocus();
  };

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
    if (!name) { setFormError('Enter a name for the screening type.'); return; }
    if (name.length > NAME_MAX) { setFormError(`The name is too long (${NAME_MAX} characters max).`); return; }
    if (editor.form.form_kind === 'CUSTOM' && !editor.form.template_id) { setFormError('Pick the form template this screening type uses.'); return; }

    setSaving(true);
    setFormError('');
    try {
      const payload = { name, description: editor.form.description.trim(), form_kind: editor.form.form_kind };
      if (editor.form.form_kind === 'CUSTOM') payload.template_id = editor.form.template_id;
      const { ok, data } = editor.id === null
        ? await request('', 'POST', payload)
        : await request(`/${editor.id}`, 'PUT', payload);
      if (ok) {
        setEditor(null);
        await onChanged();
        setNotice({ variant: 'success', title: 'Saved', message: data.message || 'Screening type saved.' });
      } else {
        setFormError(data.error || 'Could not save the screening type.');
      }
    } catch (err) {
      setFormError('Network or server error. The screening type was not saved.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t, e) => {
    remember(e);
    try {
      const { ok, data } = await request(`/${t.screening_type_id}`, 'PUT', { is_active: t.is_active ? 0 : 1 });
      if (ok) {
        await onChanged();
        setNotice({
          variant: 'success',
          title: t.is_active ? 'Deactivated' : 'Activated',
          message: t.is_active
            ? `"${t.name}" can no longer be picked for new schedules. Old schedules and results still show it.`
            : `"${t.name}" can be picked for new schedules again.`
        });
      } else {
        setNotice({ variant: 'error', title: 'Not Changed', message: data.error || 'Could not change the status.' });
      }
    } catch (err) {
      setNotice({ variant: 'error', title: 'Not Changed', message: 'Network or server error.' });
    }
  };

  // Types in use: the schedules move to another active type with the same result form (picked in the dialog).
  const moveTargets = (t) => types.filter((x) => x.screening_type_id !== t.screening_type_id && x.is_active && x.form_kind === t.form_kind && (x.template_id || null) === (t.template_id || null));

  const askDelete = (t, e) => {
    remember(e);
    if (Number(t.schedule_count) > 0 && moveTargets(t).length === 0) {
      setNotice({
        variant: 'warning',
        title: 'Cannot Remove Yet',
        message: `"${t.name}" is used by ${t.schedule_count} screening schedule(s) and no other active type has the same result form to move them to. Add or activate one first, or deactivate this type instead.`
      });
      return;
    }
    setConfirmDelete({ ...t, moveTo: Number(t.schedule_count) > 0 ? String(moveTargets(t)[0].screening_type_id) : '' });
  };

  const doDelete = async () => {
    const t = confirmDelete;
    setConfirmDelete(null);
    try {
      const { ok, data } = await request(`/${t.screening_type_id}`, 'DELETE', t.moveTo ? { move_to: t.moveTo } : undefined);
      await onChanged();
      setNotice(ok
        ? { variant: 'success', title: 'Removed', message: data.message || 'Screening type removed.' }
        : { variant: 'error', title: 'Not Removed', message: data.error || 'Could not remove the screening type.' });
    } catch (err) {
      setNotice({ variant: 'error', title: 'Not Removed', message: 'Network or server error.' });
    }
  };

  const formLocked = editor && (editor.isSystem || editor.scheduleCount > 0);
  const formOptions = editor && editor.isSystem ? [editor.form.form_kind] : CUSTOM_FORMS;
  const nameErrorLinked = formError && /name/i.test(formError);

  return (
    <section className="st-panel-hs" aria-labelledby="st-heading-hs">
      <div className="st-head-hs">
        <div>
          <h2 id="st-heading-hs">Screening Types</h2>
        </div>
        <button type="button" className="btn-hs btn-primary-hs st-btn-hs" ref={addButtonRef} onClick={openAdd}>
          <Plus size={18} aria-hidden="true" /> Add Screening Type
        </button>
      </div>

      {loadError && <p className="hint-hs warn-hs" role="alert">{loadError}</p>}

      <div className="st-table-wrap-hs">
        <table className="st-table-hs">
          <caption className="st-sr-hs">Screening types</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Result form</th>
              <th scope="col">Description</th>
              <th scope="col">Schedules</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && types.length === 0 && (
              <tr><td colSpan={6} className="st-empty-hs" role="status">Loading screening types...</td></tr>
            )}
            {!loading && types.length === 0 && (
              <tr><td colSpan={6} className="st-empty-hs">No screening types yet.</td></tr>
            )}
            {types.map((t) => (
              <tr key={t.screening_type_id}>
                <th scope="row" className="st-name-hs">
                  {t.name}
                </th>
                <td>{t.form_kind === 'CUSTOM' ? (t.template_name || 'Form template') : (FORM_LABELS[t.form_kind] || t.form_kind)}</td>
                <td>{t.description || <span className="st-muted-hs">No description</span>}</td>
                <td>{t.schedule_count}</td>
                <td>
                  {t.is_active
                    ? <span className="badge-hs badge-status-present-hs st-chip-hs"><CheckCircle size={14} aria-hidden="true" /> Active</span>
                    : <span className="badge-hs badge-status-pending-hs st-chip-hs"><PauseCircle size={14} aria-hidden="true" /> Inactive</span>}
                </td>
                <td>
                  <div className="st-actions-hs">
                    <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs st-btn-hs" onClick={(e) => openEdit(t, e)} aria-label={`Edit ${t.name}`} title="Edit">
                      <Edit3 size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn-hs btn-icon-hs btn-secondary-hs st-btn-hs"
                      onClick={(e) => toggleActive(t, e)}
                      aria-label={`${t.is_active ? 'Deactivate' : 'Activate'} ${t.name}`}
                      title={t.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {t.is_active ? <PowerOff size={16} aria-hidden="true" /> : <Power size={16} aria-hidden="true" />}
                    </button>
                    <button type="button" className="btn-hs btn-icon-hs btn-danger-hs st-btn-hs" onClick={(e) => askDelete(t, e)} aria-label={`Remove ${t.name}`} title="Remove">
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
        title={editor && editor.id === null ? 'Add Screening Type' : 'Edit Screening Type'}
        footer={
          <>
            <button type="button" className="btn-hs btn-secondary-hs st-btn-hs" onClick={closeEditor} disabled={saving}>Cancel</button>
            <button type="submit" form="st-form-hs" className="btn-hs btn-primary-hs st-btn-hs" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        {editor && (
          <form id="st-form-hs" onSubmit={submit} noValidate className="st-form-hs">
            {formError && <p className="st-error-hs" id="st-error-hs" role="alert">{formError}</p>}

            <div className="form-group-hs">
              <label htmlFor="st-name-hs">Name</label>
              <input
                id="st-name-hs"
                type="text"
                required
                maxLength={NAME_MAX}
                value={editor.form.name}
                onChange={(e) => setEditor({ ...editor, form: { ...editor.form, name: e.target.value } })}
                aria-invalid={nameErrorLinked ? 'true' : undefined}
                aria-describedby={nameErrorLinked ? 'st-error-hs' : undefined}
                autoFocus
              />
            </div>

            <div className="form-group-hs">
              <label htmlFor="st-description-hs">Description (optional)</label>
              <textarea
                id="st-description-hs"
                rows={3}
                maxLength={DESCRIPTION_MAX}
                value={editor.form.description}
                onChange={(e) => setEditor({ ...editor, form: { ...editor.form, description: e.target.value } })}
              />
            </div>

            <div className="form-group-hs">
              <label htmlFor="st-form-kind-hs">Result form</label>
              <select
                id="st-form-kind-hs"
                value={editor.form.form_kind}
                disabled={formLocked}
                aria-describedby={formLocked ? 'st-form-help-hs' : undefined}
                onChange={(e) => setEditor({ ...editor, form: { ...editor.form, form_kind: e.target.value, template_id: '' } })}
              >
                {formOptions.map((k) => <option key={k} value={k}>{FORM_LABELS[k] || k}</option>)}
              </select>
              {formLocked && (
                <small id="st-form-help-hs" className="hint-hs">
                  {editor.isSystem ? 'The form of a system type cannot be changed.' : `Locked: ${editor.scheduleCount} schedule(s) already use this type.`}
                </small>
              )}
            </div>

            {editor.form.form_kind === 'CUSTOM' && (
              <div className="form-group-hs">
                <label htmlFor="st-template-hs">Form template</label>
                <select
                  id="st-template-hs"
                  value={editor.form.template_id}
                  disabled={editor.scheduleCount > 0}
                  aria-describedby="st-template-help-hs"
                  onChange={(e) => setEditor({ ...editor, form: { ...editor.form, template_id: e.target.value } })}
                >
                  <option value="">-- Pick a form template --</option>
                  {templates.map((tp) => <option key={tp.template_id} value={tp.template_id}>{tp.name}</option>)}
                </select>
                <small id="st-template-help-hs" className="hint-hs">
                  {templates.length === 0 ? 'No form template yet. Make one on the Form Templates tab first.' : 'The fields of this template are what the nurse fills in for each student.'}
                </small>
              </div>
            )}
          </form>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!confirmDelete && !confirmDelete.moveTo}
        onCancel={() => { setConfirmDelete(null); restoreFocus(); }}
        onConfirm={doDelete}
        title="Remove Screening Type"
        message={confirmDelete ? `Permanently remove "${confirmDelete.name}"? No schedule uses it. This cannot be undone.` : ''}
        confirmLabel="Yes, Remove"
        cancelLabel="Keep"
        danger
      />

      <Modal
        isOpen={!!confirmDelete && !!confirmDelete.moveTo}
        onClose={() => { setConfirmDelete(null); restoreFocus(); }}
        title="Remove Screening Type"
        size="md"
        footer={
          <>
            <button type="button" className="btn-hs btn-secondary-hs st-btn-hs" onClick={() => { setConfirmDelete(null); restoreFocus(); }}>Keep</button>
            <button type="button" className="btn-hs btn-danger-hs st-btn-hs" onClick={doDelete}>Yes, Remove</button>
          </>
        }
      >
        {confirmDelete && confirmDelete.moveTo && (
          <div className="form-group-hs">
            <p id="st-move-text-hs">
              "{confirmDelete.name}" is used by {confirmDelete.schedule_count} screening schedule(s). Removing it cannot be undone.
              Their results stay as they are; the schedules move to the type you pick.
            </p>
            <label htmlFor="st-move-to-hs">Move the schedules to</label>
            <select
              id="st-move-to-hs"
              value={confirmDelete.moveTo}
              aria-describedby="st-move-text-hs"
              onChange={(e) => setConfirmDelete({ ...confirmDelete, moveTo: e.target.value })}
            >
              {moveTargets(confirmDelete).map((x) => <option key={x.screening_type_id} value={x.screening_type_id}>{x.name}</option>)}
            </select>
          </div>
        )}
      </Modal>

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
