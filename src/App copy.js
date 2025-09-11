import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Auth from './pages/Auth';
import MainMenu from './pages/MainMenu';
import ShoppingList from './pages/ShoppingList';
import FamilyChat from './pages/FamilyChat';
import RicetteAI from './pages/RicetteAI';
import CalendarioAppuntamenti from './pages/CalendarioAppuntamenti';

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
        <Route path="/ricette-AI" element={session ? <RicetteAI /> : <Navigate to="/" />} />
        <Route path="/main-menu" element={session ? <MainMenu /> : <Navigate to="/" />} />
        <Route path="/family-chat" element={session ? <FamilyChat /> : <Navigate to="/" />} />
        <Route path="/calendario-appuntamenti" element={session ? <CalendarioAppuntamenti /> : <Navigate to="/" />} />
        <Route path="/shopping-list" element={session ? <ShoppingList /> : <Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;