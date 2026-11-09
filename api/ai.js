// Vercel Serverless Function: POST /api/ai
import { GoogleGenAI } from '@google/genai';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rdmvncnjmnpjqixfuzpt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_rlTlh1l60XasCYbApw1QcA_zWU33wgM';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const SYSTEM_PROMPT =
  "You are Cayden's Clanker, the smart AI study helper on PastPaperGenie. " +
  'Help with school subjects, revision, past-paper questions and explaining ideas step by step. ' +
  'Keep answers clear and fairly short. Keep everything age-appropriate.';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = null;
      }
    }

    const { messages, provider, model } = body || {};
    const raw = Array.isArray(messages) ? messages.slice(-10) : [];
    const validMessages = raw
      .filter(m => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'system') && typeof m.content === 'string' && m.content.trim())
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));

    const lastUserMsg = [...validMessages].reverse().find(m => m.role === 'user');
    const userPrompt = lastUserMsg ? lastUserMsg.content : (body?.prompt || 'Hello');

    // 1. Google Gemini via @google/genai if requested or GEMINI_API_KEY is available
    const geminiKey = process.env.GEMINI_API_KEY;
    if ((provider === 'gemini' || provider === 'backend' || (!process.env.GROQ_API_KEY && geminiKey)) && geminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const response = await ai.models.generateContent({
          model: model || 'gemini-2.5-flash',
          contents: userPrompt,
          config: {
            systemInstruction: SYSTEM_PROMPT
          }
        });
        const replyText = response.text || 'I could not generate an answer right now.';
        return res.status(200).json({ reply: replyText, left: 1500, provider: "Cayden's Clanker (Gemini)" });
      } catch (geminiError) {
        console.warn('Gemini API call failed, trying Groq/Pollinations:', geminiError.message);
      }
    }

    // 2. Groq API if requested or GROQ_API_KEY is available
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model || GROQ_MODEL,
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...validMessages],
            temperature: 0.6,
            max_completion_tokens: 1200
          })
        });

        if (groqResp.ok) {
          const data = await groqResp.json();
          const reply = data?.choices?.[0]?.message?.content;
          if (reply && reply.trim()) {
            return res.status(200).json({ reply: reply.trim(), left: 14400, provider: "Cayden's Clanker (Groq)" });
          }
        }
      } catch (groqError) {
        console.warn('Groq call failed, trying Pollinations:', groqError.message);
      }
    }

    // 3. Pollinations.ai (Keyless, instant, zero setup)
    try {
      const pollinationsResp = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...validMessages],
          model: model || 'openai',
          temperature: 0.6,
          seed: 42
        })
      });

      if (pollinationsResp.ok) {
        const text = await pollinationsResp.text();
        if (text && text.trim()) {
          return res.status(200).json({ reply: text.trim(), left: 9999, provider: "Cayden's Clanker (Pollinations)" });
        }
      }
    } catch (pollinationsError) {
      console.warn('Pollinations call failed, falling back:', pollinationsError.message);
    }

    // 4. Guaranteed offline fallback
    return res.status(200).json({
      reply: `### Study Guide: ${userPrompt}\n\n1. **Core Concept**:\nFocus on the fundamental rules and definitions for this topic.\n\n2. **Step-by-Step Approach**:\n- Identify given variables and what is being asked.\n- Apply the relevant formula or revision framework.\n- Verify units, sign conventions, and reasoning.\n\n3. **Exam Tip**:\nAlways show working out clearly for method marks. Practice past paper exam questions under timed conditions to test recall.`,
      left: 100,
      provider: "Cayden's Clanker (Offline Helper)"
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Failed to process AI request' });
  }
}
