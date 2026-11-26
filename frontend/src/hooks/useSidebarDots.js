// useSidebarDots.js
// Number on a sidebar item = how many red dots its page holds. The layout's unread notifications are grouped by the page
// they belong to (`routeOf`). A page with tabs counts every tab that has an unread notification (TAB_MAPS_BY_ROUTE); a page
// without tabs counts its unread notifications; a page that decides its own dots reports the number (utils/pageDots).
// The number shows while the page is not open. Opening the page marks its notifications read, so the number goes away,
// except those the page shows on its own tabs (`claimed`): the tabs clear those.
import { useEffect, useMemo, useRef, useCallback } from 'react';
import { usePageDotCounts } from '../utils/pageDots';
import { TAB_MAPS_BY_ROUTE } from '../utils/tabNotificationTypes';

const API = 'https://localhost-cms.onrender.com';
const NO_CLAIMS = {};

const isUnread = (n) => !(n.is_read === 1 || n.is_read === '1' || n.is_read === true || n.read === true);

export const useSidebarDots = ({ notifications, setNotifications, routeOf, pathname, claimed = NO_CLAIMS }) => {
    const patched = useRef(new Set());
    const reported = usePageDotCounts();

    const items = useMemo(() => notifications
        .filter(isUnread)
        .map((n) => {
            const route = routeOf(n);
            return { n, route: route ? route.split('?')[0] : null };
        })
        .filter((x) => x.route), [notifications, routeOf]);

    useEffect(() => {
        const claim = claimed[pathname];
        const fresh = items.filter((x) => x.route === pathname
            && !(claim && claim.has(String(x.n.type || '').toUpperCase()))
            && !patched.current.has(x.n.notification_id));
        if (fresh.length === 0) return;
        const ids = new Set(fresh.map((x) => x.n.notification_id));
        ids.forEach((id) => patched.current.add(id));
        setNotifications((prev) => prev.map((n) => (ids.has(n.notification_id) ? { ...n, is_read: 1, read: true } : n)));
        ids.forEach((id) => { fetch(`${API}/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {}); });
    }, [items, pathname, claimed, setNotifications]);

    // how many red dots the page of this route holds (0 = none, or the page is open)
    return useCallback((route) => {
        if (pathname === route) return 0;
        if (reported[route] !== undefined) return reported[route];
        const maps = TAB_MAPS_BY_ROUTE[route];
        const dots = new Set();
        items.filter((x) => x.route === route).forEach((x) => {
            const type = String(x.n.type || '').toUpperCase();
            let counted = false;
            (maps || []).forEach((map, i) => {
                Object.entries(map).forEach(([tab, types]) => {
                    if (types.includes(type)) { dots.add(`${i}:${tab}`); counted = true; }
                });
            });
            if (!counted) dots.add(`n:${x.n.notification_id}`);
        });
        return dots.size;
    }, [items, pathname, reported]);
};

export default useSidebarDots;
