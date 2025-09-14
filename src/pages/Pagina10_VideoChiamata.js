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
                    const onlineIds = Object.keys(presenceState);
                    setOnlineMembers(onlineIds);
                });
                presenceChannel.subscribe();
            }

            return () => {
                if (callChannel) supabase.removeChannel(callChannel);
                if (presenceChannel) supabase.removeChannel(presenceChannel);
            };
        };

        const fetchFamilyMembers = async () => {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) {
                navigate('/');
                return;
            }
            setUser(userData.user);

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('family_group')
                .eq('id', userData.user.id)
                .single();

            if (error || !profile) {
                console.error("Errore nel recupero del gruppo famiglia:", error);
                return;
            }

            const { data: members, error: membersError } = await supabase
                .from('profiles')
                .select('id, username')
                .eq('family_group', profile.family_group);

            if (membersError) {
                console.error("Errore nel recupero dei membri della famiglia:", membersError);
                return;
            }
            setFamilyMembers(members);
            await setupRealtime(userData.user.id);
        };

        fetchFamilyMembers();
    }, [navigate]);

    const handleStartCall = (userId) => {
        setSelectedDirectCallUser(userId);
        setIsCalling(true);
    };

    const handleCancelCall = () => {
        setIsCalling(false);
        setSelectedDirectCallUser(null);
    };

    const handleConfirmCall = async () => {
        setIsCalling(false);
        if (!user || !selectedDirectCallUser) return;

        const channel = supabase.channel(`direct-video-call-${selectedDirectCallUser}`);
        await channel.subscribe();
        channel.send({
            type: 'broadcast',
            event: 'call-notification',
            payload: {
                senderId: user.id,
                recipientId: selectedDirectCallUser,
            }
        });

        // Reindirizza il chiamante alla pagina della videochiamata
        navigate(`/video-call-page/${selectedDirectCallUser}`);
    };

    const handleAcceptCall = () => {
        navigate(`/video-call-page/${incomingCall}`);
        setIncomingCall(null);
    };

    const handleRejectCall = () => {
        setIncomingCall(null);
    };

    const isOnline = (memberId) => onlineMembers.includes(memberId);

    const remoteUser = selectedDirectCallUser ? familyMembers.find(m => m.id === selectedDirectCallUser) : null;
    const incomingCaller = incomingCall ? familyMembers.find(m => m.id === incomingCall) : null;
    
    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
            <h1 style={{ color: '#075E54', textAlign: 'center' }}>Chiama un membro della famiglia</h1>
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
                            </div>
                            <button onClick={() => handleStartCall(member.id)} style={{
                                padding: '10px 20px', backgroundColor: '#075E54', color: 'white',
                                border: 'none', borderRadius: '20px', cursor: 'pointer',
                                fontSize: '1em'
                            }}>
                                Chiama
                            </button>
                        </div>
                    ))}
            </div>

            {isCalling && remoteUser && (
                <div style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    backgroundColor: 'white', padding: '30px', borderRadius: '15px', boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
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
                            padding: '10px 20px', borderRadius: '20px', backgroundColor: '#34B7F1', color: 'white',
                            border: 'none', cursor: 'pointer', fontWeight: 'bold'
                        }}>Chiama</button>
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