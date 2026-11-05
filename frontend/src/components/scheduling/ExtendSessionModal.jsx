// ExtendSessionModal.jsx
// Extend the end time of a check-up session that is running now (the icon button in the queue header). Same rule as the end-time
// prompt: the extension runs until the end of today only.
import React, { useEffect, useState } from 'react';
import { TimerReset } from 'lucide-react';
import Modal from '../common/Modal';
import { to12h } from '../../utils/scheduling';
import { extensionRoom } from './SessionEndPrompt';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const EXTRA_MINUTES = [15, 30, 45, 60, 90, 120];

/**
 * session:  { schedule_id, date, end_time, doctor_name } (null = closed)
 * onExtend: async (minutes) => '' or an error text
 */
const ExtendSessionModal = ({ session, onExtend, onClose }) => {
    const [extra, setExtra] = useState(30);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { setExtra(30); setBusy(false); setError(''); }, [session?.schedule_id, session?.date]);

    if (!session) return null;
    const options = EXTRA_MINUTES.filter((m) => m <= extensionRoom(session.end_time));
    const chosen = options.includes(extra) ? extra : options[options.length - 1];

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const message = await onExtend(chosen);
            if (message) setError(message); else onClose();
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen onClose={onClose} title="Extend end time" icon={<TimerReset size={20} />} size="sm">
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-notice">
                    <strong>{session.doctor_name}</strong> ends at {to12h(session.end_time)}.
                </div>
                {error && <div className="dp-error" role="alert">{error}</div>}
                {options.length > 0 ? (
                    <div className="dp-field">
                        <label htmlFor="extend-session-by">Extend by</label>
                        <select id="extend-session-by" className="dp-select" value={chosen} onChange={(e) => setExtra(Number(e.target.value))} disabled={busy}>
                            {options.map((m) => <option key={m} value={m}>{m} minutes</option>)}
                        </select>
                    </div>
                ) : (
                    <div className="dp-hint">No time left today to extend.</div>
                )}
                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
                    {options.length > 0 && (
                        <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>
                            <TimerReset size={16} aria-hidden="true" /> {busy ? 'Saving...' : 'Extend'}
                        </button>
                    )}
                </div>
            </form>
        </Modal>
    );
};

export default ExtendSessionModal;
