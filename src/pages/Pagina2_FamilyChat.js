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

                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, username')
                    .eq('family_group', fg);
                if (profilesError) console.error('Errore nel recupero dei profili:', profilesError);
                setFamilyMembers(profilesData || []);

                const { data: messagesData, error: fetchError } = await supabase
                    .from('messages')
                    .select('*, profiles:sender_id(username)')
                    .eq('family_group', fg)
                    .order('created_at', { ascending: true });
                if (fetchError) console.error(fetchError);
                setMessages(messagesData || []);
                scrollToBottom();

                presenceChannel = supabase
                    .channel('family-group-presence')
                    .on('presence', { event: 'sync' }, () => {
                        const newState = presenceChannel.presenceState();
                        const newOnlineMembers = Object.keys(newState).map(key => newState[key][0].id);
                        setOnlineMembers(newOnlineMembers);
                    })
                    .on('presence', { event: 'join' }, ({ newPresences }) => {
                        const joinedIds = newPresences.map(p => p.id);
                        setOnlineMembers(prev => [...new Set([...prev, ...joinedIds])]);
                    })
                    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
                        const leftIds = leftPresences.map(p => p.id);
                        setOnlineMembers(prev => prev.filter(id => !leftIds.includes(id)));
                    })
                    .subscribe(async (status) => {
                        if (status === 'SUBSCRIBED' && user) {
                            await presenceChannel.track({ id: user.id, username: user.user_metadata.username });
                        }
                    });

                chatChannel = supabase
                    .channel(`messages-${fg}`)
                    .on(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'messages',
                            filter: `family_group=eq.${fg}`,
                        },
                        async (payload) => {
                            if (!payload.new) return;
                            
                            if (payload.new.sender_id === user.id) return;
                            
                            const senderUsername = profilesData?.find(m => m.id === payload.new.sender_id)?.username || 'Sconosciuto';
                            
                            const newMsg = {
                                ...payload.new,
                                profiles: { username: senderUsername },
                            };
                            setMessages((prev) => [...prev, newMsg]);
                            scrollToBottom();
                        }
                    )
                    .on('broadcast', { event: 'direct-call-signal' }, ({ payload }) => {
                        console.log('Ricevuto broadcast direct-call-signal:', payload); // Debug: verifica il payload ricevuto
                        if (payload.recipientId === user.id && payload.senderId !== user.id) {
                            const callerUsername = familyMembers.find(m => m.id === payload.senderId)?.username;
                            setIncomingCall({
                                callerId: payload.senderId,
                                callerUsername,
                            });
                            try {
                                const audio = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
                                audio.play().catch(e => console.error("Errore riproduzione audio:", e));
                            } catch (e) {
                                console.error("Errore creazione oggetto Audio:", e);
                            }
                        }
                    })
                    .subscribe((status) => {
                        setRealtimeStatus(status);
                    });

            } catch (error) {
                console.error('Errore durante l\'inizializzazione della chat:', error);
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

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const handleDocClick = () => setOpenFileOptionsId(null);
        document.addEventListener('click', handleDocClick);
        return () => document.removeEventListener('click', handleDocClick);
    }, []);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file && file.size <= 10 * 1024 * 1024) {
            setSelectedFile(file);
        } else {
            alert('Il file è troppo grande. Massimo 10MB.');
        }
    };

    const removeSelectedFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if ((!newMessage.trim() && !selectedFile) || !user || !familyGroup || uploadingFile) return;

        let fileUrl = null;
        let fileName = selectedFile?.name || null;
        let fileType = selectedFile?.type || null;

        if (selectedFile) {
            setUploadingFile(true);
            try {
                const fileExt = fileName.split('.').pop();
                const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('chat-files')
                    .upload(`${familyGroup}/${uniqueFileName}`, selectedFile);
                if (uploadError) throw new Error('Errore nel caricamento del file.');
                const { data: { publicUrl } } = supabase.storage
                    .from('chat-files')
                    .getPublicUrl(`${familyGroup}/${uniqueFileName}`);
                fileUrl = publicUrl;
            } catch (error) {
                console.error(error.message);
                alert(error.message);
                setUploadingFile(false);
                return;
            } finally {
                setUploadingFile(false);
            }
        }
        
        const messageData = {
            content: newMessage || (fileName ? `📎 ${fileName}` : ''),
            family_group: familyGroup,
            sender_id: user.id,
            file_url: fileUrl,
            file_name: fileName,
            file_type: fileType,
        };
        
        setMessages((prev) => [
            ...prev,
            {
                ...messageData,
                id: Math.random(),
                created_at: new Date().toISOString(),
                profiles: { username: user.user_metadata.username || 'Tu' },
            },
        ]);

        setNewMessage('');
        setSelectedFile(null);
        scrollToBottom();

        const { error } = await supabase
            .from('messages')
            .insert(messageData);

        if (error) {
            console.error('Errore nell\'invio del messaggio:', error);
        }
    };

    const renderFilePreview = () => {
        if (!selectedFile) return null;
        const isImage = selectedFile.type.startsWith('image/');

        return (
            <div style={{
                position: 'absolute', bottom: '100%', left: '0', right: '0', backgroundColor: 'white',
                padding: '15px 20px', borderTop: '1px solid #ddd', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', maxWidth: '1200px', margin: '0 auto' }}>
                    {isImage ? (
                        <img src={URL.createObjectURL(selectedFile)} alt="Anteprima"
                            style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #ddd' }}
                        />
                    ) : (
                        <div style={{
                            width: '60px', height: '60px', backgroundColor: '#f0f0f0', borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', border: '2px solid #ddd'
                        }}>📄</div>
                    )}
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#333' }}>{selectedFile.name}</div>
                        <div style={{ fontSize: '0.9em', color: '#666' }}>
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                    </div>
                    <button onClick={removeSelectedFile}
                        style={{
                            width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#ff4444',
                            color: 'white', border: 'none', cursor: 'pointer', fontSize: '18px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>×</button>
                </div>
            </div>
        );
    };

    const handleClickFile = (e, msgId) => {
        e.stopPropagation();
        setOpenFileOptionsId(prev => prev === msgId ? null : msgId);
    };

    const handleVisualizza = (e, fileUrl) => {
        e.stopPropagation();
        if (fileUrl) window.open(fileUrl, '_blank', 'noopener,noreferrer');
        setOpenFileOptionsId(null);
    };

    const handleArchivia = (e, file) => {
        e.stopPropagation();
        setOpenFileOptionsId(null);
        navigate('/pagina8-archivio-documenti', {
            state: { 
                fileToArchive: {
                    fileName: file.file_name, 
                    fileUrl: file.file_url
                } 
            }
        });
    };

    const renderMessageContent = (msg) => {
        const hasFile = msg.file_url && msg.file_name;
        const isImage = hasFile && msg.file_type?.startsWith('image/');
        const isAutoMessage = msg.sender_id === 'SYSTEM' || !msg.profiles?.username;

        return (
            <div>
                {!isAutoMessage && (
                    <div style={{
                        fontWeight: 'bold', fontSize: '0.85em',
                        color: isMyMessage(msg.sender_id) ? '#0a5f26' : '#0366d6', marginBottom: '4px'
                    }}>
                        {msg.profiles?.username || 'Sconosciuto'}
                    </div>
                )}
                {hasFile && (
                    <div style={{ marginBottom: msg.content && msg.content !== `📎 ${msg.file_name}` ? '8px' : '0', cursor: 'pointer' }}
                        onClick={(e) => handleClickFile(e, msg.id)}>
                        {isImage ? (
                            <img src={msg.file_url} alt={msg.file_name}
                                style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', display: 'block' }}
                            />
                        ) : (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px', padding: '8px',
                                backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '8px',
                            }}>
                                <div style={{ fontSize: '24px' }}>📄</div>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.9em' }}>{msg.file_name}</div>
                                    <div style={{ fontSize: '0.8em', color: '#666' }}>Clicca per opzioni</div>
                                </div>
                            </div>
                        )}
                        {openFileOptionsId === msg.id && (
                            <div style={{ marginTop: '8px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button onClick={(e) => handleVisualizza(e, msg.file_url)}
                                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', background: 'white', cursor: 'pointer' }}>
                                    👁️ Visualizza
                                </button>
                                <button onClick={(e) => handleArchivia(e, msg)}
                                    style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#25D366', color: 'white', cursor: 'pointer' }}>
                                    📥 Archivia
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {msg.content && (
                    <div style={{ fontSize: '1em', lineHeight: '1.4', margin: 0 }}>{msg.content}</div>
                )}
            </div>
        );
    };

    const isMyMessage = (messageSenderId) => user && messageSenderId === user.id;
    const isSystemMessage = (messageSenderId) => messageSenderId === 'SYSTEM';

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handleDirectCall = () => {
        if (!selectedDirectCallUser || selectedDirectCallUser === user.id) {
            alert('Per avviare una chiamata diretta, devi selezionare un altro membro della famiglia.');
            return;
        }
        setIsCalling(true);
    };

    const handleConfirmCall = async () => {
        setIsCalling(false);
        if (!user || !familyGroup || !selectedDirectCallUser) return;

        const calleeUsername = familyMembers.find(m => m.id === selectedDirectCallUser)?.username;
        const callerUsername = user.user_metadata.username;

        // Step 1: Invia un messaggio automatico nella chat (ora usa l'ID utente valido)
        await supabase
            .from('messages')
            .insert({
                content: `${callerUsername} sta provando a videochiamare ${calleeUsername}.`,
                family_group: familyGroup,
                sender_id: user.id, // Corretto: ora usa l'ID dell'utente corrente
            });

        // Step 2: Invia il segnale di chiamata tramite broadcast
        const channel = supabase.channel(`direct-call-signal-${familyGroup}`);
        await channel.subscribe();
        channel.send({
            type: 'broadcast',
            event: 'direct-call-signal',
            payload: {
                senderId: user.id,
                recipientId: selectedDirectCallUser,
            }
        });
        
        // Step 3: Reindirizza il chiamante alla pagina della chiamata
        navigate('/video-chat-diretta', { state: { familyGroup, user, remoteUserId: selectedDirectCallUser, isCaller: true } });
    };

    const handleCancelCall = () => {
        setIsCalling(false);
    };

    const handleAcceptCall = () => {
        setIncomingCall(null);
        navigate('/video-chat-diretta', {
            state: { familyGroup, user, remoteUserId: incomingCall.callerId, isCaller: false }
        });
    };

    const handleRejectCall = () => {
        setIncomingCall(null);
    };

    return (
        <div style={{ height: '100vh', backgroundColor: '#e5ddd5', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-opacity='0.03'%3E%3Cpolygon fill='%23000' points='50 0 60 40 100 50 60 60 50 100 40 60 0 50 40 40'/%3E%3C/g%3E%3C/svg%3E")`
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px',
                backgroundColor: '#075E54', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 1000, flexWrap: 'wrap'
            }}>
                <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', color: 'white' }}>
                    <h1 style={{ fontSize: '1.6em', margin: 0 }}>💬 Patarini's Social Chat 15.0.1</h1>
                    <div style={{ fontSize: '0.8em', marginBottom: '5px' }}>Stato in tempo reale: {realtimeStatus}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px' }}>
                        {familyMembers.map((member) => {
                            const isOnline = onlineMembers.includes(member.id);
                            let memberColor = '#007bff';
                            if (member.id === user?.id) memberColor = '#25D366';
                            else if (isOnline) memberColor = '#FFC107';

                            return (
                                <div key={member.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    backgroundColor: memberColor,
                                    borderRadius: '15px', padding: '4px 10px', fontWeight: 'bold',
                                    fontSize: '0.85em', transition: 'background-color 0.3s ease'
                                }}>
                                    {member.username}
                                    <span style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        backgroundColor: 'white', border: '1px solid transparent', opacity: 1
                                    }}></span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '250px', alignItems: 'flex-end', marginTop: '10px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
                        <select onChange={(e) => setSelectedDirectCallUser(e.target.value)}
                            style={{ flex: 1, padding: '8px', borderRadius: '15px', border: 'none', outline: 'none' }}>
                            <option value="">Seleziona utente...</option>
                            {familyMembers.filter(m => m.id !== user?.id).map(member => (
                                <option key={member.id} value={member.id}>{member.username}</option>
                            ))}
                        </select>
                        <button onClick={handleDirectCall} disabled={!selectedDirectCallUser}
                            style={{ 
                                padding: '8px 15px', borderRadius: '20px', backgroundColor: '#34B7F1',
                                color: 'white', border: 'none', cursor: selectedDirectCallUser ? 'pointer' : 'not-allowed',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.2)', fontWeight: 'bold', fontSize: '0.9em',
                                transition: 'all 0.3s ease', opacity: selectedDirectCallUser ? 1 : 0.6
                            }}>
                            📞 Singolo
                        </button>
                    </div>
                    <button onClick={() => alert('La videochiamata di gruppo non è ancora implementata con una soluzione gratuita.')} 
                        style={{ 
                            padding: '8px 15px', borderRadius: '20px', backgroundColor: '#87CEEB',
                            color: 'white', border: 'none', cursor: 'pointer', width: '100%',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)', fontWeight: 'bold', fontSize: '0.9em',
                            transition: 'all 0.3s ease'
                        }}>
                        📞 Gruppo
                    </button>

                     
                    <button onClick={() => navigate('/video-chat-diretta')} 
                        style={{ 
                            padding: '8px 15px', borderRadius: '20px', backgroundColor: '#128C7E',
                            color: 'white', border: 'none', cursor: 'pointer', width: '100%',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)', fontWeight: 'bold', fontSize: '0.9em',
                            transition: 'all 0.3s ease'
                        }}>
                        ← SottoPagina2Videochiamata
                    </button>








                    
                    <button onClick={() => navigate('/main-menu')} 
                        style={{ 
                            padding: '8px 15px', borderRadius: '20px', backgroundColor: '#128C7E',
                            color: 'white', border: 'none', cursor: 'pointer', width: '100%',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)', fontWeight: 'bold', fontSize: '0.9em',
                            transition: 'all 0.3s ease'
                        }}>
                        ← Menu
                    </button>




                </div>
            </div>

            <div style={{ 
                flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column',
                gap: '12px', paddingBottom: '100px'
            }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                        <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '15px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', color: '#666'
                        }}>⏳ Caricamento messaggi...</div>
                    </div>
                ) : (
                    messages.length === 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                            <div style={{ padding: '30px', backgroundColor: 'rgba(255,255,255,0.9)',
                                borderRadius: '20px', boxShadow: '0 44px 15px rgba(0,0,0,0.1)',
                                textAlign: 'center', color: '#666'
                            }}>
                                <div style={{ fontSize: '2em', marginBottom: '10px' }}>💭</div>
                                <div>Inizia la conversazione con la tua famiglia!</div>
                            </div>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div key={msg.id} style={{ width: '100%' }}>
                                <div style={{ display: 'block', margin: '0 auto', color: '#888', fontSize: '0.75em',
                                    marginBottom: '8px', backgroundColor: 'rgba(255,255,255,0.7)',
                                    padding: '4px 12px', borderRadius: '12px', width: 'fit-content',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}>{formatTimestamp(msg.created_at)}</div>
                                
                                <div style={{
                                    display: 'flex', alignItems: 'flex-end', gap: '8px',
                                    flexDirection: isMyMessage(msg.sender_id) ? 'row-reverse' : 'row',
                                    marginBottom: '5px'
                                }}>
                                    <div style={{
                                        width: '35px', height: '35px', borderRadius: '50%',
                                        backgroundColor: isMyMessage(msg.sender_id) ? '#25D366' : '#34B7F1',
                                        color: 'white', display: 'flex', justifyContent: 'center',
                                        alignItems: 'center', fontWeight: 'bold', fontSize: '1.1em',
                                        flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', border: '2px solid white'
                                    }}>{msg.profiles?.username?.[0]?.toUpperCase() || '?'}</div>
                                    
                                    <div style={{
                                        position: 'relative', maxWidth: '75%', padding: '12px 16px',
                                        borderRadius: isMyMessage(msg.sender_id) ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
                                        backgroundColor: isMyMessage(msg.sender_id) ? '#DCF8C6' : 'white',
                                        color: '#333', boxShadow: '0 3px 8px rgba(0,0,0,0.15)', wordBreak: 'break-word',
                                        border: isMyMessage(msg.sender_id) ? 'none' : '1px solid #e0e0e0'
                                    }}>
                                        <div style={{
                                            position: 'absolute', bottom: '0',
                                            [isMyMessage(msg.sender_id) ? 'right' : 'left']: '-8px',
                                            width: '0', height: '0', borderStyle: 'solid',
                                            borderWidth: isMyMessage(msg.sender_id) ? '0 15px 15px 0' : '0 0 15px 15px',
                                            borderColor: isMyMessage(msg.sender_id) ? 
                                                'transparent #DCF8C6 transparent transparent' : 
                                                'transparent transparent white transparent',
                                            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))'
                                        }}></div>
                                        {renderMessageContent(msg)}
                                    </div>
                                </div>
                            </div>
                        ))
                    )
                )}
                <div ref={messagesEndRef} />
            </div>

            <div style={{
                position: 'fixed', bottom: '0', left: '0', right: '0', backgroundColor: '#f0f0f0',
                borderTop: '1px solid #ddd', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', zIndex: 1000
            }}>
                {selectedFile && renderFilePreview()}
                <div style={{ padding: '15px 20px' }}>
                    <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
                        <div style={{ position: 'relative' }}>
                            <input ref={fileInputRef} type="file" onChange={handleFileSelect}
                                accept="image/*,application/pdf,.doc,.docx,.txt" style={{ display: 'none' }}
                            />
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}
                                style={{ 
                                    width: '45px', height: '45px', borderRadius: '50%',
                                    backgroundColor: selectedFile ? '#25D366' : '#6c757d', color: 'white',
                                    border: 'none', cursor: uploadingFile ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', fontSize: '1.2em',
                                    transition: 'all 0.3s ease', opacity: uploadingFile ? 0.6 : 1
                                }}
                                onMouseOver={(e) => { if (!uploadingFile) { e.target.style.backgroundColor = selectedFile ? '#20b858' : '#5a6268'; e.target.style.transform = 'scale(1.1)'; }}}
                                onMouseOut={(e) => { if (!uploadingFile) { e.target.style.backgroundColor = selectedFile ? '#25D366' : '#6c757d'; e.target.style.transform = 'scale(1)'; }}}
                            >{uploadingFile ? '⏳' : '📎'}</button>
                        </div>
                        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={selectedFile ? `Messaggio per ${selectedFile.name}` : "Scrivi un messaggio..."}
                            disabled={uploadingFile}
                            style={{ 
                                flex: 1, padding: '12px 18px', borderRadius: '25px', border: '2px solid #ddd',
                                fontSize: '1em', outline: 'none', backgroundColor: uploadingFile ? '#f8f8f8' : 'white',
                                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)', transition: 'border-color 0.3s ease',
                                opacity: uploadingFile ? 0.7 : 1
                            }}
                            onFocus={(e) => !uploadingFile && (e.target.style.borderColor = '#25D366')}
                            onBlur={(e) => e.target.style.borderColor = '#ddd'}
                        />
                        <button type="submit" disabled={(!newMessage.trim() && !selectedFile) || uploadingFile}
                            style={{ 
                                width: '50px', height: '50px', borderRadius: '50%',
                                backgroundColor: (newMessage.trim() || selectedFile) && !uploadingFile ? '#25D366' : '#ccc',
                                color: 'white', border: 'none', cursor: (newMessage.trim() || selectedFile) && !uploadingFile ? 'pointer' : 'not-allowed',
                                boxShadow: (newMessage.trim() || selectedFile) && !uploadingFile ? '0 3px 10px rgba(37, 211, 102, 0.4)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2em',
                                transition: 'all 0.3s ease', transform: (newMessage.trim() || selectedFile) && !uploadingFile ? 'scale(1.05)' : 'scale(1)'
                            }}
                            onMouseOver={(e) => { if ((newMessage.trim() || selectedFile) && !uploadingFile) { e.target.style.backgroundColor = '#20b858'; e.target.style.transform = 'scale(1.1)'; }}}
                            onMouseOut={(e) => { if ((newMessage.trim() || selectedFile) && !uploadingFile) { e.target.style.backgroundColor = '#25D366'; e.target.style.transform = 'scale(1.05)'; }}}
                        >{uploadingFile ? '⏳' : '➤'}</button>
                    </form>
                </div>
            </div>

            {/* Pop-up per la chiamata in arrivo */}
            {incomingCall && (
                <div style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    backgroundColor: 'white', padding: '30px', borderRadius: '15px', boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                    zIndex: 2000, textAlign: 'center', width: '300px'
                }}>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '15px' }}>
                        Chiamata in arrivo da {incomingCall.callerUsername}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', gap: '10px' }}>
                        <button onClick={handleAcceptCall} style={{
                            padding: '10px 20px', borderRadius: '20px', backgroundColor: '#25D366', color: 'white',
                            border: 'none', cursor: 'pointer', fontWeight: 'bold'
                        }}>Accetta</button>
                        <button onClick={handleRejectCall} style={{
                            padding: '10px 20px', borderRadius: '20px', backgroundColor: '#ff4d4f', color: 'white',
                            border: 'none', cursor: 'pointer', fontWeight: 'bold'
                        }}>Rifiuta</button>
                    </div>
                </div>
            )}
            
            {/* Nuovo pop-up per avviso al chiamante */}
            {isCalling && (
                <div style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    backgroundColor: 'white', padding: '30px', borderRadius: '15px', boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                    zIndex: 2000, textAlign: 'center', width: '300px'
                }}>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '15px' }}>
                        Avviso importante!
                    </div>
                    <div style={{ fontSize: '1em', marginBottom: '20px' }}>
                        Assicurati che l'utente ricevente abbia l'app aperta sulla pagina della chat per ricevere la notifica di chiamata.
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', gap: '10px' }}>
                        <button onClick={handleConfirmCall} style={{
                            padding: '10px 20px', borderRadius: '20px', backgroundColor: '#34B7F1', color: 'white',
                            border: 'none', cursor: 'pointer', fontWeight: 'bold'
                        }}>Ho capito, chiama</button>
                        <button onClick={handleCancelCall} style={{
                            padding: '10px 20px', borderRadius: '20px', backgroundColor: '#ff4d4f', color: 'white',
                            border: 'none', cursor: 'pointer', fontWeight: 'bold'
                        }}>Annulla</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FamilyChat;