// AssessmentModals.jsx
// Read-only looks at documented check-ups, shared by the doctor portal and the nurse's Doctor Visit page:
//   - AssessmentViewModal: the assessment (shown as the assessment form, exportable as PDF) or, when nothing was documented, the details of one check-up
//   - AssessmentHistoryModal: every assessment the clinic documented for one student
import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Eye, History } from 'lucide-react';
import { useRecordSync } from '../../hooks/useRecordSync';
import Modal from '../common/Modal';
import AssessmentForm from './AssessmentForm';
import { formatDate, formatTime } from '../../utils/datetime';
import { visitLabel, sourceLabel, statusClass, statusLabel, fullName } from '../../utils/visitPurpose';
import { hasVitals, vitalsLine, inVitalsOf, outVitalsOf } from '../../utils/vitals';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';

const Fact = ({ label, children }) => (
    <>
        <dt>{label}</dt>
        <dd>{children}</dd>
    </>
);

// Vital signs the nurse took at time in / time out of the check-up (nothing when none were recorded)
const VitalFacts = ({ a }) => (
    <>
        {hasVitals(inVitalsOf(a)) && <Fact label="Vital signs (time in)">{vitalsLine(inVitalsOf(a))}</Fact>}
        {hasVitals(outVitalsOf(a)) && <Fact label="Vital signs (time out)">{vitalsLine(outVitalsOf(a))}</Fact>}
    </>
);

// What the doctor wrote for one check-up: the assessment form, read only (PDF button included)
export const AssessmentDetails = ({ a, ctx, showHeader = true, showVitals = true }) => <AssessmentForm a={a} ctx={ctx} showHeader={showHeader} showVitals={showVitals} />;

// status only: the abnormal flag, follow-up and template name are already on the form
const chipsOf = (a) => (
    <div className="dp-appt-chips">
        <span className={`dp-chip ${statusClass(a.status)}`}>{statusLabel(a.status)}</span>
    </div>
);

// ---------------------------------------------------------------------------
// One check-up: the assessment form, or its details when nothing was documented
// ---------------------------------------------------------------------------
export const AssessmentViewModal = ({ appt, onClose }) => {
    if (!appt) return null;
    const documented = !!appt.assessment_id;
    return (
        <Modal isOpen onClose={onClose} title={documented ? 'Assessment' : 'Check-up details'} icon={<ClipboardList size={20} />} size="lg">
            {documented ? (
                <>
                    {chipsOf(appt)}
                    <AssessmentForm a={appt} />
                </>
            ) : (
                <>
                    <div className="dp-notice">
                        <strong>{fullName(appt.student_first_name, appt.student_last_name)}</strong> ({appt.student_id}) - {visitLabel(appt.visit_type, appt.purpose_other)}<br />
                        {formatDate(appt.start_time)}, {formatTime(appt.start_time)} - {formatTime(appt.end_time)} - Dr. {appt.doc_first_name} {appt.doc_last_name}
                    </div>
                    {chipsOf(appt)}
                    <dl className="dp-kv">
                        <Fact label="Attendance">{appt.attendance_status || 'Pending'}</Fact>
                        <VitalFacts a={appt} />
                        <Fact label="Scheduled by">{sourceLabel(appt.booking_source)}</Fact>
                        {appt.booking_reason && <Fact label="Reason given">{appt.booking_reason}</Fact>}
                        {appt.decline_reason && <Fact label={appt.status === 'Declined' ? 'Declined because' : 'Cancelled because'}>{appt.decline_reason}</Fact>}
                        {appt.notes && <Fact label="Notes">{appt.notes}</Fact>}
                        <Fact label="Assessment">Not documented.</Fact>
                    </dl>
                </>
            )}
            <div className="dp-modal-foot">
                <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Close</button>
            </div>
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// Every assessment documented for the student (all doctors), newest first
// ---------------------------------------------------------------------------
export const AssessmentHistoryModal = ({ appt, onClose }) => {
    const [rows, setRows] = useState(null);
    const [selected, setSelected] = useState(null); // the assessment whose form is open; null = the table

    useEffect(() => {
        if (!appt) return undefined;
        let live = true;
        setRows(null);
        setSelected(null);
        fetch(`${API}/api/doctor/patients/${encodeURIComponent(appt.student_id)}/record`)
            .then((r) => r.json())
            .then((d) => { if (live) setRows(d.success ? d.consultations : []); })
            .catch(() => { if (live) setRows([]); });
        return () => { live = false; };
    }, [appt]);

    // an assessment was edited, repeated or removed (here, another tab or another device): the table, the open form and its PDF follow
    useRecordSync(['checkup', 'visit'], useCallback(() => {
        if (!appt) return;
        fetch(`${API}/api/doctor/patients/${encodeURIComponent(appt.student_id)}/record`)
            .then((r) => r.json())
            .then((d) => {
                if (!d.success) return;
                setRows(d.consultations);
                setSelected((cur) => (cur ? (d.consultations.find((c) => c.appointment_id === cur.appointment_id && c.student_id === cur.student_id) || null) : cur));
            })
            .catch(() => {});
    }, [appt]), { enabled: !!appt });

    const isCurrent = (r) => !!appt && r.appointment_id === appt.appointment_id;

    return (
        <Modal isOpen={!!appt} onClose={onClose} title={selected ? 'Assessment' : 'Past assessments'} icon={selected ? <ClipboardList size={20} /> : <History size={20} />} size="lg">
            {appt && selected ? (
                <>
                    {chipsOf(selected)}
                    <AssessmentForm
                        a={selected}
                        ctx={{ student: fullName(selected.student_first_name || appt.student_first_name, selected.student_last_name || appt.student_last_name), studentId: selected.student_id || appt.student_id }}
                    />
                    <div className="dp-modal-foot">
                        <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setSelected(null)}>Back to list</button>
                        <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Close</button>
                    </div>
                </>
            ) : (
                <>
                    {appt && (
                        <div className="dp-notice" style={{ marginBottom: 14 }}>
                            <strong>{fullName(appt.student_first_name, appt.student_last_name)}</strong> ({appt.student_id}) - every assessment documented for this student
                        </div>
                    )}
                    {rows === null ? <p className="dp-hint" role="status">Loading...</p> : rows.length === 0 ? (
                        <p className="dp-hint">No assessment was documented for this student yet.</p>
                    ) : (
                        <div className="dp-card dp-table-wrap">
                            <table className="dp-table">
                                <caption className="sr-only">Past assessments of the student</caption>
                                <thead>
                                    <tr><th>Date</th><th>Purpose</th><th>Doctor</th><th>Diagnosis</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={`${r.appointment_id}-${r.student_id}`} className={isCurrent(r) ? 'focus' : ''}>
                                            <td className="nowrap">
                                                {formatDate(r.start_time)}
                                                {isCurrent(r) && <div><span className="dp-chip source">This check-up</span></div>}
                                            </td>
                                            <td>{visitLabel(r.visit_type, r.purpose_other)}</td>
                                            <td>Dr. {r.doc_first_name} {r.doc_last_name}</td>
                                            <td>
                                                <div className="dp-cell-clip">{r.diagnosis || '-'}</div>
                                                <div className="dp-appt-chips">
                                                    {!!r.is_abnormal && <span className="dp-chip abnormal">Not normal</span>}
                                                    {!!r.follow_up_needed && <span className="dp-chip st-pending-approval">Follow-up</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <button type="button" className="dp-btn dp-btn-ghost dp-btn-icon" onClick={() => setSelected(r)} aria-label={`View assessment on ${formatDate(r.start_time)}`} title="View assessment">
                                                    <Eye size={16} aria-hidden="true" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="dp-modal-foot">
                        <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Close</button>
                    </div>
                </>
            )}
        </Modal>
    );
};
