// useQueueStatus.js
// A student's place in the waiting list(s) and in the session queue(s), refreshed every few seconds so "now serving" stays current.
import { useState, useEffect, useCallback, useRef } from 'react';

const API = 'http://localhost:3001';

export const useQueueStatus = (studentId, { intervalMs = 10000 } = {}) => {
    const [state, setState] = useState({ requests: [], appointments: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const mounted = useRef(true);

    const refresh = useCallback(async () => {
        if (!studentId) return;
        try {
            const res = await fetch(`${API}/api/student/${studentId}/queue-status`);
            const data = await res.json();
            if (!mounted.current) return;
            if (data.success) { setState({ requests: data.requests, appointments: data.appointments }); setError(''); }
            else setError(data.message || 'Could not load your queue.');
        } catch (e) {
            if (mounted.current) setError('Could not reach the server.');
        } finally {
            if (mounted.current) setLoading(false);
        }
    }, [studentId]);

    useEffect(() => {
        mounted.current = true;
        refresh();
        // no point asking while the tab is hidden
        const timer = setInterval(() => { if (!document.hidden) refresh(); }, intervalMs);
        return () => { mounted.current = false; clearInterval(timer); };
    }, [refresh, intervalMs]);

    return { ...state, loading, error, refresh };
};

export default useQueueStatus;
