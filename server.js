const express = require('express');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Gemini Live API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

wss.on('connection', (ws, req) => {
  console.log('🔌 Browser connected');

  // Connect to Gemini Live API
  const geminiWs = new WebSocket(
    `wss://generativelanguage.googleapis.com/ws/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?key=${GEMINI_API_KEY}`
  );

  geminiWs.on('open', () => {
    console.log('✅ Connected to Gemini Live');
    // Send system instruction and audio output modality
    geminiWs.send(JSON.stringify({
      setup: {
        instruction: `You are the AI receptionist for the Genesis Centre in St. John's, NL.
Genesis helps technology entrepreneurs build successful companies.
Programs include:
- AI Garage: connects recent AI graduates with startups to build practical AI solutions.
- Evolve: 8-week program for early-stage founders.
- Membership: coworking, mentorship, and community.
- Startups 101: introductory workshops.
Keep responses very brief (1-2 sentences). Sound natural and human.`,
        generationConfig: {
          temperature: 0.7,
          responseModalities: ['AUDIO']
        }
      }
    }));
  });

  geminiWs.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData?.mimeType === 'audio/pcm') {
          // Audio from Gemini is base64-encoded PCM; send raw bytes to frontend
          const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
          ws.send(audioBuffer);
        }
      }
    }
  });

  geminiWs.on('error', (err) => {
    console.error('❌ Gemini error:', err.message);
  });

  geminiWs.on('close', () => {
    console.log('🔌 Gemini connection closed');
  });

  // Forward audio from browser to Gemini
  ws.on('message', (audioBase64) => {
    // The frontend sends base64-encoded PCM audio
    if (geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(JSON.stringify({
        realtimeInput: {
          mediaChunks: [{
            mimeType: 'audio/pcm',
            data: audioBase64.toString()  // already a string of base64
          }]
        }
      }));
    }
  });

  ws.on('close', () => {
    geminiWs.close();
    console.log('🔌 Browser connection closed');
  });
});

app.get('/', (req, res) => res.send('Backend is running'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));
