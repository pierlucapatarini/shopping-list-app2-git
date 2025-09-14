import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Auth from './pages/Auth';
import MainMenu from './pages/MainMenu';
import Pagina1_ShoppingList from './pages/Pagina1_ShoppingList';
import Pagina2_FamilyChat from './pages/Pagina2_FamilyChat';
import SottoPagina2_VideochiamataDiretta from './pages/SottoPagina2_VideochiamataDiretta'; // Importa questo
import SottoPagina2_VideochiamataGruppo from './pages/SottoPagina2_VideochiamataGruppo'; // Importa questo
import Pagina3_RicetteAI from './pages/Pagina3_RicetteAI';
import Pagina4_ArchivioProdotti from './pages/Pagina4_ArchivioProdotti';
import Pagina5_OfferteVolantini from './pages/Pagina5_OfferteVolantini';
import Pagina6_CalendarioAppuntamenti from './pages/Pagina6_CalendarioAppuntamenti';
import Pagina7_GestioneFarmaci from './pages/Pagina7_GestioneFarmaci';
import Pagina8_ArchivioDocumenti from './pages/Pagina8_ArchivioDocumenti';
import Pagina9_GestioneUtenti from './pages/Pagina9_GestioneUtenti';
import DirectVideoChat from './pages/SottoPagina2_VideochiamataDiretta';



function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '20px' }}>Caricamento...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={!session ? <Auth /> : <Navigate to="/main-menu" />} />
        <Route path="/main-menu" element={session ? <MainMenu /> : <Navigate to="/" />} />
        <Route path="/pagina1-shopping-list" element={session ? <Pagina1_ShoppingList /> : <Navigate to="/" />} />
        <Route path="/pagina2-family-chat" element={session ? <Pagina2_FamilyChat /> : <Navigate to="/" />} />
        <Route path="/video-chat-diretta" element={<SottoPagina2_VideochiamataDiretta />} /> // Aggiungi questa linea
        <Route path="/video-chat-gruppo" element={<SottoPagina2_VideochiamataGruppo />} /> // Aggiungi questa linea
        <Route path="/pagina3-ricette-ai" element={session ? <Pagina3_RicetteAI /> : <Navigate to="/" />} />
        <Route path="/pagina4-archivio-prodotti" element={session ? <Pagina4_ArchivioProdotti /> : <Navigate to="/" />} />
        <Route path="/pagina5-offerte-volantini" element={session ? <Pagina5_OfferteVolantini /> : <Navigate to="/" />} />
        <Route path="/pagina6-calendario-appuntamenti" element={session ? <Pagina6_CalendarioAppuntamenti /> : <Navigate to="/" />} />
        <Route path="/pagina7-gestione-farmaci" element={session ? <Pagina7_GestioneFarmaci /> : <Navigate to="/" />} />
        <Route path="/pagina8-archivio-documenti" element={session ? <Pagina8_ArchivioDocumenti /> : <Navigate to="/" />} />
        <Route path="/pagina9-gestione-utenti" element={session ? <Pagina9_GestioneUtenti /> : <Navigate to="/" />} />
        <Route path="/direct-video/:remoteUserId" element={<DirectVideoChat />} />

      </Routes>
    </Router>
  );
}

export default App;

