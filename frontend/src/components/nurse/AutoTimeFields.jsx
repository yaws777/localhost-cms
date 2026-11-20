import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

const API = 'http://localhost:3001/api';
const DURATIONS = [15, 30, 45, 60, 90, 120];

const minutesOf = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};
const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const fmt12 = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  if (!Number.isFinite(h)) return '';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

// Screening time that fills itself: the next free time of the chosen day (after now when it is today) for the chosen length,
// so two screenings never overlap. Nothing is typed. `value` = { start_time, end_time }, `onChange({ start_time, end_time })`.
export default function AutoTimeFields({ date, value, onChange, excludeId = '', studentIds = [], autoOnMount = false, onNotice }) {
  const [duration, setDuration] = useState(() => {
    const len = minutesOf(value?.end_time) - minutesOf(value?.start_time);
    return DURATIONS.includes(len) ? len : (len > 0 ? len : 30);
  });
  const [conflicts, setConflicts] = useState([]);
  const [busy, setBusy] = useState(false);
  const lastDate = useRef('');

  const pickSlot = useCallback(async (len) => {
    if (!date) return;
    setBusy(true);
    try {
      const q = new URLSearchParams({ date, duration: String(len) });
      if (excludeId) q.set('exclude_id', excludeId);
      const res = await fetch(`${API}/screenings/free-slot?${q.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not find a free time.');
      if (!data.available) {
        onChange({ start_time: '', end_time: '' });
        if (onNotice) onNotice(data.message || 'No free time is left on this day.');
        return;
      }
      onChange({ start_time: data.start_time, end_time: data.end_time });
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Could not find a free time.');
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, excludeId]);

  // a new date -> the next free time of that day
  useEffect(() => {
    if (!date) return;
    if (lastDate.current === '' && !autoOnMount && value?.start_time) { lastDate.current = date; return; }
    if (lastDate.current === date) return;
    lastDate.current = date;
    pickSlot(duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // live overlap check of the chosen slot
  const studentKey = (studentIds || []).join(',');
  useEffect(() => {
    if (!date || !value?.start_time || !value?.end_time) { setConflicts([]); return undefined; }
    let cancelled = false;
    const q = new URLSearchParams({ date, start_time: value.start_time, end_time: value.end_time });
    if (excludeId) q.set('exclude_id', excludeId);
    if (studentKey) q.set('student_ids', studentKey);
    fetch(`${API}/screenings/conflicts?${q.toString()}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setConflicts(d.conflicts || []); })
      .catch(() => { if (!cancelled) setConflicts([]); });
    return () => { cancelled = true; };
  }, [date, value?.start_time, value?.end_time, excludeId, studentKey]);

  const changeDuration = (len) => {
    setDuration(len);
    const start = minutesOf(value?.start_time);
    if (Number.isFinite(start) && start + len < 24 * 60) onChange({ start_time: value.start_time, end_time: hhmm(start + len) });
    else pickSlot(len);
  };

  return (
    <>
      <div className="form-group-hs">
        <label htmlFor="auto-start-hs">Start</label>
        <input id="auto-start-hs" type="text" readOnly value={fmt12(value?.start_time)} placeholder={date ? 'Finding a free time' : 'Pick a date'} />
      </div>
      <div className="form-group-hs">
        <label htmlFor="auto-end-hs">End</label>
        <input id="auto-end-hs" type="text" readOnly value={fmt12(value?.end_time)} placeholder="Auto" />
      </div>
      <div className="form-group-hs">
        <label htmlFor="auto-len-hs">Length</label>
        <div className="auto-len-row-hs">
          <select id="auto-len-hs" value={duration} onChange={(e) => changeDuration(Number(e.target.value))} disabled={!date || busy}>
            {[...new Set([...DURATIONS, duration])].sort((a, b) => a - b).map((d) => <option key={d} value={d}>{d} min</option>)}
          </select>
          <button
            type="button"
            className="btn-hs btn-secondary-hs btn-icon-hs"
            onClick={() => pickSlot(duration)}
            disabled={!date || busy}
            aria-label="Next free time"
            title="Next free time"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      {conflicts.length > 0 && (
        <div className="auto-conflict-hs" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{conflicts.join(' ')}</span>
        </div>
      )}
    </>
  );
}
