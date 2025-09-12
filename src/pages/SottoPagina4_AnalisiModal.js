import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/archivio.css';
import '../styles/StileSottoPagina4.css';

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
            .select('articolo, categoria, quantita, prezzo, data_acquisto, supermercato, prezzo_esselunga, prezzo_mercato, prezzo_coop, prezzo_penny, prezzo_carrefour')
            .eq('family_group', familyGroup)
            .order('data_acquisto', { ascending: false });
        
        if (startDate) {
            query = query.gte('data_acquisto', startDate);
        }
        
        if (endDate) {
            query = query.lte('data_acquisto', `${endDate}T23:59:59`);
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
        return acquisti.reduce((total, acquisto) => {
            const prezzo = parseFloat(acquisto.prezzo);
            const quantita = parseFloat(acquisto.quantita);
            return total + (prezzo * quantita);
        }, 0);
    };

    const calcolaTotaliSupermercati = () => {
        const totali = {
            esselunga: 0,
            mercato: 0,
            coop: 0,
            penny: 0,
            carrefour: 0
        };

        acquisti.forEach(acquisto => {
            if (acquisto.prezzo_esselunga) totali.esselunga += parseFloat(acquisto.quantita) * parseFloat(acquisto.prezzo_esselunga);
            if (acquisto.prezzo_mercato) totali.mercato += parseFloat(acquisto.quantita) * parseFloat(acquisto.prezzo_mercato);
            if (acquisto.prezzo_coop) totali.coop += parseFloat(acquisto.quantita) * parseFloat(acquisto.prezzo_coop);
            if (acquisto.prezzo_penny) totali.penny += parseFloat(acquisto.quantita) * parseFloat(acquisto.prezzo_penny);
            if (acquisto.prezzo_carrefour) totali.carrefour += parseFloat(acquisto.quantita) * parseFloat(acquisto.prezzo_carrefour);
        });

        return totali;
    };

    const totaliSupermercati = calcolaTotaliSupermercati();

    return (
        <div className="modal-overlay">
            <div className="modal-content large-modal">
                <div className="modal-header">
                    <h3>📊 Analisi Economica</h3>
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
                </div>

                {loading ? (
                    <div className="loading">Caricamento acquisti...</div>
                ) : (
                    <>
                        <div className="analisi-table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Data</th>
                                        <th>Articolo</th>
                                        <th>Categoria</th>
                                        <th>Quantità</th>
                                        <th>Supermercato</th>
                                        <th>Costo Reale (€)</th>
                                        <th>Costo Esselunga (€)</th>
                                        <th>Costo Mercato (€)</th>
                                        <th>Costo Coop (€)</th>
                                        <th>Costo Penny (€)</th>
                                        <th>Costo Carrefour (€)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {acquisti.length > 0 ? (
                                        acquisti.map((item, index) => (
                                            <tr key={index}>
                                                <td>{new Date(item.data_acquisto).toLocaleDateString()}</td>
                                                <td>{item.articolo}</td>
                                                <td>{item.categoria}</td>
                                                <td>{item.quantita}</td>
                                                <td>{item.supermercato}</td>
                                                <td>{item.prezzo && (parseFloat(item.quantita) * parseFloat(item.prezzo)).toFixed(2)}</td>
                                                <td>{item.prezzo_esselunga && (parseFloat(item.quantita) * parseFloat(item.prezzo_esselunga)).toFixed(2)}</td>
                                                <td>{item.prezzo_mercato && (parseFloat(item.quantita) * parseFloat(item.prezzo_mercato)).toFixed(2)}</td>
                                                <td>{item.prezzo_coop && (parseFloat(item.quantita) * parseFloat(item.prezzo_coop)).toFixed(2)}</td>
                                                <td>{item.prezzo_penny && (parseFloat(item.quantita) * parseFloat(item.prezzo_penny)).toFixed(2)}</td>
                                                <td>{item.prezzo_carrefour && (parseFloat(item.quantita) * parseFloat(item.prezzo_carrefour)).toFixed(2)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="11">Nessun acquisto trovato per i filtri selezionati.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            <div className="analisi-summary-container">
    <table>
        <thead>
            <tr>
                <th>Costo Reale</th>
                <th>Esselunga</th>
                <th>Mercato</th>
                <th>Coop</th>
                <th>Penny</th>
                <th>Carrefour</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>{calcolaTotale().toFixed(2)} €</strong></td>
                <td><strong>{totaliSupermercati.esselunga.toFixed(2)} €</strong></td>
                <td><strong>{totaliSupermercati.mercato.toFixed(2)} €</strong></td>
                <td><strong>{totaliSupermercati.coop.toFixed(2)} €</strong></td>
                <td><strong>{totaliSupermercati.penny.toFixed(2)} €</strong></td>
                <td><strong>{totaliSupermercati.carrefour.toFixed(2)} €</strong></td>
            </tr>
        </tbody>
    </table>
</div>
                        </div>
                    </>
                )}
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={onClose}>Chiudi</button>
                </div>
            </div>
        </div>
    );
};

export default SottoPagina4_AnalisiModal;