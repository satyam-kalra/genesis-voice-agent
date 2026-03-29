const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store active calls
const calls = new Map();

// System prompt for Genesis
const SYSTEM_PROMPT = {
  role: 'system',
  content: `You are the AI receptionist for the Genesis Centre in St. John's, NL.
Genesis helps technology entrepreneurs build successful companies. Programs include:
- AI Garage: connects recent AI graduates with startups to build practical AI solutions.
- Evolve: 8-week program for early-stage founders.
- Membership: coworking, mentorship, and community.
Your personality: friendly, professional, enthusiastic about innovation. Keep responses very brief (1–2 sentences).`
};

wss.on('connection', (ws, req) => {
  const streamSid = new URL(req.url, `http://${req.headers.host}`).searchParams.get('streamSid');
  console.log(`New call: ${streamSid}`);

  const messages = [SYSTEM_PROMPT];
  calls.set(streamSid, { messages });

  ws.on('message', async (data) => {
    const msg = JSON.parse(data);
    if (msg.event === 'media') {
      const audioBase64 = msg.media.payload;

      // 1. Speech‑to‑Text via Deepgram
      const transcript = await deepgramSTT(audioBase64);
      console.log(`Caller: ${transcript}`);
      if (transcript) {
        messages.push({ role: 'user', content: transcript });

        // 2. LLM via OpenAI
        const reply = await openaiChat(messages);
        console.log(`AI: ${reply}`);
        messages.push({ role: 'assistant', content: reply });

        // 3. Text‑to‑Speech via ElevenLabs
        const audioReply = await elevenlabsTTS(reply);

        // 4. Send audio back to Twilio
        ws.send(JSON.stringify({
          event: 'media',
          streamSid,
          media: { payload: audioReply }
        }));
      }
    } else if (msg.event === 'stop') {
      calls.delete(streamSid);
    }
  });
});

// Deepgram STT – expects base64 audio (mu-law)
async function deepgramSTT(audioBase64) {
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const response = await axios.post('https://api.deepgram.com/v1/listen', audioBuffer, {
    headers: {
      'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': 'audio/x-mulaw',
    },
    params: { model: 'nova-2', language: 'en' }
  });
  return response.data.results?.channels[0]?.alternatives[0]?.transcript || '';
}

// OpenAI chat completion
async function openaiChat(messages) {
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-3.5-turbo',
    messages,
    max_tokens: 150
  }, {
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
  });
  return response.data.choices[0].message.content;
}

// ElevenLabs TTS – returns base64 audio
async function elevenlabsTTS(text) {
  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`, // Rachel voice
    { text, model_id: 'eleven_monolingual_v1' },
    {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer'
    }
  );
  return Buffer.from(response.data).toString('base64');
}

// Twilio webhook to start the stream
app.post('/incoming', (req, res) => {
  const host = req.headers.host;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
  <Response>
    <Connect>
      <Stream url="wss://${host}/stream"/>
    </Connect>
  </Response>`;
  res.type('text/xml').send(twiml);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
