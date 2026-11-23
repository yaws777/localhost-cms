// useRecordSync.js
// Calls onChange when a document of one of the given kinds changed: 'checkup' (assessment), 'visit' (clinic visit + medicine given),
// 'incident' (incident report) or 'screening' (screening result). Lists, open modals and the data a PDF is built from
// reload from it, so an edit shows everywhere without a manual refresh.
// Same browser: instant, through notifyRecordChanged(kind) (window event + BroadcastChannel for other tabs).
// Other devices: the server revisions (GET /api/records/revision) are polled and checked again when the tab shows.
import { useEffect, useRef } from 'react';

const API = 'http://localhost:3001';
const EVENT = 'clinic-records-changed';
const CHANNEL = 'clinic-records';

let channel = null;
const getChannel = () => {
    if (channel || typeof BroadcastChannel === 'undefined') return channel;
    channel = new BroadcastChannel(CHANNEL);
    return channel;
};

// call after a write succeeded; kind or a list of kinds
export const notifyRecordChanged = (kinds) => {
    const list = Array.isArray(kinds) ? kinds : [kinds];
    window.dispatchEvent(new CustomEvent(EVENT, { detail: list }));
    try { getChannel()?.postMessage(list); } catch (_) { /* no channel */ }
};

// every kind of document, for a screen that lists them all (student / parent clinic records)
export const ALL_RECORD_KINDS = ['screening', 'checkup', 'visit', 'incident'];

// Does this row of a freshly loaded list stand for the same document as the open one? (visit, incident, assessment or screening result)
export const sameRecord = (a, b) => {
    if (!a || !b) return false;
    const key = (r) => [r.visit_id, r.incident_id, r.id, r.dispensation_type, r.appointment_id, r.assessment_id, r.record_id, r.screening_schedule_id, r.student_id].join('|');
    return key(a) === key(b);
};

export const useRecordSync =(kinds, onChange, { intervalMs = 8000, enabled = true } = {}) => {
    const handler = useRef(onChange);
    useEffect(() => { handler.current = onChange; }, [onChange]);
    const kindsKey = (Array.isArray(kinds) ? kinds : [kinds]).join(',');

    useEffect(() => {
        if (!enabled) return undefined;
        const mine = kindsKey.split(',').filter(Boolean);
        let stopped = false;
        let last = null;

        const fire = () => { if (!stopped && handler.current) handler.current(); };
        const touches = (list) => !Array.isArray(list) || list.some((k) => mine.includes(k));
        const stamp = (revisions) => mine.map((k) => revisions?.[k] ?? '').join('|');

        // silent = remember the revision without calling onChange (a local event already did)
        const poll = async (silent = false) => {
            try {
                const res = await fetch(`${API}/api/records/revision`, { cache: 'no-store' });
                const data = await res.json();
                if (stopped || !data.success) return;
                const now = stamp(data.revisions);
                if (!silent && last !== null && now !== last) fire();
                last = now;
            } catch (_) { /* server unreachable: try again on the next tick */ }
        };

        // the write has finished on the server before the event is sent, so reload now and take the new revision quietly
        const onLocal = (e) => { if (touches(e.detail)) { fire(); poll(true); } };
        const onVisible = () => { if (!document.hidden) poll(); };
        const onMessage = (e) => { if (touches(e.data)) { fire(); poll(true); } };

        poll(true);
        const timer = setInterval(() => { if (!document.hidden) poll(); }, intervalMs);
        window.addEventListener(EVENT, onLocal);
        document.addEventListener('visibilitychange', onVisible);
        const ch = getChannel();
        if (ch) ch.addEventListener('message', onMessage);

        return () => {
            stopped = true;
            clearInterval(timer);
            window.removeEventListener(EVENT, onLocal);
            document.removeEventListener('visibilitychange', onVisible);
            if (ch) ch.removeEventListener('message', onMessage);
        };
    }, [kindsKey, intervalMs, enabled]);
};

export default useRecordSync;
