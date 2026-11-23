// AssessmentForm.jsx
// A documented check-up shown as the assessment form itself (same sections and fields as the doctor's Document check-up form),
// read only, with an icon button that exports the same layout as a PDF (nurse name on the signature line).
// Every screen that opens an assessment uses this: doctor / nurse lists, Visit Log, student and parent records, student Check-up page.
//   a:   the record with the assessment columns (see buildAssessmentModel)
//   ctx: what the record does not carry: { student, studentId, purpose, doctor, when }
import React, { useId, useMemo } from 'react';
import { FileDown } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { buildAssessmentModel } from '../../utils/assessmentModel';
import { printAssessment } from '../../utils/assessmentPdf';
import VitalMeta from '../common/VitalMeta';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/doctor/AssessmentForm.css';

const rowsFor = (text) => Math.min(8, Math.max(2, String(text).split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 70)), 0)));

const Box = ({ id, label, value, area, status, range }) => (
    <div className="dp-field">
        <label htmlFor={id}>{label}</label>
        {area
            ? <textarea id={id} className="dp-textarea" readOnly rows={rowsFor(value)} value={value} />
            : <input id={id} className="dp-input" type="text" readOnly value={value} />}
        <VitalMeta status={status} range={range} />
    </div>
);

export const AssessmentForm = ({ a, ctx, showPdf = true, showHeader = true, showVitals = true }) => {
    const { showAlert } = useAlert();
    const uid = useId();
    const m = useMemo(() => buildAssessmentModel(a, ctx), [a, ctx]);
    const id = (key) => `${uid}-${key}`;

    return (
        <form className="dp-form af-form" onSubmit={(e) => e.preventDefault()} aria-label="Assessment form">
            <div className="af-bar">
                {showHeader && (
                    <div className="dp-notice af-head">
                        {m.header.map(([k, v]) => <div key={k}><strong>{k}:</strong> {v}</div>)}
                    </div>
                )}
                {showPdf && m.documented && (
                    <button
                        type="button"
                        className="dp-btn dp-btn-ghost dp-btn-icon af-pdf"
                        onClick={() => printAssessment(a, ctx, () => showAlert('Allow popups to preview the PDF.', 'warning'))}
                        aria-label="Export PDF"
                        title="Export PDF"
                    >
                        <FileDown size={18} aria-hidden="true" />
                    </button>
                )}
            </div>

            {m.abnormal && <div className="dp-error" role="status">The doctor marked this result as not normal.</div>}

            {showVitals && m.vitals.map((g, gi) => (
                <React.Fragment key={g.title}>
                    <div className="dp-section-label">{g.title}</div>
                    <div className="dp-row">
                        {g.items.map((i) => <Box key={i.label} id={id(`v${gi}-${i.label}`)} label={`${i.label}${i.unit ? ` (${i.unit})` : ''}`} value={i.value} status={i.status} range={i.range} />)}
                    </div>
                </React.Fragment>
            ))}

            {m.nurseRemarks && <Box id={id('nurse-remarks')} label="Nurse remarks" value={m.nurseRemarks} area />}

            {m.sections.map((s, si) => (
                <React.Fragment key={s.title}>
                    <div className="dp-section-label">{s.title}</div>
                    {s.fields.map((f) => <Box key={f.key} id={id(`s${si}-${f.key}`)} label={f.label} value={f.value} area={f.type === 'textarea'} />)}
                </React.Fragment>
            ))}

            {(m.prescriptions.length > 0 || m.dispensed) && (
                <>
                    <div className="dp-section-label">Prescription</div>
                    {m.prescriptions.map((p, i) => (
                        <div key={i} className="dp-card af-rx">
                            <div className="dp-row">
                                <Box id={id(`rx${i}-m`)} label="Medicine" value={p.medicine} />
                                <Box id={id(`rx${i}-d`)} label="Dosage" value={p.dosage || ''} />
                                <Box id={id(`rx${i}-f`)} label="Frequency" value={p.frequency || ''} />
                                <Box id={id(`rx${i}-u`)} label="Duration" value={p.duration || ''} />
                            </div>
                            {p.instructions && <Box id={id(`rx${i}-i`)} label="Instructions" value={p.instructions} />}
                        </div>
                    ))}
                    {m.dispensed && <Box id={id('dispensed')} label="Medicine dispensed (time out)" value={m.dispensed} />}
                </>
            )}

            {m.followUp && (
                <>
                    <div className="dp-section-label">Follow-up</div>
                    <label className="dp-check"><input type="checkbox" checked readOnly disabled /> Follow-up needed</label>
                    <div className="dp-row">
                        <Box id={id('fu-date')} label="Follow-up date" value={m.followUp.date || 'As soon as possible'} />
                        {m.followUp.notes && <Box id={id('fu-notes')} label="Follow-up notes" value={m.followUp.notes} />}
                    </div>
                </>
            )}

            {m.referral && (
                <>
                    <div className="dp-section-label">Referral</div>
                    <div className="dp-row">
                        <Box id={id('ref-to')} label="Refer to" value={m.referral.facility} />
                        {m.referral.reason && <Box id={id('ref-why')} label="Reason" value={m.referral.reason} />}
                    </div>
                </>
            )}

            {m.documentedBy && <p className="dp-hint af-foot">Documented {m.documentedBy}</p>}
        </form>
    );
};

export default AssessmentForm;
