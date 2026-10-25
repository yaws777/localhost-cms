// useSpecializations.js
// The specializations a doctor can have and the visit type (purpose of the consultation) each one adds.
// One shared copy for the whole app: adding a specialization updates every screen that lists the purposes.
import { useState, useEffect, useCallback } from 'react';

const API = 'http://localhost:3001';
const FALLBACK = { specializations: [], visitTypes: ['General Check Up'], generalVisitType: 'General Check Up' };

let current = null;
let inflight = null;
const listeners = new Set();

const publish = (next) => {
    current = next;
    listeners.forEach((fn) => fn(next));
};

export const loadSpecializations = async (force = false) => {
    if (current && !force) return current;
    if (!inflight || force) {
        inflight = fetch(`${API}/api/specializations`)
            .then((res) => res.json())
            .then((data) => {
                const next = data.success
                    ? { specializations: data.specializations, visitTypes: data.visit_types, generalVisitType: data.general_visit_type }
                    : FALLBACK;
                publish(next);
                return next;
            })
            .catch(() => current || FALLBACK)
            .finally(() => { inflight = null; });
    }
    return inflight;
};

export const useSpecializations = () => {
    const [state, setState] = useState(current || FALLBACK);
    const [loading, setLoading] = useState(!current);

    useEffect(() => {
        listeners.add(setState);
        loadSpecializations().then((next) => { setState(next); setLoading(false); });
        return () => { listeners.delete(setState); };
    }, []);

    const reload = useCallback(() => loadSpecializations(true), []);
    return { ...state, loading, reload };
};
