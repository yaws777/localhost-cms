// ScreeningParticipantsModal.jsx
// View and edit the participants of an upcoming health screening. The working list starts as the saved participants and Save sends the whole list.
// Two panes: the current participants (a removed student stays in the list, marked, until Save, and can be undone)
// and the students to add.
// - A screening is for one class (same program, year level and section): the picker is locked to the class of the participants,
//   or asks for the program, year and section first. A screening in a custom folder takes students from any class.
// - A make-up session only shows the students who were absent from the screening it makes up. Those can be added back with one click,
//   and any other student of the same class can be found by name or ID.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UserMinus, UserPlus, Save, Search, RotateCcw, Users, AlertTriangle } from 'lucide-react';
import { Pager, paginate } from '../common/RecordFolders';
import { classLabel } from '../../utils/scheduling';
import { formatDate } from '../../utils/datetime';
import { HsDialog, HsDialogHeader } from './HsDialog';

const PER_PAGE = 40;
const SEARCH_LIMIT = 8;
const fullName = (st) => `${st.first_name || ''} ${st.last_name || ''}`.trim();
const classKey = (st) => `${st.program_id}|${st.year_level}|${st.section}`;
const toMember = (st) => ({
  student_id: st.student_id, first_name: st.first_name, last_name: st.last_name,
  program_id: st.program_id, program_name: st.program_name, year_level: st.year_level, section: st.section
});
const initialsOf = (st) => `${(st.first_name || '').charAt(0)}${(st.last_name || '').charAt(0)}`.toUpperCase();

export default function ScreeningParticipantsModal({ schedule, programs, apiBase, senderId, onClose, onSaved, showAlert, showConfirm }) {
  const scheduleId = schedule.screening_schedule_id;
  const isMakeup = !!schedule.makeup_of;
  const isCustom = !!schedule.folder_id; // custom folder: students from any class
  const [members, setMembers] = useState([]);
  const [savedList, setSavedList] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  const [filters, setFilters] = useState({ program_id: '', year_level: '', section: '' });
  const [pickerSearch, setPickerSearch] = useState('');
  const [pool, setPool] = useState([]);
  const [pickerPage, setPickerPage] = useState(1);
  const [absentees, setAbsentees] = useState([]);
  const [absenteesLoading, setAbsenteesLoading] = useState(isMakeup);
  const [addSearch, setAddSearch] = useState('');
  // the parent re-creates these on every render; keep the latest in refs so the effects below run once
  const alertRef = useRef(showAlert);
  alertRef.current = showAlert;

  // saved participants
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/screenings/${scheduleId}/students`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load participants');
        if (cancelled) return;
        const list = (data.students || []).map(toMember);
        setMembers(list);
        setSavedList(list);
        setSavedIds(list.map((s) => s.student_id));
      } catch (err) {
        if (!cancelled) alertRef.current(err.message || 'Could not load the participants.', 'Error', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBase, scheduleId]);

  // make-up: the students who were absent from the screening this one makes up
  useEffect(() => {
    if (!isMakeup) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/screenings/${schedule.makeup_of}/students`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load the absent students');
        if (!cancelled) setAbsentees((data.students || []).filter((s) => ['ABSENT', 'PENDING'].includes(s.attendance_status)).map(toMember));
      } catch (err) {
        if (!cancelled) alertRef.current(err.message || 'Could not load the absent students.', 'Error', 'error');
      } finally {
        if (!cancelled) setAbsenteesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBase, isMakeup, schedule.makeup_of]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.student_id)), [members]);

  // the class of the participants, when they are all from one
  const lockedClass = useMemo(() => {
    if (members.length === 0) return null;
    const keys = new Set(members.map(classKey));
    return keys.size === 1 && !isCustom ? members[0] : null;
  }, [members, isCustom]);
  const activeFilters = lockedClass
    ? { program_id: lockedClass.program_id, year_level: String(lockedClass.year_level), section: lockedClass.section }
    : filters;

  // students to pick from: the whole pool for the make-up search, the chosen class for a regular screening
  const loadPool = useCallback(async () => {
    if (!isMakeup && !isCustom && (!activeFilters.program_id || !activeFilters.year_level)) { setPool([]); return; }
    try {
      const q = new URLSearchParams();
      if (activeFilters.program_id) q.append('program_id', activeFilters.program_id);
      if (activeFilters.year_level) q.append('year_level', activeFilters.year_level);
      const res = await fetch(`${apiBase}/filtered-students?${q.toString()}`);
      const data = await res.json();
      setPool(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading students:', err);
      setPool([]);
    }
  }, [apiBase, isMakeup, isCustom, activeFilters.program_id, activeFilters.year_level]);

  useEffect(() => { loadPool(); }, [loadPool]);

  const sections = useMemo(
    () => Array.from(new Set(pool.map((s) => s.section).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b))),
    [pool]
  );

  const visiblePool = useMemo(() => {
    if (isMakeup || (!isCustom && !activeFilters.section)) return [];
    const q = pickerSearch.trim().toLowerCase();
    return pool.filter((s) =>
      (!activeFilters.section || s.section === activeFilters.section) &&
      (!q || `${s.first_name || ''} ${s.last_name || ''} ${s.student_id || ''}`.toLowerCase().includes(q))
    );
  }, [pool, isMakeup, isCustom, activeFilters.section, pickerSearch]);

  // make-up: absent students still to add, and a small search for any other student of the same class
  const absentToAdd = useMemo(() => absentees.filter((s) => !memberIds.has(s.student_id)), [absentees, memberIds]);
  const addMatches = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    if (!isMakeup || q.length < 2) return [];
    return pool
      .filter((s) => !memberIds.has(s.student_id) && (!lockedClass || classKey(s) === classKey(lockedClass)) &&
        `${s.first_name || ''} ${s.last_name || ''} ${s.student_id || ''}`.toLowerCase().includes(q))
      .slice(0, SEARCH_LIMIT);
  }, [isMakeup, addSearch, pool, memberIds, lockedClass]);

  // left pane: the saved students and the new ones; a removed student stays in place (marked) so it can be undone
  const currentRows = useMemo(() => {
    const byId = new Map();
    savedList.forEach((m) => byId.set(m.student_id, m));
    members.forEach((m) => { if (!byId.has(m.student_id)) byId.set(m.student_id, m); });
    const q = memberSearch.trim().toLowerCase();
    return [...byId.values()].filter((m) => !q || `${fullName(m)} ${m.student_id} ${m.program_name || ''} ${m.section || ''}`.toLowerCase().includes(q));
  }, [savedList, members, memberSearch]);

  const pickerData = useMemo(() => paginate(visiblePool, pickerPage, PER_PAGE), [visiblePool, pickerPage]);

  const toggle = (st, on) => {
    setMembers((prev) => (on
      ? (prev.some((m) => m.student_id === st.student_id) ? prev : [...prev, toMember(st)])
      : prev.filter((m) => m.student_id !== st.student_id)));
  };

  const allVisibleOn = visiblePool.length > 0 && visiblePool.every((s) => memberIds.has(s.student_id));
  const toggleAllVisible = (on) => { visiblePool.forEach((s) => toggle(s, on)); };

  const added = members.filter((m) => !savedIds.includes(m.student_id)).length;
  const removed = savedIds.filter((id) => !memberIds.has(id)).length;
  const changed = added + removed > 0;

  const undoAll = () => setMembers(savedList);

  // unsaved picks are not lost by a stray Esc or Close
  const requestClose = () => {
    if (changed && showConfirm) {
      showConfirm('You have participant changes that are not saved yet. Close without saving?', onClose, 'Discard changes?', 'Discard', 'Keep editing');
      return;
    }
    onClose();
  };

  const save = async () => {
    if (members.length === 0) {
      showAlert('A screening needs at least one participant.', 'Selection Required', 'warning');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/screenings/${scheduleId}/participants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_ids: members.map((m) => m.student_id), sender_id: senderId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update the participants.');
      onSaved(data);
    } catch (err) {
      showAlert(err.message || 'Failed to update the participants.', 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const classText = (st) => classLabel(st.program_id, st.year_level, st.section);

  return (
    <HsDialog onClose={requestClose} size="lg">
      <HsDialogHeader
        onClose={requestClose}
        sub={(
          <p className="modal-sub-hs" role="status">
            <Users size={14} aria-hidden="true" /> {members.length} student{members.length === 1 ? '' : 's'}
            {schedule.scheduled_date ? ` · ${formatDate(String(schedule.scheduled_date).split('T')[0])}` : ''}
          </p>
        )}
      >
        Participants - {schedule.title}
      </HsDialogHeader>

      <div className="modal-body-hs">
        <div className={`pk-strip-hs${changed ? ' changed-hs' : ''}`} role="status">
          {changed ? (
            <>
              <span className="pk-strip-title-hs"><AlertTriangle size={16} aria-hidden="true" /> Not saved</span>
              <span className="chip-hs chip-info-hs">+{added} added</span>
              <span className="chip-hs chip-bad-hs">-{removed} removed</span>
              <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs pk-strip-undo-hs" onClick={undoAll} aria-label="Undo all changes" title="Undo all changes">
                <RotateCcw size={18} aria-hidden="true" />
              </button>
            </>
          ) : (
            <span className="pk-count-hs pk-strip-none-hs">No changes</span>
          )}
        </div>

        <div className="pk-panes-hs pk-two-hs pk-even-hs">
          {/* LEFT: current participants */}
          <section className="pk-find-hs" aria-label="Current participants">
            <h3 className="pk-pane-title-hs">Current</h3>
            <div className="pk-search-hs">
              <Search size={18} aria-hidden="true" />
              <input
                id="part-member-search-hs"
                type="search"
                aria-label="Search participants"
                placeholder="Name, ID, program or section"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
            </div>
            <div className="pk-list-hs pk-tall-hs">
              {loading ? (
                <div className="pk-empty-hs" role="status">Loading participants...</div>
              ) : currentRows.length === 0 ? (
                <div className="pk-empty-hs">
                  <Search size={24} aria-hidden="true" />
                  {members.length === 0 && savedList.length === 0 ? 'No participants yet' : 'No match'}
                </div>
              ) : currentRows.map((m) => {
                const isNew = !savedIds.includes(m.student_id) && memberIds.has(m.student_id);
                const isRemoved = savedIds.includes(m.student_id) && !memberIds.has(m.student_id);
                return (
                  <div key={m.student_id} className={`pk-row-hs pk-picked-hs${isRemoved ? ' rm-hs' : ''}${isNew ? ' on-hs' : ''}`}>
                    <span className="pk-avatar-hs" aria-hidden="true">{initialsOf(m)}</span>
                    <span className="pk-name-hs">
                      <span className="pk-name-main-hs">{fullName(m)}</span>
                      <span className="pk-id-hs">{classText(m) || '-'} &middot; {m.student_id}</span>
                    </span>
                    {isNew && <span className="chip-hs chip-info-hs">New</span>}
                    {isRemoved && <span className="chip-hs chip-bad-hs">Removing</span>}
                    {isRemoved ? (
                      <button type="button" className="btn-hs btn-icon-hs" onClick={() => toggle(m, true)} aria-label={`Undo remove ${fullName(m)}`} title="Undo">
                        <RotateCcw size={18} aria-hidden="true" />
                      </button>
                    ) : (
                      <button type="button" className="btn-hs btn-icon-hs pk-remove-hs" onClick={() => toggle(m, false)} aria-label={`Remove ${fullName(m)}`} title="Remove">
                        <UserMinus size={18} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* RIGHT: students to add */}
          <section className="pk-tray-hs" aria-label="Add students">
            <h3 className="pk-pane-title-hs">Add students</h3>
            {isMakeup ? (
              <>
                <div className="pk-list-hs">
                  <div className="pk-sub-hs">Absent from the recent screening ({absentToAdd.length} not in this make-up)</div>
                  {absenteesLoading ? (
                    <div className="pk-empty-hs" role="status">Loading absent students...</div>
                  ) : absentToAdd.length === 0 ? (
                    <div className="pk-empty-hs">{absentees.length === 0 ? 'No student was absent' : 'Every absent student is in'}</div>
                  ) : absentToAdd.map((st) => (
                    <div key={st.student_id} className="pk-row-hs pk-picked-hs">
                      <span className="pk-avatar-hs" aria-hidden="true">{initialsOf(st)}</span>
                      <span className="pk-name-hs">
                        <span className="pk-name-main-hs">{fullName(st)}</span>
                        <span className="pk-id-hs">{classText(st)}</span>
                      </span>
                      <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => toggle(st, true)} aria-label={`Add ${fullName(st)}`} title="Add">
                        <UserPlus size={18} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pk-search-hs">
                  <Search size={18} aria-hidden="true" />
                  <input id="part-add-search-hs" type="search" aria-label="Find another student by name or ID" placeholder="Another student: name or ID" value={addSearch} onChange={(e) => setAddSearch(e.target.value)} />
                </div>
                {addSearch.trim().length >= 2 && (
                  <div className="pk-list-hs" aria-label="Matching students">
                    {addMatches.length === 0 ? (
                      <div className="pk-empty-hs">No student found{lockedClass ? ' in the same class' : ''}</div>
                    ) : addMatches.map((st) => (
                      <div key={st.student_id} className="pk-row-hs pk-picked-hs">
                        <span className="pk-avatar-hs" aria-hidden="true">{initialsOf(st)}</span>
                        <span className="pk-name-hs">
                          <span className="pk-name-main-hs">{fullName(st)}</span>
                          <span className="pk-id-hs">{st.student_id} &middot; {classText(st)}</span>
                        </span>
                        <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => { toggle(st, true); setAddSearch(''); }} aria-label={`Add ${fullName(st)}`} title="Add">
                          <UserPlus size={18} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="pk-filters-hs">
                  <select id="part-program-hs" aria-label="Academic Program" disabled={!!lockedClass} value={activeFilters.program_id} onChange={(e) => { setFilters({ program_id: e.target.value, year_level: '', section: '' }); setPickerPage(1); }}>
                    <option value="">{isCustom ? 'All programs' : '-- Program --'}</option>
                    {programs.map((p) => <option key={p.program_id} value={p.program_id}>{p.program_name}</option>)}
                  </select>
                  <select id="part-year-hs" aria-label="Year Level" disabled={!!lockedClass || (!isCustom && !activeFilters.program_id)} value={activeFilters.year_level} onChange={(e) => { setFilters({ ...filters, year_level: e.target.value, section: '' }); setPickerPage(1); }}>
                    <option value="">{isCustom ? 'All years' : '-- Year --'}</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    {String(programs.find((p) => p.program_id === activeFilters.program_id)?.type || '').toLowerCase() !== 'strand' && (
                      <>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                      </>
                    )}
                  </select>
                  <select id="part-section-hs" aria-label="Section" disabled={!!lockedClass || (!isCustom && !activeFilters.year_level)} value={activeFilters.section} onChange={(e) => { setFilters({ ...filters, section: e.target.value }); setPickerPage(1); }}>
                    <option value="">{isCustom ? 'All sections' : '-- Section --'}</option>
                    {(lockedClass ? [lockedClass.section] : sections).map((sec) => <option key={sec} value={sec}>{sec}</option>)}
                  </select>
                </div>

                <div className="pk-search-hs">
                  <Search size={18} aria-hidden="true" />
                  <input id="part-search-hs" type="search" aria-label="Search by name or ID" placeholder="Name or ID" value={pickerSearch} onChange={(e) => { setPickerSearch(e.target.value); setPickerPage(1); }} />
                </div>

                <div className="pk-bar-hs">
                  <label className="pk-all-hs">
                    <input
                      type="checkbox"
                      checked={allVisibleOn}
                      disabled={visiblePool.length === 0}
                      onChange={(e) => toggleAllVisible(e.target.checked)}
                      aria-label="Add or remove all shown students"
                    />
                    <span>{visiblePool.length} shown</span>
                  </label>
                </div>

                <div className="pk-list-hs">
                  {pickerData.total === 0 ? (
                    <div className="pk-empty-hs">
                      <Search size={24} aria-hidden="true" />
                      {(isCustom || activeFilters.section) ? 'No match' : 'Pick a class'}
                    </div>
                  ) : pickerData.items.map((st) => {
                    const on = memberIds.has(st.student_id);
                    return (
                      <label key={st.student_id} className={`pk-row-hs${on ? ' on-hs' : ''}`}>
                        <input
                          type="checkbox"
                          aria-label={`Include ${fullName(st)}`}
                          checked={on}
                          onChange={(e) => toggle(st, e.target.checked)}
                        />
                        <span className="pk-name-hs">
                          <span className="pk-name-main-hs">{fullName(st)}</span>
                          <span className="pk-id-hs">{st.student_id}</span>
                        </span>
                        <span className="chip-hs">{classText(st)}</span>
                      </label>
                    );
                  })}
                </div>
                <Pager page={pickerData.page} pageCount={pickerData.pageCount} total={pickerData.total} pageSize={PER_PAGE} onPage={setPickerPage} noun="students" />
              </>
            )}
          </section>
        </div>
      </div>

      <div className="modal-footer-hs">
        <button type="button" className="btn-hs btn-secondary-hs" onClick={requestClose}>Close</button>
        <button type="button" className="btn-hs btn-primary-hs" onClick={save} disabled={saving || loading || !changed || members.length === 0}>
          <Save size={16} aria-hidden="true" /> {saving ? 'Saving...' : 'Save & Notify'}
        </button>
      </div>
    </HsDialog>
  );
}
