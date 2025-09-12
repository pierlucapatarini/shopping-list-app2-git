import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "../styles/MainStyle.css"; // Nuovo file di stile di base
import "../styles/StilePagina1.css"; // Nuovo file di stile specifico

// Non toccare i dati, solo la presentazione
const SUPERMARKETS = [
  { key: "esselunga", label: "Esselunga", priceField: "prezzo_esselunga", corsiaField: "corsia_esselunga" },
  { key: "mercato", label: "Mercato", priceField: "prezzo_mercato", corsiaField: "corsia_mercato" },
  { key: "carrefour", label: "Carrefour", priceField: "prezzo_carrefour", corsiaField: "corsia_carrefour" },
  { key: "penny", label: "Penny", priceField: "prezzo_penny", corsiaField: "corsia_penny" },
  { key: "coop", label: "Coop", priceField: "prezzo_coop", corsiaField: "corsia_coop" },
];

export default function Pagina1_ShoppingList() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [familyGroup, setFamilyGroup] = useState(null);
  const [prodotti, setProdotti] = useState([]);
  const [categorie, setCategorie] = useState([]);
  const [shoppingItems, setShoppingItems] = useState([]);
  const [selectedSupermarket, setSelectedSupermarket] = useState(SUPERMARKETS[0].key);
  const [mode, setMode] = useState("archivio");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOtherPrices, setShowOtherPrices] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profiles } = await supabase.from("profiles").select("id, username, family_group").eq("id", user.id).single();
      if (profiles) {
        setUserProfile(profiles);
        setFamilyGroup(profiles.family_group);
      }
    }
    loadProfile();
  }, []);

  useEffect(() => {
    if (!familyGroup) return;
    Promise.all([
      supabase.from("prodotti").select("*").order("articolo", { ascending: true }),
      supabase.from("categorie").select("*").order("name", { ascending: true }),
      supabase.from("shopping_items").select("*").eq("family_group", familyGroup).order("created_at", { ascending: true }),
    ]).then(([prodRes, catRes, shopRes]) => {
      if (!prodRes.error) setProdotti(prodRes.data || []);
      if (!catRes.error) setCategorie(catRes.data || []);
      if (!shopRes.error) setShoppingItems(shopRes.data || []);
    });
  }, [familyGroup]);

  const findCategory = (categoriaIdOrName) => categorie.find(c => c.id === categoriaIdOrName || c.name === categoriaIdOrName) || {};

  const searchResults = useMemo(() => {
    if (mode === "preferiti") {
      const preferiti = prodotti.filter(p => (p.preferito == true || p.preferito === 1 || p.preferito === "true" || p.preferito === "1") && p.family_group === familyGroup);
      if (!searchQuery.trim()) return preferiti;
      const q = searchQuery.trim().toLowerCase();
      return preferiti.filter(p => p.articolo.toLowerCase().includes(q));
    }
    
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    
    const filteredProdotti = prodotti.filter(p => p.family_group === familyGroup);
    
    if (mode === "vocale") {
      return filteredProdotti.filter(p => 
        p.articolo.toLowerCase().includes(q) || 
        (p.descrizione || "").toLowerCase().includes(q)
      );
    }
    
    return filteredProdotti.filter(p => 
      p.articolo.toLowerCase().includes(q) || 
      (p.descrizione || "").toLowerCase().includes(q)
    );
  }, [prodotti, searchQuery, mode, familyGroup]);

  const startVoiceRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Il riconoscimento vocale non è supportato dal tuo browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'it-IT';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Errore riconoscimento vocale:', event.error);
      setIsListening(false);
      alert('Errore nel riconoscimento vocale: ' + event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

async function addProductToShopping(prod) {
    if (!familyGroup || !userProfile) return;
    const sup = SUPERMARKETS.find(s => s.key === selectedSupermarket);
    const price = prod?.[sup?.priceField] ?? prod?.prezzo ?? 0;
    
    const categoryObject = findCategory(prod.categoria_id);
    const categoriaName = categoryObject?.name || null;

    const newItem = {
        articolo: prod.articolo || prod,
        descrizione: prod.descrizione_articolo || prod.descrizione || null,
        inserito_da: userProfile.username,
        user_id: userProfile.id,
        fatto: false,
        quantita: 1,
        unita_misura: prod.unita_misura || null,
        prezzo: price,
        supermercato: selectedSupermarket,
        categoria: categoriaName,
        prodotto_id: prod.id || null,
        family_group: familyGroup,
        created_at: new Date().toISOString(),
        prezzo_esselunga: prod.prezzo_esselunga,
        prezzo_mercato: prod.prezzo_mercato,
        prezzo_carrefour: prod.prezzo_carrefour,
        prezzo_penny: prod.prezzo_penny,
        prezzo_coop: prod.prezzo_coop,
    };

    const { data } = await supabase.from("shopping_items").insert([newItem]).select();
    if (data) setShoppingItems(s => [...s, ...data]);
    
    if (mode !== "vocale") setSearchQuery("");
}

  async function handleUpdateShoppingItem(id, patch) {
    const { data } = await supabase.from("shopping_items").update(patch).eq("id", id).select();
    if (data) setShoppingItems(prev => prev.map(r => r.id === id ? data[0] : r));
  }

  async function toggleTaken(item) {
    await handleUpdateShoppingItem(item.id, { fatto: !item.fatto });
  }

  async function clearShoppingList() {
    if (!window.confirm("Sei sicuro di azzerare tutta la lista?")) return;
    await supabase.from("shopping_items").delete().eq("family_group", familyGroup);
    setShoppingItems([]);
  }

async function finishShopping() {
    const taken = shoppingItems.filter(i => i.fatto);
    if (taken.length === 0) { 
        window.alert("Nessun articolo selezionato come preso."); 
        return; 
    }
    const payload = taken.map(it => ({
        articolo: it.articolo,
        categoria: it.categoria,
        supermercato: it.supermercato,
        data_acquisto: new Date().toISOString(),
        family_group: it.family_group,
        quantita: it.quantita,
        unita_misura: it.unita_misura,
        prezzo: it.prezzo,
        prezzo_esselunga: it.prezzo_esselunga,
        prezzo_mercato: it.prezzo_mercato,
        prezzo_coop: it.prezzo_coop,
        prezzo_penny: it.prezzo_penny,
        prezzo_carrefour: it.prezzo_carrefour,
    }));
    await supabase.from("acquisti_effettuati").insert(payload);
    const idsToDelete = taken.map(t => t.id);
    await supabase.from("shopping_items").delete().in("id", idsToDelete);
    setShoppingItems(prev => prev.filter(i => !idsToDelete.includes(i.id)));
    window.alert("Acquisti salvati.");
}

  const sortedShoppingItems = useMemo(() => {
    let items = [...shoppingItems];
    const takenItems = items.filter(i => i.fatto);
    let notTaken = items.filter(i => !i.fatto);

    if (sortConfig.key === 'categoria') {
      notTaken.sort((a, b) => {
        const catA = (findCategory(a.categoria)?.name || '').toLowerCase();
        const catB = (findCategory(b.categoria)?.name || '').toLowerCase();
        return sortConfig.ascending ? catA.localeCompare(catB) : catB.localeCompare(catA);
      });
    } else if (sortConfig.key === 'corsia') {
      notTaken.sort((a, b) => {
        const sup = SUPERMARKETS.find(s => s.key === selectedSupermarket);
        const corsA = (findCategory(a.categoria)?.[sup?.corsiaField] || '').toLowerCase();
        const corsB = (findCategory(b.categoria)?.[sup?.corsiaField] || '').toLowerCase();
        return sortConfig.ascending ? corsA.localeCompare(corsB) : corsB.localeCompare(corsA);
      });
    }

    return [...notTaken, ...takenItems];
  }, [shoppingItems, sortConfig, selectedSupermarket, categorie]);

  return (
    <div className="container">
      
      <div className="header">
        <h1>Lista della Spesa</h1>
        <p>Gruppo Famiglia: <strong>{familyGroup || '...'}</strong></p>
        <button onClick={() => navigate('/main-menu')} className="btn-secondary">
          Menu Principale
        </button>
      </div>

      <div className="main-content">
        <div className="info-box yellow">
          <h2>Selezionare Supermercato</h2>
          <p>Serve per la corsia e per i prezzi</p>
        </div>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          {SUPERMARKETS.map(s => (
            <button 
              key={s.key} 
              className={`tab-button ${selectedSupermarket === s.key ? 'active' : ''}`} 
              onClick={() => setSelectedSupermarket(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="info-box yellow">
          <h2>Modalità Inserimento</h2>
          <p>Seleziona come vuoi aggiungere prodotti alla lista</p>
        </div>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <button 
            className={`tab-button ${mode === 'archivio' ? 'active' : ''}`} 
            onClick={() => setMode('archivio')}
          >
            Archivio
          </button>
          <button 
            className={`tab-button ${mode === 'preferiti' ? 'active' : ''}`} 
            onClick={() => setMode('preferiti')}
          >
            Preferiti
          </button>
          <button 
            className={`tab-button ${mode === 'vocale' ? 'active' : ''}`} 
            onClick={() => setMode('vocale')}
          >
            Comando Vocale
          </button>
          <button 
            className={`tab-button ${mode === 'ricette' ? 'active' : ''}`} 
            onClick={() => navigate('/pagina3-ricette-ai')}
          >
            Ricette
          </button>
        </div>

        {mode !== 'ricette' && (
          <div className="input-group">
            <input
              type="text"
              className="search-input"
              placeholder={mode === 'preferiti' ? 'Cerca nei preferiti...' : mode === 'vocale' ? 'Cerca o usa il microfono...' : 'Cerca prodotto...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            {mode === 'vocale' && (
              <button
                onClick={startVoiceRecognition}
                disabled={isListening}
                className="btn-add"
              >
                {isListening ? '🎤 Ascolto...' : '🎤 Parla'}
              </button>
            )}
            
            <button
              className="btn-primary"
              onClick={() => navigate('/pagina4-archivio-prodotti')}
            >
              Aggiungi nuovo
            </button>
          </div>
        )}

        {(mode === 'preferiti' || searchQuery) && mode !== 'ricette' && searchResults.length > 0 && (
          <ul className="list">
            {searchResults.map(p => {
              const categoria = findCategory(p.categoria || p.categoria_id);
              return (
                <li key={p.id || p.articolo} className="list-item">
                  <div className="item-main">
                    <strong>{p.articolo || p}</strong>
                    {p.preferito && <span style={{ color: '#ffd700', marginLeft: '5px' }}>⭐</span>}
                    <small style={{ display: 'block', color: '#666', marginTop: '2px' }}>{p.descrizione}</small>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
                    <div style={{ fontSize: '0.9em', color: '#888', flex: 1 }}>
                      Categoria: {categoria?.name || 'N/A'}
                    </div>
                    <button className="btn-add" onClick={() => addProductToShopping(p)}>Aggiungi</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {mode === 'preferiti' && searchResults.length === 0 && (
          <div className="info-box red">
            Nessun prodotto preferito trovato per il gruppo famiglia.
          </div>
        )}

        {mode === 'vocale' && searchQuery && searchResults.length === 0 && (
          <div className="info-box red">
            Nessun prodotto trovato con "{searchQuery}".
          </div>
        )}

        {shoppingItems.length > 0 && (
          <div className="shopping-table-container">
            <table className="shopping-table">
              <thead>
                <tr>
                  <th>
                    <div className="sort-header">
                      <span onClick={() => setSortConfig({ key: 'corsia', ascending: true })}>↑</span>
                      Corsia
                      <span onClick={() => setSortConfig({ key: 'corsia', ascending: false })}>↓</span>
                    </div>
                  </th>
                  <th>
                    <div className="sort-header">
                      <span onClick={() => setSortConfig({ key: 'categoria', ascending: true })}>↑</span>
                      Categoria
                      <span onClick={() => setSortConfig({ key: 'categoria', ascending: false })}>↓</span>
                    </div>
                  </th>
                  <th>Articolo</th>
                  <th>Quantità</th>
                  <th>Unità</th>
                  <th>Prezzo</th>
                  <th>Preso</th>
                  <th>Elimina</th>
                </tr>
              </thead>
              <tbody>
                {sortedShoppingItems.map(item => {
                  const prodotto = prodotti.find(p => p.id === item.prodotto_id) || {};
                  const sup = SUPERMARKETS.find(s => s.key === selectedSupermarket);
                  const categoria = findCategory(item.categoria);
                  const corsia = categoria?.[sup?.corsiaField] || prodotto?.[sup?.corsiaField] || prodotto?.corsia || '';
                  const prezzo = prodotto?.[sup?.priceField] ?? item.prezzo;
                  return (
                    <tr key={item.id} className={item.fatto ? 'taken' : ''}>
                      <td>{corsia}</td>
                      <td>{categoria?.name}</td>
                      <td>{item.articolo}</td>
                      <td>
                        <input type="number" className="small-input" value={item.quantita} onChange={e => handleUpdateShoppingItem(item.id, { quantita: parseInt(e.target.value) })} />
                      </td>
                      <td>{item.unita_misura}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <input type="number" className="small-input" value={prezzo} onChange={e => handleUpdateShoppingItem(item.id, { prezzo: parseFloat(e.target.value) })} />
                          <button 
                            className="btn-primary" 
                            style={{ marginLeft: '5px' }} 
                            onClick={() => setShowOtherPrices(showOtherPrices === item.id ? null : item.id)}
                          >
                            ...
                          </button>
                        </div>
                        {showOtherPrices === item.id && (
                          <div className="other-prices-dropdown">
                            {SUPERMARKETS.map(s => <div key={s.key}>{s.label}: {prodotto?.[s.priceField] ?? '-'}</div>)}
                          </div>
                        )}
                      </td>
                      <td>
                        <input type="checkbox" checked={item.fatto} onChange={() => toggleTaken(item)} />
                      </td>
                      <td>
                        <button className="btn-delete" onClick={() => supabase.from('shopping_items').delete().eq('id', item.id) && setShoppingItems(prev => prev.filter(r => r.id !== item.id))}>Elimina</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="footer">
        {shoppingItems.length > 0 && (
          <div className="input-group">
            <button className="btn-primary" onClick={clearShoppingList}>Azzera Lista</button>
            <button className="btn-add" onClick={finishShopping}>FINE SPESA</button>
          </div>
        )}
      </div>
    </div>
  );
}
