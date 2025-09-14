import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

function Pagina10() {
  const [phase, setPhase] = useState("list"); // "list" | "call"
  const [familyMembers, setFamilyMembers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [remoteUser, setRemoteUser] = useState(null);
  const [status, setStatus] = useState("Inizializzazione...");

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pc = useRef(null);
  const channel = useRef(null);
  const localStream = useRef(null);
  const currentUser = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Carica utente e membri famiglia
  useEffect(() => {
    const loadData = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      currentUser.current = userData.user;

      const { data: members, error } = await supabase
        .from("profiles")
        .select("id, username, family_group");

      if (error) {
        console.error("Errore fetch profili:", error);
      }

      setFamilyMembers(members || []);

      // setup canale per notifiche chiamata in arrivo
      const presenceChannel = supabase.channel(`direct-video-call-notify-${currentUser.current.id}`);
      presenceChannel.on('broadcast', { event: 'call-notification' }, payload => {
        setIncomingCall(payload?.payload?.sender);
      }).subscribe();
    };
    loadData();
  }, []);

  // Inizio chiamata
  const startCall = async (targetUser) => {
    setRemoteUser(targetUser);
    setPhase("call");
    await initCall(true, targetUser.id);
  };

  // Accetta chiamata
  const acceptCall = async (caller) => {
    setRemoteUser(caller);
    setIncomingCall(null);
    setPhase("call");
    await initCall(false, caller.id);
  };

  // Inizializza WebRTC
  const initCall = async (isCaller, remoteUserId) => {
    try {
      setStatus("Acquisizione videocamera e microfono...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      pc.current = new RTCPeerConnection(ICE_SERVERS);
      stream.getTracks().forEach((t) => pc.current.addTrack(t, stream));

      pc.current.ontrack = (e) => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
          setStatus("Chiamata in corso...");
        }
      };

      pc.current.onicecandidate = (e) => {
        if (e.candidate) {
          channel.current.send({
            type: "broadcast",
            event: "webrtc-signal",
            payload: {
              senderId: currentUser.current.id,
              type: "ice-candidate",
              candidate: e.candidate,
            },
          });
        }
      };

      const sortedIds = [String(currentUser.current.id), String(remoteUserId)].sort();
      const callChannelName = `direct-video-call-${sortedIds.join('-')}`;
      channel.current = supabase.channel(callChannelName);

      let incomingCandidateQueue = [];

      const flushCandidateQueue = async () => {
        while (incomingCandidateQueue.length) {
          const c = incomingCandidateQueue.shift();
          try {
            await pc.current.addIceCandidate(new RTCIceCandidate(c));
          } catch (err) {
            console.error('[flushCandidateQueue] addIceCandidate failed:', err, c);
          }
        }
      };

      channel.current.on("broadcast", { event: "webrtc-signal" }, (msg) => {
        const payload = msg?.payload ?? msg;
        if (payload?.type === 'ice-candidate') {
          if (!pc.current || !pc.current.remoteDescription) {
            incomingCandidateQueue.push(payload.candidate);
            return;
          }
        }
        handleSignals(payload, isCaller, incomingCandidateQueue);
      });

      const { error: subscribeError } = await channel.current.subscribe();
      if (subscribeError) console.error('[realtime] subscribe error', subscribeError);
      if (isCaller) {
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        channel.current.send({
          type: "broadcast",
          event: "webrtc-signal",
          payload: {
            senderId: currentUser.current.id,
            type: "offer",
            offer,
          },
        });
        setStatus("Offerta inviata, in attesa di risposta...");
      }
      await flushCandidateQueue();
    } catch (err) {
      console.error(err);
      if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
        setStatus("Errore: per favore, concedi i permessi per videocamera e microfono.");
      } else {
        setStatus("Errore avvio chiamata");
      }
    }
  };

  const handleSignals = async (payload, isCaller, candidateQueue) => {
    if (payload.senderId === currentUser.current.id) return;
    switch (payload.type) {
      case "offer":
        if (!isCaller) {
          await pc.current.setRemoteDescription(payload.offer);
          const answer = await pc.current.createAnswer();
          await pc.current.setLocalDescription(answer);
          channel.current.send({
            type: "broadcast",
            event: "webrtc-signal",
            payload: {
              senderId: currentUser.current.id,
              type: "answer",
              answer,
            },
          });
          setStatus("Risposta inviata, connessione in corso...");
        }
        break;
      case "answer":
        if (isCaller) {
          await pc.current.setRemoteDescription(payload.answer);
        }
        break;
      case "ice-candidate":
        try {
          if (!pc.current.remoteDescription) {
            candidateQueue.push(payload.candidate);
          } else {
            await pc.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
        } catch (e) {
          console.error("ICE error:", e);
        }
        break;
      case "hang-up":
        hangUp();
        break;
      default:
        break;
    }
  };

  const hangUp = () => {
    if (localStream.current)
      localStream.current.getTracks().forEach((t) => t.stop());
    if (pc.current) pc.current.close();
    if (channel.current) supabase.removeChannel(channel.current);
    setPhase("list");
    setRemoteUser(null);
    setStatus("Inizializzazione...");
  };

  const toggleMute = () => {
    if (!localStream.current) return;
    localStream.current.getAudioTracks().forEach(t => t.enabled = !t.enabled);
    setIsMuted(prev => !prev);
  };

  const toggleVideo = () => {
    if (!localStream.current) return;
    localStream.current.getVideoTracks().forEach(t => t.enabled = !t.enabled);
    setIsVideoOff(prev => !prev);
  };

  // === UI ===
  if (phase === "list") {
    return (
      <div style={{ padding: 20 }}>
        <h2>Membri famiglia</h2>
        <ul>
          {familyMembers.filter(m => m.id !== currentUser.current?.id).map((m) => (
            <li key={m.id} style={{ marginBottom: 10 }}>
              {m.username}
              <button style={{ marginLeft: 10 }} onClick={() => startCall(m)}>Chiama</button>
            </li>
          ))}
        </ul>
        {incomingCall && (
          <div style={{ marginTop: 20 }}>
            <p>Chiamata in arrivo da {incomingCall.username}</p>
            <button onClick={() => acceptCall(incomingCall)}>Accetta</button>
          </div>
        )}
      </div>
    );
  }

  if (phase === "call") {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px", background: "#075E54", color: "#fff" }}>
          <h2>Videochiamata</h2>
          <p>{status}</p>
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              position: "absolute",
              bottom: 20,
              right: 20,
              width: 120,
              border: "2px solid #fff",
            }}
          />
        </div>
        <div style={{ padding: "10px", textAlign: "center", display: "flex", justifyContent: "center", gap: 10 }}>
          <button onClick={toggleMute} style={{ padding: 10 }}>{isMuted ? '🔇' : '🎤'}</button>
          <button onClick={toggleVideo} style={{ padding: 10 }}>{isVideoOff ? '📷' : '📹'}</button>
          <button onClick={hangUp} style={{ padding: 10, background: 'red', color: 'white' }}>Termina</button>
        </div>
      </div>
    );
  }

  return null;
}

export default Pagina10;
