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
    
    const navigate = useNavigate();

    useEffect(() => {
        let presenceChannel = null;
        let callChannel = null;

        const setupRealtime = async (userId) => {
            // Canale per la videochiamata diretta
            callChannel = supabase.channel(`direct-video-call-${userId}`);
            callChannel.on('broadcast', { event: 'call-notification' }, payload => {
                setIncomingCall(payload.payload.senderId);
            }).subscribe();

            // Canale per la presenza
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('family_group')
                .eq('id', userId)
                .single();

            if (profileData) {
                presenceChannel = supabase.channel(`family-presence-${profileData.family_group}`, {
                    config: {
                        presence: { key: userId }
                    }
                });

                presenceChannel.on('presence', { event: 'sync' }, () => {
                    const presenceState = presenceChannel.presenceState();
                    const currentOnlineUsers = Object.keys(presenceState).map(key => key);
                    setOnlineMembers(currentOnlineUsers);
                });

                await presenceChannel.subscribe();
            }

        };

        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                setupRealtime(user.id);
            } else {
                navigate('/login');
            }
        };

        const handleAuthStateChange = async () => {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
                (event, session) => {
                    if (event === 'SIGNED_IN') {
                        getUser();
                    }
                }
            );
            return () => {
                subscription.unsubscribe();
            };
        };

        handleAuthStateChange();
        getUser();
        
        return () => {
            if (presenceChannel) supabase.removeChannel(presenceChannel);
            if (callChannel) supabase.removeChannel(callChannel);
        };
    }, [navigate]);

    useEffect(() => {
        const fetchFamilyMembers = async () => {
            if (!user) return;
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('family_group')
                .eq('id', user.id)
                .single();

            if (profileError) {
                console.error("Errore nel recupero del gruppo familiare:", profileError);
                return;
            }

            const { data: members, error: membersError } = await supabase
                .from('profiles')
                .select('id, username')
                .eq('family_group', profileData.family_group);
            
            if (membersError) {
                console.error("Errore nel recupero dei membri della famiglia:", membersError);
            } else {
                setFamilyMembers(members);
            }
        };
        fetchFamilyMembers();
    }, [user]);

    const incomingCaller = familyMembers.find(member => member.id === incomingCall);

    const handleCall = (memberId) => {
        setIsCalling(true);
        setSelectedDirectCallUser(memberId);
    };

    const handleConfirmCall = async () => {
        setIsCalling(false);
        if (!user || !selectedDirectCallUser) return;
        
        // Crea il nome del canale condiviso ordinando gli ID
        const sortedIds = [user.id, selectedDirectCallUser].sort();
        const callChannelName = sortedIds.join('-');

        const channel = supabase.channel(`direct-video-call-${callChannelName}`);
        await channel.subscribe();

        channel.send({
            type: 'broadcast',
            event: 'call-notification',
            payload: {
                senderId: user.id,
                recipientId: selectedDirectCallUser,
            }
        });

        navigate(`/video-call-page/${selectedDirectCallUser}`);
    };

    const handleCancelCall = () => {
        setIsCalling(false);
    };

    const handleAcceptCall = () => {
        navigate(`/video-call-page/${incomingCall}`);
        setIncomingCall(null);
    };

    const handleRejectCall = () => {
        setIncomingCall(null);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    return (
        <div style={{
            fontFamily: 'Arial, sans-serif', backgroundColor: '#f0f2f5', minHeight: '100vh',
            display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20px'
        }}>
            <div style={{
                width: '100%', maxWidth: '600px', backgroundColor: 'white', padding: '20px',
                borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', textAlign: 'center'
            }}>
                <h1 style={{ color: '#075E54' }}>Videochiamate</h1>
                <p>Membri della famiglia:</p>
                <ul style={{ listStyleType: 'none', padding: 0 }}>
                    {familyMembers.map(member => (
                        <li key={member.id} style={{
                            padding: '10px', margin: '5px', borderRadius: '10px',
                            backgroundColor: onlineMembers.includes(member.id) ? '#dcf8c6' : '#f0f0f0',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <span>{member.username} {user?.id === member.id ? '(Tu)' : ''}</span>
                            {user?.id !== member.id && onlineMembers.includes(member.id) && (
                                <button onClick={() => handleCall(member.id)} style={{
                                    padding: '8px 15px', borderRadius: '20px', backgroundColor: '#25D366',
                                    color: 'white', border: 'none', cursor: 'pointer'
                                }}>
                                    Chiama
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
                <button onClick={handleLogout} style={{
                    marginTop: '20px', padding: '10px 20px', borderRadius: '20px',
                    backgroundColor: '#ff4d4f', color: 'white', border: 'none', cursor: 'pointer'
                }}>
                    Disconnetti
                </button>
            </div>

            {isCalling && (
                <div style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    backgroundColor: 'white', padding: '30px', borderRadius: '15px', boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                    zIndex: 2000, textAlign: 'center', width: '300px'
                }}>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '15px' }}>
                        Stai per effettuare una videochiamata...
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', gap: '10px' }}>
                        <button onClick={handleConfirmCall} style={{
                            padding: '10px 20px', borderRadius: '20px', backgroundColor: '#25D366', color: 'white',
                            border: 'none', cursor: 'pointer', fontWeight: 'bold'
                        }}>Invia offerta</button>
                        <button onClick={handleCancelCall} style={{
                            padding: '10px 20px', borderRadius: '20px', backgroundColor: '#ff4d4f', color: 'white',
                            border: 'none', cursor: 'pointer', fontWeight: 'bold'
                        }}>Annulla</button>
                    </div>
                </div>
            )}

            {incomingCall && incomingCaller && (
                <div style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    backgroundColor: 'white', padding: '30px', borderRadius: '15px', boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                    zIndex: 2000, textAlign: 'center', width: '300px'
                }}>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '15px' }}>
                        Chiamata in arrivo da {incomingCaller.username}!
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
        </div>
    );
}

export default Videochiamate;