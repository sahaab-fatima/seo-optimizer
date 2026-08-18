const express = require('express');
const router = express.Router();
const { scrapeUrl } = require('../utils/scraper');
const { analyzeSEO } = require('../utils/seo-analysis');
const Analysis = require('../models/Analysis');

router.post('/', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

    const scrapedData = await scrapeUrl(url);
    const analysis = analyzeSEO(scrapedData);

    const saved = new Analysis(analysis);
    await saved.save();

    res.json({ success: true, data: { scraped: scrapedData, analysis } });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze URL' });
  }
});

module.exports = router;
