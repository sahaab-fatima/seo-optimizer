const { connectDB, Analysis } = require('./db');
const { scrapeUrl, analyzeSEO } = require('./utils');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { url } = JSON.parse(event.body);
    if (!url) return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL is required' }) };
    try { new URL(url); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL format' }) }; }

    const scrapedData = await scrapeUrl(url);
    const analysis = analyzeSEO(scrapedData);

    try {
      const db = await connectDB();
      if (db) {
        const saved = new Analysis(analysis);
        await saved.save();
      }
    } catch (dbErr) { console.warn('DB save failed:', dbErr.message); }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { scraped: scrapedData, analysis } }) };
  } catch (error) {
    console.error('Analysis error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Failed to analyze URL' }) };
  }
};
