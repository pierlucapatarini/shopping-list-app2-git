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

// Definisci la chiave pubblica VAPID che deve corrispondere a quella sul backend
const VAPID_PUBLIC_KEY = 'BIb7rVR51NVDPSQHfjkC5m6r5i-4VJlYo77y8rBfu-bzRvwF9xn1PERDeUPov8Aj4G29wCECDkqS7-sUkPtxPP4';

// Funzione per registrare il service worker e la sottoscrizione
const setupPushNotifications = async (session) => {
    // Controlla che le notifiche siano supportate dal browser
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Le notifiche push non sono supportate da questo browser.');
        return;
    }

    try {
        // Registra il service worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service worker registrato con successo:', registration);

        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            console.warn('Permesso di notifica negato.');
            return;
        }

        const pushSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: VAPID_PUBLIC_KEY,
        });

        // Salva la sottoscrizione nel database
        const { data, error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: session.user.id,
                subscription: pushSubscription,
                family_group: 'PATARINI' // Inserisci qui l'ID del gruppo familiare dell'utente
            }, { onConflict: 'user_id' });

        if (error) {
            console.error('Errore durante il salvataggio della sottoscrizione:', error);
        } else {
            console.log('Sottoscrizione salvata con successo.', data);
        }
    } catch (error) {
        console.error('Errore nella configurazione delle notifiche push:', error);
    }
};

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
        
        // Registra le notifiche push solo se l'utente è autenticato e la sessione è disponibile
        if (session) {
            setupPushNotifications(session);
        }

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [session]); // Aggiungi 'session' alle dipendenze per far ripartire il setup quando la sessione cambia

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