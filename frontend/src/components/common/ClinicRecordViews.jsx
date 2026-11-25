// ClinicRecordViews.jsx
// The Doctor Visit and Health Screening records as the student and the parent see them (Clinic Logs & Records, Child Clinic Records):
// a status pill for the table rows and a structured detail view for the modal, so the doctor's assessment and the screening result
// show as sections instead of a raw list of fields.
import React from 'react';
import { Stethoscope, Activity, Pill, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';
import AssessmentForm from '../doctor/AssessmentForm';
import FormDocument from './FormDocument';
import { buildClinicVisitModel, buildDispensedModel, buildIncidentModel, buildScreeningRecordModel, detailPairs } from '../../utils/formModels';
import { formatDate as formatDateBase, formatTime, formatDateTime } from '../../utils/datetime';
import { hasVitals, vitalMeta, flaggedText, VITAL_FIELDS, inVitalsOf, outVitalsOf } from '../../utils/vitals';
import VitalMeta from './VitalMeta';
import { dispensedLine } from '../../utils/dispensed';
import '../../styles/common/ClinicRecordViews.css';

const asDate = (v) => (v ? new Date(String(v).includes(' ') && !String(v).includes('T') ? String(v).replace(' ', 'T') : v) : null);
const dateOf = (v) => {
    const d = asDate(v);
    return d && !Number.isNaN(d.getTime()) ? formatDateBase(d) : 'N/A';
};

const TONE_ICON = { ok: CheckCircle2, warn: AlertTriangle, bad: XCircle, info: Clock };

export const StatusPill = ({ tone = 'info', children }) => {
    const Icon = TONE_ICON[tone] || Clock;
    return <span className={`pill-crv pill-${tone}-crv`}><Icon size={13} aria-hidden="true" /> {children}</span>;
};

// where a doctor visit stands, for the Status column and the detail header
export const visitOutcome = (v) => {
    if (v.documented) return { label: 'Completed', tone: 'ok' };
    if (v.status === 'Cancelled' || v.status === 'Declined') return { label: v.status, tone: 'bad' };
    if (v.attendance_status === 'Absent' || v.queue_state === 'Void') return { label: 'Missed', tone: 'bad' };
    if (v.queue_state === 'Serving') return { label: 'In session', tone: 'info' };
    const end = asDate(v.end_time);
    if (end && end.getTime() < Date.now()) return { label: 'Not documented', tone: 'warn' };
    return { label: 'Upcoming', tone: 'info' };
};

export const visitDoctor = (v) => (v.doctor_first_name && v.doctor_last_name ? `Dr. ${v.doctor_first_name} ${v.doctor_last_name}` : v.doctor_id || 'N/A');
export const visitTitle = (v) => (v.is_repeat ? 'Follow-up check-up' : (v.visit_type || 'Check-up'));

export const VisitStatus = ({ item }) => {
    const o = visitOutcome(item);
    return <StatusPill tone={o.tone}>{o.label}</StatusPill>;
};

export const ScreeningStatus = ({ item }) => {
    // the status keeps one color per label; an abnormal result is its own pill
    const tone = item.status === 'Completed' ? 'ok' : item.status === 'Missed' || item.status === 'Cancelled' ? 'bad' : 'info';
    const flagged = item.status === 'Completed' && !!item.is_abnormal;
    return (
        <span className="pills-crv">
            <StatusPill tone={tone}>{item.status}</StatusPill>
            {flagged && <StatusPill tone="warn">{flaggedText(item.results) || 'Not normal'}</StatusPill>}
        </span>
    );
};

const Row = ({ label, children }) => (children === null || children === undefined || children === '' ? null : (
    <div className="row-crv"><dt>{label}</dt><dd>{children}</dd></div>
));

const Section = ({ icon: Icon, title, children }) => (
    <section className="section-crv">
        <h4><Icon size={15} aria-hidden="true" /> {title}</h4>
        {children}
    </section>
);

const keyLabel = (key) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// dental / vision visit forms: every filled value
const FormValues = ({ record, keys, title }) => {
    const filled = keys.filter((k) => record[k] !== null && record[k] !== undefined && record[k] !== '');
    if (filled.length === 0) return null;
    return (
        <Section icon={Stethoscope} title={title}>
            <dl>{filled.map((k) => <Row key={k} label={keyLabel(k.replace(/^(dental|vision)_/, ''))}>{String(record[k])}</Row>)}</dl>
        </Section>
    );
};

const DENTAL_KEYS = ['oral_hygiene', 'caries_count', 'missing_count', 'filled_count', 'gum_condition', 'malocclusion', 'tooth_notes', 'treatment_done', 'treatment_needed', 'referral_needed', 'referral_to', 'next_visit_recommendation', 'dental_remarks'];
const VISION_KEYS = ['visual_acuity_left', 'visual_acuity_right', 'va_left_corrected', 'va_right_corrected', 'wears_eyeglasses', 'wears_contacts', 'color_vision', 'eye_findings', 'recommended_action', 'vision_remarks'];

// one set of vital signs: value, Normal / High / Low and the normal range under each
const VitalGroup = ({ title, values }) => (
    <Section icon={Activity} title={title}>
        <dl>
            {VITAL_FIELDS.map((f) => {
                const m = vitalMeta(f.key, values[f.key]);
                return m.value ? (
                    <div className="row-crv" key={f.key}>
                        <dt>{f.label} ({f.unit})</dt>
                        <dd>{m.value}<VitalMeta status={m.status} range={m.range} /></dd>
                    </div>
                ) : null;
            })}
        </dl>
    </Section>
);

export function DoctorVisitDetail({ record: v }) {
    const outcome = visitOutcome(v);
    const start = asDate(v.start_time);
    const end = asDate(v.end_time);

    return (
        <div className="detail-crv">
            <div className="head-crv">
                <div>
                    <strong>{visitTitle(v)}</strong>
                    <div className="sub-crv">{visitDoctor(v)}{v.location ? `, ${v.location}` : ''}</div>
                    <div className="sub-crv">{dateOf(v.start_time)}{start && end ? `, ${formatTime(start)} - ${formatTime(end)}` : ''}{v.queue_label ? ` | Number ${v.queue_label}` : ''}</div>
                </div>
                <StatusPill tone={outcome.tone}>{outcome.label}</StatusPill>
            </div>

            <Section icon={Stethoscope} title="Check-up">
                <dl>
                    <Row label="Reason">{v.documented ? v.booking_reason : (v.chief_complaint || v.booking_reason)}</Row>
                    <Row label="Attendance">{v.attendance_status}</Row>
                    <Row label="Time in">{v.check_in_time ? formatDateTime(asDate(v.check_in_time)) : null}</Row>
                    <Row label="Reason declined">{v.decline_reason}</Row>
                    <Row label="Notes">{v.student_notes}</Row>
                </dl>
            </Section>

            {v.documented ? (
                <AssessmentForm a={v} showPdf={false} showHeader={false} />
            ) : (
                <>
                    {(hasVitals(inVitalsOf(v)) || hasVitals(outVitalsOf(v))) && (
                        <>
                            {hasVitals(inVitalsOf(v)) && <VitalGroup title="Vital signs - time in" values={inVitalsOf(v)} />}
                            {hasVitals(outVitalsOf(v)) && <VitalGroup title="Vital signs - time out" values={outVitalsOf(v)} />}
                        </>
                    )}
                    <p className="empty-crv">{outcome.tone === 'info' ? 'The assessment shows here after the check-up.' : 'No assessment was recorded for this check-up.'}</p>
                    {dispensedLine(v) && (
                        <Section icon={Pill} title="Medicine dispensed">
                            <dl><Row label="Given at time out">{dispensedLine(v)}</Row></dl>
                        </Section>
                    )}
                    <FormValues record={v} keys={DENTAL_KEYS} title="Dental record" />
                    <FormValues record={v} keys={VISION_KEYS} title="Vision record" />
                </>
            )}
        </div>
    );
}

// The four forms the nurse fills up, shown filled in like the paper form and exportable as PDF (FormDocument + utils/formModels.js)
export function ClinicVisitForm({ record }) {
    return <FormDocument model={buildClinicVisitModel(record)} showPdf={false} />;
}

export function DispensedForm({ record }) {
    return <FormDocument model={buildDispensedModel(record)} showPdf={false} />;
}

export function IncidentForm({ record }) {
    return <FormDocument model={buildIncidentModel(record)} showPdf={false} />;
}

export function ScreeningDetail({ record }) {
    return <FormDocument model={buildScreeningRecordModel(record)} showPdf={false} />;
}

export { detailPairs };
