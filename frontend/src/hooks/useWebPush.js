import { useState, useEffect, useCallback } from 'react';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function useWebPush(userId) {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [permission, setPermission] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    );
    const [error, setError] = useState(null);

    // Check existing push subscription on mount / userId update & auto-sync to backend
    useEffect(() => {
        let isMounted = true;

        async function checkSubscription() {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                if (isMounted) setLoading(false);
                return;
            }

            try {
                const reg = await navigator.serviceWorker.ready;
                if (reg) {
                    const sub = await reg.pushManager.getSubscription();
                    if (isMounted) {
                        setIsSubscribed(!!sub);
                    }
                    // Auto-sync existing subscription with backend when userId is present on mount/login
                    if (sub && userId) {
                        await fetch('http://localhost:3001/api/push/subscribe', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: userId, subscription: sub })
                        }).catch(err => console.error('Failed to auto-sync push subscription:', err));
                    }
                }
            } catch (err) {
                console.error('Error checking push subscription:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        checkSubscription();
        return () => { isMounted = false; };
    }, [userId]);

    // Enable / Subscribe Function
    const subscribe = useCallback(async () => {
        if (!userId) return false;
        setLoading(true);
        setError(null);

        try {
            // 1. Request Browser Permission
            const perm = await Notification.requestPermission();
            setPermission(perm);
            if (perm !== 'granted') {
                throw new Error('Notification permission was denied by user.');
            }

            // 2. Register Service Worker
            const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            await navigator.serviceWorker.ready;

            // 3. Get VAPID Public Key from Backend
            const keyRes = await fetch('http://localhost:3001/api/push/public-key');
            const { publicKey } = await keyRes.json();

            // 4. Create Push Subscription
            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

            // 5. Save to Express Backend DB
            await fetch('http://localhost:3001/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, subscription })
            });

            setIsSubscribed(true);
            return true;
        } catch (err) {
            console.error('Push Subscription Error:', err);
            setError(err.message);
            return false;
        } finally {
            setLoading(false);
        }
    }, [userId]);

    // Disable / Unsubscribe Function
    const unsubscribe = useCallback(async () => {
        if (!userId) return false;
        setLoading(true);
        setError(null);

        try {
            const reg = await navigator.serviceWorker.ready;
            const subscription = await reg.pushManager.getSubscription();

            if (subscription) {
                // 1. Remove locally from browser
                await subscription.unsubscribe();

                // 2. Remove from Express Backend DB
                await fetch('http://localhost:3001/api/push/unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, endpoint: subscription.endpoint })
                });
            }

            setIsSubscribed(false);
            return true;
        } catch (err) {
            console.error('Push Unsubscribe Error:', err);
            setError(err.message);
            return false;
        } finally {
            setLoading(false);
        }
    }, [userId]);

    return { isSubscribed, permission, loading, error, subscribe, unsubscribe };
}