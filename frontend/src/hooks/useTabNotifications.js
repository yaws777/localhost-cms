// useTabNotifications.js
// Red dots on page tabs. The unread notifications of the user are grouped by tab through `typeMap`
// ({ tabKey: ['NOTIFICATION_TYPE', ...] }). While a tab is the open one, its unread notifications are marked read,
// so its dot goes away the moment the user is on it. Other tabs keep their dot until they are opened.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const API = 'http://localhost:3001';

export const useTabNotifications = ({ userId, typeMap, activeTab, pollMs = 10000 }) => {
    const [unread, setUnread] = useState([]); // [{ id, type, tab }]
    const activeRef = useRef(activeTab);
    activeRef.current = activeTab;

    const tabOfType = useMemo(() => {
        const map = {};
        Object.entries(typeMap).forEach(([tab, types]) => types.forEach((t) => { map[t.toUpperCase()] = tab; }));
        return map;
    }, [typeMap]);

    const markTabRead = useCallback(async (tab) => {
        const types = typeMap[tab];
        if (!userId || !types || types.length === 0) return;
        setUnread((list) => list.filter((n) => n.tab !== tab));
        try {
            await fetch(`${API}/api/notifications/user/${encodeURIComponent(userId)}/read-types`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ types })
            });
        } catch (err) {
            console.error('Error marking tab notifications read:', err);
        }
    }, [userId, typeMap]);

    const load = useCallback(async () => {
        if (!userId) return;
        try {
            const data = await fetch(`${API}/api/notifications/user/${encodeURIComponent(userId)}`).then((r) => r.json());
            if (!data.success) return;
            const rows = (data.data || [])
                .filter((n) => !(n.is_read === 1 || n.is_read === '1' || n.is_read === true))
                .map((n) => ({ id: n.notification_id, type: String(n.type || '').toUpperCase(), tab: tabOfType[String(n.type || '').toUpperCase()] }))
                .filter((n) => n.tab);
            const open = activeRef.current;
            if (open && rows.some((n) => n.tab === open)) markTabRead(open);
            setUnread(rows.filter((n) => n.tab !== open));
        } catch (err) {
            console.error('Error loading tab notifications:', err);
        }
    }, [userId, tabOfType, markTabRead]);

    useEffect(() => {
        load();
        const timer = setInterval(() => { if (!document.hidden) load(); }, pollMs);
        return () => clearInterval(timer);
    }, [load, pollMs]);

    // opening a tab clears it at once
    useEffect(() => { if (activeTab) markTabRead(activeTab); }, [activeTab, markTabRead]);

    const dots = useMemo(() => {
        const out = {};
        unread.forEach((n) => { out[n.tab] = (out[n.tab] || 0) + 1; });
        return out;
    }, [unread]);

    return { dots, unread, reload: load };
};

export default useTabNotifications;
