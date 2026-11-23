// SessionEndPrompt.jsx
// Asked when the end time of a check-up session or a health screening has passed: confirm the end (it moves to Past Check-up / Past Screening)
// or extend the end time. An extension runs until the same date only; after it passes the question comes again.
// When the date passes the session ends by itself (the server does that), so there is nothing to confirm any more.
import React, { useEffect, useState } from 'react';
import { TimerReset, CheckCircle2, BellRing, Clock } from 'lucide-react';
import Modal from '../common/Modal';
import { to12h } from '../../utils/scheduling';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const EXTRA_MINUTES = [15, 30, 45, 60, 90, 120];
const LAST_MINUTE_OF_DAY = 23 * 60 + 59;

const minutesOf = (hms) => {
    const [h, m] = String(hms || '').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

// minutes that still fit in today after the extension starts (from the end time, or from now when that already passed)
export const extensionRoom = (endTime, now = new Date()) => LAST_MINUTE_OF_DAY - Math.max(minutesOf(endTime), now.getHours() * 60 + now.getMinutes());

/**
 * item:      { key, title, endTime ('HH:MM:SS'), kind: 'check-up' | 'screening' }  (null = closed)
 * onConfirm: async () => '' or an error text
 * onExtend:  async (minutes) => '' or an error text
 * onLater:   close without answering (the question stays on the session card)
 */
const SessionEndPrompt = ({ item, onConfirm, onExtend, onLater }) => {
    const [extra, setExtra] = useState(30);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { setExtra(30); setBusy(false); setError(''); }, [item?.key]);

    if (!item) return null;
    const room = extensionRoom(item.endTime);
    // no onExtend = this user cannot extend (the nurse for a check-up): only Confirm / Ask me later
    const options = onExtend ? EXTRA_MINUTES.filter((m) => m <= room) : [];
    const chosen = options.includes(extra) ? extra : options[options.length - 1];
    const past = item.kind === 'screening' ? 'Past Screening' : 'Past Check-up';

    const run = async (action) => {
        setBusy(true);
        setError('');
        try {
            const message = await action();
            if (message) setError(message);
        } catch (e) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen onClose={busy ? () => {} : onLater} title="The end time has passed" icon={<BellRing size={20} />} size="sm">
            <div className="dp-form sep">
                <div className="dp-notice">
                    <strong>{item.title}</strong> ended at {to12h(item.endTime)}.
                </div>
                {error && <div className="dp-error" role="alert">{error}</div>}
                {options.length > 0 ? (
                    <div className="dp-field">
                        <label htmlFor="session-extend-by">Extend by</label>
                        <select id="session-extend-by" className="dp-select" value={chosen} onChange={(e) => setExtra(Number(e.target.value))} disabled={busy}>
                            {options.map((m) => <option key={m} value={m}>{m} minutes</option>)}
                        </select>
                    </div>
                ) : onExtend ? (
                    <div className="dp-hint">No time left today to extend.</div>
                ) : null}
                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onLater} disabled={busy} title="Ask me later">
                        <Clock size={18} aria-hidden="true" />
                        <span>Ask me later</span>
                    </button>
                    {options.length > 0 && (
                        <button type="button" className="dp-btn dp-btn-ghost" disabled={busy} onClick={() => run(() => onExtend(chosen))} title={`Extend end time by ${chosen} minutes`}>
                            <TimerReset size={18} aria-hidden="true" />
                            <span>Extend</span>
                        </button>
                    )}
                    <button type="button" className="dp-btn dp-btn-primary" disabled={busy} onClick={() => run(onConfirm)} title={`Confirm end time, move to ${past}`}>
                        <CheckCircle2 size={18} aria-hidden="true" />
                        <span>Confirm end</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default SessionEndPrompt;
