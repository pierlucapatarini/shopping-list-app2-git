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
    const chatContainerRef = useRef(null);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    const [openFileOptionsId, setOpenFileOptionsId] = useState(null);
    const [familyMembers, setFamilyMembers] = useState([]);
    const [onlineMembers, setOnlineMembers] = useState([]);
    const [selectedDirectCallUser, setSelectedDirectCallUser] = useState('');

    // Stato per debug
    const [realtimeStatus, setRealtimeStatus] = useState('DISCONNECTED');

    useEffect(() => {
        let chatChannel = null;
        let presenceChannel = null;

        const fetchInitialDataAndSubscribe = async () => {
            console.log('🚀 Inizializzazione FamilyChat...');
            setLoading(true);

            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError) {
                    console.error('❌ Errore autenticazione:', userError);
                    setLoading(false);
                    return;
                }

                if (!user) {
                    console.error('❌ Utente non autenticato');
                    setLoading(false);
                    return;
                }

                console.log('✅ Utente autenticato:', user.id);
                setUser(user);

                if (user && user.user_metadata && user.user_metadata.family_group) {
                    const userFamilyGroup = user.user_metadata.family_group;
                    console.log('👨‍👩‍👧‍👦 Family Group:', userFamilyGroup);
                    setFamilyGroup(userFamilyGroup);

                    // Carica i membri della famiglia
                    console.log('📋 Caricamento membri famiglia...');
                    const { data: profilesData, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, username')
                        .eq('family_group', userFamilyGroup);

                    if (profilesError) {
                        console.error('❌ Errore nel recupero dei profili:', profilesError);
                    } else {
                        console.log('✅ Membri famiglia caricati:', profilesData);
                        setFamilyMembers(profilesData || []);
                    }
                    
                    // Carica i messaggi iniziali
                    console.log('💬 Caricamento messaggi iniziali...');
                    const { data: messagesData, error: messagesError } = await supabase
                        .from('messages')
                        .select('*, profiles(username)')
                        .eq('family_group', userFamilyGroup)
                        .order('created_at', { ascending: true });

                    if (messagesError) {
                        console.error('❌ Errore nel recupero dei messaggi:', messagesError);
                    } else {
                        console.log('✅ Messaggi iniziali caricati:', messagesData?.length || 0);
                        setMessages(messagesData || []);
                    }

                    // Canale di presenza per lo stato online
                    console.log('👥 Configurazione canale presenza...');
                    presenceChannel = supabase
                        .channel(`family-presence-${userFamilyGroup}`, {
                            config: {
                                presence: { key: user.id },
                            },
                        })
                        .on('presence', { event: 'sync' }, () => {
                            console.log('👥 Sincronizzazione presenza');
                            const newState = presenceChannel.presenceState();
                            const newOnlineMembers = Object.keys(newState).map(key => newState[key][0].id);
                            console.log('👥 Membri online:', newOnlineMembers);
                            setOnlineMembers(newOnlineMembers);
                        })
                        .on('presence', { event: 'join' }, ({ newPresences }) => {
                            console.log('👥 Utente entrato:', newPresences);
                            const joinedIds = newPresences.map(p => p.id);
                            setOnlineMembers(prev => [...new Set([...prev, ...joinedIds])]);
                        })
                        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
                            console.log('👥 Utente uscito:', leftPresences);
                            const leftIds = leftPresences.map(p => p.id);
                            setOnlineMembers(prev => prev.filter(id => !leftIds.includes(id)));
                        })
                        .subscribe(async (status) => {
                            console.log('👥 Stato sottoscrizione presenza:', status);
                            if (status === 'SUBSCRIBED') {
                                await presenceChannel.track({ id: user.id });
                                console.log('👥 Tracking presenza attivo');
                            }
                        });

                    // CANALE MESSAGGI - VERSIONE MIGLIORATA
                    console.log('💬 Configurazione canale messaggi...');
                    const channelName = `messages-${userFamilyGroup}`;
                    console.log('💬 Nome canale:', channelName);

                    chatChannel = supabase
                        .channel(channelName)
                        .on(
                            'postgres_changes',
                            {
                                event: '*', // Ascolta tutti gli eventi
                                schema: 'public',
                                table: 'messages'
                                // Rimuovo il filtro qui per testare
                            },
                            async (payload) => {
                                console.log('🎉 EVENTO REALTIME RICEVUTO!', payload);
                                console.log('📊 Payload completo:', JSON.stringify(payload, null, 2));
                                
                                // Verifica se il messaggio appartiene al nostro family group
                                if (payload.new && payload.new.family_group !== userFamilyGroup) {
                                    console.log('⚠️ Messaggio non per il nostro gruppo, ignorato');
                                    return;
                                }

                                if (payload.eventType === 'INSERT' && payload.new) {
                                    // Recupera il nome utente del mittente
                                    console.log('👤 Recupero profilo mittente...');
                                    const { data: senderProfile, error: senderError } = await supabase
                                        .from('profiles')
                                        .select('username')
                                        .eq('id', payload.new.sender_id)
                                        .single();

                                    const senderUsername = senderError ? 'Sconosciuto' : senderProfile.username;
                                    console.log('👤 Nome mittente:', senderUsername);
                                    
                                    setMessages(prevMessages => {
                                        console.log('📝 Messaggi attuali prima dell\'aggiunta:', prevMessages.length);
                                        
                                        // Controllo duplicati più robusto
                                        const messageExists = prevMessages.some(msg => 
                                            msg.id === payload.new.id || 
                                            (msg.content === payload.new.content && 
                                             msg.sender_id === payload.new.sender_id && 
                                             Math.abs(new Date(msg.created_at) - new Date(payload.new.created_at)) < 1000)
                                        );
                                        
                                        if (messageExists) {
                                            console.log('⚠️ Messaggio duplicato trovato, ignorato');
                                            return prevMessages;
                                        }

                                        const newMsg = {
                                            ...payload.new,
                                            profiles: {
                                                username: senderUsername
                                            }
                                        };
                                        
                                        console.log('✅ Aggiunto nuovo messaggio via real-time:', newMsg);
                                        const updatedMessages = [...prevMessages, newMsg];
                                        console.log('📝 Totale messaggi dopo aggiunta:', updatedMessages.length);
                                        return updatedMessages;
                                    });
                                }
                            }
                        )
                        .subscribe((status) => {
                            console.log('💬 Stato sottoscrizione messaggi:', status);
                            setRealtimeStatus(status);
                            
                            if (status === 'SUBSCRIBED') {
                                console.log('✅ CANALE MESSAGGI ATTIVO!');
                            } else if (status === 'CHANNEL_ERROR') {
                                console.error('❌ ERRORE CANALE MESSAGGI!');
                            } else if (status === 'TIMED_OUT') {
                                console.error('⏰ TIMEOUT CANALE MESSAGGI!');
                                // Prova a riconnettersi automaticamente
                                setTimeout(() => {
                                    console.log('🔄 Tentativo di riconnessione...');
                                    chatChannel.subscribe();
                                }, 3000);
                            } else if (status === 'CLOSED') {
                                console.error('🚫 CANALE MESSAGGI CHIUSO!');
                            }
                        });

                } else {
                    console.error('❌ Family group non trovato nei metadati utente');
                }
            } catch (error) {
                console.error('❌ Errore durante l\'inizializzazione:', error);
            }
            
            setLoading(false);
            console.log('✅ Inizializzazione completata');
        };

        fetchInitialDataAndSubscribe();

        // Cleanup function
        return () => {
            console.log('🧹 Pulizia sottoscrizioni...');
            if (chatChannel) {
                console.log('🧹 Rimozione canale messaggi...');
                supabase.removeChannel(chatChannel);
            }
            if (presenceChannel) {
                console.log('🧹 Rimozione canale presenza...');
                supabase.removeChannel(presenceChannel);
            }
            console.log('🧹 Pulizia completata');
        };
    }, []);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        const handleDocClick = () => setOpenFileOptionsId(null);
        document.addEventListener('click', handleDocClick);
        return () => document.removeEventListener('click', handleDocClick);
    }, []);

const messagesEndRef = useRef(null);

const scrollToBottom = () => {
  if (messagesEndRef.current) {
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }
};











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
  if (!newMessage.trim() || !user || !familyGroup) return;

  const messageData = {
    content: newMessage,
    family_group: familyGroup,
    sender_id: user.id,
  };

  try {
    const { data: insertedData, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select('*')
      .single();

    if (error) throw error;

    // ✅ fallback: aggiunge subito il messaggio nello stato
    setMessages(prev => [...prev, {
      ...insertedData,
      profiles: { username: user.user_metadata.username || 'Tu' },
    }]);

    setNewMessage('');
    scrollToBottom();
  } catch (error) {
    console.error('Errore invio messaggio:', error);
  }
};


    // Test function migliorata per verificare real-time
    const testRealtime = async () => {
        console.log('🧪 Test real-time...');
        const testMessage = `🧪 Test ${new Date().toLocaleTimeString()}`;
        
        const { data, error } = await supabase
            .from('messages')
            .insert({
                content: testMessage,
                family_group: familyGroup,
                sender_id: user.id,
            })
            .select('*, profiles(username)')
            .single();
            
        if (error) {
            console.error('❌ Errore test:', error);
            alert('Errore nel test: ' + error.message);
        } else {
            console.log('✅ Messaggio test inviato:', data);
            
            // Verifica se il messaggio appare via real-time
            setTimeout(() => {
                setMessages(prevMessages => {
                    const exists = prevMessages.some(msg => msg.id === data.id);
                    if (!exists) {
                        console.log('⚠️ Test fallito - messaggio non ricevuto via real-time');
                        alert('⚠️ Real-time non funziona correttamente');
                        return [...prevMessages, data];
                    } else {
                        console.log('✅ Test riuscito - real-time funzionante!');
                        alert('✅ Real-time funziona correttamente!');
                    }
                    return prevMessages;
                });
            }, 1000);
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
                        <img src={URL.createObjectURL(selectedFile)} alt="Preview" 
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
            state: { file_url: file.file_url, file_name: file.file_name, file_type: file.file_type }
        });
    };

    const renderMessageContent = (msg) => {
        const hasFile = msg.file_url && msg.file_name;
        const isImage = hasFile && msg.file_type?.startsWith('image/');
        
        return (
            <div>
                <div style={{ 
                    fontWeight: 'bold', fontSize: '0.85em',
                    color: isMyMessage(msg.sender_id) ? '#0a5f26' : '#0366d6', marginBottom: '4px'
                }}>
                    {msg.profiles?.username || 'Sconosciuto'}
                </div>
                
                {hasFile && (
                    <div style={{ marginBottom: msg.content !== `📎 ${msg.file_name}` ? '8px' : '0', cursor: 'pointer' }}
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
                
                {msg.content && msg.content !== `📎 ${msg.file_name}` && (
                    <div style={{ fontSize: '1em', lineHeight: '1.4', margin: 0 }}>{msg.content}</div>
                )}
            </div>
        );
    };

    const isMyMessage = (messageSenderId) => user && messageSenderId === user.id;

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handleDirectCall = () => {
        if (selectedDirectCallUser && selectedDirectCallUser !== user.id) {
            navigate('/video-chat-diretta', { state: { familyGroup, user, remoteUserId: selectedDirectCallUser } });
        } else {
            alert('Per avviare una chiamata diretta, devi selezionare un altro membro della famiglia.');
        }
    };

    return (
        <div style={{ height: '100vh', backgroundColor: '#e5ddd5', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-opacity='0.03'%3E%3Cpolygon fill='%23000' points='50 0 60 40 100 50 60 60 50 100 40 60 0 50 40 40'/%3E%3C/g%3E%3C/svg%3E")` 
        }}>
            {/* Header con indicatore real-time migliorato */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px',
                backgroundColor: '#075E54', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 1000, flexWrap: 'wrap'
            }}>
                <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', color: 'white' }}>
                    <h1 style={{ fontSize: '1.6em', margin: 0 }}>💬 Patarini's Social Chat</h1>
                    
                    {/* Indicatore stato real-time migliorato */}
                    <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8em', marginTop: '2px',
                        color: realtimeStatus === 'SUBSCRIBED' ? '#4ade80' : '#ef4444'
                    }}>
                        <span style={{ 
                            width: '8px', height: '8px', borderRadius: '50%',
                            backgroundColor: realtimeStatus === 'SUBSCRIBED' ? '#4ade80' : '#ef4444',
                            animation: realtimeStatus === 'SUBSCRIBED' ? 'pulse 2s infinite' : 'none'
                        }}></span>
                        Real-time: {realtimeStatus}
                        {realtimeStatus !== 'SUBSCRIBED' && (
                            <span style={{ marginLeft: '5px', fontSize: '0.7em' }}>
                                (I messaggi potrebbero non apparire in tempo reale)
                            </span>
                        )}
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px' }}>
                        {familyMembers.map((member) => {
                            const isOnline = onlineMembers.includes(member.id);
                            
                            let memberColor = '#007bff'; // Azzurro per utenti offline
                            if (member.id === user?.id) {
                                memberColor = '#25D366'; // Verde per l'utente loggato
                            } else if (isOnline) {
                                memberColor = '#FFC107'; // Giallo per altri utenti online
                            }

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
                                        backgroundColor: 'white', border: '1px solid transparent',
                                        opacity: 1
                                    }}></span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '250px', alignItems: 'flex-end', marginTop: '10px' }}>
                    {/* Pulsante test real-time */}
                    <button onClick={testRealtime} 
                        style={{ 
                            padding: '4px 10px', borderRadius: '15px', backgroundColor: '#ff6b35',
                            color: 'white', border: 'none', cursor: 'pointer', width: '100%',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)', fontWeight: 'bold', fontSize: '0.8em'
                        }}>
                        🧪 Test Real-time
                    </button>
                    
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
                            📞 Diretta
                        </button>
                    </div>
                    <button onClick={() => alert('La videochiamata di gruppo non è ancora implementata con una soluzione gratuita.')} 
                        style={{ 
                            padding: '8px 15px', borderRadius: '20px', backgroundColor: '#87CEEB',
                            color: 'white', border: 'none', cursor: 'pointer', width: '100%',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)', fontWeight: 'bold', fontSize: '0.9em',
                            transition: 'all 0.3s ease'
                        }}>
                        🤝 Videochiamata di gruppo
                    </button>
                    <button onClick={() => navigate('/main-menu')} 
                        style={{ 
                            padding: '8px 15px', borderRadius: '20px', backgroundColor: '#128C7E',
                            color: 'white', border: 'none', cursor: 'pointer', width: '100%',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)', fontWeight: 'bold', fontSize: '0.9em',
                            transition: 'all 0.3s ease'
                        }}>
                        ← RitornoMenuPrincipale
                    </button>
                </div>
            </div>

            {/* Aggiungi CSS per l'animazione pulse */}
            <style>
                {`
                    @keyframes pulse {
                        0% { opacity: 1; }
                        50% { opacity: 0.5; }
                        100% { opacity: 1; }
                    }
                `}
            </style>

            <div ref={chatContainerRef} style={{ 
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
                                borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
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
        </div>
    );
}

export default FamilyChat;