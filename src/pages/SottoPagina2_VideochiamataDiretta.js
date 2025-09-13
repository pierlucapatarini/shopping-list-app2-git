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
    const isCaller = state?.isCaller;

    const { familyGroup, user, remoteUserId } = state || {};

    const createAndConnectPeer = async () => {
        try {
            setStatus("Acquisizione videocamera e microfono...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            
            localStream.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            pc.current = new RTCPeerConnection({ iceServers: STUN_SERVERS });
            stream.getTracks().forEach(track => pc.current.addTrack(track, stream));

            pc.current.onicecandidate = (e) => {
                if (e.candidate) {
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
                if (remoteVideoRef.current && e.streams && e.streams[0]) {
                    remoteVideoRef.current.srcObject = e.streams[0];
                    setStatus("Chiamata in corso...");
                }
            };
            
            pc.current.onconnectionstatechange = () => {
                if (pc.current.connectionState === 'disconnected' || pc.current.connectionState === 'failed') {
                    handleHangUp();
                }
            };

            if (isCaller) {
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
            }

        } catch (error) {
            console.error("Errore nell'accesso ai media o connessione:", error);
            setStatus("Errore: Impossibile accedere ai media o avviare la connessione.");
            handleHangUp();
        }
    };

    const handleWebRTCSignals = async ({ payload }) => {
        if (payload.senderId === user.id) return;

        if (payload.type === 'offer' && !isCaller) {
            await pc.current.setRemoteDescription(new RTCSessionDescription(payload.offer));
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
        } else if (payload.type === 'answer' && isCaller) {
            await pc.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
            // Il status viene aggiornato quando arriva l'on-track
        } else if (payload.type === 'ice-candidate') {
            try {
                await pc.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
                console.error('Errore aggiungendo ICE candidate:', e);
            }
        } else if (payload.type === 'hang-up') {
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
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    createAndConnectPeer();
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
    }, [familyGroup, user, remoteUserId, navigate, isCaller]);


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