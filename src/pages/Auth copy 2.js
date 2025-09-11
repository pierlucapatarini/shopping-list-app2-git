import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [familyGroup, setFamilyGroup] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState(null); // Nuovo stato per i messaggi
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Accesso riuscito!' });
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { family_group: familyGroup, username: username },
      },
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Registrazione completata! Puoi fare il login.' });
      setIsRegistering(false);
    }
    setLoading(false);
  };

  const buttonStyle = {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1em',
    fontWeight: 'bold',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    transition: 'background-color 0.3s ease',
  };

  const messageStyle = {
    padding: '10px 15px',
    borderRadius: '8px',
    marginBottom: '15px',
    textAlign: 'center',
    fontWeight: 'bold',
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f4f8', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
        <h1 style={{ color: '#333', marginBottom: '30px' }}>
          {isRegistering ? 'Registrati' : 'Accedi'}
        </h1>

        {message && (
          <div style={{ ...messageStyle, backgroundColor: message.type === 'error' ? '#ffebee' : '#e8f5e9', color: message.type === 'error' ? '#c62828' : '#2e7d32' }}>
            {message.text}
          </div>
        )}

        {isRegistering ? (
          <form onSubmit={handleRegister}>
            <input
              type="text"
              placeholder="Nome Utente"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
              required
            />
            <input
              type="text"
              placeholder="Gruppo Famiglia"
              value={familyGroup}
              onChange={(e) => setFamilyGroup(e.target.value)}
              style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
              required
            />
            <input
              type="email"
              placeholder="La tua email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #ccc' }}
              required
            />
            <button type="submit" disabled={loading} style={{ ...buttonStyle, width: '100%', backgroundColor: '#2196F3', color: 'white' }}>
              {loading ? 'Caricamento...' : 'Registrati'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="La tua email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #ccc' }}
              required
            />
            <button type="submit" disabled={loading} style={{ ...buttonStyle, width: '100%', backgroundColor: '#4CAF50', color: 'white' }}>
              {loading ? 'Caricamento...' : 'Accedi'}
            </button>
          </form>
        )}

        <button
          style={{ ...buttonStyle, marginTop: '20px', backgroundColor: 'transparent', color: '#555', boxShadow: 'none' }}
          onClick={() => setIsRegistering(!isRegistering)}
        >
          {isRegistering ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
        </button>
      </div>
    </div>
  );
}

export default Auth;
