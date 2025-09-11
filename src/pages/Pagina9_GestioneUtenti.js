import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function Pagina9_GestioneUtenti() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const navigate = useNavigate();

  // Lista di emoji/icone disponibili
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
      
      // Ottieni l'utente corrente
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      // Ottieni il family_group dell'utente corrente dal suo profilo
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('family_group')
        .eq('id', user.id)
        .single();

      if (!currentUserProfile) {
        console.error('Profilo utente non trovato');
        return;
      }

      // Ottieni tutti gli utenti della stessa famiglia
      const { data: familyProfiles, error } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          family_group,
          avatar,
          email,
          created_at
        `)
        .eq('family_group', currentUserProfile.family_group)
        .order('username');

      if (error) {
        console.error('Errore nel recupero profili:', error);
        return;
      }

      // Aggiungi flag per utente corrente
      const usersWithEmails = familyProfiles.map(profile => ({
        ...profile,
        isCurrentUser: profile.id === user.id
      }));

      setUsers(usersWithEmails);
      setCurrentUser(user);
      
    } catch (error) {
      console.error('Errore nel caricamento utenti:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAvatar = async (userId, newAvatar) => {
    try {
      console.log('🔄 Tentativo aggiornamento avatar:', { userId, newAvatar });
      
      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar: newAvatar })
        .eq('id', userId)
        .select(); // Aggiungo select per vedere il risultato

      console.log('📤 Risultato update:', { data, error });

      if (error) {
        console.error('❌ Errore nell\'aggiornamento avatar:', error);
        alert(`Errore: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        console.log('✅ Avatar aggiornato con successo:', data[0]);
        
        // Aggiorna lo stato locale
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, avatar: newAvatar } : user
        ));
        
        setShowAvatarSelector(false);
        setSelectedUserId(null);
        
        alert('✅ Avatar salvato con successo!');
      } else {
        console.error('❌ Nessun record aggiornato');
        alert('❌ Errore: Nessun record aggiornato');
      }
      
    } catch (error) {
      console.error('💥 Errore generale:', error);
      alert(`Errore generale: ${error.message}`);
    }
  };

  const handleAvatarClick = (userId, isCurrentUser) => {
    if (isCurrentUser) {
      setSelectedUserId(userId);
      setShowAvatarSelector(true);
    }
  };

  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '40px 20px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  };

  const cardStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    padding: '40px',
    borderRadius: '24px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
    maxWidth: '800px',
    margin: '0 auto',
    border: '1px solid rgba(255,255,255,0.2)',
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '20px',
  };

  const titleStyle = {
    margin: 0,
    fontSize: '2.2em',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  };

  const backButtonStyle = {
    padding: '12px 24px',
    borderRadius: '12px',
    backgroundColor: '#64748b',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.95em',
    boxShadow: '0 4px 15px rgba(100, 116, 139, 0.3)',
    transition: 'all 0.3s ease',
  };

  const userCardStyle = {
    backgroundColor: 'white',
    border: '2px solid #e2e8f0',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
    transition: 'all 0.3s ease',
  };

  const currentUserCardStyle = {
    ...userCardStyle,
    border: '2px solid #10b981',
    backgroundColor: '#f0fdf4',
  };

  const avatarStyle = {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2em',
    cursor: 'pointer',
    border: '2px solid #e2e8f0',
    transition: 'all 0.3s ease',
  };

  const avatarSelectorStyle = {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const selectorPanelStyle = {
    backgroundColor: 'white',
    borderRadius: '20px',
    padding: '30px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
  };

  const avatarGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: '10px',
    marginBottom: '20px',
  };

  const avatarOptionStyle = {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    backgroundColor: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5em',
    cursor: 'pointer',
    border: '2px solid transparent',
    transition: 'all 0.3s ease',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <h2>Caricamento utenti...</h2>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>👥 Gestione Utenti</h1>
          <button
            onClick={() => navigate('/main-menu')}
            style={backButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(100, 116, 139, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(100, 116, 139, 0.3)';
            }}
          >
            ← Torna al Menu
          </button>
        </div>

        <p style={{ color: '#64748b', marginBottom: '30px', fontSize: '1.1em' }}>
          Utenti della famiglia: <strong>{users[0]?.family_group}</strong>
        </p>

        <div>
          {users.map((user) => (
            <div 
              key={user.id} 
              style={user.isCurrentUser ? currentUserCardStyle : userCardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = userCardStyle.boxShadow;
              }}
            >
              <div 
                style={avatarStyle}
                onClick={() => handleAvatarClick(user.id, user.isCurrentUser)}
                onMouseEnter={(e) => {
                  if (user.isCurrentUser) {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.backgroundColor = '#e2e8f0';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                title={user.isCurrentUser ? 'Clicca per cambiare avatar' : ''}
              >
                {user.avatar || '👤'}
              </div>
              
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.2em' }}>
                  {user.username}
                  {user.isCurrentUser && (
                    <span style={{ 
                      marginLeft: '10px', 
                      fontSize: '0.8em', 
                      color: '#10b981',
                      fontWeight: 'normal',
                      backgroundColor: '#dcfce7',
                      padding: '4px 8px',
                      borderRadius: '6px'
                    }}>
                      Tu
                    </span>
                  )}
                </h3>
                <p style={{ margin: '0 0 4px 0', color: '#64748b' }}>
                  📧 {user.email}
                </p>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9em' }}>
                  Membro dal: {new Date(user.created_at).toLocaleDateString('it-IT')}
                </p>
              </div>
            </div>
          ))}
        </div>

        {users.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            <h3>Nessun utente trovato nella tua famiglia</h3>
          </div>
        )}
      </div>

      {/* Avatar Selector Modal */}
      {showAvatarSelector && (
        <div style={avatarSelectorStyle}>
          <div style={selectorPanelStyle}>
            <h3 style={{ marginTop: 0, color: '#1e293b' }}>Scegli il tuo Avatar</h3>
            
            <div style={avatarGridStyle}>
              {availableAvatars.map((avatar, index) => (
                <div
                  key={index}
                  style={avatarOptionStyle}
                  onClick={() => updateAvatar(selectedUserId, avatar)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e2e8f0';
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.borderColor = '#10b981';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  {avatar}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAvatarSelector(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Pagina9_GestioneUtenti;