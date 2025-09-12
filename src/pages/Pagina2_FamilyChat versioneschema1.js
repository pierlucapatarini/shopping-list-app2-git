import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

function FamilyChat() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [familyGroup, setFamilyGroup] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('DISCONNECTED');

  const messagesEndRef = useRef(null);
  const chatChannel = useRef(null);

  const navigate = useNavigate();

  // scroll automatico
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // inizializzazione utente, fetch e realtime
  useEffect(() => {
    const initChat = async () => {
      setLoading(true);
      try {
        // utente corrente
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return;
        setUser(user);

        const fg = user.user_metadata.family_group;
        if (!fg) return;
        setFamilyGroup(fg);

        // fetch messaggi con join profilo mittente
        const { data: messagesData, error: fetchError } = await supabase
          .from('messages')
          .select('id, content, created_at, family_group, sender_id, profiles:sender_id(username)')
          .eq('family_group', fg)
          .order('created_at', { ascending: true });

        if (fetchError) console.error(fetchError);

        setMessages(messagesData || []);
        scrollToBottom();

        // sottoscrizione realtime
        chatChannel.current = supabase
          .channel(`messages-${fg}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `family_group=eq.${fg}`,
            },
            async (payload) => {
              if (!payload.new) return;

              // recupera username mittente
              const { data: senderData } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', payload.new.sender_id)
                .single();

              const newMsg = {
                ...payload.new,
                profiles: { username: senderData?.username || 'Sconosciuto' },
              };

              setMessages((prev) => [...prev, newMsg]);
              scrollToBottom();
            }
          )
          .subscribe();

        setRealtimeStatus('SUBSCRIBED');
      } catch (error) {
        console.error('Errore inizializzazione chat:', error);
      } finally {
        setLoading(false);
      }
    };

    initChat();

    return () => {
      if (chatChannel.current) supabase.removeChannel(chatChannel.current);
    };
  }, []);

  // invio messaggio
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !familyGroup) return;

    const messageData = {
      content: newMessage,
      family_group: familyGroup,
      sender_id: user.id,
    };

    try {
      const { data: insertedData, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select('id, content, created_at, family_group, sender_id')
        .single();

      if (error) throw error;

      // fallback locale: aggiunge subito il messaggio
      setMessages((prev) => [
        ...prev,
        {
          ...insertedData,
          profiles: { username: user.user_metadata.username || 'Tu' },
        },
      ]);

      setNewMessage('');
      scrollToBottom();
    } catch (error) {
      console.error('Errore invio messaggio:', error);
    }
  };

  const isMyMessage = (msg) => user && msg.sender_id === user.id;

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '15px', backgroundColor: '#075E54', color: 'white' }}>
        <h1>💬 Patarini's143 Social Chat</h1>
        <div>Realtime: {realtimeStatus}</div>
      </div>

      {/* Lista messaggi */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#e5ddd5' }}>
        {loading ? (
          <div>⏳ Caricamento messaggi...</div>
        ) : messages.length === 0 ? (
          <div>Inizia la conversazione con la tua famiglia!</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: isMyMessage(msg) ? 'row-reverse' : 'row',
                marginBottom: '10px',
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '10px',
                  borderRadius: '15px',
                  backgroundColor: isMyMessage(msg) ? '#DCF8C6' : 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <strong>{msg.profiles?.username || 'Sconosciuto'}:</strong> {msg.content}
                <div style={{ fontSize: '0.75em', color: '#888', marginTop: '5px' }}>
                  {formatTimestamp(msg.created_at)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input messaggio */}
      <form
        onSubmit={handleSendMessage}
        style={{ display: 'flex', padding: '15px', backgroundColor: '#f0f0f0' }}
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Scrivi un messaggio..."
          style={{ flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid #ddd', marginRight: '10px' }}
        />
        <button
          type="submit"
          style={{
            padding: '10px 20px',
            borderRadius: '20px',
            backgroundColor: '#25D366',
            color: 'white',
            border: 'none',
          }}
        >
          ➤
        </button>
      </form>
    </div>
  );
}

export default FamilyChat;
