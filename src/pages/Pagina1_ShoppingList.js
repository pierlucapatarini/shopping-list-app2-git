import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "../styles/StilePagina1.css";
import "../styles/MainStyle.css";
import { FaBars } from 'react-icons/fa';

const SUPERMARKETS = [
  { key: "esselunga", label: "Esselunga", priceField: "prezzo_esselunga", corsiaField: "corsia_esselunga", icon: "🛒" },
  { key: "mercato", label: "Mercato", priceField: "prezzo_mercato", corsiaField: "corsia_mercato", icon: "🍏" },
  { key: "carrefour", label: "Carrefour", priceField: "prezzo_carrefour", corsiaField: "corsia_carrefour", icon: "🇫🇷" },
  { key: "penny", label: "Penny", priceField: "prezzo_penny", corsiaField: "corsia_penny", icon: "💰" },
  { key: "coop", label: "Coop", priceField: "prezzo_coop", corsiaField: "prezzo_coop", icon: "🤝" },
];

const MODES = [
  { key: "archivio", label: "Digitare/Visualizza Lista ", icon: "📚" },
  { key: "preferiti", label: "Lista Preferiti", icon: "⭐️" },
  { key: "vocale", label: "Comando Vocale", icon: "🎤" },
  { key: "ricette", label: "Ricette AI", icon: "👩‍🍳" },
];

export default function Pagina1_ShoppingList() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [familyGroup, setFamilyGroup] = useState(null);
  const [prodotti, setProdotti] = useState([]);
  const [categorie, setCategorie] = useState([]);
  const [shoppingItems, setShoppingItems] = useState([]);
  const [selectedSupermarket, setSelectedSupermarket] = useState(SUPERMARKETS[0].key);
  const [mode, setMode] = useState(MODES[0].key);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOtherPrices, setShowOtherPrices] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, ascending: true });
  const [isListening, setIsListening] = useState(false);
  const [showFullList, setShowFullList] = useState(false); // Changed default state to false

// Funzione per calcolare la somiglianza tra due stringhe
const calculateSimilarity = (word1, word2) => {
  const s1 = word1.toLowerCase().trim();
  const s2 = word2.toLowerCase().trim();
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return 1 - (matrix[len1][len2] / Math.max(len1, len2));
};


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
    // Rimuove l'ultima lettera della stringa di ricerca per gestire singolare/plurale
    // Esempio: "banana" diventa "banan", "banane" diventa "banan"
    const q = searchQuery.trim().toLowerCase();
    const truncatedQuery = q.length > 2 ? q.slice(0, -1) : q;

    // Filtra i prodotti per il gruppo familiare
    let filteredProdotti = prodotti.filter(p => p.family_group === familyGroup);

    // Gestione della modalità "preferiti"
    if (mode === "preferiti") {
        filteredProdotti = filteredProdotti.filter(p => p.preferito == true || p.preferito === 1 || p.preferito === "true" || p.preferito === "1");
        
        filteredProdotti.sort((a, b) => {
            const catA = findCategory(a.categoria_id)?.name || '';
            const catB = findCategory(b.categoria_id)?.name || '';
            if (catA < catB) return -1;
            if (catA > catB) return 1;
            return a.articolo.localeCompare(b.articolo);
        });

        if (!q) return filteredProdotti;
        // La ricerca sui preferiti usa il testo completo per maggiore precisione
        return filteredProdotti.filter(p => p.articolo.toLowerCase().includes(q) || (p.descrizione || "").toLowerCase().includes(q));
    }
    
    // Se non c'è una query, non mostrare risultati
    if (!q) return [];
    
    // Logica di ricerca principale per "archivio" e "vocale"
    return filteredProdotti.filter(p =>
      // Cerca la corrispondenza usando la stringa troncata
      p.articolo.toLowerCase().includes(truncatedQuery) ||
      (p.descrizione || "").toLowerCase().includes(truncatedQuery)
    );
}, [prodotti, searchQuery, mode, familyGroup, categorie]);

  const startVoiceRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      window.alert('Il riconoscimento vocale non è supportato dal tuo browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'it-IT';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      setIsListening(false);
    };
    recognition.onerror = (event) => {
      console.error('Errore riconoscimento vocale:', event.error);
      setIsListening(false);
      window.alert('Errore nel riconoscimento vocale: ' + event.error);
    };
    recognition.onend = () => setIsListening(false);

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
      
      prezzo_esselunga: prod.prezzo_esselunga,
      prezzo_mercato: prod.prezzo_mercato,
      prezzo_carrefour: prod.prezzo_carrefour,
      prezzo_penny: prod.prezzo_penny,
      prezzo_coop: prod.prezzo_coop,
    };

    const { data } = await supabase.from("shopping_items").insert([newItem]).select();
    if (data) setShoppingItems(s => [...s, ...data]);
  }

  async function handleUpdateShoppingItem(id, patch) {
    const { data } = await supabase.from("shopping_items").update(patch).eq("id", id).select();
    if (data) setShoppingItems(prev => prev.map(r => r.id === id ? data[0] : r));
  }

  async function toggleTaken(item) {
    await handleUpdateShoppingItem(item.id, { fatto: !item.fatto });
  }

  async function handleDeleteItem(id) {
    await supabase.from('shopping_items').delete().eq('id', id);
    setShoppingItems(prev => prev.filter(r => r.id !== id));
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
    <div className="app-layout">
      {/* Header */}
      <div className={`header ${!showFullList ? 'header-mobile-compact' : ''}`}>
        <button onClick={() => navigate('/main-menu')} className="btn-secondary">
          <FaBars /> Ritorna al menu
        </button>
        <h1>Lista della Spesa</h1>
        <p>Family's : <strong>{familyGroup || '...'}</strong></p>
      </div>

      <div className="scrollable-content">
        {/* Controlli sempre visibili */}
        <div className="controls-container">
          {/* Sezione per i supermercati, visibile solo nella lista completa */}
          {showFullList && (
            <>
              <div className="info-box">
                <h2>Seleziona Supermercato</h2>
                <p>Prezzi e corsie si aggiorneranno automaticamente.</p>
              </div>
              <div className="tab-buttons">
                {SUPERMARKETS.map(s => (
                  <button
                    key={s.key}
                    className={`tab-button ${selectedSupermarket === s.key ? 'active' : ''}`}
                    onClick={() => setSelectedSupermarket(s.key)}
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Sezione per le modalità, ora sempre visibile */}
          <div className="info-box">
            <h2>Modalità Inserimento </h2>
          </div>
          <div className="tab-buttons">
            {MODES.map(m => (
              <button
                key={m.key}
                className={`tab-button ${m.key === mode ? 'active' : ''}`}
                onClick={() => m.key === 'ricette' ? navigate('/pagina3-ricette-ai') : setMode(m.key)}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Barra ricerca e vocale sempre visibile in modalità vocale */}
        {mode !== 'ricette' && (
          <div className="input-group">
            <input
              type="text"
              className="search-input"
              placeholder={
                mode === 'preferiti'
                  ? 'Cerca nei preferiti...'
                  : mode === 'vocale'
                    ? 'Parla per cercare...'
                    : 'Cerca un prodotto digitando ...'
              }
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
              + Nuovo
            </button>
          </div>
        )}

        {/* Risultati ricerca */}
        {(mode === 'preferiti' || searchQuery) && mode !== 'ricette' && searchResults.length > 0 && (
          <div className="shopping-table-container">
            <table className="shopping-table">
              <thead>
                <tr>
                  <th>Articolo</th>
                  <th>Descrizione</th>
                  <th>Categoria</th>
                  <th>Azione</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map(p => {
                  const categoria = findCategory(p.categoria_id);
                  return (
                    <tr key={p.id || p.articolo}>
                      <td title={p.descrizione}>
                        <strong>{p.articolo || p}</strong>
                        {p.preferito && <span role="img" aria-label="preferito">⭐</span>}
                      </td>
                      <td>{p.descrizione}</td>
                      <td>{categoria?.name || 'N/A'}</td>
                      <td>
                        <button className="btn-add" onClick={() => addProductToShopping(p)}>Aggiungi</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Messaggi vuoti */}
        {mode === 'preferiti' && searchResults.length === 0 && (
          <div className="info-box red">
            Nessun prodotto preferito trovato.
          </div>
        )}
        {mode !== 'preferiti' && searchQuery && searchResults.length === 0 && (
          <div className="info-box red">
            Nessun prodotto trovato con "{searchQuery}".
          </div>
        )}

        {/* Pulsanti vista lista */}
        <div className="button-list-container">
          <button className={`btn-secondary ${!showFullList ? 'active' : ''}`} onClick={() => setShowFullList(false)}>
            Visualizza lista ridotta
          </button>
          <button className={`btn-secondary ${showFullList ? 'active' : ''}`} onClick={() => setShowFullList(true)}>
            Visualizza lista completa
          </button>
        </div>

        {/* Lista della spesa */}
        {shoppingItems.length > 0 && (
          <>
            {showFullList ? (
              <div className="shopping-table-container">
                <table className="shopping-table">
                  <thead>
                    <tr>
                      <th className="articolo-column-header">Articolo</th>
                      <th>✔️</th>
                      <th>🗑️</th>
                      <th>Quantità</th>
                      <th>Prezzo</th>
                      <th>
                        <div className="sort-header" onClick={() => setSortConfig({ key: 'categoria', ascending: !sortConfig.ascending })}>
                          Categoria {sortConfig.key === 'categoria' && (sortConfig.ascending ? '↓' : '↑')}
                        </div>
                      </th>
                      <th>
                        <div className="sort-header" onClick={() => setSortConfig({ key: 'corsia', ascending: !sortConfig.ascending })}>
                          Corsia {sortConfig.key === 'corsia' && (sortConfig.ascending ? '↓' : '↑')}
                        </div>
                      </th>
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
                          <td title={item.descrizione} className="articolo-column-cell">{item.articolo}</td>
                          <td>
                            <button className="btn-icon" onClick={() => toggleTaken(item)}>
                              {item.fatto ? '✔️' : '◻️'}
                            </button>
                          </td>
                          <td>
                            <button className="btn-icon" onClick={() => handleDeleteItem(item.id)}>🗑️</button>
                          </td>
                          <td>
                            <input type="number" className="small-input" value={item.quantita} onChange={e => handleUpdateShoppingItem(item.id, { quantita: parseInt(e.target.value) })} />
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <input type="number" className="small-input" value={prezzo} onChange={e => handleUpdateShoppingItem(item.id, { prezzo: parseFloat(e.target.value) })} />
                              <button className="btn-primary" style={{ marginLeft: '5px' }} onClick={() => setShowOtherPrices(showOtherPrices === item.id ? null : item.id)}>...</button>
                              {showOtherPrices === item.id && (
                                <div className="other-prices-dropdown">
                                  {SUPERMARKETS.map(s => <div key={s.key}>{s.label}: {prodotto?.[s.priceField] ?? '-'}</div>)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>{categoria?.name}</td>
                          <td>{corsia}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="shopping-table-container">
                <table className="shopping-table">
                  <thead>
                    <tr>
                      <th className="articolo-column-header">Articolo</th>
                      <th>✔️</th>
                      <th>🗑️</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedShoppingItems.map(item => (
                      <tr key={item.id} className={item.fatto ? 'taken' : ''}>
                        <td title={item.descrizione} className="articolo-column-cell">{item.articolo}</td>
                        <td>
                          <button className="btn-icon" onClick={() => toggleTaken(item)}>{item.fatto ? '✔️' : '◻️'}</button>
                        </td>
                        <td>
                          <button className="btn-icon" onClick={() => handleDeleteItem(item.id)}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <div className="footer">
        {shoppingItems.length > 0 && mode === 'archivio' && (
          <div className="input-group">
            <button className="btn-delete" onClick={clearShoppingList}>Azzera Lista</button>
            <button className="btn-primary" onClick={finishShopping}>FINE SPESA 🥳</button>
          </div>
        )}
      </div>
    </div>
  );
}