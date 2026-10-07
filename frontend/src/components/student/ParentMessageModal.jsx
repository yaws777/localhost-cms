import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    X, Send, ShieldCheck, User, MessageSquare, 
    Image, Paperclip, Mic, Video, FileText, 
    Trash2, MoreVertical, Square, AlertCircle, Loader2
} from 'lucide-react';
import '../../styles/parent/ParentMessageModal.css';

const ParentMessageModal = ({ userId, parentId, linkedStudents = [], onClose, refreshUnreadCount }) => {
    const [nurseContacts, setNurseContacts] = useState([]);
    const [studentContacts, setStudentContacts] = useState([]);
    const [selectedContact, setSelectedContact] = useState(null);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [messages, setMessages] = useState([]);
    const [inputContent, setInputContent] = useState('');
    
    // Attachment & Recording States
    const [attachment, setAttachment] = useState(null);
    const [attachmentType, setAttachmentType] = useState('text');
    const [isRecording, setIsRecording] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState(null);

    const [isSending, setIsSending] = useState(false);
    const isSendingRef = useRef(false); // Synchronous guard to prevent double texting

    const [isLoadingContacts, setIsLoadingContacts] = useState(true);
    const [isLoadingThread, setIsLoadingThread] = useState(false);

    const messagesEndRef = useRef(null);
    const activeContactRef = useRef(null);
    const fileInputRef = useRef(null);
    const pendingTypeRef = useRef('text');
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    useEffect(() => {
        activeContactRef.current = selectedContact;
    }, [selectedContact]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Check unread counts across contacts
    const checkUnreadForContacts = useCallback(async (allContacts) => {
        if (!userId || !allContacts || allContacts.length === 0) return {};

        const counts = {};
        await Promise.all(
            allContacts.map(async (contact) => {
                if (!contact.contact_user_id) return;
                
                if (activeContactRef.current && activeContactRef.current.id === contact.id) {
                    counts[contact.id] = 0;
                    return;
                }
                try {
                    const res = await fetch(`http://localhost:3001/api/messages/${String(userId)}/${String(contact.contact_user_id)}`);
                    const data = await res.json();
                    if (data.success && Array.isArray(data.messages)) {
                        const unread = data.messages.filter(
                            m => String(m.receiver_id) === String(userId) && (Number(m.is_read) === 0 || m.is_read === false)
                        ).length;
                        counts[contact.id] = unread;
                    }
                } catch (err) {
                    console.error('Error checking unread count:', contact.id, err);
                }
            })
        );

        setUnreadCounts(prev => ({ ...prev, ...counts }));
        return counts;
    }, [userId]);

    // Fetch & Normalize Contacts
    useEffect(() => {
        let isMounted = true;

        const fetchAllContacts = async () => {
            setIsLoadingContacts(true);
            try {
                let fetchedNurses = [];
                try {
                    const nurseRes = await fetch('http://localhost:3001/api/nurses');
                    const nurseData = await nurseRes.json();
                    if (nurseData.success && Array.isArray(nurseData.nurses)) {
                        fetchedNurses = nurseData.nurses;
                    } else if (Array.isArray(nurseData)) {
                        fetchedNurses = nurseData;
                    }
                } catch (err) {
                    console.error('Error fetching nurses:', err);
                }

                const normalizedNurses = fetchedNurses.map(n => {
                    const recipientUserId = n.user_id ? String(n.user_id) : (n.nurse_id ? String(n.nurse_id) : '');
                    return {
                        id: `nurse_${n.nurse_id || recipientUserId}`,
                        nurse_id: String(n.nurse_id || ''),
                        contact_user_id: recipientUserId,
                        first_name: n.first_name || 'Clinic',
                        last_name: n.last_name || 'Nurse',
                        subtitle: n.role || 'Clinic Staff',
                        type: 'nurse',
                        hasValidUserAccount: Boolean(n.user_id)
                    };
                });

                let fetchedStudents = [];
                if (parentId) {
                    try {
                        const studentRes = await fetch(`http://localhost:3001/api/parent/${String(parentId)}/contacts`);
                        const studentData = await studentRes.json();
                        if (studentData.success && Array.isArray(studentData.contacts)) {
                            fetchedStudents = studentData.contacts;
                        }
                    } catch (err) {
                        console.error('Error fetching student contacts:', err);
                    }
                }

                if (fetchedStudents.length === 0 && linkedStudents.length > 0) {
                    fetchedStudents = linkedStudents.map(s => ({
                        student_id: String(s.student_id),
                        contact_user_id: String(s.contact_user_id || s.user_id || s.student_id),
                        first_name: s.first_name,
                        last_name: s.last_name,
                        year_level: s.year_level,
                        section: s.section
                    }));
                }

                const normalizedStudents = fetchedStudents.map(s => ({
                    id: `student_${s.student_id}`,
                    student_id: String(s.student_id),
                    contact_user_id: String(s.contact_user_id || s.user_id || s.student_id),
                    first_name: s.first_name,
                    last_name: s.last_name,
                    subtitle: `ID: ${s.student_id}${s.section ? ` • ${s.section}` : ''}`,
                    type: 'student',
                    hasValidUserAccount: true
                }));

                if (isMounted) {
                    setNurseContacts(normalizedNurses);
                    setStudentContacts(normalizedStudents);

                    const allContacts = [...normalizedStudents, ...normalizedNurses];
                    const counts = await checkUnreadForContacts(allContacts);

                    const contactWithUnread = allContacts.find(c => counts[c.id] > 0);
                    if (contactWithUnread) {
                        setSelectedContact(contactWithUnread);
                    } else if (normalizedStudents.length > 0) {
                        setSelectedContact(normalizedStudents[0]);
                    } else if (normalizedNurses.length > 0) {
                        setSelectedContact(normalizedNurses[0]);
                    }
                }
            } catch (err) {
                console.error('Error initializing contacts:', err);
            } finally {
                if (isMounted) setIsLoadingContacts(false);
            }
        };

        fetchAllContacts();
        return () => { isMounted = false; };
    }, [parentId, linkedStudents, checkUnreadForContacts]);

    // Fetch Chat Thread & Mark Read
    const fetchChatThread = useCallback(async (contactUserId) => {
        if (!userId || !contactUserId) {
            setMessages([]);
            return;
        }

        try {
            const res = await fetch(`http://localhost:3001/api/messages/${String(userId)}/${String(contactUserId)}`);
            const data = await res.json();

            const threadMessages = data.success ? (data.messages || []) : [];
            setMessages(threadMessages);

            const hasUnread = threadMessages.some(
                m => String(m.receiver_id) === String(userId) && (Number(m.is_read) === 0 || m.is_read === false)
            );

            if (hasUnread) {
                await fetch('http://localhost:3001/api/messages/mark-read', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        sender_id: String(contactUserId), 
                        receiver_id: String(userId) 
                    })
                });

                if (activeContactRef.current?.id) {
                    setUnreadCounts(prev => ({ ...prev, [activeContactRef.current.id]: 0 }));
                }

                if (refreshUnreadCount) refreshUnreadCount();
            }
        } catch (err) {
            console.error('Error fetching chat thread:', err);
        }
    }, [userId, refreshUnreadCount]);

    useEffect(() => {
        if (selectedContact && selectedContact.contact_user_id) {
            setIsLoadingThread(true);
            fetchChatThread(selectedContact.contact_user_id).finally(() => setIsLoadingThread(false));
        }
    }, [selectedContact, fetchChatThread]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (activeContactRef.current && activeContactRef.current.contact_user_id) {
                fetchChatThread(activeContactRef.current.contact_user_id);
            }
            const allContacts = [...studentContacts, ...nurseContacts];
            if (allContacts.length > 0) {
                checkUnreadForContacts(allContacts);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [fetchChatThread, checkUnreadForContacts, studentContacts, nurseContacts]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Attachment Helpers
    const triggerFilePicker = (type, acceptFilter) => {
        pendingTypeRef.current = type;
        if (fileInputRef.current) {
            fileInputRef.current.accept = acceptFilter;
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAttachment(file);
            setAttachmentType(pendingTypeRef.current);
        }
    };

    const clearAttachment = () => {
        setAttachment(null);
        setAttachmentType('text');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Voice Recording logic
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
                setAttachment(audioFile);
                setAttachmentType('audio');
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            alert('Microphone permission is required to record audio.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    // Unsend Message
    const handleDeleteMessage = async (messageId) => {
        setActiveMenuId(null);
        if (!window.confirm('Unsend this message?')) return;

        try {
            const res = await fetch(`http://localhost:3001/api/messages/${messageId}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (data.success) {
                setMessages((prev) => prev.map((m) => 
                    m.message_id === messageId ? { ...m, is_deleted: true } : m
                ));
            } else {
                alert('Failed to unsend message.');
            }
        } catch (err) {
            console.error('Error deleting message:', err);
        }
    };

    // Send Message Handler with Double Texting Protection
    const handleSendMessage = async (e) => {
        e.preventDefault();

        // 1. Guard against double texting (synchronous lock)
        if (isSendingRef.current || isSending) return;

        if (!selectedContact || !selectedContact.contact_user_id) {
            alert("Cannot send message: Receiver account ID is missing for this contact.");
            return;
        }

        const textContent = inputContent.trim();
        if (!textContent && !attachment) return;

        // Immediately lock sending ref and update state
        isSendingRef.current = true;
        setIsSending(true);

        const contactUserId = String(selectedContact.contact_user_id);
        const currentAttachment = attachment;
        const currentAttachmentType = attachmentType;

        // Clear UI input states immediately to prevent double submits
        setInputContent('');
        clearAttachment();

        const formData = new FormData();
        formData.append('sender_id', String(userId));
        formData.append('receiver_id', contactUserId);
        formData.append('message_type', currentAttachment ? currentAttachmentType : 'text');
        formData.append('content', textContent);

        if (currentAttachment) {
            formData.append('media', currentAttachment);
        }

        try {
            const response = await fetch('http://localhost:3001/api/messages/send', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                await fetchChatThread(contactUserId);
            } else {
                // Restore input on failure
                setInputContent(textContent);
                setAttachment(currentAttachment);
                setAttachmentType(currentAttachmentType);
                alert(data.message || 'Failed to send message.');
            }
        } catch (err) {
            console.error('Error sending message:', err);
            setInputContent(textContent);
            setAttachment(currentAttachment);
            setAttachmentType(currentAttachmentType);
            alert('Failed to send message due to a connection delay.');
        } finally {
            isSendingRef.current = false;
            setIsSending(false);
        }
    };

    return (
        <div className="pmm-overlay" onClick={() => setActiveMenuId(null)}>
            <style>{`
                @keyframes pmmSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .pmm-spin {
                    animation: pmmSpin 1s linear infinite;
                }
            `}</style>
            <div className="pmm-container">
                {/* Header */}
                <div className="pmm-header">
                    <div>
                        <h3 className="pmm-header-title">
                            <MessageSquare size={20} />
                            Parent Messages
                        </h3>
                        <span className="pmm-header-subtitle">
                            Connect with clinic staff and linked children
                        </span>
                    </div>
                    <button className="pmm-close-btn" onClick={onClose} title="Close Modal">
                        <X size={22} />
                    </button>
                </div>

                {/* Body Area */}
                <div className="pmm-body">
                    {/* Contacts Sidebar */}
                    <div className="pmm-sidebar">
                        <div className="pmm-sidebar-scroll">
                            {isLoadingContacts ? (
                                <div className="pmm-sidebar-loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '20px 0', color: '#666' }}>
                                    <Loader2 size={18} className="pmm-spin" />
                                    <span>Loading contacts...</span>
                                </div>
                            ) : (
                                <>
                                    {studentContacts.length > 0 && (
                                        <div>
                                            <div className="pmm-section-header">LINKED CHILDREN</div>
                                            {studentContacts.map((contact) => {
                                                const isSelected = selectedContact && selectedContact.id === contact.id;
                                                const unread = unreadCounts[contact.id] || 0;
                                                return (
                                                    <div 
                                                        key={contact.id}
                                                        onClick={() => setSelectedContact(contact)}
                                                        className={`pmm-contact-item ${isSelected ? 'active' : ''}`}
                                                    >
                                                        <div className="pmm-avatar">
                                                            <User size={20} />
                                                        </div>
                                                        <div className="pmm-contact-info">
                                                            <div className="pmm-contact-name">
                                                                {contact.first_name} {contact.last_name}
                                                            </div>
                                                            <div className="pmm-contact-sub">{contact.subtitle}</div>
                                                        </div>
                                                        {unread > 0 && (
                                                            <span className="pmm-unread-badge">{unread}</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {nurseContacts.length > 0 && (
                                        <div style={{ marginTop: studentContacts.length > 0 ? '8px' : '0' }}>
                                            <div className="pmm-section-header">CLINIC STAFF</div>
                                            {nurseContacts.map((contact) => {
                                                const isSelected = selectedContact && selectedContact.id === contact.id;
                                                const unread = unreadCounts[contact.id] || 0;
                                                return (
                                                    <div 
                                                        key={contact.id}
                                                        onClick={() => setSelectedContact(contact)}
                                                        className={`pmm-contact-item ${isSelected ? 'active' : ''}`}
                                                    >
                                                        <div className="pmm-avatar">
                                                            <ShieldCheck size={20} />
                                                        </div>
                                                        <div className="pmm-contact-info">
                                                            <div className="pmm-contact-name">
                                                                {contact.first_name} {contact.last_name}
                                                            </div>
                                                            <div className="pmm-contact-sub">{contact.subtitle}</div>
                                                        </div>
                                                        {unread > 0 && (
                                                            <span className="pmm-unread-badge">{unread}</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Chat Window */}
                    <div className="pmm-chat-area">
                        {selectedContact ? (
                            <>
                                {/* Chat Header */}
                                <div className="pmm-chat-header">
                                    <div className="pmm-avatar">
                                        {selectedContact.type === 'nurse' ? <ShieldCheck size={20} /> : <User size={20} />}
                                    </div>
                                    <div>
                                        <h3>{selectedContact.first_name} {selectedContact.last_name}</h3>
                                        <span className="pmm-status-text">{selectedContact.subtitle.toUpperCase()}</span>
                                    </div>
                                </div>

                                {!selectedContact.hasValidUserAccount && (
                                    <div style={{
                                        backgroundColor: '#fffbe6',
                                        border: '1px solid #ffe58f',
                                        padding: '8px 16px',
                                        fontSize: '0.82rem',
                                        color: '#d46b08',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <AlertCircle size={16} />
                                        <span>Warning: This staff record lacks a user account link (`user_id`). Messaging may fail until linked.</span>
                                    </div>
                                )}

                                {/* Messages Container */}
                                <div className="pmm-messages-container">
                                    {isLoadingThread ? (
                                        <div className="pmm-empty-thread" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '40px 0' }}>
                                            <Loader2 size={28} className="pmm-spin" style={{ color: '#003366' }} />
                                            <span style={{ color: '#666', fontSize: '0.88rem' }}>Loading conversation...</span>
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="pmm-empty-thread">
                                            No messages yet. Send a message to start the conversation.
                                        </div>
                                    ) : (
                                        messages.map((msg) => {
                                            const isMe = String(msg.sender_id) === String(userId);
                                            const isUnsent = msg.is_deleted || msg.content === 'You unsent a message';

                                            return (
                                                <div 
                                                    key={msg.message_id || msg.created_at}
                                                    className={`pmm-msg-wrapper ${isMe ? 'sent' : 'received'}`}
                                                >
                                                    {isMe && !isUnsent && (
                                                        <div className="pmm-msg-actions-wrapper">
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveMenuId(activeMenuId === msg.message_id ? null : msg.message_id);
                                                                }}
                                                                className="pmm-msg-more-btn"
                                                            >
                                                                <MoreVertical size={16} />
                                                            </button>
                                                            {activeMenuId === msg.message_id && (
                                                                <div className="pmm-msg-dropdown">
                                                                    <button 
                                                                        onClick={() => handleDeleteMessage(msg.message_id)}
                                                                        className="pmm-unsend-btn"
                                                                    >
                                                                        <Trash2 size={14} /> Unsend
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className={`pmm-msg-bubble ${isUnsent ? 'unsent' : ''}`}>
                                                        {isUnsent ? (
                                                            <p className="pmm-unsent-text">{isMe ? 'You unsent a message' : 'Message unsent'}</p>
                                                        ) : (
                                                            <>
                                                                {msg.content && <p>{msg.content}</p>}

                                                                {msg.message_type === 'image' && msg.media_url && (
                                                                    <img 
                                                                        src={`http://localhost:3001${msg.media_url}`} 
                                                                        alt="attachment" 
                                                                        className="pmm-msg-media" 
                                                                    />
                                                                )}

                                                                {msg.message_type === 'video' && msg.media_url && (
                                                                    <video 
                                                                        controls 
                                                                        src={`http://localhost:3001${msg.media_url}`} 
                                                                        className="pmm-msg-media" 
                                                                    />
                                                                )}

                                                                {msg.message_type === 'audio' && msg.media_url && (
                                                                    <audio 
                                                                        controls 
                                                                        src={`http://localhost:3001${msg.media_url}`} 
                                                                        className="pmm-msg-audio" 
                                                                    />
                                                                )}

                                                                {msg.message_type === 'file' && msg.media_url && (
                                                                    <a 
                                                                        href={`http://localhost:3001${msg.media_url}`} 
                                                                        target="_blank" 
                                                                        rel="noreferrer" 
                                                                        className="pmm-msg-file-link"
                                                                    >
                                                                        <FileText size={16} /> Download File
                                                                    </a>
                                                                )}

                                                                <div className="pmm-msg-footer-info">
                                                                    <span className="pmm-time-stamp">
                                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Media Attachment Preview Bar */}
                                {attachment && (
                                    <div className="pmm-attachment-bar">
                                        <span>Attachment: <strong>{attachment.name}</strong> ({attachmentType})</span>
                                        <button type="button" onClick={clearAttachment} className="pmm-attachment-clear-btn">✕</button>
                                    </div>
                                )}

                                {/* Input Form */}
                                <form onSubmit={handleSendMessage} className="pmm-input-form">
                                    <div className="pmm-controls-row">
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            style={{ display: 'none' }} 
                                            onChange={handleFileSelect} 
                                        />

                                        <button 
                                            type="button" 
                                            onClick={() => triggerFilePicker('image', 'image/*')} 
                                            title="Attach Image"
                                            className="pmm-media-btn"
                                            disabled={!selectedContact.contact_user_id || isSending}
                                        >
                                            <Image size={20} />
                                        </button>

                                        <button 
                                            type="button" 
                                            onClick={() => triggerFilePicker('video', 'video/*')} 
                                            title="Attach Video"
                                            className="pmm-media-btn"
                                            disabled={!selectedContact.contact_user_id || isSending}
                                        >
                                            <Video size={20} />
                                        </button>

                                        <button 
                                            type="button" 
                                            onClick={() => triggerFilePicker('file', '*/*')} 
                                            title="Attach Document"
                                            className="pmm-media-btn"
                                            disabled={!selectedContact.contact_user_id || isSending}
                                        >
                                            <Paperclip size={20} />
                                        </button>

                                        {!isRecording ? (
                                            <button 
                                                type="button" 
                                                onClick={startRecording} 
                                                title="Record Audio"
                                                className="pmm-media-btn"
                                                disabled={!selectedContact.contact_user_id || isSending}
                                            >
                                                <Mic size={20} />
                                            </button>
                                        ) : (
                                            <button 
                                                type="button" 
                                                onClick={stopRecording} 
                                                title="Stop Recording"
                                                className="pmm-media-btn recording"
                                            >
                                                <Square size={20} color="red" />
                                            </button>
                                        )}

                                        <input 
                                            type="text"
                                            value={inputContent}
                                            onChange={(e) => setInputContent(e.target.value)}
                                            placeholder={
                                                isSending 
                                                    ? "Sending message..." 
                                                    : selectedContact.contact_user_id 
                                                        ? "Type a message..." 
                                                        : "Contact cannot receive messages"
                                            }
                                            disabled={!selectedContact.contact_user_id || isSending}
                                            className="pmm-message-input"
                                        />

                                        <button 
                                            type="submit"
                                            disabled={(!inputContent.trim() && !attachment) || !selectedContact.contact_user_id || isSending}
                                            className="pmm-send-btn"
                                            title={isSending ? "Sending message..." : "Send message"}
                                        >
                                            {isSending ? (
                                                <Loader2 size={18} className="pmm-spin" />
                                            ) : (
                                                <Send size={18} />
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <div className="pmm-empty-chat-placeholder">
                                <User size={48} />
                                <h3>Select a contact to view conversation</h3>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ParentMessageModal;