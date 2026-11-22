// useUnseenDots.js
// Red dots for tabs that have no notification of their own: a tab shows a dot when its list holds ids the nurse
// has not seen there yet. Opening the tab stores what it holds (localStorage, per page + user). The first visit
// only sets the baseline, so nothing is flagged on a fresh browser.
import { useState, useEffect, useMemo } from 'react';

const read = (key) => {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? new Set(JSON.parse(raw)) : null;
    } catch (e) { return null; }
};
const write = (key, ids) => {
    try { window.localStorage.setItem(key, JSON.stringify([...ids])); } catch (e) { /* the dots are a convenience */ }
};

// itemsByTab: { tabKey: [id, ...] | null }  (null = not loaded yet)   activeTabs: tab keys that are open right now
export const useUnseenDots = (scope, itemsByTab, activeTabs) => {
    const [seenVersion, setSeenVersion] = useState(0);
    const signature = JSON.stringify(itemsByTab);
    const activeSig = JSON.stringify(activeTabs);

    useEffect(() => {
        const items = JSON.parse(signature);
        const open = JSON.parse(activeSig);
        let changed = false;
        Object.entries(items).forEach(([tab, ids]) => {
            if (!Array.isArray(ids)) return;
            const key = `dots:${scope}:${tab}`;
            const seen = read(key);
            if (open.includes(tab) || seen === null) {
                const merged = new Set([...(seen || []), ...ids.map(String)]);
                if (!seen || merged.size !== seen.size) { write(key, merged); changed = true; }
            }
        });
        if (changed) setSeenVersion((v) => v + 1);
    }, [scope, signature, activeSig]);

    return useMemo(() => {
        const out = {};
        Object.entries(JSON.parse(signature)).forEach(([tab, ids]) => {
            if (!Array.isArray(ids)) return;
            const seen = read(`dots:${scope}:${tab}`);
            out[tab] = !!seen && ids.some((id) => !seen.has(String(id)));
        });
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope, signature, seenVersion]);
};

export default useUnseenDots;
