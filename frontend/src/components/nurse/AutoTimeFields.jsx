import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import TimeRangeFields from '../common/TimeRangeFields';

const API = 'http://localhost:3001/api';
const DURATIONS = [15, 30, 45, 60, 90, 120];

const minutesOf = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};

// Screening time: it fills itself with the next free time of the chosen day (after now when it is today) for the chosen length,
// and the nurse can still change Start, End or Length (an overlap shows a warning). `value` = { start_time, end_time }, `onChange({ start_time, end_time })`.
export default function AutoTimeFields({ date, value, onChange, excludeId = '', studentIds = [], autoOnMount = false, onNotice, onDateChange }) {
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
      // the day is full: the server found the next day with room, move the date there
      if (data.date && data.date !== date && onDateChange) {
        lastDate.current = data.date;
        onDateChange(data.date);
        if (onNotice) onNotice(data.message || `No free time is left on ${date}. Moved to ${data.date}.`);
      }
      onChange({ start_time: data.start_time, end_time: data.end_time });
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Could not find a free time.');
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, excludeId, onDateChange]);

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

  // the nurse can type any start / end or pick a length; the conflict check below warns about overlaps
  const handleRange = (start_time, end_time) => {
    const len = minutesOf(end_time) - minutesOf(start_time);
    if (len > 0) setDuration(len);
    onChange({ start_time, end_time });
  };

  return (
    <>
      <TimeRangeFields
        variant="hs" idPrefix="auto" disabled={!date || busy} defaultLength={duration}
        start={value?.start_time} end={value?.end_time} onChange={handleRange}
        extra={(
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
        )}
      />
      {conflicts.length > 0 && (
        <div className="auto-conflict-hs" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{conflicts.join(' ')}</span>
        </div>
      )}
    </>
  );
}
