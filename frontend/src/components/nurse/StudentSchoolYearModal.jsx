// StudentSchoolYearModal.jsx
// Set the school year from Manage Student Accounts (for example 2026 to 2027). The new year becomes the current one:
// active students are enrolled in it; optionally they also move up one year level and the last-year students graduate.
import React, { useEffect, useId, useRef, useState } from 'react';
import { CalendarRange, X } from 'lucide-react';

export const schoolYearText = (label) => String(label || '').replace('-', ' to ');

export default function StudentSchoolYearModal({ info, apiBase, senderId, onClose, onSaved }) {
  const next = info?.next || { school_year: '', start_date: '', end_date: '' };
  const preview = info?.preview || { promote: 0, graduate: 0 };
  const titleId = useId();
  const panelRef = useRef(null);
  const [startYear, setStartYear] = useState(next.school_year ? next.school_year.slice(0, 4) : '');
  const [dates, setDates] = useState({ start_date: next.start_date, end_date: next.end_date });
  const [promote, setPromote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const yearNum = Number(startYear);
  const validYear = /^\d{4}$/.test(String(startYear)) && yearNum >= 2000;
  const label = validYear ? `${yearNum}-${yearNum + 1}` : '';

  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.querySelector('input')?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && document.contains(opener) && typeof opener.focus === 'function') opener.focus();
    };
  }, [onClose]);

  const changeYear = (value) => {
    const v = value.replace(/\D/g, '').slice(0, 4);
    setStartYear(v);
    if (/^\d{4}$/.test(v)) setDates({ start_date: `${v}-06-01`, end_date: `${Number(v) + 1}-05-31` });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validYear) { setError('Type the starting year, like 2026.'); return; }
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/school-years`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_year: label, ...dates, promote_students: promote, sender_id: senderId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not set the school year.');
      onSaved(data);
    } catch (err) {
      setError(err.message || 'Could not set the school year.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay-msa" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-msa" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-header-msa">
          <div className="modal-title-msa">
            <CalendarRange size={22} aria-hidden="true" />
            <h3 id={titleId}>Set School Year</h3>
          </div>
          <button type="button" className="close-btn-msa" aria-label="Close" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={submit} className="modal-content-msa">
          <div className="modal-body-msa">
            <p className="text-muted-msa mb-16-msa">Current school year: <strong>{info?.current ? schoolYearText(info.current) : '-'}</strong></p>
            {error && <p className="error-text-msa" role="alert">{error}</p>}
            <div className="form-grid-msa">
              <div className="form-group-msa col-span-2-msa">
                <label htmlFor="sy-start-year-msa">Starting year *</label>
                <input
                  id="sy-start-year-msa"
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="2026"
                  value={startYear}
                  onChange={(e) => changeYear(e.target.value)}
                  aria-describedby="sy-start-year-note-msa"
                />
                <small id="sy-start-year-note-msa">
                  {validYear ? `School year ${schoolYearText(label)}` : 'Four digits, like 2026 for school year 2026 to 2027.'}
                </small>
              </div>
              <div className="form-group-msa">
                <label htmlFor="sy-from-msa">Starts</label>
                <input id="sy-from-msa" type="date" required value={dates.start_date} onChange={(e) => setDates({ ...dates, start_date: e.target.value })} />
              </div>
              <div className="form-group-msa">
                <label htmlFor="sy-to-msa">Ends</label>
                <input id="sy-to-msa" type="date" required min={dates.start_date || undefined} value={dates.end_date} onChange={(e) => setDates({ ...dates, end_date: e.target.value })} />
              </div>
              <div className="form-group-msa checkbox-group-msa col-span-2-msa">
                <label>
                  <input type="checkbox" checked={promote} onChange={(e) => setPromote(e.target.checked)} />
                  Move active students up one year level and archive the graduates
                </label>
              </div>
            </div>
            <p className="text-muted-msa" role="status">
              {promote
                ? `${preview.promote} student(s) move up a year level. ${preview.graduate} student(s) in their last year (2nd year strand, 4th year course) graduate: they are marked graduated, their account is made inactive and they go to the Archive.`
                : 'Active students are enrolled in the new school year and keep their year level. You can still change a student\'s year level and school year when you edit the account.'}
            </p>
          </div>
          <div className="modal-footer-msa">
            <button type="button" className="btn-msa btn-secondary-msa" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-msa btn-primary-msa" disabled={saving || !validYear}>{saving ? 'Saving...' : 'Set school year'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
