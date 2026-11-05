// ScreeningParticipantsModal.jsx
// View and edit the participants of an upcoming health screening. The working list starts as the saved participants and Save sends the whole list.
// - A screening is for one class (same program, year level and section): the picker is locked to the class of the participants,
//   or asks for the program, year and section first.
// - A make-up session only shows the students who were absent from the screening it makes up. Those can be added back with one click,
//   and any other student of the same class can be found by name or ID.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UserMinus, UserPlus, Save, Search } from 'lucide-react';
import { Pager, paginate } from '../common/RecordFolders';
import { classLabel } from '../../utils/scheduling';
import { HsDialog, HsDialogHeader } from './HsDialog';

const PER_PAGE = 8;
const SEARCH_LIMIT = 8;
const fullName = (st) => `${st.first_name || ''} ${st.last_name || ''}`.trim();
const classKey = (st) => `${st.program_id}|${st.year_level}|${st.section}`;
const toMember = (st) => ({
  student_id: st.student_id, first_name: st.first_name, last_name: st.last_name,
  program_id: st.program_id, program_name: st.program_name, year_level: st.year_level, section: st.section
});

export default function ScreeningParticipantsModal({ schedule, programs, apiBase, senderId, onClose, onSaved, showAlert, showConfirm }) {
  const scheduleId = schedule.screening_schedule_id;
  const isMakeup = !!schedule.makeup_of;
  const isCustom = !!schedule.folder_id; // custom folder: students from any class
  const [members, setMembers] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberPage, setMemberPage] = useState(1);

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

  const memberData = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    const list = members.filter((m) => !q || `${fullName(m)} ${m.student_id} ${m.program_name || ''} ${m.section || ''}`.toLowerCase().includes(q));
    return paginate(list, memberPage, PER_PAGE);
  }, [members, memberSearch, memberPage]);
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
            {members.length} student{members.length === 1 ? '' : 's'}
            {changed && ` (${added} to add, ${removed} to remove - not saved yet)`}
          </p>
        )}
      >
        Participants - {schedule.title}
      </HsDialogHeader>

      <div className="modal-body-hs">
        <span className="list-title-hs">Current participants</span>
        <div className="form-group-hs">
          <label htmlFor="part-member-search-hs">Search participants</label>
          <input
            id="part-member-search-hs"
            type="text"
            placeholder="Name, ID, program or section"
            value={memberSearch}
            onChange={(e) => { setMemberSearch(e.target.value); setMemberPage(1); }}
          />
        </div>
        <div className="table-wrapper-hs">
          <table className="table-hs">
            <thead>
              <tr><th scope="col">Student Name</th><th scope="col">Class</th><th scope="col">Action</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="3" className="empty-table-msg-hs" role="status">Loading participants...</td></tr>
              ) : memberData.total === 0 ? (
                <tr><td colSpan="3" className="empty-table-msg-hs">{members.length === 0 ? 'No participants. Add students below.' : 'No participants match your search.'}</td></tr>
              ) : memberData.items.map((m) => (
                <tr key={m.student_id}>
                  <td>{fullName(m)}{!savedIds.includes(m.student_id) && ' (new)'}</td>
                  <td>{classText(m) || '-'}</td>
                  <td>
                    <button type="button" className="btn-hs btn-danger-hs" onClick={() => toggle(m, false)} aria-label={`Remove ${fullName(m)}`}>
                      <UserMinus size={16} aria-hidden="true" /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={memberData.page} pageCount={memberData.pageCount} total={memberData.total} pageSize={PER_PAGE} onPage={setMemberPage} noun="participants" />

        {isMakeup ? (
          <>
            <span className="list-title-hs picker-title-hs">Absent from the recent screening ({absentToAdd.length} not in this make-up)</span>
            <div className="table-wrapper-hs">
              <table className="table-hs">
                <thead>
                  <tr><th scope="col">Student Name</th><th scope="col">Class</th><th scope="col">Action</th></tr>
                </thead>
                <tbody>
                  {absenteesLoading ? (
                    <tr><td colSpan="3" className="empty-table-msg-hs" role="status">Loading absent students...</td></tr>
                  ) : absentToAdd.length === 0 ? (
                    <tr><td colSpan="3" className="empty-table-msg-hs">{absentees.length === 0 ? 'No student was absent from the recent screening.' : 'Every absent student is already in this make-up.'}</td></tr>
                  ) : absentToAdd.map((st) => (
                    <tr key={st.student_id}>
                      <td>{fullName(st)}</td>
                      <td>{classText(st)}</td>
                      <td>
                        <button type="button" className="btn-hs btn-secondary-hs" onClick={() => toggle(st, true)} aria-label={`Add ${fullName(st)}`}>
                          <UserPlus size={16} aria-hidden="true" /> Add
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <span className="list-title-hs picker-title-hs">Add another student</span>
            <div className="form-group-hs">
              <label htmlFor="part-add-search-hs">Find a student by name or student ID</label>
              <div className="folder-search-hs">
                <Search size={16} aria-hidden="true" />
                <input id="part-add-search-hs" type="text" placeholder="Type at least 2 letters" value={addSearch} onChange={(e) => setAddSearch(e.target.value)} />
              </div>
            </div>
            {addSearch.trim().length >= 2 && (
              <ul className="add-results-hs" aria-label="Matching students">
                {addMatches.length === 0 ? (
                  <li className="hint-hs">No student found{lockedClass ? ' in the same program, year level and section' : ''}.</li>
                ) : addMatches.map((st) => (
                  <li key={st.student_id}>
                    <span>{fullName(st)} <span className="sub-note-hs">{st.student_id} - {classText(st)}</span></span>
                    <button type="button" className="btn-hs btn-secondary-hs" onClick={() => { toggle(st, true); setAddSearch(''); }} aria-label={`Add ${fullName(st)}`}>
                      <UserPlus size={16} aria-hidden="true" /> Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <span className="list-title-hs picker-title-hs">Add students</span>
            <p className="picker-note-hs">
              {isCustom
                ? 'This screening is in a custom folder, so students from any program, year level and section can be added. Use the filters only to find students; tick the ones to add. Unticking a student removes them.'
                : lockedClass
                ? 'A screening is for one class, so only students of the same program, year level and section can be added. Tick the ones to add; unticking a student removes them.'
                : 'Choose the program, year level and section to list the students, then tick the ones to add. Unticking a student removes them.'}
            </p>
            <div className="picker-bar-hs">
              <div className="form-group-hs">
                <label htmlFor="part-program-hs">Academic Program</label>
                <select id="part-program-hs" disabled={!!lockedClass} value={activeFilters.program_id} onChange={(e) => { setFilters({ program_id: e.target.value, year_level: '', section: '' }); setPickerPage(1); }}>
                  <option value="">{isCustom ? '-- All programs --' : '-- Select program --'}</option>
                  {programs.map((p) => <option key={p.program_id} value={p.program_id}>{p.program_name}</option>)}
                </select>
              </div>
              <div className="form-group-hs">
                <label htmlFor="part-year-hs">Year Level</label>
                <select id="part-year-hs" disabled={!!lockedClass || (!isCustom && !activeFilters.program_id)} value={activeFilters.year_level} onChange={(e) => { setFilters({ ...filters, year_level: e.target.value, section: '' }); setPickerPage(1); }}>
                  <option value="">{isCustom ? '-- All year levels --' : '-- Select year --'}</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  {String(programs.find((p) => p.program_id === activeFilters.program_id)?.type || '').toLowerCase() !== 'strand' && (
                    <>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </>
                  )}
                </select>
              </div>
              <div className="form-group-hs">
                <label htmlFor="part-section-hs">Section</label>
                <select id="part-section-hs" disabled={!!lockedClass || (!isCustom && !activeFilters.year_level)} value={activeFilters.section} onChange={(e) => { setFilters({ ...filters, section: e.target.value }); setPickerPage(1); }}>
                  <option value="">{isCustom ? '-- All sections --' : '-- Select section --'}</option>
                  {(lockedClass ? [lockedClass.section] : sections).map((sec) => <option key={sec} value={sec}>{sec}</option>)}
                </select>
              </div>
              <div className="form-group-hs">
                <label htmlFor="part-search-hs">Search student</label>
                <input id="part-search-hs" type="text" placeholder="Name or student ID" value={pickerSearch} onChange={(e) => { setPickerSearch(e.target.value); setPickerPage(1); }} />
              </div>
            </div>
            <div className="table-wrapper-hs">
              <table className="table-hs">
                <thead>
                  <tr>
                    <th scope="col" className="col-checkbox-hs">
                      <input
                        type="checkbox"
                        checked={allVisibleOn}
                        disabled={visiblePool.length === 0}
                        onChange={(e) => toggleAllVisible(e.target.checked)}
                        aria-label="Add or remove all matching students"
                      />
                    </th>
                    <th scope="col">Student Name</th><th scope="col">Class</th>
                  </tr>
                </thead>
                <tbody>
                  {pickerData.total === 0 ? (
                    <tr><td colSpan="3" className="empty-table-msg-hs">{(isCustom || activeFilters.section) ? 'No students match the selected filters or search.' : 'Select the program, year level and section to list the students.'}</td></tr>
                  ) : pickerData.items.map((st) => (
                    <tr key={st.student_id}>
                      <td className="col-checkbox-hs">
                        <input
                          type="checkbox"
                          aria-label={`Include ${fullName(st)}`}
                          checked={memberIds.has(st.student_id)}
                          onChange={(e) => toggle(st, e.target.checked)}
                        />
                      </td>
                      <td>{fullName(st)}</td>
                      <td>{classText(st)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={pickerData.page} pageCount={pickerData.pageCount} total={pickerData.total} pageSize={PER_PAGE} onPage={setPickerPage} noun="students" />
          </>
        )}
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
