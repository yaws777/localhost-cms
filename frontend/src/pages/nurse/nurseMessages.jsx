import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
    Search, Image, Paperclip, Mic, Video, Send, 
    Square, User, FileText, Trash2, MoreVertical, MoreHorizontal 
} from 'lucide-react';
import '../../styles/nurse/NurseMessages.css';

const NurseMessages = () => {
    const { userId, refreshUnreadCount } = useOutletContext();
    const [conversations, setConversations] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContact, setSelectedContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [textInput, setTextInput] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [attachmentType, setAttachmentType] = useState('text');
    
    // Popover Menu States
    const [activeMenuId, setActiveMenuId] = useState(null); // Message actions
    const [activeConvMenuId, setActiveConvMenuId] = useState(null); // Sidebar conversation actions
    
    // Voice Recording state
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const pendingTypeRef = useRef('text');

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchConversations = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await fetch(`http://localhost:3001/api/messages/conversations/${userId}`);
            const data = await res.json();
            if (data.success) {
                setConversations(data.conversations);
            }
        } catch (err) {
            console.error('Error fetching conversations:', err);
        }
    }, [userId]);

    useEffect(() => {
        fetchConversations();
        const interval = setInterval(fetchConversations, 4000);
        return () => clearInterval(interval);
    }, [fetchConversations]);

    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (query.trim().length === 0) {
            setSearchResults([]);
            return;
        }
        try {
            const res = await fetch(`http://localhost:3001/api/messages/contacts?search=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.success) {
                setSearchResults(data.contacts);
            }
        } catch (err) {
            console.error('Error searching contacts:', err);
        }
    };

    const selectConversation = async (contact) => {
        setActiveConvMenuId(null);
        const contactUserId = contact.user_id || contact.contact_user_id;
        setSelectedContact({
            user_id: contactUserId,
            first_name: contact.first_name,
            last_name: contact.last_name,
            role: contact.role
        });

        fetchChatHistory(contactUserId);

        try {
            await fetch(`http://localhost:3001/api/messages/read/${userId}/${contactUserId}`, { method: 'PUT' });
            fetchConversations();
            if (refreshUnreadCount) refreshUnreadCount();
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    const fetchChatHistory = async (contactUserId) => {
        try {
            const res = await fetch(`http://localhost:3001/api/messages/history/${userId}/${contactUserId}`);
            const data = await res.json();
            if (data.success) {
                setMessages(data.messages);
            }
        } catch (err) {
            console.error('Error fetching chat history:', err);
        }
    };

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
                fetchConversations();
            } else {
                alert('Failed to delete message.');
            }
        } catch (err) {
            console.error('Error deleting message:', err);
        }
    };

    const handleDeleteConversation = async (e, contactUserId) => {
        e.stopPropagation();
        setActiveConvMenuId(null);
        if (!window.confirm('Delete this conversation? This cannot be undone.')) return;

        try {
            const res = await fetch(`http://localhost:3001/api/messages/conversations/${userId}/${contactUserId}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (data.success) {
                setConversations((prev) => prev.filter((c) => String(c.contact_user_id) !== String(contactUserId)));
                if (String(selectedContact?.user_id) === String(contactUserId)) {
                    setSelectedContact(null);
                    setMessages([]);
                }
            } else {
                alert('Failed to delete conversation.');
            }
        } catch (err) {
            console.error('Error deleting conversation:', err);
        }
    };

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

    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!userId || !selectedContact?.user_id) {
            alert('Sender or Receiver ID is missing.');
            return;
        }

        if (!textInput.trim() && !attachment) return;

        const formData = new FormData();
        formData.append('sender_id', userId);
        formData.append('receiver_id', selectedContact.user_id);
        formData.append('message_type', attachment ? attachmentType : 'text');
        formData.append('content', textInput.trim());
        
        if (attachment) {
            formData.append('media', attachment);
        }

        try {
            const res = await fetch('http://localhost:3001/api/messages/send', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (data.success) {
                setMessages((prev) => [...prev, data.message]);
                setTextInput('');
                clearAttachment();
                fetchConversations();
            } else {
                console.error('Server error sending message:', data.message);
                alert(`Message error: ${data.message || 'Failed to send message.'}`);
            }
        } catch (err) {
            console.error('Network error sending message:', err);
            alert('Server unreachable or network connection error.');
        }
    };

    return (
        <div className="messenger-container" onClick={() => { setActiveMenuId(null); setActiveConvMenuId(null); }}>
            {/* LEFT PANEL */}
            <div className="messenger-sidebar">
                <div className="messenger-search-box">
                    <Search className="search-icon" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search student or parent..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>

                <div className="conversations-list">
                    {searchQuery.trim().length > 0 ? (
                        <div className="search-results">
                            <span className="section-title">Search Results</span>
                            {searchResults.length === 0 && <p className="no-result">No contacts found.</p>}
                            {searchResults.map((contact) => (
                                <div 
                                    key={contact.user_id} 
                                    className="conversation-item"
                                    onClick={() => selectConversation(contact)}
                                >
                                    <div className="avatar"><User size={20} /></div>
                                    <div className="details">
                                        <h4>{contact.first_name} {contact.last_name}</h4>
                                        <span className="role-tag">{contact.role} ({contact.detail || 'N/A'})</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="recent-conversations">
                            <span className="section-title">Chats</span>
                            {conversations.length === 0 && <p className="no-result">No recent conversations.</p>}
                            {conversations.map((conv) => (
                                <div 
                                    key={conv.contact_user_id} 
                                    className={`conversation-item ${String(selectedContact?.user_id) === String(conv.contact_user_id) ? 'active' : ''}`}
                                    onClick={() => selectConversation(conv)}
                                >
                                    <div className="avatar"><User size={20} /></div>
                                    <div className="details">
                                        <div className="header-row">
                                            <h4>{conv.first_name} {conv.last_name}</h4>
                                            <span className="timestamp">
                                                {new Date(conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="message-preview-row">
                                            <p className={`preview ${conv.unread_count > 0 ? 'unread' : ''}`}>
                                                {conv.message_type !== 'text' ? `[${conv.message_type}]` : conv.content}
                                            </p>
                                            {conv.unread_count > 0 && (
                                                <span className="chat-unread-badge">{conv.unread_count}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Messenger Sidebar Hover Action Menu */}
                                    <div className="conv-action-container">
                                        <button 
                                            className="conv-more-btn"
                                            title="Options"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveConvMenuId(activeConvMenuId === conv.contact_user_id ? null : conv.contact_user_id);
                                            }}
                                        >
                                            <MoreHorizontal size={18} />
                                        </button>

                                        {/* Dropdown Popover */}
                                        {activeConvMenuId === conv.contact_user_id && (
                                            <div className="conv-dropdown-menu">
                                                <button onClick={(e) => handleDeleteConversation(e, conv.contact_user_id)}>
                                                    <Trash2 size={14} /> Delete Chat
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="messenger-chat-area">
                {selectedContact ? (
                    <>
                        <div className="chat-header">
                            <div className="avatar"><User size={20} /></div>
                            <div>
                                <h3>{selectedContact.first_name} {selectedContact.last_name}</h3>
                                <span className="status-text">{selectedContact.role.toUpperCase()}</span>
                            </div>
                        </div>

                        <div className="chat-body">
                            {messages.map((msg) => {
                                const isSender = String(msg.sender_id) === String(userId);
                                const isUnsent = msg.is_deleted || msg.content === 'You unsent a message';

                                return (
                                    <div key={msg.message_id} className={`message-bubble-wrapper ${isSender ? 'sent' : 'received'}`}>
                                        {!isUnsent && (
                                            <div className="msg-action-container">
                                                <button 
                                                    className="msg-more-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveMenuId(activeMenuId === msg.message_id ? null : msg.message_id);
                                                    }}
                                                >
                                                    <MoreVertical size={16} />
                                                </button>

                                                {activeMenuId === msg.message_id && (
                                                    <div className="msg-dropdown-menu">
                                                        <button onClick={() => handleDeleteMessage(msg.message_id)}>
                                                            <Trash2 size={14} /> Unsend
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className={`message-bubble ${isUnsent ? 'unsent' : ''}`}>
                                            {isUnsent ? (
                                                <p className="unsent-text">{isSender ? 'You unsent a message' : 'Message unsent'}</p>
                                            ) : (
                                                <>
                                                    {msg.content && <p>{msg.content}</p>}
                                                    
                                                    {msg.message_type === 'image' && msg.media_url && (
                                                        <img src={`http://localhost:3001${msg.media_url}`} alt="attachment" className="chat-image-preview" />
                                                    )}
                                                    
                                                    {msg.message_type === 'video' && msg.media_url && (
                                                        <video controls src={`http://localhost:3001${msg.media_url}`} className="chat-video-preview" />
                                                    )}

                                                    {msg.message_type === 'audio' && msg.media_url && (
                                                        <audio controls src={`http://localhost:3001${msg.media_url}`} />
                                                    )}

                                                    {msg.message_type === 'file' && msg.media_url && (
                                                        <a href={`http://localhost:3001${msg.media_url}`} target="_blank" rel="noreferrer" className="file-attachment-link">
                                                            <FileText size={16} /> Download File
                                                        </a>
                                                    )}

                                                    <div className="message-footer-info">
                                                        <span className="time-stamp">
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Footer Controls */}
                        <form className="chat-footer" onSubmit={handleSendMessage}>
                            {attachment && (
                                <div className="attachment-preview-bar">
                                    <span>Attachment: {attachment.name} ({attachmentType})</span>
                                    <button type="button" onClick={clearAttachment}>✕</button>
                                </div>
                            )}

                            <div className="controls-row">
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    style={{ display: 'none' }} 
                                    onChange={handleFileSelect} 
                                />

                                <button 
                                    type="button" 
                                    className="media-btn" 
                                    title="Send Image" 
                                    onClick={() => triggerFilePicker('image', 'image/*')}
                                >
                                    <Image size={20} />
                                </button>

                                <button 
                                    type="button" 
                                    className="media-btn" 
                                    title="Send Video" 
                                    onClick={() => triggerFilePicker('video', 'video/*')}
                                >
                                    <Video size={20} />
                                </button>

                                <button 
                                    type="button" 
                                    className="media-btn" 
                                    title="Send File" 
                                    onClick={() => triggerFilePicker('file', '*/*')}
                                >
                                    <Paperclip size={20} />
                                </button>

                                {!isRecording ? (
                                    <button type="button" className="media-btn" title="Record Audio" onClick={startRecording}>
                                        <Mic size={20} />
                                    </button>
                                ) : (
                                    <button type="button" className="media-btn recording" title="Stop Recording" onClick={stopRecording}>
                                        <Square size={20} color="red" />
                                    </button>
                                )}

                                <input 
                                    type="text" 
                                    className="message-input"
                                    placeholder="Type a message..."
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                />

                                <button type="submit" className="send-btn">
                                    <Send size={18} />
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="empty-chat-placeholder">
                        <User size={48} />
                        <h3>Select a student or parent to start messaging</h3>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NurseMessages;