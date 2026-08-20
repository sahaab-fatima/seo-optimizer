const express = require('express');
const router = express.Router();
const { scrapeUrl } = require('../utils/scraper');
const { analyzeSEO } = require('../utils/seo-analysis');

function isDbReady() {
  return require('mongoose').connection.readyState === 1;
}

router.post('/', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

    const scrapedData = await scrapeUrl(url);
    const analysis = analyzeSEO(scrapedData);

    // Save to DB if available
    if (isDbReady()) {
      try {
        let userId = null;
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (token) {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seo-boost-secret-key-2024');
          userId = decoded.userId;
        }
        const Analysis = require('../models/Analysis');
        const saved = new Analysis({ ...analysis, userId });
        await saved.save();
      } catch {}
    }

    res.json({ success: true, data: { scraped: scrapedData, analysis } });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze URL' });
  }
});

module.exports = router;
