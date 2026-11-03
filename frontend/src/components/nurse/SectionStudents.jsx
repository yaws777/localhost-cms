// SectionStudents.jsx
// The students of one program / year / section folder, each with a button to open their screening records.
import React, { useEffect, useMemo, useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { Pager, paginate } from '../common/RecordFolders';

const PER_PAGE = 12;

export default function SectionStudents({ apiBase, view, onOpenRecords }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const q = new URLSearchParams({ program_id: view.program_id, year_level: String(view.year_level) });
        const res = await fetch(`${apiBase}/filtered-students?${q.toString()}`);
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) throw new Error(data?.error || 'Failed to load the students');
        if (!cancelled) { setStudents(data.filter((s) => String(s.section) === String(view.section))); setError(''); }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load the students.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBase, view.program_id, view.year_level, view.section]);

  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    return paginate(students.filter((s) => !q || `${s.first_name || ''} ${s.last_name || ''} ${s.student_id || ''}`.toLowerCase().includes(q)), page, PER_PAGE);
  }, [students, search, page]);

  return (
    <>
      <div className="folder-toolbar-hs">
        <div className="folder-search-hs">
          <Search size={16} aria-hidden="true" />
          <input type="text" aria-label="Search students" placeholder="Search by name or student ID..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>
      {error ? <p className="hint-hs" role="alert">{error}</p> : (
        <div className="table-wrapper-hs">
          <table className="table-hs">
            <thead><tr><th scope="col">Student</th><th scope="col">Student ID</th><th scope="col">Records</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="3" className="empty-table-msg-hs" role="status">Loading...</td></tr>
              ) : data.total === 0 ? (
                <tr><td colSpan="3" className="empty-table-msg-hs">No student found in this section.</td></tr>
              ) : data.items.map((st) => (
                <tr key={st.student_id}>
                  <td>{st.first_name} {st.last_name}</td>
                  <td>{st.student_id}</td>
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
      <Pager page={data.page} pageCount={data.pageCount} total={data.total} pageSize={PER_PAGE} onPage={setPage} noun="students" />
    </>
  );
}
