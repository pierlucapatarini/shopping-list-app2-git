import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import '../styles/MainStyle.css';
import SottoPagina4_AnalisiModal from './SottoPagina4_AnalisiModal';


// Modal component (rimane invariato)
const Modal = ({ type, data, categories, onClose, onSave }) => {
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (data) {
            setFormData(data);
        }
    }, [data]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSave = () => {
        if (type === 'categoria' && formData.name !== data.name) {
            if (!window.confirm("Attenzione: cambiare il nome di una categoria modificherà tutti i prodotti ad essa collegati. Sei sicuro di voler procedere?")) {
                return;
            }
        }

        const dataToSave = { ...formData };
        if (dataToSave.categorie) {
            delete dataToSave.categorie;
        }

        onSave(dataToSave);
    };

    if (!data) {
        return null;
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>✏️ Modifica {type === 'prodotto' ? 'Prodotto' : 'Categoria'}</h3>
                {type === 'prodotto' ? (
                    <>
                        <div className="form-group">
                            <label>Articolo: <span className="obbligatorio">(Obbligatorio)</span></label>
                            <input name="articolo" value={formData.articolo || ''} onChange={handleChange} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label>Descrizione Articolo:</label>
                            <input name="descrizione_articolo" value={formData.descrizione_articolo || ''} onChange={handleChange} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label>Prezzo Generale (€):</label>
                            <input type="number" name="prezzo" value={formData.prezzo || ''} onChange={handleChange} placeholder="0.00" className="form-input" />
                        </div>
                        <div className="form-group">
                            <label>Categoria: <span className="obbligatorio">(Obbligatorio)</span></label>
                            <select name="categoria_id" value={formData.categoria_id || ''} onChange={handleChange} className="form-input">
                                <option value="">Seleziona categoria</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Unità di Misura:</label>
                            <input name="unita_misura" value={formData.unita_misura || ''} onChange={handleChange} placeholder="Es. kg, l, pz" className="form-input" />
                        </div>
                        <div className="form-group checkbox-group">
                            <input type="checkbox" name="preferito" checked={formData.preferito || false} onChange={handleChange} id="modal-preferito" />
                            <label htmlFor="modal-preferito">Preferito</label>
                        </div>
                        <div className="form-group-column">
                            <h4>Prezzi Supermercati</h4>
                            <div className="input-with-label">
                                <label>Esselunga (€):</label>
                                <input type="number" name="prezzo_esselunga" value={formData.prezzo_esselunga || ''} onChange={handleChange} placeholder="0.00" className="form-input" />
                            </div>
                            <div className="input-with-label">
                                <label>Mercato (€):</label>
                                <input type="number" name="prezzo_mercato" value={formData.prezzo_mercato || ''} onChange={handleChange} placeholder="0.00" className="form-input" />
                            </div>
                            <div className="input-with-label">
                                <label>Carrefour (€):</label>
                                <input type="number" name="prezzo_carrefour" value={formData.prezzo_carrefour || ''} onChange={handleChange} placeholder="0.00" className="form-input" />
                            </div>
                            <div className="input-with-label">
                                <label>Penny (€):</label>
                                <input type="number" name="prezzo_penny" value={formData.prezzo_penny || ''} onChange={handleChange} placeholder="0.00" className="form-input" />
                            </div>
                            <div className="input-with-label">
                                <label>Coop (€):</label>
                                <input type="number" name="prezzo_coop" value={formData.prezzo_coop || ''} onChange={handleChange} placeholder="0.00" className="form-input" />
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="form-group">
                            <label>Nome Categoria: <span className="obbligatorio">(Obbligatorio)</span></label>
                            <input name="name" value={formData.name || ''} onChange={handleChange} className="form-input" />
                        </div>
                        <div className="form-group-column">
                            <h4>Corsie Supermercati</h4>
                            <div className="input-with-label">
                                <label>Esselunga:</label>
                                <input name="corsia_esselunga" value={formData.corsia_esselunga || ''} onChange={handleChange} placeholder="Aisle" className="small-input form-input" />
                            </div>
                            <div className="input-with-label">
                                <label>Mercato:</label>
                                <input name="corsia_mercato" value={formData.corsia_mercato || ''} onChange={handleChange} placeholder="Aisle" className="small-input form-input" />
                            </div>
                            <div className="input-with-label">
                                <label>Carrefour:</label>
                                <input name="corsia_carrefour" value={formData.corsia_carrefour || ''} onChange={handleChange} placeholder="Aisle" className="small-input form-input" />
                            </div>
                            <div className="input-with-label">
                                <label>Penny:</label>
                                <input name="corsia_penny" value={formData.corsia_penny || ''} onChange={handleChange} placeholder="Aisle" className="small-input form-input" />
                            </div>
                            <div className="input-with-label">
                                <label>Coop:</label>
                                <input name="corsia_coop" value={formData.corsia_coop || ''} onChange={handleChange} placeholder="Aisle" className="small-input form-input" />
                            </div>
                        </div>
                    </>
                )}
                <div className="modal-actions">
                    <button className="btn-primary" onClick={handleSave}>Salva</button>
                    <button className="btn-secondary" onClick={onClose}>Annulla</button>
                </div>
            </div>
        </div>
    );
};

export default function Pagina4_ArchivioProdotti() {
    const [sezioneAttiva, setSezioneAttiva] = useState('prodotti');
    const [categorie, setCategorie] = useState([]);
    const [prodotti, setProdotti] = useState([]);
    const [queryProdotto, setQueryProdotto] = useState('');
    const [queryCategoria, setQueryCategoria] = useState('');
    const [prodottiFiltratiCategoria, setProdottiFiltratiCategoria] = useState([]);
    const [showAddProdForm, setShowAddProdForm] = useState(false);
    const [showAddCatForm, setShowAddCatForm] = useState(false);
    const [familyGroup, setFamilyGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAnalisiModal, setShowAnalisiModal] = useState(false);

    const [formProd, setFormProd] = useState({
        articolo: '',
        descrizione_articolo: '',
        prezzo: '',
        categoria_id: '',
        prezzo_esselunga: '',
        prezzo_mercato: '',
        prezzo_carrefour: '',
        prezzo_penny: '',
        prezzo_coop: '',
        preferito: false,
        unita_misura: ''
    });
    const [formCat, setFormCat] = useState({
        name: '',
        corsia_esselunga: '',
        corsia_mercato: '',
        corsia_carrefour: '',
        corsia_penny: '',
        corsia_coop: ''
    });

    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState(null);
    const [modalData, setModalData] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    const userId = session.user.id;
                    const { data: profileData, error: profileError } = await supabase
                        .from('profiles')
                        .select('family_group')
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
                    await fetchProdotti(currentFamilyGroup);
                    await fetchCategorie(currentFamilyGroup);
                } else {
                    console.warn('Nessun utente autenticato. Reindirizzamento al login.');
                }
            } catch (error) {
                console.error('Errore nel caricamento dei dati:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    async function fetchProdotti(currentFamilyGroup) {
        const { data, error } = await supabase
            .from('prodotti')
            .select('*, categorie(name, corsia_esselunga, corsia_mercato, corsia_carrefour, corsia_penny, corsia_coop)')
            .eq('family_group', currentFamilyGroup)
            .order('articolo', { ascending: true });
        if (error) {
            console.error("Errore nel fetch dei prodotti:", error);
            return;
        }
        setProdotti(data || []);
    }

    async function fetchCategorie(currentFamilyGroup) {
        const { data, error } = await supabase
            .from('categorie')
            .select('*')
            .eq('family_group', currentFamilyGroup)
            .order('name', { ascending: true });
        if (error) {
            console.error("Errore nel fetch delle categorie:", error);
            return;
        }
        setCategorie(data || []);
    }

    async function aggiungiProdotto() {
        if (!formProd.articolo || !formProd.categoria_id) {
            alert("Il nome dell'articolo e la categoria sono obbligatori.");
            return;
        }
        const newProduct = {
            ...formProd,
            family_group: familyGroup,
            prezzo: formProd.prezzo === '' ? null : parseFloat(formProd.prezzo),
            prezzo_esselunga: formProd.prezzo_esselunga === '' ? null : parseFloat(formProd.prezzo_esselunga),
            prezzo_mercato: formProd.prezzo_mercato === '' ? null : parseFloat(formProd.prezzo_mercato),
            prezzo_carrefour: formProd.prezzo_carrefour === '' ? null : parseFloat(formProd.prezzo_carrefour),
            prezzo_penny: formProd.prezzo_penny === '' ? null : parseFloat(formProd.prezzo_penny),
            prezzo_coop: formProd.prezzo_coop === '' ? null : parseFloat(formProd.prezzo_coop),
        };
        const { error } = await supabase.from('prodotti').insert(newProduct);
        if (error) {
            console.error("Errore nell'inserimento del prodotto:", error);
            alert("Errore nell'inserimento del prodotto: " + error.message);
            return;
        }
        resetFormProd();
        await fetchProdotti(familyGroup);
        setShowAddProdForm(false);
    }

    async function aggiungiCategoria() {
        if (!formCat.name) {
            alert("Il nome della categoria è obbligatorio.");
            return;
        }
        const newCategory = {
            ...formCat,
            family_group: familyGroup
        };
        const { error } = await supabase.from('categorie').insert(newCategory);
        if (error) {
            console.error("Errore nell'inserimento della categoria:", error);
            alert("Errore nell'inserimento della categoria: " + error.message);
            return;
        }
        resetFormCat();
        await fetchCategorie(familyGroup);
        setShowAddCatForm(false);
    }

    const apriModalModifica = (type, data) => {
        setModalType(type);
        setModalData(data);
        setModalVisible(true);
    };

    const salvaModifiche = async (updatedData) => {
        if (modalType === 'prodotto') {
            const productData = {
                ...updatedData,
                prezzo: updatedData.prezzo === '' ? null : parseFloat(updatedData.prezzo),
                prezzo_esselunga: updatedData.prezzo_esselunga === '' ? null : parseFloat(updatedData.prezzo_esselunga),
                prezzo_mercato: updatedData.prezzo_mercato === '' ? null : parseFloat(updatedData.prezzo_mercato),
                prezzo_carrefour: updatedData.prezzo_carrefour === '' ? null : parseFloat(updatedData.prezzo_carrefour),
                prezzo_penny: updatedData.prezzo_penny === '' ? null : parseFloat(updatedData.prezzo_penny),
                prezzo_coop: updatedData.prezzo_coop === '' ? null : parseFloat(updatedData.prezzo_coop),
            };
            const { error } = await supabase.from('prodotti').update(productData).eq('id', modalData.id);
            if (error) {
                console.error("Errore nell'aggiornamento del prodotto:", error);
                alert("Errore nell'aggiornamento del prodotto: " + error.message);
                return;
            }
            await fetchProdotti(familyGroup);
        } else if (modalType === 'categoria') {
            const { error } = await supabase.from('categorie').update(updatedData).eq('id', modalData.id);
            if (error) {
                console.error("Errore nell'aggiornamento della categoria:", error);
                alert("Errore nell'aggiornamento della categoria: " + error.message);
                return;
            }
            await fetchCategorie(familyGroup);
        }
        chiudiModal();
    };

    const chiudiModal = () => {
        setModalVisible(false);
        setModalType(null);
        setModalData(null);
    };

    async function cancellaProdotto(id) {
        const { error } = await supabase.from('prodotti').delete().eq('id', id);
        if (error) {
            console.error("Errore nella cancellazione del prodotto:", error);
            alert("Errore nella cancellazione del prodotto: " + error.message);
            return;
        }
        await fetchProdotti(familyGroup);
    }

    async function cancellaCategoria(id) {
        const { data: prodottiAssociati, error: prodottiError } = await supabase
            .from('prodotti')
            .select('id')
            .eq('categoria_id', id);
        if (prodottiError) {
            console.error("Errore nella ricerca dei prodotti associati:", prodottiError);
            alert("Impossibile cancellare la categoria: " + prodottiError.message);
            return;
        }
        if (prodottiAssociati.length > 0) {
            alert(`Impossibile cancellare la categoria. Ci sono ${prodottiAssociati.length} prodotti associati. Rimuovi prima i prodotti.`);
            return;
        }
        const { error } = await supabase.from('categorie').delete().eq('id', id);
        if (error) {
            console.error("Errore nella cancellazione della categoria:", error);
            alert("Errore nella cancellazione della categoria: " + error.message);
            return;
        }
        await fetchCategorie(familyGroup);
    }

    const prodottiFiltrati = queryProdotto
        ? prodotti.filter((p) => p.articolo.toLowerCase().includes(queryProdotto.toLowerCase()) || (p.descrizione_articolo && p.descrizione_articolo.toLowerCase().includes(queryProdotto.toLowerCase())) || (p.categorie && p.categorie.name.toLowerCase().includes(queryProdotto.toLowerCase())))
        : prodotti;

    const categorieFiltrate = queryCategoria
        ? categorie.filter((c) => c.name.toLowerCase().includes(queryCategoria.toLowerCase()))
        : categorie;

    const visualizzaProdotti = (categoryId) => {
        const filtered = prodotti.filter(p => p.categoria_id === categoryId);
        setProdottiFiltratiCategoria(filtered);
    };

    const tornaACategorie = () => {
        setProdottiFiltratiCategoria([]);
        setQueryCategoria('');
    };

    const resetFormProd = () => {
        setFormProd({
            articolo: '',
            descrizione_articolo: '',
            prezzo: '',
            categoria_id: '',
            prezzo_esselunga: '',
            prezzo_mercato: '',
            prezzo_carrefour: '',
            prezzo_penny: '',
            prezzo_coop: '',
            preferito: false,
            unita_misura: ''
        });
    };

    const resetFormCat = () => {
        setFormCat({
            name: '',
            corsia_esselunga: '',
            corsia_mercato: '',
            corsia_carrefour: '',
            corsia_penny: '',
            corsia_coop: ''
        });
    };

    if (loading) {
        return <div className="loading">Caricamento...</div>;
    }

    return (
        <div className="app-layout">
            <header className="header">
                <button className="btn-secondary" onClick={() => navigate('/main-menu')}>← Menu Principale</button>
                <h1>📦 Archivio Prodotti</h1>
                <p>Gestisci i tuoi articoli e le loro categorie.</p>
            </header>

            <div className="tab-buttons">
                <button className={`tab-button ${sezioneAttiva === 'prodotti' ? 'active' : ''}`} onClick={() => { setSezioneAttiva('prodotti'); setQueryProdotto(''); setShowAddProdForm(false); }}>🛒 Prodotti</button>
                <button className={`tab-button ${sezioneAttiva === 'categorie' ? 'active' : ''}`} onClick={() => { setSezioneAttiva('categorie'); tornaACategorie(); setShowAddCatForm(false); }}>🗂️ Categorie</button>
                <button className="btn-primary" onClick={() => setShowAnalisiModal(true)}>📈 Analisi Economica Acquisti</button>
            </div>

            <main className="main-content">
                {sezioneAttiva === 'prodotti' && (
                    <section className="section">
                        <div className="input-group">
                            <input value={queryProdotto} onChange={(e) => setQueryProdotto(e.target.value)} placeholder="🔍 Cerca prodotto..." className="search-input" />
                            <button className="btn-add" onClick={() => setShowAddProdForm(!showAddProdForm)}>
                                {showAddProdForm ? 'Annulla' : '➕ Aggiungi'}
                            </button>
                        </div>
                        
                        {showAddProdForm && (
                            <div className="info-box add-form">
                                <h3>➕ Aggiungi un nuovo prodotto</h3>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Articolo: <span className="obbligatorio">(Obbligatorio)</span></label>
                                        <input value={formProd.articolo} onChange={(e) => setFormProd({ ...formProd, articolo: e.target.value })} placeholder="Articolo" className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label>Descrizione Articolo:</label>
                                        <input value={formProd.descrizione_articolo} onChange={(e) => setFormProd({ ...formProd, descrizione_articolo: e.target.value })} placeholder="Descrizione" className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label>Categoria: <span className="obbligatorio">(Obbligatorio)</span></label>
                                        <select value={formProd.categoria_id} onChange={(e) => setFormProd({ ...formProd, categoria_id: e.target.value })} className="form-input">
                                            <option value="">Seleziona categoria</option>
                                            {categorie.map((cat) => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Unità di Misura:</label>
                                        <input value={formProd.unita_misura} onChange={(e) => setFormProd({ ...formProd, unita_misura: e.target.value })} placeholder="Es. kg, l, pz" className="form-input" />
                                    </div>
                                    <div className="form-group checkbox-group">
                                        <input type="checkbox" checked={formProd.preferito} onChange={(e) => setFormProd({ ...formProd, preferito: e.target.checked })} id="preferito" />
                                        <label htmlFor="preferito">Preferito</label>
                                    </div>
                                </div>
                                <div className="form-group-column">
                                    <h4>Prezzi Supermercati</h4>
                                    <div className="input-with-label">
                                        <label>Esselunga (€):</label>
                                        <input type="number" value={formProd.prezzo_esselunga} onChange={(e) => setFormProd({ ...formProd, prezzo_esselunga: e.target.value })} placeholder="0.00" className="form-input" />
                                    </div>
                                    <div className="input-with-label">
                                        <label>Mercato (€):</label>
                                        <input type="number" value={formProd.prezzo_mercato} onChange={(e) => setFormProd({ ...formProd, prezzo_mercato: e.target.value })} placeholder="0.00" className="form-input" />
                                    </div>
                                    <div className="input-with-label">
                                        <label>Carrefour (€):</label>
                                        <input type="number" value={formProd.prezzo_carrefour} onChange={(e) => setFormProd({ ...formProd, prezzo_carrefour: e.target.value })} placeholder="0.00" className="form-input" />
                                    </div>
                                    <div className="input-with-label">
                                        <label>Penny (€):</label>
                                        <input type="number" value={formProd.prezzo_penny} onChange={(e) => setFormProd({ ...formProd, prezzo_penny: e.target.value })} placeholder="0.00" className="form-input" />
                                    </div>
                                    <div className="input-with-label">
                                        <label>Coop (€):</label>
                                        <input type="number" value={formProd.prezzo_coop} onChange={(e) => setFormProd({ ...formProd, prezzo_coop: e.target.value })} placeholder="0.00" className="form-input" />
                                    </div>
                                </div>
                                <button className="btn-add form-submit-btn" onClick={aggiungiProdotto}>➕ Aggiungi Prodotto</button>
                            </div>
                        )}
                        <div className="shopping-table-container">
                            <table className="shopping-table">
                                <thead>
                                    <tr>
                                        <th>Articolo</th>
                                        <th>Descrizione</th>
                                        <th>Categoria</th>
                                        <th>Azioni</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {prodottiFiltrati.map((prod) => (
                                        <tr key={prod.id}>
                                            <td>
                                                <strong>{prod.articolo}</strong>
                                                {prod.preferito && <span role="img" aria-label="preferito">⭐</span>}
                                            </td>
                                            <td>{prod.descrizione_articolo || 'N/D'}</td>
                                            <td>{prod.categorie ? prod.categorie.name : 'N/D'}</td>
                                            <td className="actions-cell">
                                                <button className="btn-edit btn-icon" onClick={(e) => { e.stopPropagation(); apriModalModifica('prodotto', prod); }}>✏️</button>
                                                <button className="btn-delete btn-icon" onClick={(e) => { e.stopPropagation(); cancellaProdotto(prod.id); }}>🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {sezioneAttiva === 'categorie' && (
                    <section className="section">
                        <div className="input-group">
                            <input value={queryCategoria} onChange={(e) => setQueryCategoria(e.target.value)} placeholder="🔍 Cerca categoria..." className="search-input" />
                            <button className="btn-add" onClick={() => {
                                setShowAddCatForm(!showAddCatForm);
                            }}>
                                {showAddCatForm ? 'Annulla' : '➕ Aggiungi'}
                            </button>
                        </div>

                        {prodottiFiltratiCategoria.length > 0 ? (
                            <>
                                <button className="btn-secondary" onClick={tornaACategorie}>← Torna alle Categorie</button>
                                <div className="shopping-table-container">
                                    <table className="shopping-table">
                                        <thead>
                                            <tr>
                                                <th>Articolo</th>
                                                <th>Descrizione</th>
                                                <th>Azioni</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {prodottiFiltratiCategoria.map((prod) => (
                                                <tr key={prod.id}>
                                                    <td><strong>{prod.articolo}</strong></td>
                                                    <td>{prod.descrizione_articolo || 'N/D'}</td>
                                                    <td className="actions-cell">
                                                        <button className="btn-edit btn-icon" onClick={() => apriModalModifica('prodotto', prod)}>✏️</button>
                                                        <button className="btn-delete btn-icon" onClick={() => cancellaProdotto(prod.id)}>🗑️</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <>
                                {showAddCatForm && (
                                    <div className="info-box add-form">
                                        <h3>➕ Aggiungi una nuova categoria</h3>
                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label>Nome: <span className="obbligatorio">(Obbligatorio)</span></label>
                                                <input value={formCat.name} onChange={(e) => setFormCat({ ...formCat, name: e.target.value })} placeholder="Nome Categoria" className="form-input" />
                                            </div>
                                            <div className="form-group-column">
                                                <h4>Corsie Supermercati</h4>
                                                <div className="input-with-label">
                                                    <label>Esselunga:</label>
                                                    <input value={formCat.corsia_esselunga} onChange={(e) => setFormCat({ ...formCat, corsia_esselunga: e.target.value })} placeholder="Aisle" className="small-input form-input" />
                                                </div>
                                                <div className="input-with-label">
                                                    <label>Mercato:</label>
                                                    <input value={formCat.corsia_mercato} onChange={(e) => setFormCat({ ...formCat, corsia_mercato: e.target.value })} placeholder="Aisle" className="small-input form-input" />
                                                </div>
                                                <div className="input-with-label">
                                                    <label>Carrefour:</label>
                                                    <input value={formCat.corsia_carrefour} onChange={(e) => setFormCat({ ...formCat, corsia_carrefour: e.target.value })} placeholder="Aisle" className="small-input form-input" />
                                                </div>
                                                <div className="input-with-label">
                                                    <label>Penny:</label>
                                                    <input value={formCat.corsia_penny} onChange={(e) => setFormCat({ ...formCat, corsia_penny: e.target.value })} placeholder="Aisle" className="small-input form-input" />
                                                </div>
                                                <div className="input-with-label">
                                                    <label>Coop:</label>
                                                    <input value={formCat.corsia_coop} onChange={(e) => setFormCat({ ...formCat, corsia_coop: e.target.value })} placeholder="Aisle" className="small-input form-input" />
                                                </div>
                                            </div>
                                        </div>
                                        <button className="btn-add form-submit-btn" onClick={aggiungiCategoria}>➕ Aggiungi Categoria</button>
                                    </div>
                                )}
                                <div className="shopping-table-container">
                                    <table className="shopping-table">
                                        <thead>
                                            <tr>
                                                <th>Nome Categoria</th>
                                                <th>Azioni</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {categorieFiltrate.map((cat) => (
                                                <tr key={cat.id}>
                                                    <td><strong>{cat.name}</strong></td>
                                                    <td className="actions-cell">
                                                        <button className="btn-edit btn-icon" onClick={() => apriModalModifica('categoria', cat)} title="Modifica">✏️</button>
                                                        <button className="btn-delete btn-icon" onClick={() => cancellaCategoria(cat.id)} title="Cancella">🗑️</button>
                                                        <button className="btn-action btn-icon" onClick={() => visualizzaProdotti(cat.id)} title="Visualizza Prodotti">🔍</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </section>
                )}

                {modalVisible && (
                    <Modal
                        type={modalType}
                        data={modalData}
                        categories={categorie}
                        onClose={chiudiModal}
                        onSave={salvaModifiche}
                    />
                )}
                {showAnalisiModal && (
                    <SottoPagina4_AnalisiModal
                        prodotti={prodotti}
                        familyGroup={familyGroup}
                        onClose={() => setShowAnalisiModal(false)}
                    />
                )}
            </main>
        </div>
    );
}