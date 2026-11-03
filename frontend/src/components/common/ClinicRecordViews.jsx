// ClinicRecordViews.jsx
// The Doctor Visit and Health Screening records as the student and the parent see them (Clinic Logs & Records, Child Clinic Records):
// a status pill for the table rows and a structured detail view for the modal, so the doctor's assessment and the screening result
// show as sections instead of a raw list of fields.
import React from 'react';
import { Stethoscope, Activity, Pill, FileText, Repeat, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { formatDate as formatDateBase, formatTime, formatDateTime } from '../../utils/datetime';
import '../../styles/common/ClinicRecordViews.css';

const asDate = (v) => (v ? new Date(String(v).includes(' ') && !String(v).includes('T') ? String(v).replace(' ', 'T') : v) : null);
const dateOf = (v) => {
    const d = asDate(v);
    return d && !Number.isNaN(d.getTime()) ? formatDateBase(d) : 'N/A';
};
const dayOnly = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? formatDateBase(v.slice(0, 10)) : dateOf(v));

const TONE_ICON = { ok: CheckCircle2, warn: Clock, bad: XCircle, info: Clock };

export const StatusPill = ({ tone = 'info', children }) => {
    const Icon = TONE_ICON[tone] || Clock;
    return <span className={`pill-crv pill-${tone}-crv`}><Icon size={13} aria-hidden="true" /> {children}</span>;
};

// where a doctor visit stands, for the Status column and the detail header
export const visitOutcome = (v) => {
    if (v.documented) return { label: 'Seen', tone: 'ok' };
    if (v.status === 'Cancelled' || v.status === 'Declined') return { label: v.status, tone: 'bad' };
    if (v.attendance_status === 'Absent' || v.queue_state === 'Void') return { label: 'Missed', tone: 'bad' };
    if (v.queue_state === 'Serving') return { label: 'In session', tone: 'info' };
    const end = asDate(v.end_time);
    if (end && end.getTime() < Date.now()) return { label: 'Not documented', tone: 'warn' };
    return { label: 'Upcoming', tone: 'info' };
};

export const visitDoctor = (v) => (v.doctor_first_name && v.doctor_last_name ? `Dr. ${v.doctor_first_name} ${v.doctor_last_name}` : v.doctor_id || 'N/A');
export const visitTitle = (v) => (v.is_repeat ? 'Repeat check-up' : (v.visit_type || 'Check-up'));

export const VisitStatus = ({ item }) => {
    const o = visitOutcome(item);
    return <StatusPill tone={o.tone}>{o.label}</StatusPill>;
};

export const ScreeningStatus = ({ item }) => {
    const tone = item.status === 'Completed' ? (item.is_abnormal ? 'warn' : 'ok') : item.status === 'Missed' || item.status === 'Cancelled' ? 'bad' : 'info';
    return <StatusPill tone={tone}>{item.status}</StatusPill>;
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

export function DoctorVisitDetail({ record: v }) {
    const outcome = visitOutcome(v);
    const start = asDate(v.start_time);
    const end = asDate(v.end_time);
    const prescriptions = Array.isArray(v.prescriptions) ? v.prescriptions : [];
    const responses = Array.isArray(v.template_responses) ? v.template_responses.filter((r) => r && r.value !== '' && r.value !== null && r.value !== undefined) : [];

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
                    <Row label="Reason">{v.chief_complaint || v.booking_reason}</Row>
                    <Row label="Attendance">{v.attendance_status}</Row>
                    <Row label="Time in">{v.check_in_time ? formatDateTime(asDate(v.check_in_time)) : null}</Row>
                    <Row label="Reason declined">{v.decline_reason}</Row>
                    <Row label="Notes">{v.student_notes}</Row>
                </dl>
            </Section>

            {v.documented ? (
                <>
                    <Section icon={FileText} title="Assessment">
                        <dl>
                            <Row label="Findings">{v.clinical_findings}</Row>
                            <Row label="Diagnosis">{v.diagnosis}</Row>
                            <Row label="Advice">{v.treatment_recommendations}</Row>
                            <Row label="Assessed on">{v.assessment_date ? dateOf(v.assessment_date) : null}</Row>
                        </dl>
                        {v.is_abnormal ? <p className="flag-crv"><AlertTriangle size={14} aria-hidden="true" /> The doctor marked this result as needing attention.</p> : null}
                    </Section>

                    {prescriptions.length > 0 && (
                        <Section icon={Pill} title="Prescription">
                            <ul className="list-crv">
                                {prescriptions.map((m, i) => (
                                    <li key={i}>
                                        <strong>{m.medicine}</strong>
                                        {[m.dosage, m.frequency, m.duration].filter(Boolean).length > 0 && <span> - {[m.dosage, m.frequency, m.duration].filter(Boolean).join(', ')}</span>}
                                        {m.instructions && <div className="sub-crv">{m.instructions}</div>}
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}

                    {responses.length > 0 && (
                        <Section icon={FileText} title={v.template_name || 'Doctor form'}>
                            <dl>{responses.map((r, i) => <Row key={r.key || i} label={r.label}>{Array.isArray(r.value) ? r.value.join(', ') : String(r.value)}</Row>)}</dl>
                        </Section>
                    )}

                    {(v.referral_facility || v.referral_reason) && (
                        <Section icon={FileText} title="Referral">
                            <dl>
                                <Row label="Refer to">{v.referral_facility}</Row>
                                <Row label="Reason">{v.referral_reason}</Row>
                            </dl>
                        </Section>
                    )}

                    {v.follow_up_needed ? (
                        <Section icon={Repeat} title="Repeat check-up">
                            <dl>
                                <Row label="Advised by">{v.follow_up_date ? dayOnly(v.follow_up_date) : 'As soon as possible'}</Row>
                                <Row label="Notes">{v.follow_up_notes}</Row>
                            </dl>
                        </Section>
                    ) : null}
                </>
            ) : (
                <p className="empty-crv">{outcome.tone === 'info' ? 'The assessment shows here after the check-up.' : 'No assessment was recorded for this check-up.'}</p>
            )}

            <FormValues record={v} keys={DENTAL_KEYS} title="Dental record" />
            <FormValues record={v} keys={VISION_KEYS} title="Vision record" />
        </div>
    );
}

// "Left ear: Normal | Right ear: Normal" -> [{label, value}] (older results are stored as one text)
const detailPairs = (details) => String(details || '').split(' | ').map((part) => {
    const i = part.indexOf(':');
    return i > 0 && i < 30 ? { label: part.slice(0, i).trim(), value: part.slice(i + 1).trim() } : { label: '', value: part.trim() };
}).filter((p) => p.value);

export function ScreeningDetail({ record: s }) {
    const results = Array.isArray(s.results) && s.results.length > 0 ? s.results : detailPairs(s.details);
    const completed = s.status === 'Completed';

    return (
        <div className="detail-crv">
            <div className="head-crv">
                <div>
                    <strong>{s.screening_type}</strong>
                    <div className="sub-crv">{s.title && s.title !== s.screening_type ? `${s.title} | ` : ''}{dayOnly(s.record_date)}{s.start_time && s.end_time ? `, ${formatTime(s.start_time)} - ${formatTime(s.end_time)}` : ''}</div>
                </div>
                <ScreeningStatus item={s} />
            </div>

            <Section icon={Activity} title="Screening">
                <dl>
                    <Row label="Attendance">{s.attendance ? s.attendance.charAt(0) + s.attendance.slice(1).toLowerCase() : null}</Row>
                    <Row label="Reason cancelled">{s.cancelled_reason}</Row>
                    <Row label="Notes">{s.announcement}</Row>
                </dl>
            </Section>

            {completed ? (
                <Section icon={FileText} title="Result">
                    <dl>
                        {results.map((r, i) => <Row key={i} label={r.label || 'Result'}>{r.value}{r.note ? ` (${r.note})` : ''}</Row>)}
                        <Row label="Remarks">{s.remarks}</Row>
                    </dl>
                    {s.is_abnormal ? <p className="flag-crv"><AlertTriangle size={14} aria-hidden="true" /> Some values are outside the normal range. See the clinic.</p> : null}
                </Section>
            ) : (
                <p className="empty-crv">{s.status === 'Upcoming' || s.status === 'Ongoing' ? 'The result shows here after the screening.' : 'No result was recorded.'}</p>
            )}
        </div>
    );
}
