const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

// Use Hugging Face free inference
const HF_API_TOKEN = process.env.HF_API_TOKEN;
const HF_MODEL = 'google/flan-t5-large';  // good for short Q&A
const HF_URL = 'https://api-inference.huggingface.co/models/' + HF_MODEL;

app.post('/ask', async (req, res) => {
    const { prompt } = req.body;
    console.log(`📥 Received: ${prompt}`);
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    try {
        const response = await axios.post(HF_URL, { inputs: prompt }, {
            headers: { 'Authorization': `Bearer ${HF_API_TOKEN}` }
        });
        let reply = response.data?.generated_text;
        if (!reply) reply = "Sorry, I didn't understand.";
        console.log(`🤖 Reply: ${reply}`);
        res.json({ reply });
    } catch (error) {
        console.error('HF error:', error.response?.data || error.message);
        res.status(500).json({ error: 'HF failed' });
    }
});

app.get('/', (req, res) => res.send('Proxy OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Proxy on ${PORT}`));
