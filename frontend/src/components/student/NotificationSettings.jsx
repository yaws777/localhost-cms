import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Bell, BellOff, CheckCircle, AlertCircle, Send } from 'lucide-react';
import { useWebPush } from '../../hooks/useWebPush';

const NotificationSettings = () => {
    const context = useOutletContext();
    // Fallback check for user ID
    const userId = context?.userId || context?.studentId || context?.nurseId || null;

    const { isSubscribed, permission, loading, subscribe, unsubscribe } = useWebPush(userId);
    const [testSending, setTestSending] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const handleTogglePush = async () => {
        setStatusMessage('');

        if (!userId) {
            setStatusMessage('User profile is still loading. Please wait a moment and try again.');
            return;
        }

        if (!('serviceWorker' in navigator)) {
            setStatusMessage('Push notifications are not supported by this browser.');
            return;
        }

        if (isSubscribed) {
            const success = await unsubscribe();
            if (success) {
                setStatusMessage('Web push notifications disabled.');
            } else {
                setStatusMessage('Failed to unsubscribe. Check server logs.');
            }
        } else {
            const success = await subscribe();
            if (success) {
                setStatusMessage('Web push notifications enabled successfully!');
            } else if (Notification.permission === 'denied') {
                setStatusMessage('Notifications are blocked by your browser. Enable them in site settings.');
            } else {
                setStatusMessage('Failed to enable push notifications. Verify backend server is running and VAPID keys are set.');
            }
        }
    };

    const handleSendTestPush = async () => {
        if (!userId || !isSubscribed) return;
        setTestSending(true);
        setStatusMessage('');

        try {
            const res = await fetch('http://localhost:3001/api/push/send-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId,
                    title: 'STI Clinic Test Notification',
                    message: 'Web push notifications are working properly on your device!'
                })
            });

            const data = await res.json();
            if (data.success) {
                setStatusMessage('Test notification sent to your device!');
            } else {
                setStatusMessage(data.message || 'Failed to send test notification.');
            }
        } catch (err) {
            console.error(err);
            setStatusMessage('Error connecting to notification server.');
        } finally {
            setTestSending(false);
        }
    };

    return (
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px', color: '#111827' }}>
                Notification Settings
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '0.95rem' }}>
                Manage how you receive real-time updates and push alerts on this device.
            </p>

            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                marginBottom: '20px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isSubscribed ? <Bell size={24} color="#10b981" /> : <BellOff size={24} color="#ef4444" />}
                        <div>
                            <h3 style={{ fontWeight: '600', fontSize: '1rem', color: '#1f2937', margin: 0 }}>
                                Push Notifications
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '2px 0 0 0' }}>
                                Receive instant clinic updates, appointment logs, and direct messages.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleTogglePush}
                        disabled={loading || !userId}
                        style={{
                            padding: '8px 18px',
                            borderRadius: '20px',
                            border: 'none',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            cursor: (loading || !userId) ? 'not-allowed' : 'pointer',
                            backgroundColor: isSubscribed ? '#ef4444' : '#003366',
                            color: '#ffffff',
                            transition: 'all 0.2s',
                            opacity: (loading || !userId) ? 0.6 : 1
                        }}
                    >
                        {loading ? 'Updating...' : !userId ? 'Loading Profile...' : isSubscribed ? 'Disable' : 'Enable'}
                    </button>
                </div>

                <div style={{
                    borderTop: '1px solid #f3f4f6',
                    paddingTop: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    fontSize: '0.85rem'
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4b5563' }}>
                        Browser Permission: 
                        <strong style={{ 
                            color: permission === 'granted' ? '#10b981' : permission === 'denied' ? '#ef4444' : '#f59e0b' 
                        }}>
                            {permission.toUpperCase()}
                        </strong>
                    </span>

                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4b5563' }}>
                        Push Status: 
                        <strong style={{ color: isSubscribed ? '#10b981' : '#6b7280' }}>
                            {isSubscribed ? 'SUBSCRIBED' : 'INACTIVE'}
                        </strong>
                    </span>
                </div>
            </div>

            {isSubscribed && (
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <h4 style={{ fontWeight: '600', color: '#1f2937', margin: 0, fontSize: '0.95rem' }}>
                            Test Push Delivery
                        </h4>
                        <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '2px 0 0 0' }}>
                            Verify that push notifications are arriving on this browser.
                        </p>
                    </div>

                    <button
                        onClick={handleSendTestPush}
                        disabled={testSending}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            backgroundColor: '#f3f4f6',
                            color: '#1f2937',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            cursor: testSending ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <Send size={14} />
                        {testSending ? 'Sending...' : 'Send Test Alert'}
                    </button>
                </div>
            )}

            {statusMessage && (
                <div style={{
                    marginTop: '16px',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    backgroundColor: statusMessage.includes('blocked') || statusMessage.includes('Failed') || statusMessage.includes('Error') 
                        ? '#fef2f2' 
                        : '#ecfdf5',
                    color: statusMessage.includes('blocked') || statusMessage.includes('Failed') || statusMessage.includes('Error') 
                        ? '#991b1b' 
                        : '#065f46',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.875rem'
                }}>
                    {statusMessage.includes('blocked') || statusMessage.includes('Failed') || statusMessage.includes('Error') ? (
                        <AlertCircle size={16} />
                    ) : (
                        <CheckCircle size={16} />
                    )}
                    <span>{statusMessage}</span>
                </div>
            )}
        </div>
    );
};

export default NotificationSettings;