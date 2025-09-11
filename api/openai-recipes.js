import OpenAI from 'openai';

// IMPORTANTE: Qui usiamo la variabile d'ambiente che caricherai su Vercel.
// Non ha bisogno del prefisso 'REACT_APP_'.
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
    // Questa è la funzione che gestisce le richieste in arrivo
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    const { recipeText } = req.body;

    if (!recipeText) {
        return res.status(400).json({ error: 'Manca il testo della ricetta' });
    }

    try {
        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Sei un assistente esperto in ricette e shopping. Il tuo compito è estrarre gli ingredienti da una ricetta data dall'utente. Rispondi solo con una lista di ingredienti separati da una virgola, senza altre frasi o spiegazioni. Non includere le quantità o le istruzioni. Ad esempio: 'pomodoro, mozzarella, basilico'."
                },
                {
                    role: "user",
                    content: recipeText
                }
            ],
        });

        const rawIngredients = chatCompletion.choices[0].message.content.trim();
        const extractedIngredients = rawIngredients.split(',').map(name => name.trim());

        // L'endpoint risponde solo con gli ingredienti estratti.
        res.status(200).json({ ingredients: extractedIngredients });

    } catch (error) {
        console.error("Errore nell'analisi della ricetta:", error);
        res.status(500).json({ error: `Si è verificato un errore durante l'analisi: ${error.message}` });
    }
}