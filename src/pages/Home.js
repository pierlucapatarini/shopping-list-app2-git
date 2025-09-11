import React from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Menu Principale</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        <button onClick={() => navigate('/shopping-list')}>Lista della Spesa Fam</button>
        <button onClick={() => navigate('/page2')}>Pagina 2</button>
        <button onClick={() => navigate('/page3')}>Pagina 3</button>
        {/* Aggiungi qui gli altri 5 pulsanti */}
      </div>
    </div>
  );
}

export default Home;