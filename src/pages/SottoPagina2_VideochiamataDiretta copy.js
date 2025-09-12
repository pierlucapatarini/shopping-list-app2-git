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

    // nome canale identico per entrambe le parti (ordinato)
    const callChannelName = [user.id, remoteUserId].sort().join('-');
    channel.current = supabase.channel(`direct-video-chat-${callChannelName}`);

    // Helper: serializza descrizione (solo campi serializzabili)
    const serializeDesc = (desc) => {
      if (!desc) return null;
      return { type: desc.type, sdp: desc.sdp };
    };

    // Helper: serializza candidato (solo campi necessari)
    const serializeCandidate = (candidate) => {
      if (!candidate) return null;
      // candidate può venire dentro un oggetto RTCIceCandidate; estrai i campi serializzabili
      return {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        // a volte ci sono altri campi, ma questi bastano per ricrearlo
      };
    };

    // Normalizza payload ricevuto (alcune versioni del client messaggiano la struttura in modi diversi)
    const normalizePayload = (incoming) => {
      if (!incoming) return null;
      // Se il callback riceve un oggetto con .payload (es: {payload: {...}}), estrai
      if (incoming.payload) return incoming.payload;
      return incoming;
    };

    const setupWebRTC = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideoRef.current.srcObject = stream;
        localStream.current = stream;

        // Aggiungo i track al PeerConnection
        if (pc.current.signalingState === 'closed') {
          // ricrea la pc se necessario (non dovrebbe succedere spesso)
          pc.current = new RTCPeerConnection({ iceServers: STUN_SERVERS });
        }

        stream.getTracks().forEach((track) => {
          try {
            pc.current.addTrack(track, stream);
          } catch (err) {
            console.warn('Impossibile aggiungere track:', err);
          }
        });

        // ricezione segnali broadcast (offerta/answer/ice)
        channel.current.on('broadcast', { event: 'webrtc_signal' }, async (raw) => {
          const payload = normalizePayload(raw);
          if (!payload) return;
          // ignora i messaggi che provengono da noi
          if (payload.senderId === user.id) return;

          try {
            if (payload.type === 'offer') {
              setStatus('Ricevuta offerta, connessione in corso...');
              // impostiamo descrizione remota (ricreiamo l'oggetto)
              const remoteDesc = { type: payload.offer?.type, sdp: payload.offer?.sdp };
              await pc.current.setRemoteDescription(remoteDesc);

              // createAnswer & invio
              const answer = await pc.current.createAnswer();
              await pc.current.setLocalDescription(answer);

              channel.current.send({
                type: 'broadcast',
                event: 'webrtc_signal',
                payload: {
                  senderId: user.id,
                  type: 'answer',
                  answer: serializeDesc(pc.current.localDescription),
                },
              });

              // svuota la coda dei candidati (se presenti)
              for (const cand of iceCandidatesQueue.current) {
                try {
                  await pc.current.addIceCandidate(cand);
                } catch (err) {
                  console.warn('Errore aggiungendo candidato dalla coda dopo offer:', err);
                }
              }
              iceCandidatesQueue.current = [];
            } else if (payload.type === 'answer') {
              setStatus('Risposta ricevuta, connessione stabilita.');
              const remoteDesc = { type: payload.answer?.type, sdp: payload.answer?.sdp };
              await pc.current.setRemoteDescription(remoteDesc);

              // svuota la coda dei candidati
              for (const cand of iceCandidatesQueue.current) {
                try {
                  await pc.current.addIceCandidate(cand);
                } catch (err) {
                  console.warn('Errore aggiungendo candidato dalla coda dopo answer:', err);
                }
              }
              iceCandidatesQueue.current = [];
            } else if (payload.type === 'ice-candidate') {
              // ricrea RTCIceCandidate in modo sicuro
              const candObj = payload.candidate;
              if (!candObj) return;
              const rtcCandidate = {
                candidate: candObj.candidate,
                sdpMid: candObj.sdpMid,
                sdpMLineIndex: candObj.sdpMLineIndex,
              };

              // se remoteDescription è impostata, aggiungi subito, altrimenti metti in coda
              if (pc.current && pc.current.remoteDescription && pc.current.remoteDescription.sdp) {
                try {
                  await pc.current.addIceCandidate(rtcCandidate);
                } catch (err) {
                  console.warn('Errore aggiungendo candidato (immediato):', err);
                }
              } else {
                iceCandidatesQueue.current.push(rtcCandidate);
              }
            }
          } catch (e) {
            console.error('Errore nella gestione del segnale WebRTC:', e);
          }
        });

        // Subscribe al canale
        await channel.current.subscribe(async (statusStr) => {
          // statusStr può essere 'SUBSCRIBED' ecc.
          if (statusStr === 'SUBSCRIBED') {
            setStatus("Pronto per la chiamata. In attesa dell'altro utente...");
            // Avvia la chiamata solo se sei il "chiamante" determinato dall'ordine degli id
            const sortedUserIds = [user.id, remoteUserId].sort();
            if (sortedUserIds[0] === user.id) {
              // piccolo delay per dare il tempo di completare subscribe e setTrack
              setTimeout(() => {
                initiateCall();
              }, 800);
            }
          }
        });

        // invio ICE candidates via channel
        pc.current.onicecandidate = (event) => {
          if (event.candidate) {
            const serial = serializeCandidate(event.candidate);
            try {
              channel.current.send({
                type: 'broadcast',
                event: 'webrtc_signal',
                payload: {
                  senderId: user.id,
                  type: 'ice-candidate',
                  candidate: serial,
                },
              });
            } catch (err) {
              console.warn('Errore inviando candidato:', err);
            }
          }
        };

        // quando ricevi stream remoto
        pc.current.ontrack = (event) => {
          // assegna lo stream al video remoto (prende il primo streams[0])
          if (remoteVideoRef.current && event.streams && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setStatus('Connessione riuscita. Videochiamata in corso.');
          }
        };

        // monitor dello stato di connessione per debug/cleanup
        pc.current.onconnectionstatechange = () => {
          const s = pc.current.connectionState;
          if (s === 'failed' || s === 'disconnected' || s === 'closed') {
            setStatus(`Stato connessione: ${s}`);
          } else {
            setStatus(`Stato connessione: ${s}`);
          }
        };
      } catch (error) {
        console.error("Errore nell'ottenere lo stream o nel setup WebRTC:", error);
        setStatus("Errore: impossibile avviare la videochiamata. Controlla permessi camera/microfono.");
      }
    };

    const initiateCall = async () => {
      try {
        // controlla che il PeerConnection esista
        if (!pc.current) {
          console.warn('PeerConnection non inizializzato');
          return;
        }

        // Non creare offerta se non siamo nello stato corretto (ma può essere stabile anche dopo)
        if (pc.current.signalingState === 'closed') {
          console.warn('PC chiuso, non posso creare offerta');
          return;
        }

        setStatus("Creazione dell'offerta...");
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);

        // invio solo campi serializzabili
        channel.current.send({
          type: 'broadcast',
          event: 'webrtc_signal',
          payload: {
            senderId: user.id,
            type: 'offer',
            offer: serializeDesc(pc.current.localDescription),
          },
        });
      } catch (e) {
        console.error("Errore nella creazione dell'offerta:", e);
      }
    };

    setupWebRTC();

    return () => {
      // cleanup
      try {
        if (localStream.current) {
          localStream.current.getTracks().forEach((track) => track.stop());
          localStream.current = null;
        }

        if (pc.current) {
          try {
            pc.current.onicecandidate = null;
            pc.current.ontrack = null;
            pc.current.onconnectionstatechange = null;
            if (pc.current.signalingState !== 'closed') pc.current.close();
          } catch (err) {
            console.warn('Errore chiudendo pc:', err);
          }
          pc.current = null;
        }

        if (channel.current) {
          try {
            supabase.removeChannel(channel.current);
          } catch (err) {
            console.warn('Errore rimuovendo channel:', err);
          }
          channel.current = null;
        }
      } catch (e) {
        console.warn('Errore in cleanup:', e);
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
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }
    if (pc.current) {
      try {
        if (pc.current.signalingState !== 'closed') pc.current.close();
      } catch (err) {
        console.warn('Errore chiudendo pc al termine:', err);
      }
      pc.current = null;
    }
    if (channel.current) {
      try {
        supabase.removeChannel(channel.current);
      } catch (err) {
        console.warn('Errore rimuovendo channel al termine:', err);
      }
      channel.current = null;
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
