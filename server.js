const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Enable CORS for all origins (or replace with your frontend URL)
app.use(cors({
    origin: '*', // For development; in production you'd restrict to your github.io domain
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

app.post('/ask', async (req, res) => {
    const { prompt } = req.body;
    console.log(`📥 Received: ${prompt}`);
    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt' });
    }
    try {
        const response = await axios.post(GEMINI_URL, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 150,
            }
        });
        const reply = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
            console.log(`🤖 Reply: ${reply}`);
            res.json({ reply });
        } else {
            console.error('Unexpected Gemini response:', response.data);
            res.status(500).json({ error: 'Gemini returned empty reply' });
        }
    } catch (error) {
        console.error('❌ Gemini error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to reach Gemini' });
    }
});

app.get('/', (req, res) => res.send('Proxy OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Proxy server listening on ${PORT}`));
