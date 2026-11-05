// QueuePanel.jsx
// The queue of one session day. Listed students (#1, #2, ...) are the ones the nurse appointed; walk-ins (W1, W2, ...) are served after them.
//   doctor : Call next, Void (the number becomes void and stays in the list; the number in session moves on to the next one), Back to number (a void number is in session again), Walk-in
//   both   : Time in (manual) or Scan QR marks a student as arrived; the doctor records the check-up only after that. Accommodate a void number as a walk-in once the student shows up
// Refreshes by itself every few seconds so both sides see the same numbers.
import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, Ban, Undo2, Clock, QrCode, Footprints, RefreshCw, Check, Stethoscope, Eye, History, TimerReset } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { ReasonModal } from '../doctor/AppointmentModals';
import { visitLabel } from '../../utils/visitPurpose';
import { API } from '../../utils/scheduling';
import { creatorBody } from './SessionModals';
import AttendanceScanModal from './AttendanceScanModal';
import '../../styles/scheduling/Scheduling.css';

const send = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return { ...data, httpStatus: res.status };
};

const STATE_CLASS = { Waiting: 'q-waiting-sc', Serving: 'q-serving-sc', Done: 'q-done-sc', Void: 'q-void-sc' };
// the state kept in the database is `Serving`; people read it as "In session"
const STATE_LABEL = { Serving: 'In session' };

// scheduleId + date: the session day. creator: { nurseId } | { doctorId }. onDocument(entry): open the check-up of the number in session.
// onWalkIn(): opens the walk-in form (the button sits beside Call next). onExtend(): opens the extend end time form.
// Every button of the header is icon only (name in aria-label and title).
// onView(entry): the assessment of this check-up (a Done number). onHistory(entry): every assessment of the student.
const QueuePanel = ({ scheduleId, date, creator, userId, onChanged, onDocument, onView, onHistory, onWalkIn, onExtend, refreshKey = 0, intervalMs = 5000 }) => {
    const { showAlert } = useAlert();
    const [queue, setQueue] = useState(null);
    const [busy, setBusy] = useState(false);
    const [voidFor, setVoidFor] = useState(null);
    const [scanning, setScanning] = useState(false);
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

    const callNext = async () => {
        setBusy(true);
        const data = await send(`/api/doctor-schedules/${scheduleId}/queue/call-next`, 'PUT', { date, created_by_doctor_id: creator.doctorId, sender_id: userId });
        setBusy(false);
        if (data.success) { showAlert(data.message, 'success'); if (data.queue) setQueue(data.queue); changed(); }
        else showAlert(data.message || 'Could not call the next number.', 'warning');
    };

    // Voiding the number in session moves on: the next number is called right away
    const voidNumber = async (reason) => {
        const wasServing = voidFor.state === 'Serving';
        const data = await send(`/api/doctor-visits/${voidFor.appointment_id}/queue/skip`, 'PUT', { created_by_doctor_id: creator.doctorId, sender_id: userId, reason });
        setVoidFor(null);
        if (!data.success) { showAlert(data.message || 'Could not void the number.', 'error'); return; }
        if (!wasServing) { showAlert(data.message, 'success'); changed(); return; }
        const next = await send(`/api/doctor-schedules/${scheduleId}/queue/call-next`, 'PUT', { date, created_by_doctor_id: creator.doctorId, sender_id: userId });
        if (next.success) { showAlert(`${data.message} ${next.message}`, 'success'); if (next.queue) setQueue(next.queue); }
        else showAlert(`${data.message} ${next.message || 'Nobody is waiting for the next number.'}`, 'info');
        changed();
    };

    // manual time in or QR scan: the student is at the clinic, the check-up can be recorded
    // back to a previous (void) number: it is in session again, the number in session until now waits again
    const goBack = async (e) => {
        setBusy(true);
        const data = await send(`/api/doctor-visits/${e.appointment_id}/queue/restore`, 'PUT', { created_by_doctor_id: creator.doctorId, sender_id: userId });
        setBusy(false);
        if (data.success) { showAlert(data.message, 'success'); if (data.queue) setQueue(data.queue); changed(); } else showAlert(data.message || 'Could not go back to the number.', 'warning');
    };

    // openCheckup: the doctor's Time in button goes straight to the check-up form (the server stamps the time of the click)
    const markArrived = async (e, quiet = false, openCheckup = false) => {
        const data = await send(`/api/doctor-visits/status/${e.appointment_id}`, 'PUT', { student_id: e.student_id, status: 'Present', ...(isDoctor ? { created_by_doctor_id: creator.doctorId } : {}) });
        if (data.success) {
            if (!quiet) showAlert(`${e.student_name} has a time in now.`, 'success');
            changed();
            if (openCheckup && isDoctor && onDocument) onDocument(e);
            return true;
        }
        if (!quiet) showAlert(data.message || 'Could not record the time in.', 'error');
        return false;
    };

    const accommodate = async (e) => {
        setBusy(true);
        const data = await send(`/api/doctor-visits/${e.appointment_id}/queue/accommodate`, 'PUT', { ...creatorBody(creator), sender_id: userId });
        setBusy(false);
        if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not accommodate the student.', 'warning');
    };

    // every action of a row is an icon; the name is in aria-label and title
    const iconBtn = (key, variant, Icon, label, onClick, title, disabled = false) => (
        <button key={key} type="button" className={`sti-btn-dv sti-btn-${variant}-dv btn-icon-sc`} disabled={disabled} onClick={onClick} aria-label={label} title={title || label}>
            <Icon size={18} aria-hidden="true" />
        </button>
    );

    if (!queue) return <p className="dp-hint">Loading the queue...</p>;

    const hasWaiting = queue.listed_waiting + queue.walkin_waiting > 0;
    // the number in session must have its check-up documented (or be voided) before the next one is called
    const current = queue.now_serving ? queue.entries.find((e) => e.appointment_id === queue.now_serving.appointment_id) : null;
    const callBlocked = !!current && !current.documented;
    const callBlockedText = callBlocked ? `${current.label} ${current.student_name} is still in session. Document the check-up or void the number first.` : '';
    // the doctor records a time in only for the number in session
    const turnOf = (e) => !isDoctor || e.state === 'Serving';

    return (
        <div className="queue-panel-sc">
            <div className="queue-head-sc">
                <div className="queue-serving-sc" aria-live="polite">
                    <small><Megaphone size={13} /> Now in session</small>
                    <strong>{queue.now_serving ? queue.now_serving.label : '-'}</strong>
                    {queue.now_serving && <span>{queue.now_serving.student_name}</span>}
                </div>
                <div className="queue-counts-sc">
                    <span><b>{queue.listed_waiting}</b> listed waiting</span>
                    <span><b>{queue.walkin_waiting}</b> walk-in waiting</span>
                    <span><b>{queue.entries.filter((e) => e.state === 'Void').length}</b> void</span>
                    <span><b>{queue.entries.filter((e) => e.state === 'Done').length}</b> done</span>
                </div>
                <div className="queue-actions-sc">
                    {isDoctor && iconBtn('next', 'primary', Megaphone, 'Call next', callNext, callBlocked ? callBlockedText : 'Call next: the lowest listed number; walk-ins are called when no listed student is waiting', busy || !hasWaiting || callBlocked)}
                    {onWalkIn && queue.allow_walk_in !== false && iconBtn('walkin', 'secondary', Footprints, 'Walk-in', onWalkIn, 'Walk-in: add a student to the walk-in queue (W1, W2, ...)')}
                    {isDoctor && iconBtn('scan', 'light', QrCode, 'Scan QR', () => setScanning(true), 'Scan QR: record the time in of a student', !hasWaiting && !queue.now_serving)}
                    {onExtend && iconBtn('extend', 'light', TimerReset, 'Extend end time', onExtend, 'Extend the end time of this session')}
                    {iconBtn('refresh', 'light', RefreshCw, 'Refresh', load)}
                </div>
            </div>

            {isDoctor && callBlocked && <p className="dp-hint" role="status">{callBlockedText}</p>}

            {queue.entries.length === 0 ? (
                <p className="dp-hint">Nobody is in this session's queue yet.</p>
            ) : (
                <div className="table-card-dv">
                    <table className="sti-table-dv">
                        <thead><tr><th style={{ width: 70 }}>No.</th><th>Student</th><th>Purpose</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            {queue.entries.map((e) => (
                                <tr key={e.appointment_id} className={e.state === 'Void' ? 'void-row-sc' : e.state === 'Serving' ? 'serving-row-sc' : ''}>
                                    <td><strong className="queue-no-sc">{e.label}</strong></td>
                                    <td>
                                        {e.student_name}
                                        <div className="muted-ds">{e.student_id}</div>
                                    </td>
                                    <td>{visitLabel(e.visit_type)}{e.is_walk_in ? <div className="muted-ds">Walk-in</div> : null}</td>
                                    <td>
                                        <span className={`q-state-sc ${STATE_CLASS[e.state] || ''}`}>{STATE_LABEL[e.state] || e.state}</span>
                                        {e.arrived && ['Waiting', 'Serving'].includes(e.state) ? <span className="q-arrived-sc"><Check size={12} /> timed in</span> : null}
                                        {e.accommodated_as && <div className="muted-ds">Accommodated as {e.accommodated_as}</div>}
                                    </td>
                                    <td>
                                        <div className="row-actions-sc">
                                            {['Waiting', 'Serving'].includes(e.state) && !e.arrived && (
                                                iconBtn('in', 'light', Clock, 'Time in', () => markArrived(e, false, true),
                                                    turnOf(e) ? 'Time in: record it now. The student is at the clinic and the check-up form opens' : `Time in is only for the number in session${queue.now_serving ? ` (${queue.now_serving.label})` : ''}. Call ${e.label} first.`,
                                                    !turnOf(e))
                                            )}
                                            {isDoctor && ['Waiting', 'Serving'].includes(e.state) && !e.arrived && !e.documented && (
                                                iconBtn('void', 'light', Ban, e.state === 'Serving' ? 'Void and call next' : 'Void', () => setVoidFor(e), e.state === 'Serving' ? 'The student is not here: the number becomes void and the next number is called' : 'The student is not here: the number becomes void')
                                            )}
                                            {isDoctor && ['Waiting', 'Serving'].includes(e.state) && onDocument && !!(e.arrived || e.documented) && (
                                                iconBtn('doc', 'primary', Stethoscope, e.documented ? 'Edit check-up' : 'Document', () => onDocument(e))
                                            )}
                                            {e.state === 'Done' && !!e.documented && onView && (
                                                iconBtn('view', 'primary', Eye, 'View assessment', () => onView(e), 'View the assessment of this check-up')
                                            )}
                                            {isDoctor && e.state === 'Void' && !e.accommodated_as && (
                                                iconBtn('back', 'light', Undo2, 'Back to number', () => goBack(e), 'Go back to this number: it is in session again and the number in session now waits again', busy)
                                            )}
                                            {e.state === 'Void' && !e.accommodated_as && (
                                                iconBtn('acc', 'secondary', Footprints, 'Accommodate', () => accommodate(e), 'The student arrived: they join the walk-in queue, after the listed students', busy)
                                            )}
                                            {onHistory && iconBtn('hist', 'light', History, 'Past assessments', () => onHistory(e), 'Past assessments of this student')}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ReasonModal
                isOpen={!!voidFor} title={voidFor && voidFor.state === 'Serving' ? 'Void this number and call the next' : 'Void this number'} confirmLabel={voidFor && voidFor.state === 'Serving' ? 'Void and call next' : 'Void number'} danger required={false} label="Reason (optional)"
                message={voidFor ? `${voidFor.label} ${voidFor.student_name} will be marked void. They stay in the list and can be accommodated as a walk-in if they arrive.` : ''}
                placeholder="e.g. Called three times, not at the clinic" onSubmit={voidNumber} onClose={() => setVoidFor(null)}
            />
            <AttendanceScanModal isOpen={scanning} entries={queue.entries} servingOnly={isDoctor}onArrived={(entry) => markArrived(entry, true, true)} onClose={() => setScanning(false)} />
        </div>
    );
};

export default QueuePanel;
