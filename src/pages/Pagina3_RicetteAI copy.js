import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

function RecipeAI() {
    // STATI PER L'AI E LE RICETTE
    const [recipeInstructions, setRecipeInstructions] = useState('');
    const [recipeIngredients, setRecipeIngredients] = useState([]);
    const [recipeText, setRecipeText] = useState('');
    const [loading, setLoading] = useState(false);

    // STATI PER SUPABASE E PRODOTTI
    const [user, setUser] = useState(null);
    const [products, setProducts] = useState([]);
    const [productsToSelect, setProductsToSelect] = useState([]);
    const [showProductSelectionModal, setShowProductSelectionModal] = useState(false);

    const navigate = useNavigate();

    // FETCH DELL'UTENTE CORRENTE
    const fetchUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        if (!user) {
            navigate('/');
        }
    };

    // FETCH DEI PRODOTTI DAL DATABASE
    const fetchProducts = async () => {
        const { data, error } = await supabase
            .from('prodotti')
            .select('*, categorie(name)');
        if (error) {
            console.error('Errore nel recupero dei prodotti:', error.message);
        } else {
            setProducts(data);
        }
    };

// FUNZIONE PER AGGIUNGERE UN PRODOTTO ALLA LISTA DELLA SPESA
const addItemToShoppingList = async (product) => {
    const { data: { user } = { user: null } } = await supabase.auth.getUser();
    if (!user) {
        alert("Devi essere loggato per aggiungere articoli!");
        return;
    }

    const { data: existingItems, error: checkError } = await supabase
        .from('shopping_items')
        .select('id')
        .eq('prodotto_id', product.id)
        .eq('family_group', user.user_metadata?.family_group);

    if (checkError) {
        console.error('Errore nella verifica dell\'articolo:', checkError.message);
        return;
    }

    if (existingItems.length > 0) {
        alert("Questo articolo è già presente nella lista della spesa!");
        return;
    }

    // Qui modifichiamo l'oggetto da inserire per includere tutti i campi
    const newItem = {
        prodotto_id: product.id,
        articolo: product.articolo, // Popoliamo il campo 'articolo'
        descrizione: product.descrizione || null, // Aggiungiamo il campo 'descrizione' (se presente)
        unita_misura: product.unita_misura || null, // Aggiungiamo l'unità di misura
        quantita: 1, // Impostiamo una quantità di default
        categoria: product.categorie?.name || null, // Aggiungiamo la categoria
        prezzo: 0, // **CORRETTO:** Impostiamo il prezzo a 0 come richiesto
        supermercato: 'esselunga', // Indichiamo il supermercato di default
        inserito_da: user.user_metadata?.username || user.email,
        family_group: user.user_metadata?.family_group,
        user_id: user.id,
    };

    const { error } = await supabase
        .from('shopping_items')
        .insert([newItem]);

    if (error) {
        console.error('Errore nell\'aggiunta dell\'articolo:', error.message);
        alert('Errore nell\'aggiunta dell\'articolo. Controlla le policy di sicurezza di Supabase.');
    } else {
        alert(`Aggiunto "${product.articolo}" alla lista!`);
    }
};

const handleAnalyzeRecipe = async () => {
    if (!recipeText) {
        alert("Per favore, inserisci una ricetta da analizzare.");
        return;
    }
    
    setLoading(true);

    try {
        // Chiamata al nuovo endpoint serverless di Vercel
        const response = await fetch('/api/openai-recipes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ recipeText }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error);
        }

        const data = await response.json();
        
        const extractedIngredients = data.ingredients.map(name => ({
            name: name,
            checked: false
        }));

        setRecipeIngredients(extractedIngredients);
        setLoading(false);

    } catch (error) {
        console.error("Errore nell'analisi della ricetta:", error);
        alert(`Si è verificato un errore durante l'analisi: ${error.message}`);
        setLoading(false);
    }
};

const handleGetCookingInstructions = async () => {
    if (!recipeText) {
        alert("Per favore, inserisci una ricetta per ottenere le istruzioni.");
        return;
    }
    setLoading(true);
    setRecipeInstructions('');

    try {
        // Chiamata al nuovo endpoint serverless
        const response = await fetch('/api/openai-instructions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ recipeText }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error);
        }

        const data = await response.json();
        
        setRecipeInstructions(data.instructions);
        setLoading(false);

    } catch (error) {
        console.error("Errore nel recupero delle istruzioni di cottura:", error);
        alert(`Si è verificato un errore durante l'analisi: ${error.message}`);
        setLoading(false);
    }
};

    // FUNZIONE CORRETTA PER GESTIRE LA SELEZIONE DEGLI INGREDIENTI
    const handleAddSelectedIngredients = async () => {
        const selectedIngredients = recipeIngredients.filter(item => item.checked);
        if (selectedIngredients.length === 0) {
            alert("Seleziona almeno un ingrediente da aggiungere.");
            return;
        }
        
        // AGGIUNTO: Ottieni il family_group dell'utente corrente
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.user_metadata?.family_group) {
            alert("Errore: gruppo famiglia non trovato.");
            return;
        }
        
        const userFamilyGroup = user.user_metadata.family_group;
        
        // MODIFICATO: Filtra prima per family_group, poi per ingredienti
        const productsToAdd = products.filter(p => 
            p.family_group === userFamilyGroup && // AGGIUNTO questo filtro
            selectedIngredients.some(ingredient => 
                p.articolo.toLowerCase().includes(ingredient.name.toLowerCase())
            )
        );

        if (productsToAdd.length > 0) {
            setProductsToSelect(productsToAdd);
            setShowProductSelectionModal(true);
        } else {
            alert("Nessun prodotto corrispondente trovato nel tuo catalogo del gruppo famiglia.");
        }
    };

    // FUNZIONE PER PULIRE TUTTI I CAMPI
    const handleClearAll = () => {
        setRecipeText('');
        setRecipeIngredients([]);
        setRecipeInstructions('');
    };

    // FUNZIONE PER LOGOUT
    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    // CARICA I DATI ALL'AVVIO
    useEffect(() => {
        fetchUser();
        fetchProducts();
    }, []);

    if (loading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '100vh',
                backgroundColor: '#f5f5f5',
                fontSize: '1.2em'
            }}>
                Caricamento in corso...
            </div>
        );
    }

    return (
        <div style={{ 
            padding: '20px', 
            backgroundColor: '#f5f5f5', 
            minHeight: '100vh', 
            fontFamily: 'Arial, sans-serif' 
        }}>
            {/* HEADER */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '30px',
                backgroundColor: '#fff',
                padding: '20px',
                borderRadius: '15px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
            }}>
                <div>
                    <h1 style={{ color: '#333', margin: 0 }}>Recipe AI Assistant</h1>
                    <p style={{ color: '#666', margin: '5px 0 0 0' }}>
                        Utente: <strong>{user?.user_metadata?.username || user?.email}</strong>
                        {user?.user_metadata?.family_group && (
                            <span> | Gruppo Famiglia: <strong>{user.user_metadata.family_group}</strong></span>
                        )}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        onClick={() => navigate('/main-menu')}
                        style={{ 
                            padding: '10px 15px', 
                            borderRadius: '8px', 
                            backgroundColor: '#4CAF50', 
                            color: 'white', 
                            border: 'none', 
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                    >
                        Torna al Menu Principale
                    </button>

                    <button 
                        onClick={() => navigate('/pagina1-shopping-list')}
                        style={{ 
                            padding: '10px 15px', 
                            borderRadius: '8px', 
                            backgroundColor: '#4CAF50', 
                            color: 'white', 
                            border: 'none', 
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                    >
                        Torna alla Lista Spesa
                    </button>
                </div>
            </div>

            {/* CONTENUTO PRINCIPALE */}
            <div style={{
                backgroundColor: '#fff',
                padding: '30px',
                borderRadius: '15px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                maxWidth: '1000px',
                margin: '0 auto'
            }}>
                {/* SEZIONE INPUT RICETTA */}
                <div style={{ marginBottom: '30px' }}>
                    <h2 style={{ color: '#333', marginBottom: '15px' }}>Inserisci la tua Ricetta</h2>
                    <textarea
                        placeholder="Incolla qui la tua ricetta completa (ingredienti e preparazione)..."
                        rows="12"
                        value={recipeText}
                        onChange={(e) => setRecipeText(e.target.value)}
                        style={{ 
                            width: '100%', 
                            padding: '15px', 
                            borderRadius: '10px', 
                            border: '2px solid #ddd',
                            fontSize: '14px',
                            fontFamily: 'Arial, sans-serif',
                            resize: 'vertical',
                            minHeight: '200px'
                        }}
                    />
                    
                    {/* BOTTONI AZIONI */}
                    <div style={{ 
                        display: 'flex', 
                        gap: '15px', 
                        marginTop: '15px',
                        flexWrap: 'wrap'
                    }}>
                        <button 
                            onClick={handleAnalyzeRecipe}
                            disabled={!recipeText || loading}
                            style={{ 
                                padding: '12px 20px', 
                                backgroundColor: !recipeText || loading ? '#ccc' : '#4CAF50', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '10px', 
                                cursor: !recipeText || loading ? 'not-allowed' : 'pointer',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                flex: 1,
                                minWidth: '150px'
                            }}
                        >
                            🔍 Trova Ingredienti
                        </button>
                        
                        <button 
                            onClick={handleGetCookingInstructions}
                            disabled={!recipeText || loading}
                            style={{ 
                                padding: '12px 20px', 
                                backgroundColor: !recipeText || loading ? '#ccc' : '#007BFF', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '10px', 
                                cursor: !recipeText || loading ? 'not-allowed' : 'pointer',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                flex: 1,
                                minWidth: '150px'
                            }}
                        >
                            📝 Istruzioni + Meteo + Barzelletta
                        </button>
                        
                        <button 
                            onClick={handleClearAll}
                            style={{ 
                                padding: '12px 20px', 
                                backgroundColor: '#ff9800', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '10px', 
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                minWidth: '120px'
                            }}
                        >
                            🗑️ Pulisci Tutto
                        </button>
                    </div>
                </div>

                {/* SEZIONE INGREDIENTI TROVATI */}
                {recipeIngredients.length > 0 && (
                    <div style={{ 
                        marginBottom: '30px',
                        padding: '20px',
                        backgroundColor: '#f9f9f9',
                        borderRadius: '10px',
                        border: '2px solid #e8f5e9'
                    }}>
                        <h3 style={{ color: '#333', marginBottom: '15px' }}>🛒 Ingredienti Trovati:</h3>
                        <div style={{ 
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                            gap: '10px',
                            marginBottom: '20px'
                        }}>
                            {recipeIngredients.map((ingredient, index) => (
                                <label 
                                    key={index} 
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        padding: '10px',
                                        backgroundColor: ingredient.checked ? '#e8f5e9' : '#fff',
                                        borderRadius: '8px',
                                        border: '1px solid #ddd',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <input 
                                        type="checkbox" 
                                        style={{ marginRight: '10px', transform: 'scale(1.2)' }} 
                                        checked={ingredient.checked} 
                                        onChange={() => {
                                            const updatedIngredients = [...recipeIngredients];
                                            updatedIngredients[index].checked = !updatedIngredients[index].checked;
                                            setRecipeIngredients(updatedIngredients);
                                        }}
                                    />
                                    <span style={{ fontSize: '14px' }}>{ingredient.name}</span>
                                </label>
                            ))}
                        </div>
                        
                        <button 
                            onClick={handleAddSelectedIngredients}
                            disabled={!recipeIngredients.some(ing => ing.checked)}
                            style={{ 
                                padding: '12px 25px', 
                                backgroundColor: recipeIngredients.some(ing => ing.checked) ? '#2196F3' : '#ccc', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '10px', 
                                cursor: recipeIngredients.some(ing => ing.checked) ? 'pointer' : 'not-allowed',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                width: '100%'
                            }}
                        >
                            ➕ Aggiungi Ingredienti Selezionati alla Lista Spesa
                        </button>
                    </div>
                )}

                {/* SEZIONE ISTRUZIONI DI COTTURA */}
                {recipeInstructions && (
                    <div style={{ 
                        padding: '20px',
                        backgroundColor: '#f0f8ff',
                        borderRadius: '10px',
                        border: '2px solid #e3f2fd'
                    }}>
                        <h3 style={{ color: '#333', marginBottom: '15px' }}>👨‍🍳 Istruzioni di Cottura + Meteo + Barzelletta:</h3>
                        <div style={{ 
                            padding: '20px', 
                            backgroundColor: '#fff',
                            borderRadius: '8px',
                            border: '1px solid #ddd',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.6',
                            fontSize: '14px',
                            maxHeight: '500px',
                            overflowY: 'auto'
                        }}>
                            {recipeInstructions}
                        </div>
                    </div>
                )}
            </div>

            {/* MODALE PER SELEZIONE PRODOTTI */}
            {showProductSelectionModal && (
                <div style={{ 
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    backgroundColor: 'rgba(0,0,0,0.5)', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div style={{ 
                        backgroundColor: '#fff', 
                        padding: '30px', 
                        borderRadius: '15px', 
                        boxShadow: '0 8px 16px rgba(0,0,0,0.3)', 
                        width: '90%', 
                        maxWidth: '600px', 
                        maxHeight: '80vh', 
                        overflowY: 'auto' 
                    }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            marginBottom: '20px',
                            borderBottom: '2px solid #f0f0f0',
                            paddingBottom: '10px'
                        }}>
                            <h2 style={{ margin: 0, color: '#333' }}>Seleziona i Prodotti da Aggiungere</h2>
                            <button 
                                onClick={() => setShowProductSelectionModal(false)}
                                style={{ 
                                    padding: '8px 12px', 
                                    backgroundColor: '#f44336', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '8px', 
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                ✕ Chiudi
                            </button>
                        </div>
                        
                        {productsToSelect.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {productsToSelect.map(product => (
                                    <div 
                                        key={product.id} 
                                        style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center', 
                                            padding: '15px',
                                            backgroundColor: '#f9f9f9',
                                            borderRadius: '10px',
                                            border: '1px solid #ddd'
                                        }}
                                    >
                                        <div>
                                            <strong style={{ fontSize: '16px' }}>{product.articolo}</strong>
                                            <br />
                                            <small style={{ color: '#666' }}>
                                                Categoria: {product.categorie ? product.categorie.name : 'N/A'}
                                            </small>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                addItemToShoppingList(product);
                                                // La riga successiva è stata rimossa per non chiudere il modale
                                                // setShowProductSelectionModal(false);
                                            }}
                                            style={{ 
                                                padding: '10px 15px', 
                                                backgroundColor: '#4CAF50', 
                                                color: 'white', 
                                                border: 'none', 
                                                borderRadius: '8px', 
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            ➕ Aggiungi
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ textAlign: 'center', color: '#666', fontSize: '16px' }}>
                                Nessun prodotto trovato che corrisponda agli ingredienti selezionati nel tuo gruppo famiglia.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default RecipeAI;