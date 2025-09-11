import React from 'react';
import { useNavigate } from 'react-router-dom';

function ArchivioDocumenti() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Archivio Documenti</h1>
      <p>Qui potrai caricare e visualizzare i documenti della famiglia.</p>
      <button onClick={() => navigate('/main-menu')} style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
        Torna al menu principale
      </button>
    </div>
  );
}

export default ArchivioDocumenti;
