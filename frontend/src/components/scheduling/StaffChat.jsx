// StaffChat.jsx
// Chat between the nurse and the doctors. Nurses see the doctors, doctors see the nurses.
// It uses the same messages table and endpoints as the rest of the app (send / history / read / delete),
// plus GET /api/staff-chat/contacts/:userId for the list of people and their unread counts.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Trash2, MessagesSquare, RefreshCw } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDateTime } from '../../utils/datetime';
import { API } from '../../utils/scheduling';
import '../../styles/scheduling/Scheduling.css';

const POLL_MS = 4000;

const nameOf = (c) => `${c.role === 'doctor' ? 'Dr. ' : ''}${c.first_name} ${c.last_name}`;

const StaffChat = ({ userId, onUnreadChange }) => {
    const { showAlert, showConfirm } = useAlert();
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const endRef = useRef(null);

    const loadContacts = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await fetch(`${API}/api/staff-chat/contacts/${userId}`);
            const data = await res.json();
            if (data.success) {
                setContacts(data.contacts);
                if (onUnreadChange) onUnreadChange(data.contacts.reduce((n, c) => n + c.unread_count, 0));
            }
        } catch (e) { /* the next poll tries again */ } finally {
            setLoading(false);
        }
    }, [userId, onUnreadChange]);

    const loadHistory = useCallback(async (contactId) => {
        if (!userId || !contactId) return;
        try {
            const res = await fetch(`${API}/api/messages/history/${userId}/${contactId}`);
            const data = await res.json();
            if (data.success) setMessages(data.messages);
        } catch (e) { /* the next poll tries again */ }
    }, [userId]);

    const markRead = useCallback(async (contactId) => {
        try {
            await fetch(`${API}/api/messages/read/${userId}/${contactId}`, { method: 'PUT' });
            loadContacts();
        } catch (e) { /* read marks are a convenience */ }
    }, [userId, loadContacts]);

    useEffect(() => {
        loadContacts();
        const timer = setInterval(loadContacts, POLL_MS);
        return () => clearInterval(timer);
    }, [loadContacts]);

    // open the first conversation as soon as there is one (a doctor usually talks to a single nurse)
    useEffect(() => {
        if (!activeId && contacts.length > 0) setActiveId(contacts[0].user_id);
    }, [contacts, activeId]);

    useEffect(() => {
        if (!activeId) { setMessages([]); return undefined; }
        loadHistory(activeId);
        markRead(activeId);
        const timer = setInterval(() => { loadHistory(activeId); }, POLL_MS);
        return () => clearInterval(timer);
    }, [activeId, loadHistory, markRead]);

    // a message that arrives while the conversation is open is read right away
    const unreadHere = (contacts.find((c) => c.user_id === activeId) || {}).unread_count || 0;
    useEffect(() => { if (activeId && unreadHere > 0) markRead(activeId); }, [activeId, unreadHere, markRead]);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, activeId]);

    const active = contacts.find((c) => c.user_id === activeId) || null;

    const sendMessage = async (e) => {
        e.preventDefault();
        const content = text.trim();
        if (!content || !active) return;
        setSending(true);
        try {
            const res = await fetch(`${API}/api/messages/send`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender_id: userId, receiver_id: active.user_id, message_type: 'text', content })
            });
            const data = await res.json();
            if (data.success) { setText(''); loadHistory(active.user_id); loadContacts(); }
            else showAlert(data.message || 'The message was not sent.', 'error');
        } catch (err) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setSending(false);
        }
    };

    const unsend = async (m) => {
        const ok = await showConfirm('Unsend this message?', { danger: true, confirmLabel: 'Unsend' });
        if (!ok) return;
        try {
            const res = await fetch(`${API}/api/messages/${m.message_id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) { setMessages((prev) => prev.filter((x) => x.message_id !== m.message_id)); loadContacts(); }
            else showAlert('Could not unsend the message.', 'error');
        } catch (err) {
            showAlert('Could not reach the server.', 'error');
        }
    };

    return (
        <div className="chat-layout-sc">
            <aside className="chat-list-sc" aria-label="People you can message">
                <div className="chat-list-head-sc">
                    <strong>Messages</strong>
                    <button type="button" className="icon-btn-ds" title="Refresh" onClick={loadContacts}><RefreshCw size={14} /></button>
                </div>
                {loading ? <div className="empty-sc">Loading...</div> : contacts.length === 0 ? (
                    <div className="empty-sc">There is nobody to message yet.</div>
                ) : contacts.map((c) => (
                    <button key={c.user_id} type="button" className={`chat-contact-sc ${c.user_id === activeId ? 'active-sc' : ''}`} onClick={() => setActiveId(c.user_id)}>
                        <span className="chat-avatar-sc">{(c.first_name || '?').charAt(0)}{(c.last_name || '').charAt(0)}</span>
                        <span className="chat-contact-text-sc">
                            <strong>{nameOf(c)}</strong>
                            <small>{c.last_message ? `${c.last_from_me ? 'You: ' : ''}${c.last_message}` : (c.detail || (c.role === 'doctor' ? 'Doctor' : 'Nurse'))}</small>
                        </span>
                        {c.unread_count > 0 && <span className="tab-badge-sc">{c.unread_count}</span>}
                    </button>
                ))}
            </aside>

            <section className="chat-panel-sc" aria-label="Conversation">
                {!active ? (
                    <div className="chat-empty-sc"><MessagesSquare size={34} /><p>Pick someone to start a conversation.</p></div>
                ) : (
                    <>
                        <header className="chat-head-sc">
                            <strong>{nameOf(active)}</strong>
                            <small>{active.detail || (active.role === 'doctor' ? 'Doctor' : 'Clinic nurse')}</small>
                        </header>
                        <div className="chat-messages-sc">
                            {messages.length === 0 && <div className="empty-sc">No messages yet. Say hello.</div>}
                            {messages.map((m) => {
                                const mine = m.sender_id === userId;
                                return (
                                    <div key={m.message_id} className={`chat-row-sc ${mine ? 'mine-sc' : ''}`}>
                                        <div className="chat-bubble-sc">
                                            {m.media_url && <a href={`${API}${m.media_url}`} target="_blank" rel="noreferrer">[{m.message_type}] open attachment</a>}
                                            {m.content && <p>{m.content}</p>}
                                            <small>{formatDateTime(m.created_at)}</small>
                                        </div>
                                        {mine && <button type="button" className="icon-btn-ds chat-unsend-sc" title="Unsend" onClick={() => unsend(m)}><Trash2 size={13} /></button>}
                                    </div>
                                );
                            })}
                            <div ref={endRef} />
                        </div>
                        <form className="chat-compose-sc" onSubmit={sendMessage}>
                            <input
                                type="text" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
                                placeholder={`Message ${nameOf(active)}...`} aria-label="Message"
                            />
                            <button type="submit" className="sti-btn-dv sti-btn-primary-dv" disabled={sending || !text.trim()}><Send size={15} /> Send</button>
                        </form>
                    </>
                )}
            </section>
        </div>
    );
};

export default StaffChat;
