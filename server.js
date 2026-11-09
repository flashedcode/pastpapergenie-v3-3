import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = '0.0.0.0';

app.use(express.json());

// Set required headers for service workers, wasm, and iframe embedding
app.use((req, res, next) => {
  res.setHeader('Service-Worker-Allowed', '/');
  // Allow cross-origin isolation headers if needed by wasm/shared workers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Configure custom mime types
express.static.mime.define({
  'application/wasm': ['wasm'],
  'text/javascript': ['mjs', 'js']
});

// AI Study helper endpoint for /ai/index.html & /ai.html
app.post('/api/ai', async (req, res) => {
  try {
    const { messages, provider, model } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages are required' });
    }

    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const userPrompt = lastUserMsg ? lastUserMsg.content : 'Hello';

    // 1. Google Gemini via @google/genai if requested or GEMINI_API_KEY is available
    const geminiKey = process.env.GEMINI_API_KEY;
    if ((provider === 'gemini' || provider === 'backend') && geminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const systemMsg = messages.find(m => m.role === 'system');
        const systemInstruction = systemMsg ? systemMsg.content : 'You are an educational study helper for school subjects, past-paper revision, and exam prep. Keep answers clear and step-by-step.';
        
        const response = await ai.models.generateContent({
          model: model || 'gemini-2.5-flash',
          contents: userPrompt,
          config: {
            systemInstruction
          }
        });
        const replyText = response.text || 'I could not generate an answer right now.';
        return res.json({ reply: replyText, left: 1500, provider: 'Google AI Studio (Gemini)' });
      } catch (geminiError) {
        console.warn('Gemini API call failed, falling back to Pollinations:', geminiError);
      }
    }

    // 2. Groq API if requested or GROQ_API_KEY is available
    const groqKey = process.env.GROQ_API_KEY;
    if ((provider === 'groq' || (!geminiKey && groqKey)) && groqKey) {
      try {
        const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model || 'llama-3.1-8b-instant',
            messages: messages.slice(-10),
            temperature: 0.6,
            max_tokens: 1500
          })
        });
        if (groqResp.ok) {
          const data = await groqResp.json();
          const reply = data?.choices?.[0]?.message?.content;
          if (reply) {
            return res.json({ reply, left: 14400, provider: 'Groq (Llama 3)' });
          }
        }
      } catch (groqError) {
        console.warn('Groq call failed, falling back to Pollinations:', groqError);
      }
    }

    // 3. Pollinations.ai (Keyless, instant, zero setup)
    try {
      const pollinationsResp = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.slice(-10),
          model: model || 'openai',
          temperature: 0.6,
          seed: 42
        })
      });

      if (pollinationsResp.ok) {
        const text = await pollinationsResp.text();
        if (text && text.trim()) {
          return res.json({ reply: text.trim(), left: 9999, provider: 'Pollinations.ai' });
        }
      }
    } catch (pollinationsError) {
      console.warn('Pollinations call failed, falling back to local tutor:', pollinationsError);
    }

    // 4. Guaranteed offline fallback study response
    return res.json({
      reply: `### Study Guide: ${userPrompt}\n\n1. **Core Concept**:\nFocus on the fundamental rules and definitions for this topic.\n\n2. **Step-by-Step Approach**:\n- Identify given variables and what is being asked.\n- Apply the relevant formula or revision framework.\n- Verify units, sign conventions, and reasoning.\n\n3. **Exam Tip**:\nAlways show working out clearly for method marks. Practice past paper exam questions under timed conditions to test recall.`,
      left: 100,
      provider: 'Local Study Helper'
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to process AI request' });
  }
});

// Static assets
app.use(express.static(__dirname, {
  extensions: ['html', 'htm'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Fallback to index.html for root navigation only, 404 for missing static assets
app.get('*', (req, res) => {
  if (path.extname(req.path)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`pastpapergenie v3 with Ultraviolet Proxy running at http://${HOST}:${PORT}`);
});
