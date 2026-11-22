// pageDots.js
// A page that decides its own red dots (no notification behind them) reports how many it shows; the sidebar item of
// that page shows the same number. `usePageDotCounts()` gives { '/Route': n }.
import { useSyncExternalStore } from 'react';

let counts = {};
const listeners = new Set();

export const setPageDotCount = (route, n) => {
    const next = Number(n) || 0;
    if (counts[route] === next) return;
    counts = { ...counts, [route]: next };
    listeners.forEach((l) => l());
};

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => counts;

export const usePageDotCounts = () => useSyncExternalStore(subscribe, snapshot);
