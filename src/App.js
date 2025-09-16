import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Auth from './pages/Auth';
import MainMenu from './pages/MainMenu';
import Pagina1_ShoppingList from './pages/Pagina1_ShoppingList';
import Pagina2_FamilyChat from './pages/Pagina2_FamilyChat';
import SottoPagina2_VideochiamataDiretta from './pages/SottoPagina2_VideochiamataDiretta';
import SottoPagina2_VideochiamataGruppo from './pages/SottoPagina2_VideochiamataGruppo';
import Pagina3_RicetteAI from './pages/Pagina3_RicetteAI';
import Pagina4_ArchivioProdotti from './pages/Pagina4_ArchivioProdotti';
import Pagina5_OfferteVolantini from './pages/Pagina5_OfferteVolantini';
import Pagina6_CalendarioAppuntamenti from './pages/Pagina6_CalendarioAppuntamenti';
import Pagina7_GestioneFarmaci from './pages/Pagina7_GestioneFarmaci';
import Pagina8_ArchivioDocumenti from './pages/Pagina8_ArchivioDocumenti';
import Pagina9_GestioneUtenti from './pages/Pagina9_GestioneUtenti';

import VideoCallPage from './components/VideoCallPage';
import Videochiamate from './components/Videochiamate';

// 🔑 Chiave pubblica VAPID (deve corrispondere a quella usata dal backend/edge function)
const VAPID_PUBLIC_KEY = 'BA1yRnhH-u3I41onTHomTbQoxRpZxwhpPLnNT8N_zqNI8WeUZwSVf8ln_AmS9f1Ec6dwUBR1erYk76pomNKfSds';

// Utility per convertire Base64 → Uint8Array (richiesto per applicationServerKey)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const setupPushNotifications = async (session) => {
  // ⚠️ DISABILITA IN SVILUPPO
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🔕 Push notifications disabilitate in localhost');
    return;
  }
  
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Le notifiche push non sono supportate da questo browser.');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('✅ Service worker registrato:', registration);

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('❌ Permesso di notifica negato.');
      return;
    }

    // Controlla se una sottoscrizione push esiste già
    const existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      const { endpoint, keys } = existingSubscription.toJSON();
      
      const { data: dbSubscription, error: fetchError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('endpoint', endpoint)
        .single();
      
      if (dbSubscription) {
        console.log('✅ Sottoscrizione push già presente e valida.');
        return;
      }
    }

    // Se non esiste, crea nuova sottoscrizione
    const pushSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const { endpoint, keys } = pushSubscription.toJSON();

    // Elimina eventuali duplicati
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', session.user.id);

    // Inserisci la nuova sottoscrizione
    const { data, error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        family_group: 'PATARINI',
      });

    if (error) {
      console.error('❌ Errore salvataggio sottoscrizione:', error);
    } else {
      console.log('✅ Sottoscrizione salvata con successo:', data);
    }

  } catch (error) {
    if (error.name === 'AbortError' && error.message.includes('push service')) {
      console.warn('⚠️ Servizio push non disponibile in sviluppo locale');
    } else {
      console.error('❌ Errore configurazione notifiche push:', error);
    }
  }
};
// ... (resto del codice)

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

    // Registra notifiche push se utente autenticato
    if (session) {
      setupPushNotifications(session);
    }

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [session]);

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
        <Route path="/video-chat-diretta" element={<SottoPagina2_VideochiamataDiretta />} />
        <Route path="/video-chat-gruppo" element={<SottoPagina2_VideochiamataGruppo />} />
        <Route path="/pagina3-ricette-ai" element={session ? <Pagina3_RicetteAI /> : <Navigate to="/" />} />
        <Route path="/pagina4-archivio-prodotti" element={session ? <Pagina4_ArchivioProdotti /> : <Navigate to="/" />} />
        <Route path="/pagina5-offerte-volantini" element={session ? <Pagina5_OfferteVolantini /> : <Navigate to="/" />} />
        <Route path="/pagina6-calendario-appuntamenti" element={session ? <Pagina6_CalendarioAppuntamenti /> : <Navigate to="/" />} />
        <Route path="/pagina7-gestione-farmaci" element={session ? <Pagina7_GestioneFarmaci /> : <Navigate to="/" />} />
        <Route path="/pagina8-archivio-documenti" element={session ? <Pagina8_ArchivioDocumenti /> : <Navigate to="/" />} />
        <Route path="/pagina9-gestione-utenti" element={session ? <Pagina9_GestioneUtenti /> : <Navigate to="/" />} />
        <Route path="/video-call-page/:userId" element={<VideoCallPage />} />
        <Route path="/pagina10-VideoChiamata" element={<Videochiamate />} />
      </Routes>
    </Router>
  );
}

export default App;
