import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import '../styles/MainStyle.css';

function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [familyGroup, setFamilyGroup] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState(null);
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
      navigate('/main-menu');
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
      setMessage({ type: 'success', text: 'Registrazione riuscita! Controlla la tua email per confermare.' });
      setIsRegistering(false);
    }
    setLoading(false);
  };

  return (
    <div className="app-layout auth-container">
      <div className="form-card">
        <h1 className="auth-title">{isRegistering ? 'Crea un Account' : 'Accedi'}</h1>
        
        {message && (
          <div className={`info-box ${message.type === 'error' ? 'red' : ''}`}>
            {message.text}
          </div>
        )}

        {isRegistering ? (
          <form onSubmit={handleRegister} className="auth-form">
            <div className="form-group">
                <input
                    type="email"
                    placeholder="La tua email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                    required
                />
            </div>
            <div className="form-group">
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    required
                />
            </div>
            <div className="form-group">
                <input
                    type="text"
                    placeholder="Nome Utente"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="form-input"
                    required
                />
            </div>
            <div className="form-group">
                <input
                    type="text"
                    placeholder="Gruppo Famiglia (Es. Rossi)"
                    value={familyGroup}
                    onChange={(e) => setFamilyGroup(e.target.value)}
                    className="form-input"
                    required
                />
            </div>
            <button type="submit" disabled={loading} className="btn-primary auth-button">
              {loading ? 'Caricamento...' : 'Conferma Registrazione'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
                <input
                    type="email"
                    placeholder="La tua email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                    required
                />
            </div>
            <div className="form-group">
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    required
                />
            </div>
            <button type="submit" disabled={loading} className="btn-primary auth-button">
              {loading ? 'Caricamento...' : 'Accedi'}
            </button>
          </form>
        )}

        <button
          className="btn-link"
          onClick={() => setIsRegistering(!isRegistering)}
        >
          {isRegistering ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
        </button>
      </div>
    </div>
  );
}

export default Auth;