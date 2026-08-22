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
    const domain = hostname.split('.')[0];
    const backlinks = [];

    const searches = [
      { source: 'Google', q: '"' + domain + '" -site:' + hostname },
      { source: 'Google', q: 'link:' + hostname },
      { source: 'Bing', q: '"' + domain + '"' }
    ];

    for (var i = 0; i < searches.length; i++) {
      var s = searches[i];
      try {
        var searchUrl = s.source === 'Google'
          ? 'https://www.google.com/search?q=' + encodeURIComponent(s.q) + '&num=20'
          : 'https://www.bing.com/search?q=' + encodeURIComponent(s.q) + '&count=20';

        var response = await axios.get(searchUrl, {
          timeout: 8000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });

        var $ = cheerio.load(response.data);
        $('a').each(function(_, el) {
          var href = $(el).attr('href');
          if (!href || !href.startsWith('http')) return;
          try {
            var linkDomain = new URL(href).hostname.replace('www.', '');
            if (linkDomain !== hostname &&
                !linkDomain.includes('google') &&
                !linkDomain.includes('bing') &&
                !linkDomain.includes('facebook') &&
                !linkDomain.includes('twitter') &&
                !backlinks.find(function(b) { return b.domain === linkDomain; }) &&
                backlinks.length < 30) {
              backlinks.push({ domain: linkDomain, source: s.source, url: href });
            }
          } catch(e) {}
        });
      } catch(e) {}
    }

    res.json({
      success: true,
      data: {
        url: url,
        domain: hostname,
        totalFound: backlinks.length,
        backlinks: backlinks
      }
    });
  } catch (error) {
    console.error('Backlink error:', error.message);
    res.status(500).json({ error: 'Failed to check backlinks' });
  }
});

module.exports = router;
