import React, { useState, useEffect, useCallback } from 'react';
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
  const [loggedUserId, setLoggedUserId] = useState(null);
  const [loggedUsername, setLoggedUsername] = useState(null);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  const [searchUsernames, setSearchUsernames] = useState([]);
  const [searchYear, setSearchYear] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [secondarySearchQuery, setSecondarySearchQuery] = useState('');

  const fetchUsersAndDocuments = useCallback(async (group, filters = {}, sortField, sortDir) => {
    setLoading(true);
    setError(null);

    const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('family_group', group)
        .order('username', { ascending: true });

    if (usersError) {
        console.error('Errore nel recupero degli utenti del gruppo:', usersError);
        setError('Errore nel recupero degli utenti del gruppo.');
        setLoading(false);
        return;
    }
    const userMap = usersData.reduce((map, user) => {
      map[user.id] = user.username;
      return map;
    }, {});
    setFamilyUsers(usersData);

    let query = supabase
      .from('documents')
      .select('*, username_from_db:username')
      .eq('family_group', group);
    
    // Ordina prima di filtrare per nome utente, se necessario
    if (sortField !== 'username') {
        query = query.order(sortField, { ascending: sortDir === 'asc' });
    }

    if (filters.usernames && filters.usernames.length > 0) {
      const userIds = usersData.filter(u => filters.usernames.includes(u.username)).map(u => u.id);
      if (userIds.length > 0) {
        query = query.in('uploaded_by', userIds);
      }
    }

    if (filters.year) {
      const startOfYear = `${filters.year}-01-01`;
      const endOfYear = `${filters.year}-12-31`;
      query = query.gte('reference_date', startOfYear).lte('reference_date', endOfYear);
    }

    const { data: documentsData, error: documentsError } = await query;

    if (documentsError) {
      console.error('Errore nel recupero dei documenti:', documentsError);
      setError('Errore nel caricamento dei documenti.');
      setDocuments([]);
    } else {
      let combinedDocuments = documentsData.map(doc => ({
        ...doc,
        // Usa lo username salvato nella tabella o, se non presente, cerca l'ID
        username: doc.username_from_db || userMap[doc.uploaded_by] || 'Sconosciuto'
      }));

      // Ordina in-memory per nome utente se richiesto
      if (sortField === 'username') {
        combinedDocuments.sort((a, b) => {
            const usernameA = a.username.toLowerCase();
            const usernameB = b.username.toLowerCase();
            if (usernameA < usernameB) return sortDir === 'asc' ? -1 : 1;
            if (usernameA > usernameB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
      }

      setDocuments(combinedDocuments || []);
    }
    setLoading(false);
  }, [setLoading, setError, setFamilyUsers, setDocuments]);

  useEffect(() => {
    const fetchDataAndLoadDocuments = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            navigate('/login');
            return;
        }

        const userId = session.user.id;
        setLoggedUserId(userId);

        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('family_group, username')
            .eq('id', userId)
            .single();

        let currentFamilyGroup;
        if (profileError || !profileData || !profileData.family_group) {
            currentFamilyGroup = crypto.randomUUID(); 
            await supabase.from('profiles').update({ family_group: currentFamilyGroup }).eq('id', userId);
        } else {
            currentFamilyGroup = profileData.family_group;
        }
        setFamilyGroup(currentFamilyGroup);
        setLoggedUsername(profileData.username); // Imposta lo username dell'utente loggato

        fetchUsersAndDocuments(currentFamilyGroup, {}, sortBy, sortDirection);
        
      } catch (error) {
          console.error('Errore nel caricamento dei dati:', error);
          setError('Errore nel caricamento dei dati iniziali.');
          setLoading(false);
      }
    };
    fetchDataAndLoadDocuments();
  }, [navigate, fetchUsersAndDocuments, sortBy, sortDirection]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const fileNameWithoutExt = selectedFile.name.split('.').slice(0, -1).join('.');
      setEditableFileName(fileNameWithoutExt);
    }
  };

  const handlePrimarySearch = () => {
    setSearchQuery('');
    setSecondarySearchQuery('');
    fetchUsersAndDocuments(familyGroup, {
      usernames: searchUsernames,
      year: searchYear,
    }, sortBy, sortDirection);
  };

  const handleResetFilters = () => {
    setSearchUsernames([]);
    setSearchYear('');
    setSearchQuery('');
    setSecondarySearchQuery('');
    setSortBy('created_at');
    setSortDirection('desc');
    fetchUsersAndDocuments(familyGroup, {}, 'created_at', 'desc');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !familyGroup || !loggedUserId) {
        alert("Per favore, seleziona un file e una data di riferimento.");
        return;
    }

    setLoading(true);
    
    const finalReferenceDate = referenceDate || new Date().toISOString().slice(0, 10);
    const fileExtension = file.name.split('.').pop();
    const finalFileName = `${editableFileName}.${fileExtension}`;
    const uniqueFilePath = `${familyGroup}/${Date.now()}-${finalFileName}`;

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
          uploaded_by: loggedUserId,
          username: loggedUsername, // Salva lo username qui
          file_url: publicUrl,
          file_name: finalFileName,
          file_type: file.type,
          description: description,
          reference_date: finalReferenceDate,
        },
      ]);

    if (insertError) {
      console.error('Errore nell\'inserimento dei dati:', insertError);
      await supabase.storage.from('family_documents').remove([uniqueFilePath]);
      setError('Errore nel salvataggio del documento.');
    } else {
      setFile(null);
      setEditableFileName('');
      setDescription('');
      setReferenceDate('');
      fetchUsersAndDocuments(familyGroup, {
        usernames: searchUsernames,
        year: searchYear,
      }, sortBy, sortDirection);
    }
    setLoading(false);
  };

  const handleDelete = async (docId, fileName) => {
    if (window.confirm("Sei sicuro di voler eliminare questo documento?")) {
      setLoading(true);
      
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', docId);

      if (deleteError) {
        console.error('Errore nell\'eliminazione dal database:', deleteError);
        setLoading(false);
        setError('Errore nell\'eliminazione del documento.');
        return;
      }
      
      const { error: storageError } = await supabase.storage
        .from('family_documents')
        .remove([`${familyGroup}/${fileName}`]);

      if (storageError) {
        console.error('Errore nell\'eliminazione del file dallo storage:', storageError);
      }

      fetchUsersAndDocuments(familyGroup, {
        usernames: searchUsernames,
        year: searchYear,
      }, sortBy, sortDirection);
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

  const handleSort = (key) => {
    const newSortDirection = sortBy === key ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortBy(key);
    setSortDirection(newSortDirection);
    fetchUsersAndDocuments(familyGroup, {
        usernames: searchUsernames,
        year: searchYear,
    }, key, newSortDirection);
  };

  const documentsToDisplay = documents
    .filter(doc => 
      !searchQuery || 
      (doc.file_name && doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (doc.description && doc.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .filter(doc => 
      !secondarySearchQuery || 
      (doc.file_name && doc.file_name.toLowerCase().includes(secondarySearchQuery.toLowerCase())) ||
      (doc.description && doc.description.toLowerCase().includes(secondarySearchQuery.toLowerCase()))
    );

  return (
    <div className="archivio-container">
      <div className="top-right-button-container">
        <button onClick={() => navigate('/main-menu')} className="btn btn-secondary">
          Torna al menu principale
        </button>
      </div>

      <h1 className="title">Archivio Documenti</h1>
      <p className="subtitle">Qui potrai caricare e visualizzare i documenti della famiglia.</p>

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
          <button 
            type="submit" 
            disabled={!file || loading}
            className="btn btn-primary"
          >
            {loading ? 'Caricamento...' : 'Carica documento'}
          </button>
        </form>
      </section>

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
                placeholder="Anno"
              />
            </div>
          </div>
          <div className="button-group">
            <button onClick={handlePrimarySearch} className="btn btn-secondary">
              Applica Filtri
            </button>
            <button onClick={handleResetFilters} className="btn btn-secondary">
              Azzera Filtri
            </button>
          </div>
        </div>

        {/* FILTRI A CASCATA */}
        <div className="search-box secondary-search">
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
             <div className="search-group">
                <div className="search-input-group full-width">
                  <label htmlFor="secondary-search-query" className="search-label">Filtra ulteriormente</label>
                  <input 
                    id="secondary-search-query"
                    type="text"
                    value={secondarySearchQuery}
                    onChange={(e) => setSecondarySearchQuery(e.target.value)}
                    className="search-input"
                    placeholder="Filtra i risultati attuali..."
                  />
                </div>
            </div>
        </div>

        {/* TABELLA DOCUMENTI */}
        {loading && <p>Caricamento documenti...</p>}
        {error && <p className="error-message">{error}</p>}
        
        {!loading && documentsToDisplay.length > 0 && (
          <div className="documents-table-container">
            <table className="documents-table">
              <thead>
                <tr>
                  <th className="th-thumbnail"></th>
                  <th onClick={() => handleSort('created_at')} className="sortable-header">
                    Data Inserimento
                    <span className="sort-icon">{sortBy === 'created_at' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</span>
                  </th>
                  <th onClick={() => handleSort('username')} className="sortable-header">
                    Utente
                    <span className="sort-icon">{sortBy === 'username' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}</span>
                  </th>
                  <th>Nome File</th>
                  <th>Descrizione</th>
                  <th>Data di Riferimento</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {documentsToDisplay.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      {doc.file_type.startsWith('image/') ? (
                        <img src={doc.file_url} alt="Anteprima file" className="table-thumbnail" />
                      ) : (
                        <span className="file-icon-table">📄</span>
                      )}
                    </td>
                    <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                    <td>{doc.username || 'Sconosciuto'}</td>
                    <td>{doc.file_name}</td>
                    <td>{doc.description}</td>
                    <td>{doc.reference_date ? new Date(doc.reference_date).toLocaleDateString() : 'N/D'}</td>
                    <td className="actions-cell">
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-icon btn-action-small" title="Visualizza">
                        📄
                      </a>
                      <button onClick={() => handleDelete(doc.id, doc.file_name)} className="btn btn-icon btn-danger btn-action-small" title="Elimina">
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && documentsToDisplay.length === 0 && !error && (
            <div className="no-documents-message">
                <p>Nessun documento trovato con i filtri selezionati.</p>
            </div>
        )}
      </section>
    </div>
  );
}

export default ArchivioDocumenti;