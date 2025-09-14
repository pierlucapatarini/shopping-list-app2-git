import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

function FamilyChat() {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [familyGroup, setFamilyGroup] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [realtimeStatus, setRealtimeStatus] = useState('DISCONNECTED');
    const [openFileOptionsId, setOpenFileOptionsId] = useState(null);
    const [familyMembers, setFamilyMembers] = useState([]);
    const [onlineMembers, setOnlineMembers] = useState([]);
    const [selectedDirectCallUser, setSelectedDirectCallUser] = useState('');
    const [incomingCall, setIncomingCall] = useState(null);
    const [isCalling, setIsCalling] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        let chatChannel = null;
        let presenceChannel = null;

        const initChatAndPresence = async () => {
            setLoading(true);
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) {
                    navigate('/login');
                    return;
                }
                setUser(user);

                const fg = user.user_metadata.family_group;
                if (!fg) return;
                setFamilyGroup(fg);

                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, username')
                    .eq('family_group', fg);
                setFamilyMembers(profilesData || []);

                const { data: messagesData } = await supabase
                    .from('messages')
                    .select('*, profiles:sender_id(username)')
                    .eq('family_group', fg)
                    .order('created_at', { ascending: true });
                setMessages(messagesData || []);
                scrollToBottom();

                presenceChannel = supabase
                    .channel('family-group-presence')
                    .on('presence', { event: 'sync' }, () => {
                        const state = presenceChannel.presenceState();
                        const onlineIds = Object.keys(state).map(key => state[key][0].id);
                        setOnlineMembers(onlineIds);
                    })
                    .subscribe(async (status) => {
                        if (status === 'SUBSCRIBED') {
                            await presenceChannel.track({ id: user.id, username: user.user_metadata.username });
                        }
                    });

                chatChannel = supabase
                    .channel(`messages-${fg}`)
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `family_group=eq.${fg}` }, (payload) => {
                        if (!payload.new) return;
                        if (payload.new.sender_id === user.id) return;
                        const senderUsername = profilesData?.find(m => m.id === payload.new.sender_id)?.username || 'Sconosciuto';
                        const newMsg = { ...payload.new, profiles: { username: senderUsername } };
                        setMessages(prev => [...prev, newMsg]);
                        scrollToBottom();
                    })
                    .on('broadcast', { event: 'direct-call-signal' }, ({ payload }) => {
                        if (payload.recipientId === user.id && payload.senderId !== user.id) {
                            const callerUsername = familyMembers.find(m => m.id === payload.senderId)?.username;
                            setIncomingCall({ callerId: payload.senderId, callerUsername });
                        }
                    })
                    .subscribe(status => setRealtimeStatus(status));

            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        initChatAndPresence();

        return () => {
            if (chatChannel) supabase.removeChannel(chatChannel);
            if (presenceChannel) supabase.removeChannel(presenceChannel);
        };
    }, []);

    useEffect(() => scrollToBottom(), [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() && !selectedFile) return;

        const messageData = {
            content: newMessage || '',
            family_group: familyGroup,
            sender_id: user.id,
            file_url: null,
            file_name: null,
            file_type: null,
        };

        setMessages(prev => [...prev, { ...messageData, id: Math.random(), created_at: new Date().toISOString(), profiles: { username: user.user_metadata.username } }]);
        setNewMessage('');

        await supabase.from('messages').insert(messageData);
    };

    const handleJoinVideoCall = (callerId) => {
        navigate('/video-chat-diretta', { state: { familyGroup, user, remoteUserId: callerId, isCaller: false } });
    };

    const renderMessageContent = (msg) => {
        const isCallMessage = msg.content.includes('sta provando a videochiamare');
        return (
            <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{msg.profiles?.username || 'Sconosciuto'}</div>
                <div>{msg.content}</div>
                {isCallMessage && (
                    <button onClick={() => handleJoinVideoCall(msg.sender_id)} style={{ marginTop: '8px', padding: '6px 12px', borderRadius: '8px', backgroundColor: '#34B7F1', color: 'white', border: 'none', cursor: 'pointer' }}>
                        📹 Rispondi alla chiamata
                    </button>
                )}
            </div>
        );
    };

    const isMyMessage = (id) => user && id === user.id;
    const formatTimestamp = (t) => t ? new Date(t).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {loading ? <div>⏳ Caricamento...</div> : messages.map(msg => (
                    <div key={msg.id} style={{ marginBottom: '10px', textAlign: isMyMessage(msg.sender_id) ? 'right' : 'left' }}>
                        <div style={{ fontSize: '0.75em', color: '#888', marginBottom: '4px' }}>{formatTimestamp(msg.created_at)}</div>
                        <div style={{ display: 'inline-block', padding: '10px', borderRadius: '12px', backgroundColor: isMyMessage(msg.sender_id) ? '#DCF8C6' : '#FFF' }}>
                            {renderMessageContent(msg)}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', padding: '15px', gap: '10px' }}>
                <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Scrivi un messaggio..." style={{ flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid #ddd' }} />
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '20px', backgroundColor: '#25D366', color: 'white', border: 'none' }}>➤</button>
            </form>
        </div>
    );
}

export default FamilyChat;
