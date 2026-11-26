// useScreeningSync.js
// Calls onChange when any screening record changed (nurse saved / deleted a result, attendance, schedule, type or template).
// Same browser: instant, through notifyScreeningChanged() (window event + BroadcastChannel for other tabs).
// Other devices: the server revision (GET /api/screening-records/revision) is polled and checked again when the tab shows.
import { useEffect, useRef } from 'react';
import { notifyRecordChanged } from './useRecordSync';

const API = 'https://localhost-cms.onrender.com';
const EVENT = 'screening-records-changed';
const CHANNEL = 'screening-records';

let channel = null;
const getChannel = () => {
    if (channel || typeof BroadcastChannel === 'undefined') return channel;
    channel = new BroadcastChannel(CHANNEL);
    return channel;
};

// call after a screening write succeeded; also tells every useRecordSync screen (student / parent clinic records, doctor patients,
// health info, reports) so lists, open modals and the PDF data reload at once
export const notifyScreeningChanged = () => {
    window.dispatchEvent(new Event(EVENT));
    try { getChannel()?.postMessage('changed'); } catch (_) { /* no channel */ }
    notifyRecordChanged('screening');
};

export const useScreeningSync = (onChange, { intervalMs = 8000, enabled = true } = {}) => {
    const handler = useRef(onChange);
    useEffect(() => { handler.current = onChange; }, [onChange]);

    useEffect(() => {
        if (!enabled) return undefined;
        let stopped = false;
        let last = null;

        const fire = () => { if (!stopped && handler.current) handler.current(); };

        // silent = remember the revision without calling onChange (a local event already did)
        const poll = async (silent = false) => {
            try {
                const res = await fetch(`${API}/api/screening-records/revision`, { cache: 'no-store' });
                const data = await res.json();
                if (stopped || !data.success) return;
                if (!silent && last !== null && data.revision !== last) fire();
                last = data.revision;
            } catch (_) { /* server unreachable: try again on the next tick */ }
        };

        // the write has finished on the server before the event is sent, so reload now and take the new revision quietly
        const onLocal = () => { fire(); poll(true); };
        const onVisible = () => { if (!document.hidden) poll(); };

        poll(true);
        const timer = setInterval(() => { if (!document.hidden) poll(); }, intervalMs);
        window.addEventListener(EVENT, onLocal);
        document.addEventListener('visibilitychange', onVisible);
        const ch = getChannel();
        const onMessage = () => { fire(); poll(true); };
        if (ch) ch.addEventListener('message', onMessage);

        return () => {
            stopped = true;
            clearInterval(timer);
            window.removeEventListener(EVENT, onLocal);
            document.removeEventListener('visibilitychange', onVisible);
            if (ch) ch.removeEventListener('message', onMessage);
        };
    }, [intervalMs, enabled]);
};

export default useScreeningSync;
