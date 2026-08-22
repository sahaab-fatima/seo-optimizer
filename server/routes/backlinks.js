const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');

router.get('/', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

    const hostname = new URL(url).hostname.replace('www.', '');

    const backlinks = [];
    const sources = [
      { name: 'Google', url: `https://www.google.com/search?q=%22${hostname}%22&num=50` },
      { name: 'Bing', url: `https://www.bing.com/search?q=%22${hostname}%22&count=50` }
    ];

    for (const source of sources) {
      try {
        const response = await axios.get(source.url, {
          timeout: 10000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const $ = cheerio.load(response.data);
        $('a').each((_, el) => {
          const href = $(el).attr('href');
          if (href && href.startsWith('http') && !href.includes(hostname) && !href.includes('google') && !href.includes('bing')) {
            const domain = new URL(href).hostname.replace('www.', '');
            if (!backlinks.find(b => b.domain === domain) && backlinks.length < 20) {
              backlinks.push({ domain, source: source.name, url: href });
            }
          }
        });
      } catch {}
    }

    res.json({
      success: true,
      data: {
        url,
        domain: hostname,
        totalFound: backlinks.length,
        backlinks
      }
    });
  } catch (error) {
    console.error('Backlink error:', error.message);
    res.status(500).json({ error: 'Failed to check backlinks' });
  }
});

module.exports = router;
