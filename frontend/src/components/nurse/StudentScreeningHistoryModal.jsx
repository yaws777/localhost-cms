// StudentScreeningHistoryModal.jsx
// Every screening of one student (results, absences), grouped by school year; the school year select shows one year's record.
import React, { useMemo, useState } from 'react';
import { HsDialog, HsDialogHeader } from './HsDialog';
import { formatDate } from '../../utils/datetime';
import { classLabel as classLabelOf } from '../../utils/scheduling';

const ATTENDANCE_LABEL = { ABSENT: 'Absent', CANCELLED: 'Cancelled', PENDING: 'Not documented', PRESENT: 'Present' };

const FlagBadge = ({ row }) => {
  if (row.attendance_status === 'ABSENT' || row.attendance_status === 'CANCELLED') {
    return <span className="badge-hs badge-status-absent-hs">{ATTENDANCE_LABEL[row.attendance_status]}</span>;
  }
  if (!row.summary) return <span className="badge-hs">{ATTENDANCE_LABEL[row.attendance_status] || 'No result'}</span>;
  return row.is_abnormal
    ? <span className="badge-hs badge-status-absent-hs">Abnormal</span>
    : <span className="badge-hs badge-success-hs">Normal</span>;
};

export default function StudentScreeningHistoryModal({ student, rows, loading, onClose, zIndex = 1050 }) {
  const [year, setYear] = useState('ALL');
  const years = useMemo(() => [...new Set(rows.map((r) => r.school_year).filter(Boolean))].sort().reverse(), [rows]);
  const visible = rows.filter((r) => year === 'ALL' || r.school_year === year);
  const groups = [...years, ''].map((y) => ({ year: y, items: visible.filter((r) => (r.school_year || '') === y) })).filter((g) => g.items.length > 0);
  const name = `${student.first_name || ''} ${student.last_name || ''}`.trim();
  const classLabel = classLabelOf(student.program_id || student.program_name, student.year_level, student.section);

  return (
    <HsDialog onClose={onClose} size="lg" zIndex={zIndex}>
      <HsDialogHeader
        onClose={onClose}
        sub={<p className="modal-sub-hs">{student.student_id}{classLabel ? ` - ${classLabel}` : ''}{student.graduated_at || student.graduated_school_year ? ` - Graduated${student.graduated_school_year ? ` ${student.graduated_school_year}` : ''}` : ''}</p>}
      >
        Screening records: {name}
      </HsDialogHeader>
      <div className="modal-body-hs">
        {loading ? <p className="hint-hs" role="status">Loading...</p> : rows.length === 0 ? (
          <p className="hint-hs">No screening record yet.</p>
        ) : (
          <>
            <div className="form-group-hs history-year-hs">
              <label htmlFor="history-year-hs">School year</label>
              <select id="history-year-hs" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="ALL">All school years</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {groups.map((g) => (
              <section key={g.year || 'none'} aria-label={g.year ? `School year ${g.year}` : 'No school year'}>
                <span className="list-title-hs">{g.year ? `School year ${g.year}` : 'No school year'} ({g.items.length})</span>
                <div className="table-wrapper-hs">
                  <table className="table-hs">
                    <thead><tr><th scope="col">Date</th><th scope="col">Screening</th><th scope="col">Type</th><th scope="col">Result</th><th scope="col">Status</th></tr></thead>
                    <tbody>
                      {g.items.map((h, i) => (
                        <tr key={`${h.screening_schedule_id}-${h.screening_type}-${i}`}>
                          <td>{h.date ? formatDate(String(h.date).split('T')[0]) : ''}</td>
                          <td>{h.title}</td>
                          <td>{h.screening_type}</td>
                          <td>{h.summary || '-'}{h.remarks ? <div className="sub-note-hs">{h.remarks}</div> : null}</td>
                          <td><FlagBadge row={h} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        )}
      </div>
      <div className="modal-footer-hs">
        <button type="button" className="btn-hs btn-secondary-hs" onClick={onClose}>Close</button>
      </div>
    </HsDialog>
  );
}
