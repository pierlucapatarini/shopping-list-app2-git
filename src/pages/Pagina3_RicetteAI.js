import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import '../styles/MainStyle.css';
import '../styles/StilePagina3.css'; // Nuovo file di stile per questa pagina

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

        const newItem = {
            prodotto_id: product.id,
            articolo: product.articolo,
            descrizione: product.descrizione || null,
            unita_misura: product.unita_misura || null,
            quantita: 1,
            categoria: product.categorie?.name || null,
            prezzo: 0,
            supermercato: 'esselunga',
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
            const response = await fetch('/api/openai-recipes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            const response = await fetch('/api/openai-instructions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    const handleAddSelectedIngredients = async () => {
        const selectedIngredients = recipeIngredients.filter(item => item.checked);
        if (selectedIngredients.length === 0) {
            alert("Seleziona almeno un ingrediente da aggiungere.");
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.user_metadata?.family_group) {
            alert("Errore: gruppo famiglia non trovato.");
            return;
        }

        const userFamilyGroup = user.user_metadata.family_group;

        const productsToAdd = products.filter(p =>
            p.family_group === userFamilyGroup &&
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

    const handleClearAll = () => {
        setRecipeText('');
        setRecipeIngredients([]);
        setRecipeInstructions('');
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    useEffect(() => {
        fetchUser();
        fetchProducts();
    }, []);

    if (loading) {
        return (
            <div className="loading">Caricamento in corso...</div>
        );
    }

    return (
        <div className="app-layout">
            <header className="header">
                <div className="header-info">
                    <h1>Recipe AI Assistant 🧑‍🍳</h1>
                    <p>Utente: <strong>{user?.user_metadata?.username || user?.email}</strong>
                        {user?.user_metadata?.family_group && (
                            <span> | Gruppo Famiglia: <strong>{user.user_metadata.family_group}</strong></span>
                        )}
                    </p>
                </div>
                <div className="header-buttons">
                    <button onClick={() => navigate('/main-menu')} className="btn-secondary">
                        Torna al Menu Principale
                    </button>
                    <button onClick={() => navigate('/pagina1-shopping-list')} className="btn-secondary">
                        Torna alla Lista Spesa
                    </button>
                </div>
            </header>

            <main className="main-content">
                <div className="content-card">
                    <h2>Inserisci la tua Ricetta</h2>
                    <textarea
                        className="recipe-textarea"
                        placeholder="Incolla qui la tua ricetta completa (ingredienti e preparazione)..."
                        value={recipeText}
                        onChange={(e) => setRecipeText(e.target.value)}
                    />

                    <div className="recipe-buttons-group">
                        <button
                            onClick={handleAnalyzeRecipe}
                            disabled={!recipeText || loading}
                            className="btn-primary"
                        >
                            🔍 Trova Ingredienti
                        </button>
                        <button
                            onClick={handleGetCookingInstructions}
                            disabled={!recipeText || loading}
                            className="btn-info"
                        >
                            📝 Istruzioni + Meteo + Barzelletta
                        </button>
                        <button
                            onClick={handleClearAll}
                            className="btn-warning"
                        >
                            🗑️ Pulisci Tutto
                        </button>
                    </div>
                </div>

                {recipeIngredients.length > 0 && (
                    <div className="content-card ingredient-card">
                        <h3>🛒 Ingredienti Trovati:</h3>
                        <div className="ingredient-list">
                            {recipeIngredients.map((ingredient, index) => (
                                <label key={index} className="ingredient-label">
                                    <input
                                        type="checkbox"
                                        checked={ingredient.checked}
                                        onChange={() => {
                                            const updatedIngredients = [...recipeIngredients];
                                            updatedIngredients[index].checked = !updatedIngredients[index].checked;
                                            setRecipeIngredients(updatedIngredients);
                                        }}
                                    />
                                    <span>{ingredient.name}</span>
                                </label>
                            ))}
                        </div>
                        <button
                            onClick={handleAddSelectedIngredients}
                            disabled={!recipeIngredients.some(ing => ing.checked)}
                            className="btn-add-to-list"
                        >
                            ➕ Aggiungi Ingredienti Selezionati alla Lista Spesa
                        </button>
                    </div>
                )}

                {recipeInstructions && (
                    <div className="content-card instruction-card">
                        <h3>👨‍🍳 Istruzioni di Cottura + Meteo + Barzelletta:</h3>
                        <div className="instructions-box">
                            {recipeInstructions}
                        </div>
                    </div>
                )}
            </main>

            {showProductSelectionModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Seleziona i Prodotti da Aggiungere</h2>
                            <button onClick={() => setShowProductSelectionModal(false)} className="btn-cancel">
                                ✕ Chiudi
                            </button>
                        </div>

                        {productsToSelect.length > 0 ? (
                            <div className="modal-list">
                                {productsToSelect.map(product => (
                                    <div key={product.id} className="modal-list-item">
                                        <div>
                                            <strong>{product.articolo}</strong>
                                            <br />
                                            <small>Categoria: {product.categorie ? product.categorie.name : 'N/A'}</small>
                                        </div>
                                        <button
                                            onClick={() => {
                                                addItemToShoppingList(product);
                                            }}
                                            className="btn-primary"
                                        >
                                            ➕ Aggiungi
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p>Nessun prodotto trovato che corrisponda agli ingredienti selezionati nel tuo gruppo famiglia.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default RecipeAI;