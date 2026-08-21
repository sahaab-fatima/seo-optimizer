const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

router.post('/', async (req, res) => {
  try {
    const { content, type } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1' });

    let systemPrompt = '';
    if (type === 'meta') {
      systemPrompt = 'You are an SEO expert. Generate optimized meta tags. Return JSON with: title (max 60 chars), description (max 160 chars), keywords (array of 5-10). Only return valid JSON.';
    } else if (type === 'improve') {
      systemPrompt = 'You are an SEO content optimizer. Return JSON with: score (0-100), suggestions (array), optimizedVersion (improved text). Only return valid JSON.';
    } else {
      systemPrompt = 'You are an SEO expert. Return JSON with: overallScore (0-100), strengths (array), weaknesses (array), recommendations (array). Only return valid JSON.';
    }

    const completion = await openai.chat.completions.create({
      model: 'mimo-v2.5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this content:\n\n${content.substring(0, 3000)}` }
      ],
      temperature: 0.7,
      max_tokens: 1500
    }, { timeout: 15000 });

    const responseText = completion.choices[0].message.content || '{}';
    let result;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) { result = JSON.parse(jsonMatch[0]); } else { result = { raw: responseText }; }

    try {
      let userId = null;
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seo-boost-secret-key-2024');
        userId = decoded.userId;
      }
      if (userId) {
        await pool.query(
          'INSERT INTO contents (user_id, original_text, result) VALUES ($1, $2, $3)',
          [userId, content.substring(0, 500), JSON.stringify(result)]
        );
      }
    } catch (e) { console.log('Save to DB failed:', e.message); }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Optimization error:', error.message);
    if (error.status === 401) {
      res.status(500).json({ error: 'Invalid API key. Please check your .env file.' });
    } else {
      res.status(500).json({ error: error.message || 'Failed to optimize content' });
    }
  }
});

module.exports = router;
