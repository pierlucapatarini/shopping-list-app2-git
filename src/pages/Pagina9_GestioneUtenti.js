import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../styles/MainStyle.css';

function Pagina9_GestioneUtenti() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const navigate = useNavigate();

  const availableAvatars = [
    '👤', '👨', '👩', '🧑', '👶', '👦', '👧', '🧒',
    '👨‍💼', '👩‍💼', '👨‍🎓', '👩‍🎓', '👨‍⚕️', '👩‍⚕️',
    '👨‍🍳', '👩‍🍳', '👨‍💻', '👩‍💻', '👨‍🎨', '👩‍🎨',
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
    '🌟', '⭐', '💫', '✨', '🔥', '💎', '🏆', '🎯'
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      setCurrentUser(user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('family_group')
        .eq('id', user.id)
        .single();
      
      if (!profile || !profile.family_group) {
        setUsers([]);
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar, family_group')
        .eq('family_group', profile.family_group)
        .order('username', { ascending: true });

      if (error) throw error;

      setUsers(data);
    } catch (error) {
      console.error("Errore nel recupero degli utenti:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateAvatar = async (userId, newAvatar) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar: newAvatar })
        .eq('id', userId);
      
      if (error) throw error;
      
      fetchUsers();
      setShowAvatarSelector(false);
    } catch (error) {
      console.error("Errore nell'aggiornamento dell'avatar:", error.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (userId === currentUser.id) {
      alert("Non puoi eliminare il tuo stesso account da questa pagina.");
      return;
    }
    
    if (window.confirm("Sei sicuro di voler rimuovere questo utente dal gruppo famiglia?")) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ family_group: null })
          .eq('id', userId);

        if (error) throw error;
        
        fetchUsers();
      } catch (error) {
        console.error("Errore nella rimozione dell'utente:", error.message);
      }
    }
  };

  const handleShowAvatarSelector = (userId) => {
    setSelectedUserId(userId);
    setShowAvatarSelector(true);
  };

  if (loading) {
    return <div className="loading">Caricamento utenti...</div>;
  }

  return (
    <div className="app-layout">
      <header className="header">
        <h1>👥 Gestione Utenti</h1>
        <p>Gestisci i membri del tuo gruppo famiglia.</p>
        <button onClick={() => navigate('/main-menu')} className="btn-secondary">
          Menu Principale
        </button>
      </header>

      <main className="main-content">
        <ul className="list user-list">
          {users.map((user) => (
            <li key={user.id} className="list-item">
              <div className="user-info">
                <span className="user-avatar">{user.avatar || '👤'}</span>
                <span className="user-name">
                  {user.username} {user.id === currentUser.id ? '(Tu)' : ''}
                </span>
              </div>
              <div className="item-actions">
                <button
                  onClick={() => handleShowAvatarSelector(user.id)}
                  className="btn-edit"
                  title="Cambia Avatar"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDeleteUser(user.id)}
                  className="btn-delete"
                  title="Rimuovi Utente"
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>

      {showAvatarSelector && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Scegli un nuovo Avatar</h2>
              <button onClick={() => setShowAvatarSelector(false)} className="btn-cancel">
                ✕
              </button>
            </div>
            <div className="avatar-grid">
              {availableAvatars.map((avatar, index) => (
                <button
                  key={index}
                  onClick={() => updateAvatar(selectedUserId, avatar)}
                  className="avatar-option"
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Pagina9_GestioneUtenti;