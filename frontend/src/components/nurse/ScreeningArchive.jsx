// ScreeningArchive.jsx
// Graduated students. They leave the program / year / section folders and are kept here, marked as graduated,
// with their screening records one click away.
import React, { useCallback, useEffect, useState } from 'react';
import { Search, FileText, GraduationCap } from 'lucide-react';
import { Pager } from '../common/RecordFolders';
import { classLabel } from '../../utils/scheduling';
import { formatDate } from '../../utils/datetime';

const PAGE_SIZE = 15;

export default function ScreeningArchive({ apiBase, programs, onOpenRecords }) {
  const [rows, setRows] = useState([]);
  const [years, setYears] = useState([]);
  const [info, setInfo] = useState({ total: 0, pageCount: 1, pageSize: PAGE_SIZE });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [programId, setProgramId] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (debounced) p.set('q', debounced);
      if (programId) p.set('program_id', programId);
      if (year) p.set('school_year', year);
      const res = await fetch(`${apiBase}/screenings/archive?${p.toString()}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.students)) throw new Error(data?.error || 'Failed to load the archive');
      setRows(data.students);
      setYears(data.years || []);
      setInfo({ total: data.total, pageCount: data.pageCount, pageSize: data.pageSize });
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load the archive.');
    } finally {
      setLoading(false);
    }
  }, [apiBase, page, debounced, programId, year]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <p className="picker-note-hs">Graduated students are kept here with their screening records. Their folders stay in the school year they were screened.</p>
      <div className="folder-toolbar-hs">
        <div className="folder-search-hs">
          <Search size={16} aria-hidden="true" />
          <input type="text" aria-label="Search graduated students" placeholder="Search by name or student ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={programId} onChange={(e) => { setProgramId(e.target.value); setPage(1); }} aria-label="Program">
          <option value="">All programs</option>
          {programs.map((p) => <option key={p.program_id} value={p.program_id}>{p.program_id}</option>)}
        </select>
        <select value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }} aria-label="School year graduated">
          <option value="">All graduating years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {error ? <p className="hint-hs" role="alert">{error}</p> : (
        <div className="table-wrapper-hs">
          <table className="table-hs">
            <thead>
              <tr><th scope="col">Student</th><th scope="col">Last class</th><th scope="col">Graduated</th><th scope="col">Screenings attended</th><th scope="col">Records</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="empty-table-msg-hs" role="status">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="5" className="empty-table-msg-hs">No graduated student yet.</td></tr>
              ) : rows.map((st) => (
                <tr key={st.student_id}>
                  <td>{st.first_name} {st.last_name}<div className="sub-note-hs">{st.student_id}</div></td>
                  <td>{classLabel(st.program_id, st.year_level, st.section)}</td>
                  <td>
                    <span className="badge-hs badge-success-hs"><GraduationCap size={13} aria-hidden="true" /> Graduated</span>
                    <div className="sub-note-hs">{st.graduated_school_year || ''}{st.graduated_at ? ` (${formatDate(String(st.graduated_at).split('T')[0])})` : ''}</div>
                  </td>
                  <td>{st.attended}</td>
                  <td>
                    <button type="button" className="btn-hs btn-secondary-hs" onClick={() => onOpenRecords(st)} aria-label={`View screening records of ${st.first_name} ${st.last_name}`}>
                      <FileText size={16} aria-hidden="true" /> Records
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageCount={info.pageCount} total={info.total} pageSize={info.pageSize} onPage={setPage} noun="graduates" />
    </>
  );
}
