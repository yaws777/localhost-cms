// useTodaySessions.js
// The check-up sessions of today (GET /api/schedule-calendar) for the side rail of Doctor Visit and My Check-ups.
// doctorId: only that doctor's sessions (the doctor portal); omit it for every doctor (the nurse page).
import { useState, useEffect, useCallback } from 'react';

const API = 'https://localhost-cms.onrender.com';
const REFRESH_MS = 30000;

export const useTodaySessions = (doctorId) => {
    const [sessions, setSessions] = useState([]);

    const reload = useCallback(async () => {
        try {
            const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' });
            const qs = new URLSearchParams({ from: today, to: today });
            if (doctorId) qs.set('doctor_id', doctorId);
            const data = await fetch(`${API}/api/schedule-calendar?${qs.toString()}`).then((r) => r.json());
            if (data.success) setSessions(data.sessions || []);
        } catch (err) {
            console.error('Error loading the sessions of today:', err);
        }
    }, [doctorId]);

    useEffect(() => {
        reload();
        const timer = setInterval(() => { if (!document.hidden) reload(); }, REFRESH_MS);
        return () => clearInterval(timer);
    }, [reload]);

    return { sessions, reload };
};
