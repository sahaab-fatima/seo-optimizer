const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { scrapeUrl } = require('../utils/scraper');
const { analyzeSEO } = require('../utils/seo-analysis');
const { pool } = require('../db');

router.post('/', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

    const scrapedData = await scrapeUrl(url);
    const analysis = analyzeSEO(scrapedData);

    try {
      let userId = null;
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seo-boost-secret-key-2024');
        userId = decoded.userId;
      }
      if (userId) {
        await pool.query(
          'INSERT INTO analyses (user_id, url, score, data) VALUES ($1, $2, $3, $4)',
          [userId, url, analysis.score, JSON.stringify(analysis)]
        );
        await pool.query('UPDATE users SET analyses_count = analyses_count + 1 WHERE id = $1', [userId]);
      }
    } catch (e) { console.log('Save to DB failed:', e.message); }

    res.json({ success: true, data: { scraped: scrapedData, analysis } });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze URL' });
  }
});

module.exports = router;
