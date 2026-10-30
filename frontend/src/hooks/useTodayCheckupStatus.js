// useTodayCheckupStatus.js
// State of today's check-ups for the sidebar dot (doctor: "Check-ups", nurse: "Doctor Visit"):
// ongoing = one is on going now (green), upcoming = one is still to come (yellow), past = they are all over (gray), none = no dot.
// doctorId is a doctor id, or 'all' for every doctor (nurse). refreshKey: change it (e.g. the page path) to look again at once.
import { useState, useEffect, useCallback } from 'react';
import { localDateStr } from '../utils/visitPurpose';

const API = 'http://localhost:3001';

export const TODAY_LABELS = {
    upcoming: 'A check-up is still to come today',
    ongoing: 'A check-up is on going now',
    past: 'Today\'s check-ups are all over'
};

export const useTodayCheckupStatus = (doctorId, { enabled = true, refreshKey } = {}) => {
    const [status, setStatus] = useState('none');

    const load = useCallback(async () => {
        if (!doctorId) return;
        try {
            const day = localDateStr();
            const [ongoing, upcoming, past] = await Promise.all(['ongoing', 'upcoming', 'past'].map((scope) => (
                fetch(`${API}/api/doctor/${encodeURIComponent(doctorId)}/appointments?scope=${scope}&from=${day}&to=${day}&pageSize=1`).then((r) => r.json())
            )));
            if (ongoing.total > 0) setStatus('ongoing');
            else if (upcoming.total > 0) setStatus('upcoming');
            else if (past.total > 0) setStatus('past');
            else setStatus('none');
        } catch (e) { /* the next poll tries again */ }
    }, [doctorId]);

    useEffect(() => {
        if (!enabled) return undefined;
        load();
        const timer = setInterval(load, 15000);
        return () => clearInterval(timer);
    }, [enabled, load, refreshKey]);

    return status;
};
