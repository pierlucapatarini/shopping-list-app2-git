import React from 'react';
import { useNavigate } from 'react-router-dom';

function OfferteVolantini() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f0f4f7', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1 style={{ color: '#333' }}>Offerte Prodotti da Volantini</h1>
      <p style={{ color: '#666' }}>Questa pagina mostrerà le offerte dei prodotti dai volantini.</p>
      <button 
        onClick={() => navigate('/main-menu')}
        style={{ padding: '10px 20px', marginTop: '20px', borderRadius: '8px', backgroundColor: '#607d8b', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
      >
        Torna al Menu Principale
      </button>
    </div>
  );
}

export default OfferteVolantini;
