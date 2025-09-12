import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../styles/MainStyle.css';

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
    const [searchQuery, setSearchQuery] = useState('');
    const [searchYear, setSearchYear] = useState('');
    const [searchQueryName, setSearchQueryName] = useState('');
    const [fileUrlToArchive, setFileUrlToArchive] = useState(null);

    // === FETCH DOCUMENTS ===
    const fetchDocuments = useCallback(async (group, filters = {}, sortField = 'created_at', sortDir = 'desc') => {
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
                .select('*')
                .eq('family_group', group);

            if (filters.usernames && filters.usernames.length > 0) {
                const userIds = usersData.filter(u => filters.usernames.includes(u.username)).map(u => u.id);
                if (userIds.length > 0) query = query.in('uploaded_by', userIds);
            }
            if (filters.year) {
                const startOfYear = `${filters.year}-01-01`;
                const endOfYear = `${filters.year}-12-31`;
                query = query.gte('reference_date', startOfYear).lte('reference_date', endOfYear);
            }
            if (filters.searchQueryName) {
                query = query.or(
                    `file_name.ilike.%${filters.searchQueryName}%,description.ilike.%${filters.searchQueryName}%`
                );
            }
            if (filters.searchQuery) {
                query = query.or(
                    `file_name.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%`
                );
            }

            if (sortField !== 'username') {
                query = query.order(sortField, { ascending: sortDir === 'asc' });
            }

            const { data: documentsData, error: documentsError } = await query;
            if (documentsError) throw documentsError;

            let combinedDocuments = documentsData.map(doc => ({
                ...doc,
                username: doc.username || userMap[doc.uploaded_by] || 'Sconosciuto'
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

    // === INIT DATA ===
    useEffect(() => {
        const initData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    navigate('/auth');
                    return;
                }
                const userId = session.user.id;
                setLoggedUserId(userId);

                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('family_group, username')
                    .eq('id', userId)
                    .single();

                if (profileError || !profileData) {
                    navigate('/auth');
                    return;
                }

                setFamilyGroup(profileData.family_group);
                setLoggedUsername(profileData.username);

                if (location.state && location.state.fileToArchive) {
                    const { fileName, fileUrl } = location.state.fileToArchive;
                    setEditableFileName(fileName);
                    setFileUrlToArchive(fileUrl);
                    window.history.replaceState({}, document.title);
                }

                fetchDocuments(profileData.family_group, {}, sortBy, sortDirection);
            } catch (err) {
                console.error('Errore init data:', err);
                setError('Errore iniziale: ' + err.message);
            }
        };
        initData();
    }, [navigate, fetchDocuments, sortBy, sortDirection, location.state]);

    // === UPLOAD FILE ===
    const handleFileUpload = async (e) => {
        e.preventDefault();
        if (!file && !fileUrlToArchive) {
            setError("Seleziona un file o passa un file dalla chat.");
            return;
        }
        if (!editableFileName) {
            setError("Inserisci un nome per il documento.");
            return;
        }
        setIsImageLoading(true);
        setError(null);

        try {
            let publicUrl = fileUrlToArchive;

            if (file) {
                const fileExtension = file.name.split('.').pop();
                const finalFileName = `${editableFileName}.${fileExtension}`;
                const uniquePath = `${familyGroup}/${Date.now()}-${finalFileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('family_documents')
                    .upload(uniquePath, file);
                if (uploadError) throw uploadError;

                const { data: { publicUrl: newPublicUrl } } = supabase.storage
                    .from('family_documents')
                    .getPublicUrl(uniquePath);

                publicUrl = newPublicUrl;
            }

            const finalReferenceDate = referenceDate || new Date().toISOString().slice(0, 10);
            const newDoc = {
                family_group: familyGroup,
                uploaded_by: loggedUserId,
                username: loggedUsername,
                file_url: publicUrl,
                file_name: editableFileName,
                file_type: file ? file.type : 'link',
                description: description,
                reference_date: finalReferenceDate,
            };

            const { error: insertError } = await supabase.from('documents').insert([newDoc]);
            if (insertError) throw insertError;

            setFile(null);
            setEditableFileName('');
            setDescription('');
            setReferenceDate('');
            setFileUrlToArchive(null);

            fetchDocuments(familyGroup, {}, sortBy, sortDirection);
        } catch (err) {
            console.error("Errore caricamento:", err);
            setError("Errore salvataggio: " + err.message);
        } finally {
            setIsImageLoading(false);
        }
    };

    // === DELETE FILE ===
    const handleDelete = async (docId, fileName) => {
        if (!window.confirm(`Vuoi eliminare "${fileName}"?`)) return;
        try {
            const { error: dbError } = await supabase.from('documents').delete().eq('id', docId);
            if (dbError) throw dbError;

            const { error: storageError } = await supabase.storage
                .from('family_documents')
                .remove([`${familyGroup}/${fileName}`]);
            if (storageError) console.error("Errore storage:", storageError);

            fetchDocuments(familyGroup, {}, sortBy, sortDirection);
        } catch (err) {
            console.error("Errore eliminazione:", err);
            setError("Errore eliminazione: " + err.message);
        }
    };

    // === FILTRI ===
    const handleUserFilterChange = (username) => {
        setSearchUsernames(prev =>
            prev.includes(username)
                ? prev.filter(u => u !== username)
                : [...prev, username]
        );
    };

    return (
        <div className="app-layout">
            <header className="header">
                <h1>📁 Archivio Documenti</h1>
                <p>Gestisci documenti importanti per la tua famiglia.</p>
                <button onClick={() => navigate('/main-menu')} className="btn-secondary">
                    Menu Principale
                </button>
            </header>

            <section className="main-content">
                {/* --- Carica Documento --- */}
                <div className="info-box">
                    <h2>Carica un nuovo documento</h2>
                    <form onSubmit={handleFileUpload} className="upload-form-row">
                        {fileUrlToArchive ? (
                            <div className="archived-file-display-row">
                                <div>File da archiviare: <strong>{editableFileName}</strong></div>
                                {(fileUrlToArchive.endsWith('.png') || fileUrlToArchive.endsWith('.jpg') || fileUrlToArchive.endsWith('.jpeg')) && (
                                    <img src={fileUrlToArchive} alt="Anteprima file" className="file-preview-large" />
                                )}
                            </div>
                        ) : (
                            <div className="file-select-row">
                                <label htmlFor="file-input" className="file-label">
                                    Seleziona File
                                    <input
                                        id="file-input"
                                        type="file"
                                        onChange={(e) => setFile(e.target.files[0])}
                                        className="hidden-input"
                                    />
                                </label>
                                <span className="file-name-display">{file ? file.name : 'Nessun file selezionato'}</span>
                                {file && file.type.startsWith('image/') && (
                                    <img src={URL.createObjectURL(file)} alt="Anteprima file" className="file-preview-large" />
                                )}
                            </div>
                        )}

                        <div className="form-group-column">
                            <div className="form-group">
                                <label htmlFor="file-name">Nome Documento:</label>
                                <input
                                    id="file-name"
                                    type="text"
                                    value={editableFileName}
                                    onChange={(e) => setEditableFileName(e.target.value)}
                                    className="form-input"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="description">Descrizione:</label>
                                <input
                                    id="description"
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="form-input"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="ref-date">Data di Riferimento:</label>
                                <input
                                    id="ref-date"
                                    type="date"
                                    value={referenceDate}
                                    onChange={(e) => setReferenceDate(e.target.value)}
                                    className="form-input"
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={isImageLoading} className="btn-primary form-submit-btn">
                            {isImageLoading ? 'Caricamento...' : '➕ Carica/Archivia Documento'}
                        </button>
                        {error && <div className="info-box red">{error}</div>}
                    </form>
                </div>

                {/* --- Filtra Documenti --- */}
                <div className="info-box" style={{ marginTop: '16px' }}>
                    <h2>Filtra e cerca documenti</h2>
                    <div className="filter-container">
                        <div className="filter-group">
                            <label htmlFor="filter-1">Filtro 1:</label>
                            <input
                                id="filter-1"
                                type="text"
                                value={searchQueryName}
                                onChange={(e) => setSearchQueryName(e.target.value)}
                                className="search-input"
                                placeholder="Parola chiave su nome o descrizione"
                            />
                        </div>
                        <div className="filter-group">
                            <label htmlFor="filter-2">Filtro 2:</label>
                            <input
                                id="filter-2"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                                placeholder="Parola chiave su nome o descrizione"
                            />
                        </div>
                        <div className="filter-group-checkbox">
                            <label>Utente:</label>
                            <div className="checkbox-list">
                                {familyUsers.map(user => (
                                    <label key={user.id} className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            value={user.username}
                                            checked={searchUsernames.includes(user.username)}
                                            onChange={() => handleUserFilterChange(user.username)}
                                            className="custom-checkbox"
                                        />
                                        {user.username}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="filter-group">
                            <label htmlFor="year-select">Anno:</label>
                            <select
                                id="year-select"
                                value={searchYear}
                                onChange={(e) => setSearchYear(e.target.value)}
                                className="styled-select"
                            >
                                <option value="">Tutti</option>
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="filter-buttons" style={{ marginTop: '12px' }}>
                        <button
                            className="btn-primary"
                            onClick={() => fetchDocuments(familyGroup, {
                                usernames: searchUsernames,
                                year: searchYear,
                                searchQuery: searchQueryName || searchQuery,
                                searchQueryName: searchQueryName || searchQuery
                            }, sortBy, sortDirection)}
                        >
                            Applica Filtri
                        </button>
                        <button
                            className="btn-secondary"
                            style={{ marginLeft: '8px' }}
                            onClick={() => {
                                setSearchUsernames([]);
                                setSearchYear('');
                                setSearchQuery('');
                                setSearchQueryName('');
                                fetchDocuments(familyGroup, {}, sortBy, sortDirection);
                            }}
                        >
                            Elimina Filtri
                        </button>
                    </div>
                </div>

                {/* --- Lista Documenti --- */}
                {loading ? (
                    <div className="loading">Caricamento documenti...</div>
                ) : documents.length > 0 ? (
                    <div className="shopping-table-container">
                        <table className="shopping-table">
                            <thead>
                                <tr>
                                    <th onClick={() => { setSortBy('username'); setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc'); }}>Utente</th>
                                    <th onClick={() => { setSortBy('file_name'); setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc'); }}>Nome File</th>
                                    <th>Descrizione</th>
                                    <th onClick={() => { setSortBy('reference_date'); setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc'); }}>Data Riferimento</th>
                                    <th>Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {documents.map((doc) => (
                                    <tr key={doc.id}>
                                        <td>{doc.username || 'Sconosciuto'}</td>
                                        <td>{doc.file_name}</td>
                                        <td>{doc.description}</td>
                                        <td>{doc.reference_date ? new Date(doc.reference_date).toLocaleDateString() : 'N/D'}</td>
                                        <td className="actions-cell">
                                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn-action btn-icon" title="Visualizza">📄</a>
                                            <button onClick={() => handleDelete(doc.id, doc.file_name)} className="btn-delete btn-icon" title="Elimina">🗑️</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="info-box red" style={{ marginTop: '24px' }}>
                        <p>Nessun documento trovato con i filtri selezionati.</p>
                    </div>
                )}
            </section>
        </div>
    );
}

export default ArchivioDocumenti;
