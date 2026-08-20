const express = require('express');
const router = express.Router();

function isDbReady() {
  return require('mongoose').connection.readyState === 1;
}

router.post('/', async (req, res) => {
  try {
    const { topic, count = 10 } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1' });

    const completion = await openai.chat.completions.create({
      model: 'mimo-v2.5',
      messages: [
        { role: 'system', content: 'You are a keyword research expert. Return JSON with: keywords (array of {keyword, searchVolume: high/medium/low, difficulty: high/medium/low, relevance: 0-100}), longTailKeywords (array), questions (array). Only return valid JSON.' },
        { role: 'user', content: `Generate ${count} keyword ideas for: "${topic}"` }
      ],
      temperature: 0.7,
      max_tokens: 2000
    }, { timeout: 15000 });

    const responseText = completion.choices[0].message.content || '{}';
    let result;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) { result = JSON.parse(jsonMatch[0]); } else { result = { keywords: [], longTailKeywords: [], questions: [] }; }

    // Save if DB available
    if (isDbReady()) {
      try {
        let userId = null;
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (token) {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seo-boost-secret-key-2024');
          userId = decoded.userId;
        }
        const Keyword = require('../models/Keyword');
        const saved = new Keyword({ topic, ...result, userId });
        await saved.save();
      } catch {}
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Keyword error:', error.message);
    if (error.status === 401) {
      res.status(500).json({ error: 'Invalid API key. Please check your .env file.' });
    } else {
      res.status(500).json({ error: error.message || 'Failed to generate keywords' });
    }
  }
});

module.exports = router;
