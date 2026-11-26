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

    // Auto-detect browser push subscription on mount/login and bind it to current userId[cite: 1]
    useEffect(() => {
        let isMounted = true;

        async function checkAndSyncSubscription() {
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
                    
                    // Re-assign existing browser push endpoint to the newly logged-in user[cite: 1]
                    if (sub && userId) {
                        await fetch('https://localhost-cms.onrender.com/api/push/subscribe', {
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

        checkAndSyncSubscription();
        return () => { isMounted = false; };
    }, [userId]);

    // Manual Subscribe from Notification Settings[cite: 1]
    const subscribe = useCallback(async () => {
        if (!userId) return false;
        setLoading(true);
        setError(null);

        try {
            const perm = await Notification.requestPermission();
            setPermission(perm);
            if (perm !== 'granted') {
                throw new Error('Notification permission was denied by user.');
            }

            const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            await navigator.serviceWorker.ready;

            const keyRes = await fetch('https://localhost-cms.onrender.com/api/push/public-key');
            const { publicKey } = await keyRes.json();

            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

            await fetch('https://localhost-cms.onrender.com/api/push/subscribe', {
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

    // Manual Unsubscribe from Notification Settings[cite: 1]
    const unsubscribe = useCallback(async () => {
        if (!userId) return false;
        setLoading(true);
        setError(null);

        try {
            const reg = await navigator.serviceWorker.ready;
            const subscription = await reg.pushManager.getSubscription();

            if (subscription) {
                await subscription.unsubscribe();

                await fetch('https://localhost-cms.onrender.com/api/push/unsubscribe', {
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