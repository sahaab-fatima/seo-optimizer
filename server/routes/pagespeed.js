const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

    const apiUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=' + encodeURIComponent(url) + '&category=performance&category=accessibility&category=best-practices&category=seo&strategy=mobile';
    const response = await axios.get(apiUrl, { timeout: 60000 });
    const data = response.data;

    const scores = {};
    if (data.lighthouseResult && data.lighthouseResult.categories) {
      Object.keys(data.lighthouseResult.categories).forEach(function(key) {
        var cat = data.lighthouseResult.categories[key];
        scores[key] = Math.round((cat.score || 0) * 100);
      });
    }

    const metrics = {};
    if (data.lighthouseResult && data.lighthouseResult.audits) {
      var audits = data.lighthouseResult.audits;
      metrics.firstContentfulPaint = (audits['first-contentful-paint'] && audits['first-contentful-paint'].displayValue) || 'N/A';
      metrics.speedIndex = (audits['speed-index'] && audits['speed-index'].displayValue) || 'N/A';
      metrics.largestContentfulPaint = (audits['largest-contentful-paint'] && audits['largest-contentful-paint'].displayValue) || 'N/A';
      metrics.totalBlockingTime = (audits['total-blocking-time'] && audits['total-blocking-time'].displayValue) || 'N/A';
      metrics.cumulativeLayoutShift = (audits['cumulative-layout-shift'] && audits['cumulative-layout-shift'].displayValue) || 'N/A';
      metrics.timeToInteractive = (audits['interactive'] && audits['interactive'].displayValue) || 'N/A';
    }

    res.json({ success: true, data: { url: url, scores: scores, metrics: metrics } });
  } catch (error) {
    console.error('PageSpeed error:', error.message);
    res.status(500).json({ error: 'PageSpeed test failed. The URL may be unreachable or take too long to load.' });
  }
});

module.exports = router;
