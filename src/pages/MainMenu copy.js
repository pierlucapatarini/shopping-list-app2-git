import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function MainMenu() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const buttonStyle = {
    padding: '20px 24px',
    borderRadius: '16px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: '#64748b',
    color: 'white',
    fontSize: '1em',
    fontWeight: '600',
    boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '120px',
    position: 'relative',
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: '1.4',
    background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
  };

  const activeButtonStyle = {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    boxShadow: '0 12px 35px rgba(16, 185, 129, 0.4)',
  };

  const emptyButtonHoverStyle = {
    transform: 'translateY(-8px) scale(1.02)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
    background: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
  };

  const activeButtonHoverStyle = {
    transform: 'translateY(-8px) scale(1.02)',
    boxShadow: '0 20px 40px rgba(16, 185, 129, 0.5)',
    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
  };

  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    position: 'relative',
  };

  const cardStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    padding: '50px',
    borderRadius: '24px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
    textAlign: 'center',
    maxWidth: '90%',
    width: '700px',
    border: '1px solid rgba(255,255,255,0.2)',
    position: 'relative',
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
    fontSize: '2.5em',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  };

  const logoutButtonStyle = {
    padding: '12px 24px',
    borderRadius: '12px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.95em',
    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
    transition: 'all 0.3s ease',
  };

  const subtitleStyle = {
    color: '#64748b',
    marginBottom: '50px',
    fontSize: '1.2em',
    fontWeight: '500',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '25px',
    marginBottom: '40px',
  };

  // Decorative elements
  const decorativeCircle1 = {
    position: 'absolute',
    top: '10%',
    right: '10%',
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
    filter: 'blur(1px)',
    zIndex: '0',
  };

  const decorativeCircle2 = {
    position: 'absolute',
    bottom: '15%',
    left: '5%',
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
    filter: 'blur(1px)',
    zIndex: '0',
  };

  return (
    <div style={containerStyle}>
      <div style={decorativeCircle1}></div>
      <div style={decorativeCircle2}></div>
      
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Menu Principale</h1>
          <button
            onClick={handleLogout}
            style={logoutButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(239, 68, 68, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.3)';
            }}
          >
            Esci
          </button>
        </div>

        <p style={subtitleStyle}>Seleziona un'opzione per continuare</p>

        <div style={gridStyle}>
          
          {/* Pagina 1 - Lista della Spesa (Attiva) */}
          <button
            onClick={() => navigate('/pagina1-shopping-list')}
            style={{ ...buttonStyle, ...activeButtonStyle }}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, activeButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, { 
              transform: 'translateY(0px) scale(1)', 
              boxShadow: activeButtonStyle.boxShadow,
              background: activeButtonStyle.background 
            })}
          >
            🛒 Pagina 1<br/>Lista Spesa
          </button>

          {/* Pagina 2 - Family Chat (Attiva) */}
          <button
            onClick={() => navigate('/pagina2-family-chat')}
            style={{ ...buttonStyle, ...activeButtonStyle }}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, activeButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, { 
              transform: 'translateY(0px) scale(1)', 
              boxShadow: activeButtonStyle.boxShadow,
              background: activeButtonStyle.background 
            })}
          >
            💬 Pagina 2<br/>Family Chat
          </button>

          {/* Pagina 3 - Ricette AI */}
          <button
            onClick={() => navigate('/pagina3-ricette-ai')}
            style={buttonStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, emptyButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, { 
              transform: 'translateY(0px) scale(1)', 
              boxShadow: buttonStyle.boxShadow,
              background: buttonStyle.background 
            })}
          >
            🤖 Pagina 3<br/>Ricette AI
          </button>

          {/* Pagina 4 - Archivio Prodotti */}
          <button
            onClick={() => navigate('/pagina4-archivio-prodotti')}
            style={buttonStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, emptyButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, { 
              transform: 'translateY(0px) scale(1)', 
              boxShadow: buttonStyle.boxShadow,
              background: buttonStyle.background 
            })}
          >
            📦 Pagina 4<br/>Archivio Prodotti
          </button>

          {/* Pagina 5 - Offerte Volantini */}
          <button
            onClick={() => navigate('/pagina5-offerte-volantini')}
            style={buttonStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, emptyButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, { 
              transform: 'translateY(0px) scale(1)', 
              boxShadow: buttonStyle.boxShadow,
              background: buttonStyle.background 
            })}
          >
            🏷️ Pagina 5<br/>Offerte Volantini
          </button>

          {/* Pagina 6 - Calendario Appuntamenti */}
          <button
            onClick={() => navigate('/pagina6-calendario-appuntamenti')}
            style={buttonStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, emptyButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, { 
              transform: 'translateY(0px) scale(1)', 
              boxShadow: buttonStyle.boxShadow,
              background: buttonStyle.background 
            })}
          >
            📅 Pagina 6<br/>Calendario Appuntamenti
          </button>

          {/* Pagina 7 - Messaggi Famiglia */}
          <button
            onClick={() => navigate('/pagina7-messaggi-famiglia')}
            style={buttonStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, emptyButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, { 
              transform: 'translateY(0px) scale(1)', 
              boxShadow: buttonStyle.boxShadow,
              background: buttonStyle.background 
            })}
          >
            📨 Pagina 7<br/>Messaggi Famiglia
          </button>

          {/* Pagina 8 - Archivio Documenti */}
          <button
            onClick={() => navigate('/pagina8-archivio-documenti')}
            style={buttonStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, emptyButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, { 
              transform: 'translateY(0px) scale(1)', 
              boxShadow: buttonStyle.boxShadow,
              background: buttonStyle.background 
            })}
          >
            📁 Pagina 8<br/>Archivio Documenti
          </button>

          {/* Pagina 9 - Gestione Utenti */}
          <button
            onClick={() => navigate('/pagina9-gestione-utenti')}
            style={buttonStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, emptyButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, { 
              transform: 'translateY(0px) scale(1)', 
              boxShadow: buttonStyle.boxShadow,
              background: buttonStyle.background 
            })}
          >
            👥 Pagina 9<br/>Gestione Utenti
          </button>

        </div>
      </div>
    </div>
  );
}

export default MainMenu;