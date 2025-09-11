import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Daily from '@daily-co/daily-js';
import { supabase } from '../supabaseClient';

const DAILY_DOMAIN = "tuo-dominio-daily.daily.co"; // Sostituisci con il tuo dominio Daily.co

function GroupVideoChat() {
    const [call, setCall] = useState(null);
    const [status, setStatus] = useState('Connessione alla sala...');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [participants, setParticipants] = useState({});
    const navigate = useNavigate();
    const { state } = useLocation();

    const { familyGroup, user } = state || {};
    const familyGroupRoom = familyGroup; // La chat di gruppo funge da "room"

    useEffect(() => {
        if (!familyGroupRoom || !user) {
            navigate('/pagina2-family-chat');
            return;
        }

        const dailyRoomUrl = `https://${DAILY_DOMAIN}/${familyGroupRoom}`;

        const newCall = Daily.createCallObject();
        setCall(newCall);

        const eventHandlers = {
            'joined-meeting': () => {
                setStatus('Sei connesso!');
            },
            'participant-joined': (e) => {
                setStatus(`${e.participant.user_name} si è unito alla chiamata.`);
                setParticipants(prev => ({ ...prev, [e.participant.user_id]: e.participant }));
            },
            'participant-left': (e) => {
                setStatus(`${e.participant.user_name} ha lasciato la chiamata.`);
                setParticipants(prev => {
                    const newParticipants = { ...prev };
                    delete newParticipants[e.participant.user_id];
                    return newParticipants;
                });
            },
            'camera-stopped': () => {
                setStatus('Videocamera disattivata.');
            },
            'left-meeting': () => {
                // Pulizia e navigazione
                newCall.destroy();
                navigate('/pagina2-family-chat');
            }
        };

        for (const event in eventHandlers) {
            newCall.on(event, eventHandlers[event]);
        }

        newCall.join({ url: dailyRoomUrl, userName: user.user_metadata.username, token: "opzionale" });

        return () => {
            for (const event in eventHandlers) {
                newCall.off(event, eventHandlers[event]);
            }
            if (newCall) {
                newCall.leave();
            }
        };

    }, [familyGroupRoom, user, navigate]);

    const handleToggleMute = () => {
        if (call) {
            call.setLocalAudio(!isMuted);
            setIsMuted(!isMuted);
        }
    };

    const handleToggleVideo = () => {
        if (call) {
            call.setLocalVideo(!isVideoOff);
            setIsVideoOff(!isVideoOff);
        }
    };

    const handleHangUp = () => {
        if (call) {
            call.leave();
        }
    };

    return (
        <div style={{ height: '100vh', backgroundColor: '#e5ddd5', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '15px 20px', backgroundColor: '#075E54', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', color: 'white', zIndex: 1000 }}>
                <h1 style={{ margin: 0 }}>🤝 Videochiamata di Gruppo</h1>
                <div style={{ fontSize: '0.9em', opacity: 0.8, marginTop: '5px' }}>
                    Stato: {status}
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '10px', justifyContent: 'center', alignItems: 'center' }}>
                {Object.values(participants).map(p => (
                    <div key={p.user_id} style={{ position: 'relative', width: '45%', height: '45%', minWidth: '200px', minHeight: '200px' }}>
                        <video 
                            ref={videoElement => {
                                if (videoElement) {
                                    if (p.videoTrack) {
                                        videoElement.srcObject = new MediaStream([p.videoTrack]);
                                    } else {
                                        videoElement.srcObject = null;
                                    }
                                }
                            }}
                            autoPlay playsInline muted={p.local}
                            style={{ 
                                width: '100%', height: '100%', objectFit: 'cover',
                                borderRadius: '15px', border: p.local ? '3px solid #25D366' : '3px solid white',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                                transform: p.local ? 'scaleX(-1)' : 'none' 
                            }}
                        />
                        <div style={{
                            position: 'absolute', bottom: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.5)',
                            color: 'white', padding: '5px 10px', borderRadius: '10px'
                        }}>
                            {p.user_name} {p.local ? '(Tu)' : ''}
                        </div>
                    </div>
                ))}
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

export default GroupVideoChat;