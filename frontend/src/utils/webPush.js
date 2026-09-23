// src/utils/webPush.js

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function registerAndSubscribeUser(userId) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push notifications are not supported in this browser.');
    }

    // 1. Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    // 2. Fetch public VAPID key from Node.js backend
    const keyRes = await fetch('/api/push/public-key');
    if (!keyRes.ok) throw new Error('Failed to retrieve VAPID key from server.');
    const { publicKey } = await keyRes.json();

    // 3. Prompt user for notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error('Notification permission was denied.');
    }

    // 4. Create push subscription object
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    // 5. Save subscription to DB via Express API
    const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, subscription })
    });

    if (!saveRes.ok) throw new Error('Failed to store subscription in database.');

    return subscription;
}

export async function unsubscribeUser(userId) {
    if (!('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
        // Remove locally
        await subscription.unsubscribe();

        // Remove from DB
        await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                endpoint: subscription.endpoint
            })
        });
    }
}