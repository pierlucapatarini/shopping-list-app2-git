import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useLocation, useNavigate } from 'react-router-dom';

const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

function DirectVideoChat() {
    const localVideoRef = useRef();
    const remoteVideoRef = useRef();
    const pc = useRef(null);
    const channel = useRef(null);
    const { state } = useLocation();
    const navigate = useNavigate();
    const [status, setStatus] = useState('In attesa di risposta...');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const localStream = useRef(null);
    const iceCandidatesQueue = useRef([]);

    const { familyGroup, user, remoteUserId } = state || {};

    useEffect(() => {
        if (!familyGroup || !user || !remoteUserId) {
            navigate('/pagina2-family-chat');
            return;
        }

        pc.current = new RTCPeerConnection({ iceServers: STUN_SERVERS });
        
        const callChannelName = [user.id, remoteUserId].sort().join('-');
        channel.current = supabase.channel(`direct-video-chat-${callChannelName}`);

        const setupWebRTC = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localVideoRef.current.srcObject = stream;
                localStream.current = stream;
                
                if (pc.current.signalingState !== 'closed') {
                     stream.getTracks().forEach(track => pc.current.addTrack(track, stream));
                }

                channel.current.on('broadcast', { event: 'webrtc_signal' }, async ({ payload }) => {
                    if (payload.senderId !== user.id) {
                        try {
                            if (payload.type === 'offer') {
                                setStatus('Ricevuta offerta, connessione in corso...');
                                await pc.current.setRemoteDescription(new RTCSessionDescription(payload.offer));
                                const answer = await pc.current.createAnswer();
                                await pc.current.setLocalDescription(answer);
                                channel.current.send({
                                    type: 'broadcast',
                                    event: 'webrtc_signal',
                                    payload: {
                                        senderId: user.id,
                                        type: 'answer',
                                        answer: pc.current.localDescription
                                    }
                                });
                                // Aggiungi tutti i candidati in coda dopo aver impostato la descrizione remota
                                iceCandidatesQueue.current.forEach(candidate => {
                                    pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                                });
                                iceCandidatesQueue.current = []; // Svuota la coda
                            } else if (payload.type === 'answer') {
                                setStatus('Risposta ricevuta, connessione stabilita.');
                                await pc.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
                                // Aggiungi tutti i candidati in coda
                                iceCandidatesQueue.current.forEach(candidate => {
                                    pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                                });
                                iceCandidatesQueue.current = []; // Svuota la coda
                            } else if (payload.type === 'ice-candidate') {
                                // Se la descrizione remota non è ancora impostata, metti in coda il candidato
                                if (pc.current.remoteDescription) {
                                    await pc.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
                                } else {
                                    iceCandidatesQueue.current.push(payload.candidate);
                                }
                            }
                        } catch (e) {
                            console.error('Errore nella gestione del segnale WebRTC:', e);
                        }
                    }
                });

                await channel.current.subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        setStatus('Pronto per la chiamata. In attesa dell\'altro utente...');
                        // Avvia la chiamata solo se sei il "chiamante"
                        const sortedUserIds = [user.id, remoteUserId].sort();
                        if (sortedUserIds[0] === user.id) {
                            setTimeout(() => {
                                initiateCall();
                            }, 1000);
                        }
                    }
                });
                
                pc.current.onicecandidate = (event) => {
                    if (event.candidate) {
                        channel.current.send({
                            type: 'broadcast',
                            event: 'webrtc_signal',
                            payload: {
                                senderId: user.id,
                                type: 'ice-candidate',
                                candidate: event.candidate
                            }
                        });
                    }
                };

                pc.current.ontrack = (event) => {
                    remoteVideoRef.current.srcObject = event.streams[0];
                    setStatus('Connessione riuscita. Videochiamata in corso.');
                };

            } catch (error) {
                console.error('Errore nell\'ottenere lo stream o nel setup WebRTC:', error);
                setStatus('Errore: impossibile avviare la videochiamata.');
            }
        };

        const initiateCall = async () => {
            if (pc.current.signalingState !== 'stable') return;
            try {
                setStatus('Creazione dell\'offerta...');
                const offer = await pc.current.createOffer();
                await pc.current.setLocalDescription(offer);
                channel.current.send({
                    type: 'broadcast',
                    event: 'webrtc_signal',
                    payload: {
                        senderId: user.id,
                        type: 'offer',
                        offer: pc.current.localDescription
                    }
                });
            } catch (e) {
                console.error('Errore nella creazione dell\'offerta:', e);
            }
        };

        setupWebRTC();

        return () => {
            if (localStream.current) {
                localStream.current.getTracks().forEach(track => track.stop());
            }
            if (pc.current && pc.current.signalingState !== 'closed') {
                pc.current.close();
            }
            if (channel.current) {
                supabase.removeChannel(channel.current);
            }
        };
    }, [familyGroup, user, remoteUserId, navigate]);

    const handleToggleMute = () => {
        if (localStream.current) {
            const audioTrack = localStream.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const handleToggleVideo = () => {
        if (localStream.current) {
            const videoTrack = localStream.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    const handleHangUp = () => {
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
        }
        if (pc.current && pc.current.signalingState !== 'closed') {
            pc.current.close();
        }
        if (channel.current) {
            supabase.removeChannel(channel.current);
        }
        navigate('/pagina2-family-chat');
    };

    return (
        <div style={{ height: '100vh', backgroundColor: '#e5ddd5', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '15px 20px', backgroundColor: '#075E54', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', color: 'white', zIndex: 1000 }}>
                <h1 style={{ margin: 0 }}>📞 Chiamata Diretta</h1>
                <div style={{ fontSize: '0.9em', opacity: 0.8, marginTop: '5px' }}>
                    Stato: {status}
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
                <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <video ref={localVideoRef} autoPlay playsInline muted style={{
                    position: 'absolute', bottom: '20px', right: '20px', width: '150px', height: '150px',
                    borderRadius: '15px', border: '3px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    objectFit: 'cover', transform: 'scaleX(-1)'
                }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', padding: '20px', backgroundColor: '#075E54', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', zIndex: 1000 }}>
                <button onClick={handleToggleMute} style={{
                    width: '60px', height: '60px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                    backgroundColor: isMuted ? '#ff4d4f' : '#25D366', color: 'white', fontSize: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>{isMuted ? '🔇' : '🎤'}</button>
                
                <button onClick={handleToggleVideo} style={{
                    width: '60px', height: '60px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                    backgroundColor: isVideoOff ? '#ff4d4f' : '#25D366', color: 'white', fontSize: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>{isVideoOff ? '📷' : '📹'}</button>

                <button onClick={handleHangUp} style={{
                    width: '60px', height: '60px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                    backgroundColor: '#ff4d4f', color: 'white', fontSize: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>📞</button>
            </div>
        </div>
    );
}

export default DirectVideoChat;