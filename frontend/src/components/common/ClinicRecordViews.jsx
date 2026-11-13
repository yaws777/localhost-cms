// ClinicRecordViews.jsx
// The Doctor Visit and Health Screening records as the student and the parent see them (Clinic Logs & Records, Child Clinic Records):
// a status pill for the table rows and a structured detail view for the modal, so the doctor's assessment and the screening result
// show as sections instead of a raw list of fields.
import React from 'react';
import { Stethoscope, Activity, Pill, FileText, Repeat, AlertTriangle, CheckCircle2, Clock, XCircle, User, ShieldAlert } from 'lucide-react';
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

// Clinic visit: the nurse's documentation form, read only (same sections and labels as Visit Log > Document Visit)
const FormField = ({ id, label, value, wide, area }) => (
    <div className={`field-crv${wide ? ' wide-crv' : ''}`}>
        <label htmlFor={id}>{label}</label>
        {area
            ? <textarea id={id} rows={2} readOnly value={value} />
            : <input id={id} type="text" readOnly value={value} />}
    </div>
);

const FormSection = ({ icon: Icon, title, cols, children }) => (
    <section className="section-crv">
        <h4><Icon size={15} aria-hidden="true" /> {title}</h4>
        <div className={`grid-crv${cols === 4 ? ' four-crv' : ''}`}>{children}</div>
    </section>
);

const orDash = (v) => (v === null || v === undefined || v === '' ? '--' : String(v));

export function ClinicVisitForm({ record: v }) {
    const uid = React.useId();
    const id = (name) => `${uid}-${name}`;
    const fullName = [v.student_first_name || v.first_name, v.student_last_name || v.last_name].filter(Boolean).join(' ') || '--';
    const nurse = v.nurse_first_name && v.nurse_last_name ? `${v.nurse_first_name} ${v.nurse_last_name}` : v.nurse_id;
    const condition = v.complaint_name || v.complaint_id;
    const specify = v.specify_complaint_text || v.specify_complaints_text;
    const dispensed = Boolean(v.batch_id || v.medicine_name);
    const qty = v.dosage_consumption_unit_value ? String(Math.round(parseFloat(v.dosage_consumption_unit_value))) : '';

    return (
        <div className="detail-crv">
            <div className="head-crv">
                <div>
                    <strong>Visit {v.visit_id}</strong>
                    <div className="sub-crv">{v.visit_date ? dayOnly(v.visit_date) : 'N/A'}{nurse ? ` | Nurse ${nurse}` : ''}</div>
                </div>
                <StatusPill tone={v.time_out ? 'ok' : 'info'}>{v.time_out ? 'Timed out' : 'In clinic'}</StatusPill>
            </div>

            <FormSection icon={User} title="Student & Time Info">
                <FormField id={id('name')} label="Full Name" value={fullName} />
                <FormField id={id('sid')} label="Student ID" value={orDash(v.student_id)} />
                <FormField id={id('tin')} label="Time In" value={v.time_in ? formatTime(v.time_in) : '--'} />
                <FormField id={id('tout')} label="Time Out" value={v.time_out ? formatTime(v.time_out) : '--'} />
                <FormField id={id('cond')} label="Medical Condition" value={orDash(condition)} wide />
                {specify ? <FormField id={id('spec')} label="Specify Medical Condition Details" value={specify} wide /> : null}
            </FormSection>

            <FormSection icon={Activity} title="Vital Signs - Time In" cols={4}>
                <FormField id={id('bp')} label="BP (mmHg)" value={orDash(v.blood_pressure)} />
                <FormField id={id('temp')} label="Temp (°C)" value={orDash(v.temperature)} />
                <FormField id={id('pulse')} label="Pulse (bpm)" value={orDash(v.pulse_rate)} />
                <FormField id={id('resp')} label="Resp Rate" value={orDash(v.respiratory_rate)} />
            </FormSection>

            {v.time_out ? (
                <FormSection icon={Activity} title="Vital Signs - Time Out" cols={4}>
                    <FormField id={id('obp')} label="BP (mmHg)" value={orDash(v.out_blood_pressure)} />
                    <FormField id={id('otemp')} label="Temp (°C)" value={orDash(v.out_temperature)} />
                    <FormField id={id('opulse')} label="Pulse (bpm)" value={orDash(v.out_pulse_rate)} />
                    <FormField id={id('oresp')} label="Resp Rate" value={orDash(v.out_respiratory_rate)} />
                    <FormField id={id('onote')} label="Student Condition After Time-out" value={orDash(v.out_nurse_note)} wide area />
                </FormSection>
            ) : null}

            <FormSection icon={ShieldAlert} title="Intervention & Dispensation">
                <FormField id={id('int')} label="Nursing Intervention" value={orDash(v.nursing_intervention)} wide area />
                <FormField id={id('assess')} label="Assessment" value={orDash(v.assessment || v.health_advice)} wide area />
                <FormField id={id('med')} label="Dispensed Medicine" value={dispensed ? orDash(v.medicine_name || v.batch_id) : 'No medication dispensed'} wide />
                {dispensed ? <FormField id={id('qty')} label="Dosage / Quantity" value={orDash(qty)} /> : null}
                {dispensed ? <FormField id={id('unit')} label="Unit of Measure" value={orDash(v.dosage_consumption_unit_of_measure)} /> : null}
            </FormSection>
        </div>
    );
}

// "Left ear: Normal | Right ear: Normal" -> [{label, value}] (older results are stored as one text)
export const detailPairs = (details) => String(details || '').split(' | ').map((part) => {
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
