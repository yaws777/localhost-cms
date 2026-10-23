// PastVisitsTable.jsx
// Past doctor visits as a table: one row per visit (a batch of students, or a single booking).
import React from 'react';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { formatDate, formatTime } from '../../utils/datetime';
import { visitLabel } from '../../utils/visitPurpose';

const PastVisitsTable = ({ groups, onView, onUpdate, onDelete }) => (
    <div style={{ overflowX: 'auto' }}>
        <table className="sti-table-dv">
            <thead>
                <tr>
                    <th>Visit</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Doctor</th>
                    <th>Type</th>
                    <th>Present</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {groups.map((group) => {
                    const total = group.appointments.length;
                    const present = group.appointments.filter(a => (a.attendance_status || '').toLowerCase() === 'present').length;
                    return (
                        <tr key={group.groupKey}>
                            <td>
                                <strong>{group.title}</strong>
                                <div className="sub-text-dv">{group.batchId ? `Batch #${group.batchId}` : 'Individual visit'}</div>
                            </td>
                            <td>{group.apptStart ? formatDate(group.apptStart) : ''}</td>
                            <td>{group.apptStart ? formatTime(group.apptStart) : ''} - {group.apptEnd ? formatTime(group.apptEnd) : ''}</td>
                            <td>
                                {group.doctorName}
                                <div className="sub-text-dv">{group.specialization}</div>
                            </td>
                            <td>{visitLabel(group.visitType, group.purposeOther)}</td>
                            <td><strong>{present} / {total}</strong></td>
                            <td>
                                <div className="table-actions-dv">
                                    <button type="button" className="action-btn-dv" onClick={() => onView(group)} title="View participants and records">
                                        <Eye size={14} /> View
                                    </button>
                                    <button type="button" className="action-btn-dv edit-dv" onClick={() => onUpdate(group)} title="Update date and start/end time">
                                        <Edit size={14} /> Update
                                    </button>
                                    <button type="button" className="action-btn-dv cancel-dv" onClick={() => onDelete(group)} title="Delete this visit permanently">
                                        <Trash2 size={14} /> Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

export default PastVisitsTable;
