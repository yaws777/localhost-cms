/// <reference lib="webworker" />
/* eslint-disable */

const CACHE_NAME = 'sti-clinic-cache-v1';

// Static assets to pre-cache
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '../src/assets/sti-logof.png'
];

// Alias self as sw to bypass React's restricted-globals rule and fix VS Code scope
/** @type {ServiceWorkerGlobalScope} */
const sw = /** @type {any} */ (self);

// ==========================================
// 1. SERVICE WORKER LIFECYCLE
// ==========================================

// Install Event - Pre-cache static assets safely
sw.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            await Promise.allSettled(
                STATIC_ASSETS.map((asset) => cache.add(asset).catch((err) => {
                    console.warn(`[SW] Could not pre-cache asset: ${asset}`, err);
                }))
            );
        }).then(() => sw.skipWaiting())
    );
});

// Activate Event - Clean up old cache storage
sw.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => sw.clients.claim())
    );
});

// Fetch Event - Handle offline requests, cache, and SPA navigation
sw.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip non-GET requests (POST, PUT, DELETE)
    if (request.method !== 'GET') return;

    // Skip API routes and cross-origin requests
    if (!request.url.startsWith(sw.location.origin) || request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return response;
            })
            .catch(async () => {
                const cachedResponse = await caches.match(request);
                if (cachedResponse) return cachedResponse;

                // SPA Fallback: If offline and navigating to a route, serve index.html
                if (request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            })
    );
});

// ==========================================
// 2. WEB PUSH NOTIFICATIONS
// ==========================================

// Listen for Push Events from backend
sw.addEventListener('push', (event) => {
    let payload = {};

    if (event.data) {
        try {
            payload = event.data.json();
        } catch (e) {
            payload = {
                title: 'STI Clinic Notification',
                message: event.data.text()
            };
        }
    }

    const title = payload.title || 'STI Baliuag Clinic';
    const options = {
        body: payload.message || payload.body || 'You have a new update.',
        icon: payload.icon || '../src/assets/sti-logof.png',
        badge: payload.badge || '../src/assets/sti-logof.png',
        vibrate: [100, 50, 100],
        tag: payload.tag || 'sti-clinic-notification',
        renotify: true,
        data: {
            url:  '/login'||payload.url || payload.route || '/'|| app.json?.route,
            notificationId: payload.notification_id || null
        }
    };

    event.waitUntil(
        sw.registration.showNotification(title, options)
    );
});

// Handle Notification Clicks
sw.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let client of windowClients) {
                if ('focus' in client) {
                    client.focus();
                    if ('navigate' in client && targetUrl !== '/') {
                        return client.navigate(targetUrl);
                    }
                    return;
                }
            }
            if (sw.clients.openWindow) {
                return sw.clients.openWindow(targetUrl);
            }
        })
    );
});