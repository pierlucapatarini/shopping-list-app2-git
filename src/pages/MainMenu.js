import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../styles/MainStyle.css';

function MainMenu() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="app-layout">
      <header className="header">
        <h1>🏡 Menu Principale</h1>
        <button className="btn-secondary" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <main className="main-content main-menu-grid">
        {/* Pagina 1 - Lista della Spesa */}
        <button
          onClick={() => navigate('/pagina1-shopping-list')}
          className="menu-button"
        >
          🛒 Pagina 1<br />Lista della Spesa
        </button>

        {/* Pagina 2 - Chat di Famiglia */}
        <button
          onClick={() => navigate('/pagina2-family-chat')}
          className="menu-button"
        >
          ✅ Pagina 2<br />Chat di Famiglia
        </button>

        {/* Pagina 3 - Ricette AI */}
        <button
          onClick={() => navigate('/pagina3-ricette-ai')}
          className="menu-button"
        >
          👩‍🍳 Pagina 3<br />Ricette AI
        </button>

        {/* Pagina 4 - Archivio Prodotti */}
        <button
          onClick={() => navigate('/pagina4-archivio-prodotti')}
          className="menu-button"
        >
          📦 Pagina 4<br />Archivio Prodotti
        </button>

        {/* Pagina 5 - Offerte Volantini */}
        <button
          onClick={() => navigate('/pagina5-offerte-volantini')}
          className="menu-button"
        >
          📊 Pagina 5<br />Offerte da volantini
        </button>

        {/* Pagina 6 - Calendario Appuntameni */}
        <button
          onClick={() => navigate('/pagina6-calendario-appuntamenti')}
          className="menu-button"
        >
          🏷️ Pagina 6<br />Calendario Appuntamenti Famiglia
        </button>

        {/* Pagina 7 - Gestione Farmaci e somministrazione*/}
        <button
          onClick={() => navigate('/pagina7-gestione-farmaci')}
          className="menu-button"
        >
          💊 Pagina 7<br />Calendario Farmaci & Gestione
        </button>

        {/* Pagina 8 - Archivio Documenti */}
        <button
          onClick={() => navigate('/pagina8-archivio-documenti')}
          className="menu-button"
        >
          📁 Pagina 8<br />Archivio Documenti
        </button>

        {/* Pagina 9 - Gestione Utenti */}
        <button
          onClick={() => navigate('/pagina9-gestione-utenti')}
          className="menu-button"
        >
          👥 Pagina 9<br />Gestione Utenti
        </button>

{/* Pagina 10 - prova videochiamata */}
        <button
          onClick={() => navigate('/pagina10-VideoChiamata')}
          className="menu-button"
        >
          👥 Pagina 10<br />prova videochiamata
        </button>






      </main>
    </div>
  );
}

export default MainMenu;