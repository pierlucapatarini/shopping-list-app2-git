import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

function Videochiamate() {
    const [user, setUser] = useState(null);
    const [familyMembers, setFamilyMembers] = useState([]);
    const [onlineMembers, setOnlineMembers] = useState([]);
    const [incomingCall, setIncomingCall] = useState(null);
    const [isCalling, setIsCalling] = useState(false);
    const [selectedDirectCallUser, setSelectedDirectCallUser] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    
    const navigate = useNavigate();

    useEffect(() => {
        let presenceChannel = null;
        let callChannel = null;

        const setupRealtime = async (userId) => {
            try {
                // Canale per la videochiamata diretta
                callChannel = supabase.channel(`direct-video-call-${userId}`);
                callChannel.on('broadcast', { event: 'call-notification' }, payload => {
                    console.log('Chiamata ricevuta:', payload);
                    setIncomingCall(payload.payload.senderId);
                }).subscribe();

                // Canale per la presenza
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('family_group')
                    .eq('id', userId)
                    .single();

                if (profileError) {
                    throw profileError;
                }

                if (profileData) {
                    presenceChannel = supabase.channel(`family-presence-${profileData.family_group}`, {
                        config: {
                            presence: { key: userId }
                        }
                    });
                    
                    presenceChannel.on('presence', { event: 'sync' }, () => {
                        const presenceState = presenceChannel.presenceState();
                        const onlineIds = Object.keys(presenceState);
                        console.log('Membri online:', onlineIds);
                        setOnlineMembers(onlineIds);
                    });
                    
                    presenceChannel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
                        console.log('Utente entrato:', key);
                    });
                    
                    presenceChannel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                        console.log('Utente uscito:', key);
                    });
                    
                    await presenceChannel.subscribe();
                }

                return () => {
                    if (callChannel) {
                        console.log('Chiusura canale chiamate');
                        supabase.removeChannel(callChannel);
                    }
                    if (presenceChannel) {
                        console.log('Chiusura canale presenza');
                        supabase.removeChannel(presenceChannel);
                    }
                };
            } catch (err) {
                console.error('Errore nel setup realtime:', err);
                setError('Errore nella configurazione dei canali real-time');
                throw err;
            }
        };

        const fetchFamilyMembers = async () => {
            try {
                setError(null);
                setLoading(true);

                const { data: userData, error: authError } = await supabase.auth.getUser();
                if (authError || !userData?.user) {
                    console.error('Errore autenticazione:', authError);
                    navigate('/');
                    return;
                }
                setUser(userData.user);

                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('family_group')
                    .eq('id', userData.user.id)
                    .single();

                if (profileError || !profile) {
                    console.error("Errore nel recupero del profilo:", profileError);
                    setError("Impossibile recuperare il profilo utente");
                    return;
                }

                const { data: members, error: membersError } = await supabase
                    .from('profiles')
                    .select('id, username')
                    .eq('family_group', profile.family_group);

                if (membersError) {
                    console.error("Errore nel recupero dei membri:", membersError);
                    setError("Impossibile recuperare i membri della famiglia");
                    return;
                }

                console.log('Membri famiglia caricati:', members);
                setFamilyMembers(members || []);
                
                await setupRealtime(userData.user.id);
                
            } catch (err) {
                console.error('Errore generale:', err);
                setError('Errore nel caricamento dei dati');
            } finally {
                setLoading(false);
            }
        };

        fetchFamilyMembers();
    }, [navigate]);

    const checkMediaPermissions = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (err) {
            console.error('Permessi media negati:', err);
            setError('È necessario consentire l\'accesso a videocamera e microfono per effettuare videochiamate');
            return false;
        }
    };

    const handleStartCall = async (userId) => {
        const hasPermissions = await checkMediaPermissions();
        if (!hasPermissions) return;
        
        setSelectedDirectCallUser(userId);
        setIsCalling(true);
        setError(null);
    };

    const handleCancelCall = () => {
        setIsCalling(false);
        setSelectedDirectCallUser(null);
        setError(null);
    };

    const handleConfirmCall = async () => {
        try {
            setIsCalling(false);
            if (!user || !selectedDirectCallUser) {
                setError('Errore nei dati della chiamata');
                return;
            }

            console.log('Invio notifica chiamata a:', selectedDirectCallUser);
            const channel = supabase.channel(`direct-video-call-${selectedDirectCallUser}`);
            await channel.subscribe();
            
            const success = await channel.send({
                type: 'broadcast',
                event: 'call-notification',
                payload: {
                    senderId: user.id,
                    recipientId: selectedDirectCallUser,
                    timestamp: new Date().toISOString()
                }
            });

            console.log('Notifica inviata:', success);

            // Piccolo delay per assicurarsi che la notifica sia stata inviata
            setTimeout(() => {
                navigate(`/video-call-page/${selectedDirectCallUser}`);
            }, 500);
            
        } catch (err) {
            console.error('Errore nell\'invio della chiamata:', err);
            setError('Errore nell\'invio della chiamata');
            setSelectedDirectCallUser(null);
        }
    };

    const handleAcceptCall = async () => {
        try {
            const hasPermissions = await checkMediaPermissions();
            if (!hasPermissions) return;
            
            console.log('Accettazione chiamata da:', incomingCall);
            navigate(`/video-call-page/${incomingCall}`);
            setIncomingCall(null);
            setError(null);
        } catch (err) {
            console.error('Errore nell\'accettare la chiamata:', err);
            setError('Errore nell\'accettare la chiamata');
        }
    };

    const handleRejectCall = () => {
        console.log('Chiamata rifiutata da:', incomingCall);
        setIncomingCall(null);
        setError(null);
    };

    const isOnline = (memberId) => onlineMembers.includes(memberId);

    const remoteUser = selectedDirectCallUser ? familyMembers.find(m => m.id === selectedDirectCallUser) : null;
    const incomingCaller = incomingCall ? familyMembers.find(m => m.id === incomingCall) : null;

    if (loading) {
        return (
            <div style={{ 
                padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Arial, sans-serif' 
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5em', marginBottom: '10px' }}>⏳</div>
                    <div>Caricamento...</div>
                </div>
            </div>
        );
    }
    
    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
            <h1 style={{ color: '#075E54', textAlign: 'center' }}>Chiama un membro della famiglia</h1>
            
            {error && (
                <div style={{
                    backgroundColor: '#ffe6e6', padding: '15px', borderRadius: '10px',
                    border: '1px solid #ff9999', marginBottom: '20px', color: '#cc0000'
                }}>
                    <strong>Errore:</strong> {error}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                {familyMembers
                    .filter(member => member.id !== user?.id)
                    .map(member => (
                        <div key={member.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '15px', backgroundColor: 'white', borderRadius: '10px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{
                                    width: '12px', height: '12px', borderRadius: '50%',
                                    backgroundColor: isOnline(member.id) ? '#25D366' : '#999'
                                }}></span>
                                <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{member.username}</span>
                                <span style={{ fontSize: '0.9em', color: '#666' }}>
                                    {isOnline(member.id) ? 'Online' : 'Offline'}
                                </span>
                            </div>
                            <button 
                                onClick={() => handleStartCall(member.id)} 
                                disabled={!isOnline(member.id)}
                                style={{
                                    padding: '10px 20px', 
                                    backgroundColor: isOnline(member.id) ? '#075E54' : '#ccc', 
                                    color: 'white',
                                    border: 'none', borderRadius: '20px', 
                                    cursor: isOnline(member.id) ? 'pointer' : 'not-allowed',
                                    fontSize: '1em'
                                }}
                            >
                                {isOnline(member.id) ? 'Chiama' : 'Offline'}
                            </button>
                        </div>
                    ))}
                
                {familyMembers.filter(member => member.id !== user?.id).length === 0 && (
                    <div style={{ 
                        textAlign: 'center', padding: '40px', color: '#666',
                        backgroundColor: 'white', borderRadius: '10px'
                    }}>
                        Nessun membro della famiglia disponibile
                    </div>
                )}
            </div>

            {/* Modal per conferma chiamata */}
            {isCalling && remoteUser && (
                <div style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    backgroundColor: 'white', padding: '30px', borderRadius: '15px', 
                    boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                    zIndex: 2000, textAlign: 'center', width: '300px'
                }}>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '15px' }}>
                        Chiama {remoteUser.username}
                    </div>
                    <div style={{ fontSize: '1em', marginBottom: '20px' }}>
                        Stai per avviare una videochiamata.
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', gap: '10px' }}>
                        <button onClick={handleConfirmCall} style={{
                            padding: '10px 20px', borderRadius: '20px', backgroundColor: '#34B7F1', 
                            color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold'
                        }}>
                            Chiama
                        </button>
                        <button onClick={handleCancelCall} style={{
                            padding: '10px 20px', borderRadius: '20px', backgroundColor: '#ff4d4f', 
                            color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold'
                        }}>
                            Annulla
                        </button>
                    </div>
                </div>
            )}

            {/* Modal per chiamata in arrivo */}
            {incomingCall && incomingCaller && (
                <div style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    backgroundColor: 'white', padding: '30px', borderRadius: '15px', 
                    boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                    zIndex: 2000, textAlign: 'center', width: '300px'
                }}>
                    <div style={{ fontSize: '1.4em', marginBottom: '10px' }}>📞</div>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '15px' }}>
                        Chiamata in arrivo da {incomingCaller.username}!
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', gap: '10px' }}>
                        <button onClick={handleAcceptCall} style={{
                            padding: '10px 20px', borderRadius: '20px', backgroundColor: '#25D366', 
                            color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold'
                        }}>
                            Accetta
                        </button>
                        <button onClick={handleRejectCall} style={{
                            padding: '10px 20px', borderRadius: '20px', backgroundColor: '#ff4d4f', 
                            color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold'
                        }}>
                            Rifiuta
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Videochiamate;