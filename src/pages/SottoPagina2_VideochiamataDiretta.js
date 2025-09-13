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
    const [status, setStatus] = useState('Inizializzazione...');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const localStream = useRef(null);
    const [isLocalReady, setIsLocalReady] = useState(false);
    const [isRemoteReady, setIsRemoteReady] = useState(false);
    const [pcIsReady, setPcIsReady] = useState(false);
    const queuedOffer = useRef(null);
    const isCaller = state?.isCaller;

    const { familyGroup, user, remoteUserId } = state || {};

    // Helper per creare un'istanza RTCPeerConnection
    const createPeerConnection = async () => {
        try {
            console.log("Creazione PeerConnection...");
            pc.current = new RTCPeerConnection({ iceServers: STUN_SERVERS });
            
            pc.current.onicecandidate = (e) => {
                if (e.candidate) {
                    console.log("Inviato ICE candidate.");
                    channel.current.send({
                        type: 'broadcast',
                        event: 'webrtc-signal',
                        payload: {
                            senderId: user.id,
                            type: 'ice-candidate',
                            candidate: e.candidate,
                        },
                    });
                }
            };

            pc.current.ontrack = (e) => {
                console.log("Ricevuto track remoto.");
                if (remoteVideoRef.current && e.streams && e.streams[0]) {
                    remoteVideoRef.current.srcObject = e.streams[0];
                }
            };

            pc.current.onconnectionstatechange = () => {
                const s = pc.current.connectionState;
                console.log(`Stato connessione WebRTC: ${s}`);
                setStatus(`Stato connessione: ${s}`);
                if (s === 'disconnected' || s === 'failed') {
                    console.log("Connessione WebRTC fallita o disconnessa.");
                    handleHangUp();
                }
            };
            
            console.log("Acquisizione media locali...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStream.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            stream.getTracks().forEach(track => pc.current.addTrack(track, stream));
            setPcIsReady(true);
            console.log("PeerConnection e media pronti.");

        } catch (error) {
            console.error("Errore nell'accesso ai media:", error);
            setStatus("Errore: Impossibile accedere ai media.");
            handleHangUp();
        }
    };

    // Gestore per i segnali WebRTC
    const handleWebRTCSignals = async ({ payload }) => {
        if (payload.senderId === user.id) return;
        console.log('Ricevuto segnale WebRTC:', payload.type);

        if (payload.type === 'ready-for-call') {
            console.log("L'altro utente è pronto.");
            setIsRemoteReady(true);
        } else if (payload.type === 'offer' && !isCaller) {
            if (pcIsReady) {
                console.log("PC pronto, accetto l'offerta immediatamente.");
                await acceptCall(payload.offer);
            } else {
                console.log("PC non pronto, metto l'offerta in coda.");
                queuedOffer.current = payload.offer;
            }
        } else if (payload.type === 'answer' && isCaller) {
            console.log("Ricevuta risposta. Imposto remote description.");
            await pc.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
            setStatus('Connessione stabilita!');
        } else if (payload.type === 'ice-candidate') {
            console.log("Ricevuto ICE candidate.");
            try {
                await pc.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
                console.error('Errore aggiungendo ICE candidate:', e);
            }
        } else if (payload.type === 'hang-up') {
            handleHangUp();
        }
    };
    
    // Inizia la chiamata (solo per il chiamante)
    const initiateCall = async () => {
        try {
            console.log("Avvio chiamata: creazione offerta...");
            const offer = await pc.current.createOffer();
            await pc.current.setLocalDescription(offer);
            channel.current.send({
                type: 'broadcast',
                event: 'webrtc-signal',
                payload: {
                    senderId: user.id,
                    type: 'offer',
                    offer: pc.current.localDescription,
                },
            });
            setStatus('Offerta inviata, in attesa di risposta...');
            console.log("Offerta inviata.");
        } catch (error) {
            console.error("Errore nella creazione dell'offerta:", error);
            setStatus("Errore durante l'avvio della chiamata.");
            handleHangUp();
        }
    };

    // Accetta la chiamata (solo per il ricevente)
    const acceptCall = async (offer) => {
        try {
            console.log("Accettazione chiamata: impostazione remote description...");
            await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
            console.log("Creazione risposta...");
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            channel.current.send({
                type: 'broadcast',
                event: 'webrtc-signal',
                payload: {
                    senderId: user.id,
                    type: 'answer',
                    answer: pc.current.localDescription,
                },
            });
            setStatus('Risposta inviata, connessione in corso...');
            console.log("Risposta inviata.");
        } catch (error) {
            console.error("Errore nell'accettare l'offerta:", error);
            setStatus("Errore nell'accettare la chiamata.");
            handleHangUp();
        }
    };

    useEffect(() => {
        if (!familyGroup || !user || !remoteUserId) {
            navigate('/pagina2-family-chat');
            return;
        }

        const callChannelName = [user.id, remoteUserId].sort().join('-');
        channel.current = supabase.channel(`direct-video-chat-${callChannelName}`);

        channel.current.on('broadcast', { event: 'webrtc-signal' }, handleWebRTCSignals)
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Canale Supabase sottoscritto.');
                    await createPeerConnection();
                    // Notifica all'altro utente che sei pronto
                    console.log("Invio segnale 'ready-for-call'...");
                    channel.current.send({
                        type: 'broadcast',
                        event: 'webrtc-signal',
                        payload: {
                            senderId: user.id,
                            type: 'ready-for-call',
                        },
                    });
                    setIsLocalReady(true);
                }
            });

        return () => {
            if (localStream.current) {
                localStream.current.getTracks().forEach(track => track.stop());
            }
            if (pc.current) {
                pc.current.close();
            }
            if (channel.current) {
                supabase.removeChannel(channel.current);
            }
        };
    }, [familyGroup, user, remoteUserId, navigate]);

    useEffect(() => {
        if (isLocalReady && isRemoteReady && isCaller) {
            console.log("Entrambi gli utenti sono pronti, avvio della chiamata...");
            initiateCall();
        }
    }, [isLocalReady, isRemoteReady, isCaller]);

    useEffect(() => {
        if (pcIsReady && queuedOffer.current && !isCaller) {
            console.log("PC pronto e offerta in coda, la processo ora.");
            acceptCall(queuedOffer.current);
            queuedOffer.current = null; // Svuota la coda dopo l'elaborazione
        }
    }, [pcIsReady, isCaller]);


    const handleHangUp = () => {
        if (channel.current) {
            channel.current.send({
                type: 'broadcast',
                event: 'webrtc-signal',
                payload: { type: 'hang-up' },
            });
        }
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
        }
        if (pc.current) {
            pc.current.close();
        }
        navigate('/pagina2-family-chat');
    };

    const handleToggleMute = () => {
        if (localStream.current) {
            localStream.current.getAudioTracks().forEach(track => track.enabled = !track.enabled);
            setIsMuted(prev => !prev);
        }
    };

    const handleToggleVideo = () => {
        if (localStream.current) {
            localStream.current.getVideoTracks().forEach(track => track.enabled = !track.enabled);
            setIsVideoOff(prev => !prev);
        }
    };

    return (
        <div style={{
            height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#e5ddd5',
            fontFamily: 'Arial, sans-serif'
        }}>
            <div style={{ padding: '15px', backgroundColor: '#075E54', color: 'white', textAlign: 'center' }}>
                <h1 style={{ margin: 0, fontSize: '1.5em' }}>Videochiamata Diretta</h1>
                <div style={{ marginTop: '5px', fontSize: '1em' }}>{status}</div>
            </div>

            <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <video ref={remoteVideoRef} autoPlay playsInline style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                    backgroundColor: '#333', transform: 'scaleX(-1)'
                }} />

                <video ref={localVideoRef} autoPlay playsInline muted style={{
                    position: 'absolute', bottom: '20px', right: '20px', width: '120px',
                    height: '90px', borderRadius: '15px', border: '3px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
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