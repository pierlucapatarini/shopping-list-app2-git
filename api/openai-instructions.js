import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
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
                    content: "Sei un assistente esperto in ricette. Il tuo compito è fornire le istruzioni di cottura passo dopo passo per la ricetta. Rispondi solo con le istruzioni, senza altre frasi o spiegazioni. Non includere gli ingredienti o le quantità. Formatta le istruzioni con punti elenco o una lista numerata per renderle più chiare. Aggiungi anche la situazione del tempo su Cambiano (TORINO) per i 2 giorni successivi (suddivise tra mattina, pomeriggio e sera con temperature medie, basati sul meteo 3B meteo) e aggiungi una barzelletta"
                },
                {
                    role: "user",
                    content: recipeText
                }
            ],
        });

        const instructions = chatCompletion.choices[0].message.content.trim();
        
        // L'endpoint risponde con le istruzioni
        res.status(200).json({ instructions });

    } catch (error) {
        console.error("Errore nel recupero delle istruzioni di cottura:", error);
        res.status(500).json({ error: `Si è verificato un errore durante l'analisi: ${error.message}` });
    }
}