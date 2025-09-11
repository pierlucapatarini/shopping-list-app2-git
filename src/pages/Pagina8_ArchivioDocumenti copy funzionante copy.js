import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../styles/archivio.css';

function ArchivioDocumenti() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [editableFileName, setEditableFileName] = useState('');
  const [description, setDescription] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [familyGroup, setFamilyGroup] = useState(null);
  const [familyUsers, setFamilyUsers] = useState([]);
  const [selectedUploaderId, setSelectedUploaderId] = useState('');

  // Stato per i filtri di ricerca
  const [searchUsernames, setSearchUsernames] = useState([]);
  const [searchYear, setSearchYear] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [hasSearched, setHasSearched] = useState(false);


  const fetchDocuments = async (group, filters) => {
    setLoading(true);
    let query = supabase
      .from('documents')
      .select('*')
      .eq('family_group', group)
      .order('created_at', { ascending: false });

    if (filters.usernames && filters.usernames.length > 0) {
      query = query.in('username', filters.usernames);
    }

    if (filters.year) {
      const startOfYear = `${filters.year}-01-01`;
      const endOfYear = `${filters.year}-12-31`;
      query = query.gte('reference_date', startOfYear).lte('reference_date', endOfYear);
    }
    
    // Ricerca combinata su nome file e descrizione
    if (filters.searchQuery) {
        query = query.or(`file_name.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`);
    }

    const { data: documentsData, error: documentsError } = await query;

    if (documentsError) {
      console.error('Errore nel recupero dei documenti:', documentsError);
      setDocuments([]);
    } else {
      setDocuments(documentsData);
    }
    setLoading(false);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            const userId = session.user.id;
            
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('family_group, username')
                .eq('id', userId)
                .single();

            let currentFamilyGroup;
            if (profileError || !profileData || !profileData.family_group) {
                currentFamilyGroup = crypto.randomUUID(); 
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ family_group: currentFamilyGroup })
                    .eq('id', userId);
                
                if (updateError) {
                    console.error('Errore durante l\'aggiornamento del family_group:', updateError);
                    throw new Error('Impossibile assegnare un family group.');
                }
            } else {
                currentFamilyGroup = profileData.family_group;
            }
            setFamilyGroup(currentFamilyGroup);
            setSelectedUploaderId(userId);

            const { data: usersData, error: usersError } = await supabase
              .from('profiles')
              .select('id, username')
              .eq('family_group', currentFamilyGroup)
              .order('username', { ascending: true });

            if (usersError) {
              console.error('Errore nel recupero degli utenti del gruppo:', usersError);
            } else {
              setFamilyUsers(usersData);
            }

            setLoading(false);
        } else {
            console.warn('Nessun utente autenticato. Reindirizzamento al login.');
            navigate('/login');
        }
      } catch (error) {
          console.error('Errore nel caricamento dei dati:', error);
          setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const fileNameWithoutExt = selectedFile.name.split('.').slice(0, -1).join('.');
      setEditableFileName(fileNameWithoutExt);
    }
  };

  const handleSearch = () => {
    setHasSearched(true);
    fetchDocuments(familyGroup, {
      usernames: searchUsernames,
      year: searchYear,
      searchQuery: searchQuery,
    });
  };
  
  const handleResetFilters = () => {
    setSearchUsernames([]);
    setSearchYear('');
    setSearchQuery('');
    setDocuments([]);
    setHasSearched(false);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !familyGroup || !selectedUploaderId) {
        alert("Per favore, seleziona un file e una data di riferimento.");
        return;
    }

    setLoading(true);
    
    // Gestione della data di riferimento automatica
    const finalReferenceDate = referenceDate || new Date().toISOString().slice(0, 10);
    
    const fileExtension = file.name.split('.').pop();
    const finalFileName = `${editableFileName}.${fileExtension}`;
    const uniqueFilePath = `${familyGroup}/${Date.now()}-${finalFileName}`;
    const selectedUploader = familyUsers.find(user => user.id === selectedUploaderId);

    const { error: uploadError } = await supabase.storage
      .from('family_documents')
      .upload(uniqueFilePath, file);

    if (uploadError) {
      console.error('Errore nel caricamento del file:', uploadError);
      setLoading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('family_documents')
      .getPublicUrl(uniqueFilePath);

    const { error: insertError } = await supabase
      .from('documents')
      .insert([
        {
          family_group: familyGroup,
          uploaded_by: selectedUploaderId,
          file_url: publicUrl,
          file_name: finalFileName,
          file_type: file.type,
          description: description,
          username: selectedUploader.username,
          reference_date: finalReferenceDate,
        },
      ]);

    if (insertError) {
      console.error('Errore nell\'inserimento dei dati:', insertError);
      await supabase.storage.from('family_documents').remove([uniqueFilePath]);
    } else {
      setFile(null);
      setEditableFileName('');
      setDescription('');
      setReferenceDate('');
      handleSearch();
    }
    setLoading(false);
  };

  const handleDelete = async (docId, fileName) => {
    const filePath = `${familyGroup}/${fileName}`;
    
    if (window.confirm("Sei sicuro di voler eliminare questo documento?")) {
      setLoading(true);
      
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', docId);

      if (deleteError) {
        console.error('Errore nell\'eliminazione dal database:', deleteError);
        setLoading(false);
        return;
      }
      
      const { error: storageError } = await supabase.storage
        .from('family_documents')
        .remove([filePath]);

      if (storageError) {
        console.error('Errore nell\'eliminazione del file dallo storage:', storageError);
      }

      handleSearch();
    }
  };
  
  const handleUsernameChange = (username) => {
    setSearchUsernames(prev => {
        if (prev.includes(username)) {
            return prev.filter(name => name !== username);
        } else {
            return [...prev, username];
        }
    });
  };

  return (
    <div className="archivio-container">
      <h1 className="title">Archivio Documenti</h1>
      <p className="subtitle">Qui potrai caricare e visualizzare i documenti della famiglia.</p>

      {/* Sezione di caricamento */}
      <section className="card">
        <h2 className="card-title">Carica un nuovo documento</h2>
        <form onSubmit={handleUpload} className="form-upload">
          <div className="form-group">
            <label htmlFor="file-input" className="file-label">
              Scegli un file
              <input 
                id="file-input"
                type="file" 
                onChange={handleFileChange} 
                required 
                className="input-file"
              />
            </label>
            {file && <span className="file-name">{file.name}</span>}
          </div>
          {file && (
            <div className="form-group">
                <label className="input-label" htmlFor="editable-name">Nome File</label>
                <div className="input-with-note">
                    <input 
                        id="editable-name"
                        type="text"
                        value={editableFileName}
                        onChange={(e) => setEditableFileName(e.target.value)}
                        className="input-text"
                        placeholder="Nome File"
                    />
                    <small className="input-note">Digitare qui per cambiare nome al file</small>
                </div>
            </div>
          )}
          <div className="form-group">
            <label className="input-label" htmlFor="description">Descrizione</label>
            <input 
              id="description"
              type="text" 
              placeholder="Aggiungi una descrizione" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="input-text"
            />
          </div>
          <div className="form-group">
            <label className="input-label required-label" htmlFor="ref-date">Data di riferimento <span className="required-star">*</span></label>
            <div className="input-with-note">
              <input 
                id="ref-date"
                type="date" 
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                className="input-text"
              />
              <small className="input-note">Questo campo è obbligatorio. Se non viene compilato, verrà impostato automaticamente al 1° gennaio dell'anno corrente.</small>
            </div>
          </div>
          <div className="form-group">
            <label className="input-label" htmlFor="uploader">Inserito da</label>
            <select
                id="uploader"
                value={selectedUploaderId}
                onChange={(e) => setSelectedUploaderId(e.target.value)}
                className="input-text"
            >
                {familyUsers.map(user => (
                    <option key={user.id} value={user.id}>{user.username}</option>
                ))}
            </select>
          </div>
          <button 
            type="submit" 
            disabled={!file || loading}
            className="btn btn-primary"
          >
            {loading ? 'Caricamento...' : 'Carica documento'}
          </button>
        </form>
      </section>

      {/* Sezione di visualizzazione e filtri */}
      <section className="card">
        <h2 className="card-title">Documenti della famiglia</h2>
        <div className="search-box">
          <div className="search-group">
            <div className="search-input-group">
              <label htmlFor="search-username" className="search-label">Nome Utente</label>
              <div className="checkbox-list">
                {familyUsers.map(user => (
                    <label key={user.id} className="checkbox-label">
                        <input
                            type="checkbox"
                            value={user.username}
                            checked={searchUsernames.includes(user.username)}
                            onChange={() => handleUsernameChange(user.username)}
                        />
                        {user.username}
                    </label>
                ))}
              </div>
            </div>
            <div className="search-input-group">
              <label htmlFor="search-year" className="search-label">Anno di Riferimento</label>
              <input 
                id="search-year"
                type="number"
                value={searchYear}
                onChange={(e) => setSearchYear(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
          <div className="search-group">
            <div className="search-input-group full-width">
              <label htmlFor="search-query" className="search-label">Cerca</label>
              <input 
                id="search-query"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                placeholder="Cerca per nome file o descrizione..."
              />
            </div>
          </div>
          <div className="button-group">
            <button onClick={handleSearch} className="btn btn-secondary">
              Applica Filtri
            </button>
            <button onClick={handleResetFilters} className="btn btn-secondary">
              Azzera Filtri
            </button>
          </div>
        </div>
        {loading && <p>Caricamento documenti...</p>}
        {!hasSearched && <p>Applica i filtri per visualizzare i documenti.</p>}
        {hasSearched && documents.length === 0 && !loading && <p>Nessun documento trovato. Riprova con altri filtri.</p>}
        {hasSearched && documents.length > 0 && (
          <ul className="list-unstyled">
            {documents.map((doc) => (
              <li key={doc.id} className="list-item">
                <div className="file-preview">
                  {doc.file_type.startsWith('image/') ? (
                    <img src={doc.file_url} alt="Anteprima file" className="thumbnail" />
                  ) : (
                    <span className="file-icon">📄</span>
                  )}
                </div>
                <div className="item-content">
                  <span className="item-title">{doc.file_name}</span>
                  <span className="item-date">Caricato da: {doc.username} il {new Date(doc.created_at).toLocaleDateString()}</span>
                  {doc.reference_date && (
                    <span className="item-date">Data di Riferimento: {new Date(doc.reference_date).toLocaleDateString()}</span>
                  )}
                  <p className="item-description">{doc.description}</p>
                </div>
                <div className="item-actions">
                  <div className="action-group">
                    <a 
                      href={doc.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-icon"
                    >
                      📄
                    </a>
                    <span className="action-note">Visualizza</span>
                  </div>
                  <div className="action-group">
                    <button 
                      onClick={() => handleDelete(doc.id, doc.file_name)}
                      className="btn btn-icon btn-danger"
                    >
                      🗑️
                    </button>
                    <span className="action-note">Elimina</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button onClick={() => navigate('/main-menu')} className="btn btn-secondary mt-2">
        Torna al menu principale
      </button>
    </div>
  );
}

export default ArchivioDocumenti;