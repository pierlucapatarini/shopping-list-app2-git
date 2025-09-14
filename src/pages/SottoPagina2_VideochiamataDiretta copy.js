import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useParams } from 'react-router-dom';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Aggiungi un server TURN per l'uso in produzione
    // {
    //   urls: 'turn:YOUR_TURN_SERVER_URL:3478',
    //   username: 'YOUR_TURN_USERNAME',
    //   credential: 'YOUR_TURN_CREDENTIAL'
    // }
  ],
  iceCandidatePoolSize: 10,
};

function DirectVideoChat() {
  const { remoteUserId } = useParams();
  const navigate = useNavigate();

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pc = useRef(null);
  const channel = useRef(null);
  const localStream = useRef(null);

  const [status, setStatus] = useState('Inizializzazione...');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    let cleanupDone = false;
    const initCall = async () => {
      // 1. Carica l'utente attuale e i dati necessari
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        navigate('/pagina2-family-chat');
        return;
      }
      const currentUser = userData.user;
      const familyGroup = currentUser.user_metadata?.family_group;

      if (!remoteUserId || !familyGroup) {
        navigate('/pagina2-family-chat');
        return;
      }

      const isCaller = [currentUser.id, remoteUserId].sort()[0] === currentUser.id;

      try {
        // 2. Acquisizione videocamera e microfono
        setStatus("Acquisizione videocamera e microfono...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cleanupDone) return;

        localStream.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 3. Crea la connessione WebRTC
        pc.current = new RTCPeerConnection(ICE_SERVERS);
        stream.getTracks().forEach(track => pc.current.addTrack(track, stream));

        pc.current.onicecandidate = (e) => {
          if (e.candidate) {
            channel.current.send({
              type: 'broadcast',
              event: 'webrtc-signal',
              payload: {
                senderId: currentUser.id,
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
          if (['disconnected', 'failed'].includes(pc.current.connectionState)) {
            handleHangUp(currentUser);
          }
        };

        // 4. Connettiti al canale di Supabase
        const callChannelName = [currentUser.id, remoteUserId].sort().join('-');
        channel.current = supabase.channel(`direct-video-chat-${callChannelName}`);

        channel.current.on('broadcast', { event: 'webrtc-signal' }, (payload) => {
          handleWebRTCSignals(payload, currentUser.id, isCaller);
        }).subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            if (isCaller) {
              createOffer(pc.current, currentUser.id);
            }
          }
        });
        
      } catch (error) {
        console.error("Errore nell'inizializzazione della chiamata:", error);
        if (error.name === 'NotAllowedError' || error.name === 'NotFoundError') {
          setStatus("Errore: per favore, concedi i permessi per videocamera e microfono.");
        } else {
          setStatus("Errore: impossibile avviare la chiamata.");
        }
      }
    };

    const createOffer = async (peerConnection, senderId) => {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      channel.current.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload: {
          senderId: senderId,
          type: 'offer',
          offer: peerConnection.localDescription,
        },
      });
      setStatus('Offerta inviata, in attesa di risposta...');
    };

    const handleWebRTCSignals = async ({ payload }, currentUserId, isCaller) => {
      if (payload.senderId === currentUserId) return;

      switch (payload.type) {
        case 'offer':
          if (!isCaller) {
            await pc.current.setRemoteDescription(new RTCSessionDescription(payload.offer));
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            channel.current.send({
              type: 'broadcast',
              event: 'webrtc-signal',
              payload: {
                senderId: currentUserId,
                type: 'answer',
                answer: pc.current.localDescription,
              },
            });
            setStatus('Risposta inviata, connessione in corso...');
          }
          break;

        case 'answer':
          if (isCaller) {
            await pc.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
          }
          break;

        case 'ice-candidate':
          try {
            await pc.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (err) {
            console.error('Errore ICE:', err);
          }
          break;

        case 'hang-up':
          handleHangUp();
          break;

        default:
          break;
      }
    };

    const handleHangUp = (currentUser) => {
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
        if (pc.current) pc.current.close();
        navigate('/pagina2-family-chat');
    };

    initCall();

    return () => {
        cleanupDone = true;
        if (localStream.current) localStream.current.getTracks().forEach(track => track.stop());
        if (pc.current) pc.current.close();
        if (channel.current) supabase.removeChannel(channel.current);
    };
  }, [remoteUserId, navigate]);

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

      <div style={{
        flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center'
      }}>
        <video ref={remoteVideoRef} autoPlay playsInline style={{
          width: '100%', height: '100%', objectFit: 'cover',
          backgroundColor: '#333', transform: 'scaleX(-1)'
        }} />
        <video ref={localVideoRef} autoPlay playsInline muted style={{
          position: 'absolute', bottom: '20px', right: '20px', width: '120px',
          height: '90px', borderRadius: '15px', border: '3px solid white',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)', objectFit: 'cover', transform: 'scaleX(-1)'
        }} />
      </div>

      <div style={{
        display: 'flex', justifyContent: 'center', gap: '20px', padding: '20px',
        backgroundColor: '#075E54', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', zIndex: 1000
      }}>
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