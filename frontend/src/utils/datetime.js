// Shared date/time formatting — always renders in Philippine time (Asia/Manila),
// regardless of the viewer's device/browser timezone, so timestamps shown in
// the UI stay correct in both development and production.

const MANILA_TZ = 'Asia/Manila';

export const formatCurrentDate = (date = new Date()) =>
    date.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        timeZone: MANILA_TZ,
    });

export const formatDate = (value) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        timeZone: MANILA_TZ,
    });
};

export const formatDateTime = (value) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        timeZone: MANILA_TZ,
    });
};

export const formatTime = (value) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
        timeZone: MANILA_TZ,
    });
};
