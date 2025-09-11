import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/archivio.css'; // O il tuo file CSS principale
import '../styles/modal.css'; // O il tuo file CSS principale


const SottoPagina4_AnalisiModal = ({ onClose, familyGroup }) => {
    const [acquisti, setAcquisti] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    useEffect(() => {
        if (familyGroup) {
            const fetchData = async () => {
                await fetchCategories();
                await fetchAcquisti();
            };
            fetchData();
        }
    }, [startDate, endDate, selectedCategory, familyGroup]);

    async function fetchCategories() {
        const { data, error } = await supabase
            .from('categorie')
            .select('id, name')
            .eq('family_group', familyGroup)
            .order('name', { ascending: true });
        
        if (error) {
            console.error("Errore nel fetch delle categorie:", error);
            return;
        }
        setCategories(data || []);
    }

    async function fetchAcquisti() {
        setLoading(true);
        let query = supabase
            .from('acquisti_effettuati')
            .select('articolo, categoria, quantita, prezzo, data_acquisito')
            .eq('family_group', familyGroup)
            .order('data_acquisito', { ascending: false });
        
        if (startDate) {
            query = query.gte('data_acquisito', startDate);
        }
        
        if (endDate) {
            query = query.lte('data_acquisito', `${endDate}T23:59:59`);
        }

        if (selectedCategory) {
            const { data: categoryData, error: catError } = await supabase
                .from('categorie')
                .select('name')
                .eq('id', selectedCategory)
                .single();

            if (!catError && categoryData) {
                query = query.eq('categoria', categoryData.name);
            }
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error("Errore nel fetch degli acquisti:", error);
        } else {
            setAcquisti(data || []);
        }
        setLoading(false);
    }
    
    const calcolaTotale = () => {
        return acquisti.reduce((total, acquisto) => total + (acquisto.prezzo * acquisto.quantita), 0);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content large-modal">
                <h3>📊 Analisi Acquisti</h3>
                <div className="filtri-analisi">
                    <div className="form-group">
                        <label>Data Inizio:</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Data Fine:</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Categoria:</label>
                        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                            <option value="">Tutte le categorie</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="loading">Caricamento acquisti...</div>
                ) : (
                    <div className="analisi-table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Articolo</th>
                                    <th>Categoria</th>
                                    <th>Quantità</th>
                                    <th>Prezzo (€)</th>
                                    <th>Totale (€)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {acquisti.length > 0 ? (
                                    acquisti.map((item, index) => (
                                        <tr key={index}>
                                            <td>{new Date(item.data_acquisito).toLocaleDateString()}</td>
                                            <td>{item.articolo}</td>
                                            <td>{item.categoria}</td>
                                            <td>{item.quantita}</td>
                                            <td>{item.prezzo.toFixed(2)}</td>
                                            <td>{(item.prezzo * item.quantita).toFixed(2)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6">Nessun acquisto trovato per i filtri selezionati.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        <div className="analisi-summary">
                            <strong>Totale Spesa: {calcolaTotale().toFixed(2)} €</strong>
                        </div>
                    </div>
                )}
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={onClose}>Chiudi</button>
                </div>
            </div>
        </div>
    );
};

export default SottoPagina4_AnalisiModal;