import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../styles/archivio.css';

function ArchivioDocumenti() {
    const navigate = useNavigate();
    const location = useLocation();
    const [documents, setDocuments] = useState([]);
    const [file, setFile] = useState(null);
    const [editableFileName, setEditableFileName] = useState('');
    const [description, setDescription] = useState('');
    const [referenceDate, setReferenceDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [isImageLoading, setIsImageLoading] = useState(false);
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
        try {
            const { data: usersData, error: usersError } = await supabase
                .from('profiles')
                .select('id, username')
                .eq('family_group', group)
                .order('username', { ascending: true });
            if (usersError) throw usersError;
            const userMap = usersData.reduce((map, user) => {
                map[user.id] = user.username;
                return map;
            }, {});
            setFamilyUsers(usersData);
            let query = supabase
                .from('documents')
                .select('*, username_from_db:username')
                .eq('family_group', group);
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
            if (documentsError) throw documentsError;
            let combinedDocuments = documentsData.map(doc => ({
                ...doc,
                username: doc.username_from_db || userMap[doc.uploaded_by] || 'Sconosciuto'
            }));
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
        } catch (err) {
            console.error('Errore nel recupero dei dati:', err);
            setError('Errore nel caricamento dei documenti: ' + err.message);
            setDocuments([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const initData = async () => {
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
                setLoggedUsername(profileData.username);
                fetchUsersAndDocuments(currentFamilyGroup, {}, sortBy, sortDirection);
            } catch (err) {
                console.error('Errore nel caricamento dei dati iniziali:', err);
                setError('Errore nel caricamento dei dati iniziali: ' + err.message);
                setLoading(false);
            }
        };
        initData();
    }, [navigate, fetchUsersAndDocuments, sortBy, sortDirection]);

    useEffect(() => {
        if (location.state && location.state.imageUrl) {
            setIsImageLoading(true);
            const imageUrl = location.state.imageUrl;
            const urlParts = imageUrl.split('/');
            const fileNameWithTimestamp = urlParts[urlParts.length - 1];
            const fileName = fileNameWithTimestamp.split('-').slice(1).join('-');
            fetch(imageUrl)
                .then(res => {
                    if (!res.ok) throw new Error(`Errore HTTP: ${res.status}`);
                    return res.blob();
                })
                .then(blob => {
                    const fileFromBlob = new File([blob], fileName, { type: blob.type });
                    setFile(fileFromBlob);
                    setEditableFileName(fileName.split('.').slice(0, -1).join('.'));
                })
                .catch(err => {
                    console.error("Errore nel recupero dell'immagine dalla chat:", err);
                    setError("Impossibile caricare l'immagine dalla chat. Si prega di provare a caricarla manualmente.");
                    setFile(null);
                })
                .finally(() => {
                    setIsImageLoading(false);
                });
        }
    }, [location.state]);

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
            setError("Per favore, seleziona un file e una data di riferimento.");
            return;
        }
        setError(null);
        setLoading(true);
        const finalReferenceDate = referenceDate || new Date().toISOString().slice(0, 10);
        const fileExtension = file.name.split('.').pop();
        const finalFileName = `${editableFileName}.${fileExtension}`;
        const uniqueFilePath = `${familyGroup}/${Date.now()}-${finalFileName}`;
        try {
            const { error: uploadError } = await supabase.storage
                .from('family_documents')
                .upload(uniqueFilePath, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage
                .from('family_documents')
                .getPublicUrl(uniqueFilePath);
            const { error: insertError } = await supabase
                .from('documents')
                .insert([
                    {
                        family_group: familyGroup,
                        uploaded_by: loggedUserId,
                        username: loggedUsername,
                        file_url: publicUrl,
                        file_name: finalFileName,
                        file_type: file.type,
                        description: description,
                        reference_date: finalReferenceDate,
                    },
                ]);
            if (insertError) throw insertError;
            setFile(null);
            setEditableFileName('');
            setDescription('');
            setReferenceDate('');
            fetchUsersAndDocuments(familyGroup, {
                usernames: searchUsernames,
                year: searchYear,
            }, sortBy, sortDirection);
        } catch (err) {
            console.error('Errore nel processo di caricamento:', err);
            setError('Errore nel salvataggio del documento: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (docId, fileName) => {
        if (window.confirm("Sei sicuro di voler eliminare questo documento?")) {
            setLoading(true);
            try {
                const { error: deleteError } = await supabase
                    .from('documents')
                    .delete()
                    .eq('id', docId);
                if (deleteError) throw deleteError;
                const { error: storageError } = await supabase.storage
                    .from('family_documents')
                    .remove([`${familyGroup}/${fileName}`]);
                if (storageError) console.error('Errore nell\'eliminazione del file dallo storage:', storageError);
                fetchUsersAndDocuments(familyGroup, {
                    usernames: searchUsernames,
                    year: searchYear,
                }, sortBy, sortDirection);
            } catch (err) {
                console.error('Errore nell\'eliminazione:', err);
                setError('Errore nell\'eliminazione del documento: ' + err.message);
                setLoading(false);
            }
        }
    };

    const handleUsernameChange = (username) => {
        setSearchUsernames(prev => prev.includes(username) ? prev.filter(name => name !== username) : [...prev, username]);
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
            <div className="header-container">
                <h1 className="title">Archivio Documenti</h1>
                <button onClick={() => navigate('/main-menu')} className="btn btn-secondary">
                    Torna al menu principale
                </button>
            </div>
            <p className="subtitle">Qui potrai caricare e visualizzare i documenti della famiglia.</p>

            <section className="card">
                <h2 className="card-title">Carica un nuovo documento</h2>
                {isImageLoading && (
                    <p className="loading-message">Caricamento foto dalla chat...</p>
                )}
                {error && <p className="error-message">{error}</p>}
                <form onSubmit={handleUpload} className="form-upload">
                    <div className="form-group">
                        <label htmlFor="file-input" className="file-label">
                            Scegli un file
                            <input
                                id="file-input"
                                name="file-input"
                                type="file"
                                onChange={handleFileChange}
                                className="input-file"
                                disabled={!!file || isImageLoading}
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
                                    name="editable-name"
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
                            name="description"
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
                                name="ref-date"
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
                        disabled={!file || loading || isImageLoading}
                        className="btn btn-primary"
                    >
                        {loading || isImageLoading ? 'Caricamento...' : 'Carica documento'}
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
                                name="search-year"
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

                <div className="search-box secondary-search">
                    <div className="search-group">
                        <div className="search-input-group full-width">
                            <label htmlFor="search-query" className="search-label">Cerca</label>
                            <input
                                id="search-query"
                                name="search-query"
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
                                name="secondary-search-query"
                                type="text"
                                value={secondarySearchQuery}
                                onChange={(e) => setSecondarySearchQuery(e.target.value)}
                                className="input-text"
                                placeholder="Filtra i risultati attuali..."
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <p>Caricamento documenti...</p>
                ) : error ? (
                    <p className="error-message">{error}</p>
                ) : documentsToDisplay.length > 0 ? (
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
                ) : (
                    <div className="no-documents-message">
                        <p>Nessun documento trovato con i filtri selezionati.</p>
                    </div>
                )}
            </section>
        </div>
    );
}

export default ArchivioDocumenti;