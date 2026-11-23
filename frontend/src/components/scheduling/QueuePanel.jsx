// QueuePanel.jsx
// The queue of one session day. Listed students (#1, #2, ...) are the ones the nurse appointed; walk-ins (W1, W2, ...) are served after them.
//   doctor : Call next (the number is CALLED), Call on every timed-in row ("Waiting for call"; a called number that has not timed in is marked Skipped), Skip (the next number is called; a skipped number can be called again while the session runs),
//            Call (a skipped number again), Document
//   nurse  : Void (final: the number cannot be called again, the student comes back as a walk-in). Time in - only for the called number: opens the vital signs form (all four; not normal values are saved and flagged), then the student can go to the doctor.
//            Time out - after the check-up is documented; its vital signs are optional.
//   both   : the student health records button (doctor). The doctor records the check-up only after the nurse's time in.
//   nurse  : the only one who adds a student as a walk-in (button beside Call next); a skipped or voided student gets a new walk-in number that way.
// Refreshes by itself every few seconds so both sides see the same numbers.
import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, Ban, Clock, Footprints, RefreshCw, Check, CheckCircle, Stethoscope, Eye, TimerReset, PhoneCall, ChevronsRight, FolderHeart, LogOut, Square } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { ReasonModal } from '../doctor/AppointmentModals';
import VitalsModal from './VitalsModal';
import { visitLabel } from '../../utils/visitPurpose';
import { API } from '../../utils/scheduling';
import '../../styles/scheduling/Scheduling.css';

const send = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return { ...data, httpStatus: res.status };
};

// the database keeps `Serving` for both the called number and the one in session; a time in tells them apart.
// A void number is either skipped (can be called again) or voided (final).
const stateOf = (e) => {
    if (e.state === 'Serving') return e.arrived ? 'Serving' : 'Called';
    if (e.state === 'Void' && e.skipped) return 'Skipped';
    return e.state;
};

// Status cell: a pill (icon + label), one line of what comes next for this role, and a four step tracker.
// tone = css modifier of .q-pill-sc. Skipped and Void have no tracker (the number is out of the flow).
const statusOf = (e, isDoctor) => {
    const key = stateOf(e);
    if (key === 'Waiting' && e.arrived) return { tone: 'ok', Icon: CheckCircle, label: 'Ready to call', hint: isDoctor ? 'Vital signs done. Call this number' : 'Vital signs done' };
    if (key === 'Waiting') return { tone: 'mute', Icon: Clock, label: 'Waiting', hint: isDoctor ? 'Waiting for the nurse\'s time in' : 'Needs time in and vital signs' };
    if (key === 'Called') return { tone: 'info', Icon: Megaphone, label: 'Called', hint: isDoctor ? 'Waiting for the nurse\'s time in' : 'Student called. Record time in' };
    if (key === 'Serving') return { tone: 'live', Icon: Stethoscope, label: 'In session', hint: 'With the doctor' };
    if (key === 'Skipped') return { tone: 'warn', Icon: ChevronsRight, label: 'Skipped', hint: isDoctor ? 'Can be called again' : 'The doctor can call again' };
    if (key === 'Void') return { tone: 'bad', Icon: Ban, label: 'Void', hint: e.accommodated_as ? `Walk-in ${e.accommodated_as}` : 'Final. Comes back as a walk-in' };
    if (!e.timed_out) return { tone: 'warn', Icon: LogOut, label: 'Needs time out', hint: isDoctor ? 'Documented. The nurse records the time out' : 'Documented. Record the time out' };
    return { tone: 'ok', Icon: CheckCircle, label: 'Complete', hint: 'Timed out' };
};

const TRACKER = ['Vitals', 'Called', 'Documented', 'Out'];
const trackerOf = (e) => {
    const key = stateOf(e);
    if (key === 'Skipped' || key === 'Void') return null;
    const done = [!!e.arrived, ['Called', 'Serving', 'Done'].includes(key), !!e.documented, !!e.timed_out];
    return { done, current: done.findIndex((d) => !d) };
};

const StatusCell = ({ entry, isDoctor }) => {
    const { tone, Icon, label, hint } = statusOf(entry, isDoctor);
    const tracker = trackerOf(entry);
    return (
        <>
            <span className={`q-pill-sc q-pill-${tone}-sc`}><Icon size={14} aria-hidden="true" /> {label}</span>
            <span className="q-hint-sc">{hint}</span>
            {tracker && (
                <ol className="q-steps-sc" aria-label="Progress">
                    {TRACKER.map((name, i) => (
                        <li key={name} className={tracker.done[i] ? 'done' : i === tracker.current ? 'now' : ''} aria-current={i === tracker.current ? 'step' : undefined}>
                            <span className="q-dot-sc" aria-hidden="true">{tracker.done[i] && <Check size={10} strokeWidth={3.5} />}</span>
                            {name}
                            {tracker.done[i] && <span className="q-sr-sc"> done</span>}
                        </li>
                    ))}
                </ol>
            )}
        </>
    );
};

// scheduleId + date: the session day. creator: { nurseId } | { doctorId }. onDocument(entry): open the check-up of the number in session.
// onWalkIn(): opens the walk-in form (the button sits beside Call next). onExtend(): opens the extend end time form.
// Every button is icon only (name in aria-label and title).
// onView(entry): the assessment of this check-up (a Done number).
// onRecords(entry): the student's health records (doctor and nurse).
// The nurse's Time in / Time out (vital signs forms) belong to the panel itself.
const QueuePanel = ({ scheduleId, date, creator, userId, onChanged, onDocument, onView, onRecords, onWalkIn, onExtend, onEnd, refreshKey = 0, intervalMs = 5000 }) => {
    const { showAlert, showConfirm } = useAlert();
    const [queue, setQueue] = useState(null);
    const [busy, setBusy] = useState(false);
    const [skipFor, setSkipFor] = useState(null);
    const [voidFor, setVoidFor] = useState(null);
    const [vitalsFor, setVitalsFor] = useState(null); // { entry, mode: 'in' | 'out' }
    const isDoctor = !!creator.doctorId;

    const load = useCallback(async () => {
        if (!scheduleId || !date) return;
        try {
            const res = await fetch(`${API}/api/doctor-schedules/${scheduleId}/queue?date=${date}`);
            const data = await res.json();
            if (data.success) setQueue(data.queue);
        } catch (e) { /* the next refresh tries again */ }
    }, [scheduleId, date]);

    useEffect(() => {
        load();
        const timer = setInterval(() => { if (!document.hidden) load(); }, intervalMs);
        return () => clearInterval(timer);
    }, [load, refreshKey, intervalMs]);

    const changed = () => { load(); if (onChanged) onChanged(); };

    // the number that was called and has not timed in yet: calling another number skips it
    const calledWaiting = () => {
        const cur = queue && queue.now_serving ? queue.entries.find((e) => e.appointment_id === queue.now_serving.appointment_id) : null;
        return cur && !cur.arrived && !cur.documented ? cur : null;
    };

    const callNext = async () => {
        const waitingForTimeIn = calledWaiting();
        if (waitingForTimeIn) {
            const ok = await showConfirm(`${waitingForTimeIn.label} ${waitingForTimeIn.student_name} has not timed in. Calling the next number skips ${waitingForTimeIn.label}.`, { title: 'Call the next number?', confirmLabel: 'Call next' });
            if (!ok) return;
        }
        setBusy(true);
        const data = await send(`/api/doctor-schedules/${scheduleId}/queue/call-next`, 'PUT', { date, created_by_doctor_id: creator.doctorId, sender_id: userId });
        setBusy(false);
        if (data.success) { showAlert(data.message, 'success'); if (data.queue) setQueue(data.queue); changed(); }
        else showAlert(data.message || 'Could not call the next number.', 'warning');
    };

    // Call on a timed-in row: that number is called. A called number that has not timed in is marked Skipped by the call.
    const callNumber = async (e) => {
        const waitingForTimeIn = calledWaiting();
        if (waitingForTimeIn) {
            const ok = await showConfirm(`${waitingForTimeIn.label} ${waitingForTimeIn.student_name} has not timed in. Calling ${e.label} marks ${waitingForTimeIn.label} as skipped.`, { title: `Call ${e.label}?`, confirmLabel: 'Call' });
            if (!ok) return;
        }
        setBusy(true);
        const data = await send(`/api/doctor-schedules/${scheduleId}/queue/call-next`, 'PUT', { date, created_by_doctor_id: creator.doctorId, sender_id: userId, appointment_id: e.appointment_id });
        setBusy(false);
        if (data.success) { showAlert(data.message, 'success'); if (data.queue) setQueue(data.queue); changed(); }
        else showAlert(data.message || 'Could not call the number.', 'warning');
    };

    // Skip: the number stays in the list (it can be called again) and the next number is called right away
    const skipNumber = async (reason) => {
        const target = skipFor;
        const data = await send(`/api/doctor-visits/${target.appointment_id}/queue/skip`, 'PUT', { created_by_doctor_id: creator.doctorId, sender_id: userId, reason, mode: 'skip' });
        setSkipFor(null);
        if (!data.success) { showAlert(data.message || 'Could not skip the number.', 'error'); return; }
        const next = await send(`/api/doctor-schedules/${scheduleId}/queue/call-next`, 'PUT', { date, created_by_doctor_id: creator.doctorId, sender_id: userId });
        if (next.success) { showAlert(`${data.message} ${next.message}`, 'success'); if (next.queue) setQueue(next.queue); }
        else showAlert(`${data.message} ${next.message || 'Nobody is waiting for the next number.'}`, 'info');
        changed();
    };

    // Void: final. The next number is not called by itself: press Call next
    const voidNumber = async (reason) => {
        const target = voidFor;
        const data = await send(`/api/doctor-visits/${target.appointment_id}/queue/skip`, 'PUT', { sender_id: userId, reason, mode: 'void' });
        setVoidFor(null);
        if (!data.success) { showAlert(data.message || 'Could not void the number.', 'error'); return; }
        showAlert(data.message, 'success');
        changed();
    };

    // call a skipped number again: it waits for the time in like any called number
    const callAgain = async (e) => {
        const waitingForTimeIn = calledWaiting();
        const ok = await showConfirm(
            `${e.label} ${e.student_name} was skipped. Call this number now?${waitingForTimeIn ? ` ${waitingForTimeIn.label} has not timed in and will be skipped.` : ''}`,
            { title: `Call ${e.label}?`, confirmLabel: 'Call' }
        );
        if (!ok) return;
        setBusy(true);
        const data = await send(`/api/doctor-visits/${e.appointment_id}/queue/restore`, 'PUT', { created_by_doctor_id: creator.doctorId, sender_id: userId });
        setBusy(false);
        if (data.success) { showAlert(data.message, 'success'); if (data.queue) setQueue(data.queue); changed(); } else showAlert(data.message || 'Could not call the number.', 'warning');
    };

    // every action of a row is an icon; the name is in aria-label and title
    const iconBtn = (key, variant, Icon, label, onClick, title, disabled = false) => (
        <button key={key} type="button" className={`sti-btn-dv sti-btn-${variant}-dv btn-icon-sc`} disabled={disabled} onClick={onClick} aria-label={label} title={title || label}>
            <Icon size={18} aria-hidden="true" />
        </button>
    );

    if (!queue) return <p className="dp-hint">Loading the queue...</p>;

    // the doctor can call only a waiting number the nurse timed in (vital signs recorded)
    const waitingEntries = queue.entries.filter((e) => e.state === 'Waiting');
    const readyCount = waitingEntries.filter((e) => e.arrived && e.has_vitals).length;
    const hasWaiting = readyCount > 0;
    // the number in session must be finished (documented, skipped or voided) before the next one is called
    const current = queue.now_serving ? queue.entries.find((e) => e.appointment_id === queue.now_serving.appointment_id) : null;
    // only a number in session (time in done) blocks the calls; a called number that has not timed in is skipped when another number is called
    const inSession = !!current && !!current.arrived && !current.documented;
    const callBlocked = inSession;
    const callBlockedText = inSession ? `${current.label} ${current.student_name} is in session. Document the check-up first.` : '';
    const skippedList = queue.entries.filter((e) => e.state === 'Void' && e.skipped && !e.accommodated_as);
    const voidCount = queue.entries.filter((e) => e.state === 'Void' && !e.skipped).length;
    const called = current && !current.arrived;
    // a student the doctor documented must be timed out before the next time in
    const needsTimeOut = queue.entries.find((e) => e.arrived && e.documented && !e.timed_out && e.state !== 'Void');

    return (
        <div className="queue-panel-sc">
            <div className="queue-head-sc">
                <div className={`queue-serving-sc ${called ? 'called' : ''}`} aria-live="polite">
                    <small><Megaphone size={13} /> {called ? 'Called - waiting for time in' : 'Now in session'}</small>
                    <strong>{queue.now_serving ? queue.now_serving.label : '-'}</strong>
                    {queue.now_serving && <span>{queue.now_serving.student_name}</span>}
                </div>
                <div className="queue-counts-sc">
                    <span><b>{queue.listed_waiting}</b> listed waiting</span>
                    <span><b>{queue.walkin_waiting}</b> walk-in waiting</span>
                    <span><b>{skippedList.length}</b> skipped</span>
                    <span><b>{voidCount}</b> void</span>
                    <span><b>{queue.entries.filter((e) => e.state === 'Done').length}</b> done</span>
                </div>
                <div className="queue-actions-sc">
                    {isDoctor && iconBtn('next', 'primary', Megaphone, 'Call next', callNext, callBlocked ? callBlockedText : !hasWaiting && waitingEntries.length > 0 ? 'No number has vital signs yet. The nurse records them at time in first' : 'Call next: the lowest listed number with vital signs; walk-ins are called when no listed student is ready', busy || !hasWaiting || callBlocked)}
                    {!isDoctor && onWalkIn && queue.allow_walk_in !== false && iconBtn('walkin', 'secondary', Footprints, 'Add walk-in', onWalkIn, 'Add walk-in: give a student a walk-in number (W1, W2, ...). A skipped or voided student comes back this way')}
                    {onExtend && iconBtn('extend', 'light', TimerReset, 'Extend end time', onExtend, 'Extend the end time of this session')}
                    {iconBtn('refresh', 'light', RefreshCw, 'Refresh', load)}
                    {onEnd && iconBtn('end', 'danger', Square, 'End time', onEnd, 'End time: end this session now')}
                </div>
            </div>

            {isDoctor && callBlocked && <p className="dp-hint" role="status">{callBlockedText}</p>}

            {skippedList.length > 0 && (
                <div className="queue-missed-sc" role="group" aria-label="Skipped numbers">
                    <strong>Skipped</strong>
                    {skippedList.map((e) => (
                        <span key={e.appointment_id} className="queue-missed-item-sc">
                            <span>{e.label} {e.student_name}</span>
                            {isDoctor && iconBtn(`call-${e.appointment_id}`, 'primary', PhoneCall, `Call ${e.label}`, () => callAgain(e),
                                inSession ? callBlockedText : called ? `Call ${e.label} again: ${current.label} has not timed in and is skipped` : `Call ${e.label} again`, busy || inSession)}
                        </span>
                    ))}
                </div>
            )}

            {queue.entries.length === 0 ? (
                <p className="dp-hint">Nobody is in this session's queue yet.</p>
            ) : (
                <div className="table-card-dv">
                    <table className="sti-table-dv">
                        <thead><tr><th style={{ width: 70 }}>No.</th><th>Student</th><th>Purpose</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            {queue.entries.map((e) => {
                                const key = stateOf(e);
                                return (
                                    <tr key={e.appointment_id} className={`q-row-sc q-row-${key === 'Waiting' && e.arrived ? 'Ready' : key}-sc ${key === 'Void' ? 'void-row-sc' : ''}`}>
                                        <td><strong className="queue-no-sc">{e.label}</strong></td>
                                        <td>
                                            {e.student_name}
                                            <div className="muted-ds">{e.student_id}</div>
                                        </td>
                                        <td>{visitLabel(e.visit_type)}{e.is_walk_in ? <div className="muted-ds">Walk-in</div> : null}</td>
                                        <td><StatusCell entry={e} isDoctor={isDoctor} /></td>
                                        <td>
                                            <div className="row-actions-sc">
                                                {!isDoctor && ['Waiting', 'Called'].includes(key) && !e.arrived && iconBtn('in', 'primary', Clock, 'Time in', () => setVitalsFor({ entry: e, mode: 'in' }), needsTimeOut ? `${needsTimeOut.label} ${needsTimeOut.student_name} still needs a time out first` : 'Time in: record the vital signs', !!needsTimeOut)}
                                                {!isDoctor && e.state === 'Done' && !!e.documented && !!e.has_vitals && !e.timed_out && iconBtn('out', 'light', LogOut, 'Time out', () => setVitalsFor({ entry: e, mode: 'out' }), 'Time out: the vital signs after the check-up are optional')}
                                                {isDoctor && key === 'Waiting' && !!e.arrived && !!e.has_vitals && iconBtn('callnow', 'primary', PhoneCall, `Call ${e.label}`, () => callNumber(e),
                                                    inSession ? callBlockedText : called ? `Call ${e.label}: ${current.label} has not timed in and is marked skipped` : `Call ${e.label}`, busy || inSession)}
                                                {isDoctor && ['Called', 'Serving'].includes(key) && !e.documented && iconBtn('skip', 'light', ChevronsRight, 'Skip', () => setSkipFor(e), 'The student is not here: skip the number and call the next one. A skipped number can be called again')}
                                                {!isDoctor && ['Waiting', 'Called'].includes(key) && !e.documented && iconBtn('void', 'light', Ban, 'Void', () => setVoidFor(e), 'Void the number: it is final and cannot be called again. The student comes back as a walk-in')}
                                                {isDoctor && key === 'Serving' && onDocument && iconBtn('doc', 'primary', Stethoscope, e.documented ? 'Edit check-up' : 'Document', () => onDocument(e))}
                                                {isDoctor && key === 'Skipped' && !e.accommodated_as && iconBtn('call', 'primary', PhoneCall, 'Call', () => callAgain(e),
                                                    inSession ? callBlockedText : called ? `Call this number again: ${current.label} has not timed in and is skipped` : 'Call this number again', busy || inSession)}
                                                {e.state === 'Done' && !!e.documented && onView && (
                                                    iconBtn('view', 'primary', Eye, 'View assessment', () => onView(e), 'View the assessment of this check-up')
                                                )}
                                                {onRecords && iconBtn('records', 'light', FolderHeart, 'Student health records', () => onRecords(e), 'Health records of this student')}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <ReasonModal
                isOpen={!!skipFor} title="Skip this number and call the next" confirmLabel="Skip number" required={false} label="Reason (optional)"
                message={skipFor ? `${skipFor.label} ${skipFor.student_name} is not here. The number is marked Skipped and stays in the list and the next number is called.` : ''}
                placeholder="e.g. Called three times, not at the clinic" onSubmit={skipNumber} onClose={() => setSkipFor(null)}
            />
            <ReasonModal
                isOpen={!!voidFor} title="Void this number" confirmLabel="Void number" danger required={false} label="Reason (optional)"
                message={voidFor ? `${voidFor.label} ${voidFor.student_name} will be removed from this schedule and cannot be called again. The student needs a new walk-in number.` : ''}
                placeholder="e.g. Student went home" onSubmit={voidNumber} onClose={() => setVoidFor(null)}
            />
            {vitalsFor && (
                <VitalsModal
                    appt={{ appointment_id: vitalsFor.entry.appointment_id, student_id: vitalsFor.entry.student_id, name: vitalsFor.entry.student_name, label: vitalsFor.entry.label }}
                    mode={vitalsFor.mode} userId={userId} onClose={() => setVitalsFor(null)} onDone={changed}
                />
            )}
        </div>
    );
};

export default QueuePanel;
