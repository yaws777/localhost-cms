// SchoolYearDialog.jsx
// Start a new school year. The screenings keep the school year of their date, so the past years stay viewable.
// Optionally every active student moves up one year level and the last-year students graduate (kept in the Archive).
import React, { useState } from 'react';
import { HsDialog, HsDialogHeader } from './HsDialog';

export default function SchoolYearDialog({ info, apiBase, senderId, onClose, onSaved }) {
  const next = info?.next || { school_year: '', start_date: '', end_date: '' };
  const [form, setForm] = useState({ school_year: next.school_year, start_date: next.start_date, end_date: next.end_date, promote_students: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const preview = info?.preview || { promote: 0, graduate: 0 };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/school-years`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, sender_id: senderId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start the school year.');
      onSaved(data);
    } catch (err) {
      setError(err.message || 'Could not start the school year.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <HsDialog onClose={onClose}>
      <HsDialogHeader onClose={onClose} sub={<p className="modal-sub-hs">Current school year: {info?.current || '-'}</p>}>Update School Year</HsDialogHeader>
      <form onSubmit={submit} className="modal-form-hs">
        <div className="modal-body-hs">
          {error && <p className="hint-hs" role="alert">{error}</p>}
          <div className="form-group-hs">
            <label htmlFor="sy-label-hs">New school year</label>
            <input id="sy-label-hs" type="text" required pattern="\d{4}-\d{4}" placeholder="2026-2027" value={form.school_year} onChange={(e) => setForm({ ...form, school_year: e.target.value })} aria-describedby="sy-label-note-hs" />
            <small id="sy-label-note-hs">Two consecutive years, like 2026-2027.</small>
          </div>
          <div className="form-row-hs">
            <div className="form-group-hs">
              <label htmlFor="sy-start-hs">Starts</label>
              <input id="sy-start-hs" type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="form-group-hs">
              <label htmlFor="sy-end-hs">Ends</label>
              <input id="sy-end-hs" type="date" required min={form.start_date || undefined} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <label className="check-row-hs">
            <input type="checkbox" checked={form.promote_students} onChange={(e) => setForm({ ...form, promote_students: e.target.checked })} />
            Move active students up one year level and archive the graduates
          </label>
          <p className="picker-note-hs" role="status">
            {form.promote_students
              ? `${preview.promote} student(s) move up a year level. ${preview.graduate} student(s) in their last year (2nd year strand, 4th year course) graduate: they are marked graduated, their account is made inactive and they go to the Archive. Their screening records move with them.`
              : 'Students stay in their current year level. You can still update a student\'s year in Manage Student Accounts.'}
          </p>
        </div>
        <div className="modal-footer-hs">
          <button type="button" className="btn-hs btn-secondary-hs" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-hs btn-primary-hs" disabled={saving}>{saving ? 'Saving...' : 'Start school year'}</button>
        </div>
      </form>
    </HsDialog>
  );
}
