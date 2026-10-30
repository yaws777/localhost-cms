// QueuePanel.jsx
// The queue of one session day. Listed students (#1, #2, ...) are the ones the nurse appointed; walk-ins (W1, W2, ...) are served after them.
//   doctor : Call next, Void (the number becomes void and stays in the list; the number in session moves on to the next one), Back to number (a void number is in session again), Walk-in
//   both   : Time in (manual) or Scan QR marks a student as arrived; the doctor records the check-up only after that. Accommodate a void number as a walk-in once the student shows up
// Refreshes by itself every few seconds so both sides see the same numbers.
import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, Ban, Undo2, Clock, QrCode, Footprints, RefreshCw, Check, Stethoscope } from 'lucide-react';
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
// onWalkIn(): opens the walk-in form (the button sits beside Call next).
const QueuePanel = ({ scheduleId, date, creator, userId, onChanged, onDocument, onWalkIn, refreshKey = 0, intervalMs = 5000 }) => {
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

    const markArrived = async (e, quiet = false) => {
        const data = await send(`/api/doctor-visits/status/${e.appointment_id}`, 'PUT', { student_id: e.student_id, status: 'Present' });
        if (data.success) { if (!quiet) showAlert(`${e.student_name} has a time in now.`, 'success'); changed(); return true; }
        if (!quiet) showAlert(data.message || 'Could not record the time in.', 'error');
        return false;
    };

    const accommodate = async (e) => {
        setBusy(true);
        const data = await send(`/api/doctor-visits/${e.appointment_id}/queue/accommodate`, 'PUT', { ...creatorBody(creator), sender_id: userId });
        setBusy(false);
        if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not accommodate the student.', 'warning');
    };

    if (!queue) return <p className="dp-hint">Loading the queue...</p>;

    const hasWaiting = queue.listed_waiting + queue.walkin_waiting > 0;

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
                    {isDoctor && (
                        <button type="button" className="sti-btn-dv sti-btn-primary-dv" disabled={busy || !hasWaiting} onClick={callNext} title="Calls the lowest listed number; walk-ins are called when no listed student is waiting">
                            <Megaphone size={15} /> Call next
                        </button>
                    )}
                    {onWalkIn && (
                        <button type="button" className="sti-btn-dv sti-btn-secondary-dv" onClick={onWalkIn} title="Add a walk-in to the walk-in queue (W1, W2, ...)">
                            <Footprints size={15} /> Walk-in
                        </button>
                    )}
                    <button type="button" className="sti-btn-dv sti-btn-light-dv" disabled={!hasWaiting && !queue.now_serving} onClick={() => setScanning(true)} title="Scan the QR code of a student to record the time in">
                        <QrCode size={15} /> Scan QR
                    </button>
                    <button type="button" className="icon-btn-ds" title="Refresh" aria-label="Refresh" onClick={load}><RefreshCw size={15} /></button>
                </div>
            </div>

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
                                                <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={() => markArrived(e)} title="Record the time in by hand: the student is at the clinic"><Clock size={13} /> Time in</button>
                                            )}
                                            {isDoctor && ['Waiting', 'Serving'].includes(e.state) && (
                                                <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={() => setVoidFor(e)} title={e.state === 'Serving' ? 'The student is not here: the number becomes void and the next number is called' : 'The student is not here: the number becomes void'}><Ban size={13} /> {e.state === 'Serving' ? 'Void and call next' : 'Void'}</button>
                                            )}
                                            {isDoctor && e.state === 'Serving' && onDocument && (e.arrived || e.documented) && (
                                                <button type="button" className="sti-btn-dv sti-btn-primary-dv btn-sm-sc" onClick={() => onDocument(e)}><Stethoscope size={13} /> {e.documented ? 'View' : 'Document'}</button>
                                            )}
                                            {isDoctor && e.state === 'Serving' && onDocument && !e.arrived && !e.documented && (
                                                <span className="muted-ds">Time in or scan the QR code to record the check-up</span>
                                            )}
                                            {isDoctor && e.state === 'Void' && !e.accommodated_as && (
                                                <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" disabled={busy} onClick={() => goBack(e)} title="Go back to this number: it is in session again and the number in session now waits again"><Undo2 size={13} /> Back to number</button>
                                            )}
                                            {e.state === 'Void' && !e.accommodated_as && (
                                                <button type="button" className="sti-btn-dv sti-btn-secondary-dv btn-sm-sc" disabled={busy} onClick={() => accommodate(e)} title="The student arrived: they join the walk-in queue, after the listed students"><Footprints size={13} /> Accommodate</button>
                                            )}
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
            <AttendanceScanModal isOpen={scanning} entries={queue.entries} onArrived={(entry) => markArrived(entry, true)} onClose={() => setScanning(false)} />
        </div>
    );
};

export default QueuePanel;
