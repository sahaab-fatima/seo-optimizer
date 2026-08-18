exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { url } = JSON.parse(event.body);
    if (!url) return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL is required' }) };
    try { new URL(url); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL format' }) }; }

    const https = require('https');
    const http = require('http');

    const html = await new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html'
        },
        timeout: 5000
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
          const redirectClient = redirectUrl.startsWith('https') ? https : http;
          redirectClient.get(redirectUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }, (res2) => {
            let data = '';
            res2.on('data', chunk => data += chunk);
            res2.on('end', () => resolve(data));
          }).on('error', reject);
        } else {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        }
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });

    // Parse basic meta tags
    const getTag = (pattern) => { const m = html.match(pattern); return m ? m[1].trim() : ''; };
    const title = getTag(/<title[^>]*>([^<]+)<\/title>/i);
    const metaDesc = getTag(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) || getTag(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
    const metaKeywords = getTag(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i) || getTag(/<meta\s+content=["']([^"']+)["']\s+name=["']keywords["']/i);
    const canonical = getTag(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    const robots = getTag(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
    const ogTitle = getTag(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) || getTag(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
    const ogDesc = getTag(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) || getTag(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i);
    const ogImage = getTag(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) || getTag(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);

    const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
    const h2Count = (html.match(/<h2[\s>]/gi) || []).length;
    const imgCount = (html.match(/<img[\s>]/gi) || []).length;
    const imgsNoAlt = (html.match(/<img[^>]*(?!alt=)[^>]*>/gi) || []).length - (html.match(/<img[^>]*alt=["'][^"']+["'][^>]*>/gi) || []).length;
    const linkCount = (html.match(/<a[\s>]/gi) || []).length;
    const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

    // Analyze
    const issues = [];
    let score = 100;

    if (!title) { issues.push({ type: 'error', category: 'Title', message: 'Missing page title', suggestion: 'Add a descriptive title between 50-60 characters' }); score -= 20; }
    else if (title.length < 30) { issues.push({ type: 'warning', category: 'Title', message: `Title is too short (${title.length} chars)`, suggestion: 'Aim for 50-60 characters' }); score -= 10; }
    else if (title.length > 60) { issues.push({ type: 'warning', category: 'Title', message: `Title is too long (${title.length} chars)`, suggestion: 'Keep title under 60 characters' }); score -= 5; }

    if (!metaDesc) { issues.push({ type: 'error', category: 'Meta Description', message: 'Missing meta description', suggestion: 'Add a compelling meta description between 150-160 characters' }); score -= 15; }
    else if (metaDesc.length < 120) { issues.push({ type: 'warning', category: 'Meta Description', message: `Too short (${metaDesc.length} chars)`, suggestion: 'Aim for 150-160 characters' }); score -= 5; }
    else if (metaDesc.length > 160) { issues.push({ type: 'warning', category: 'Meta Description', message: `Too long (${metaDesc.length} chars)`, suggestion: 'Keep under 160 characters' }); score -= 5; }

    if (h1Count === 0) { issues.push({ type: 'error', category: 'Headings', message: 'No H1 tag found', suggestion: 'Add exactly one H1 tag' }); score -= 15; }
    else if (h1Count > 1) { issues.push({ type: 'warning', category: 'Headings', message: `Multiple H1 tags (${h1Count})`, suggestion: 'Use only one H1 tag per page' }); score -= 5; }

    if (h2Count === 0 && h1Count > 0) { issues.push({ type: 'info', category: 'Headings', message: 'No H2 tags found', suggestion: 'Add H2 tags to organize content' }); score -= 3; }

    if (imgsNoAlt > 0) { issues.push({ type: 'warning', category: 'Images', message: `${imgsNoAlt} image(s) missing alt text`, suggestion: 'Add descriptive alt text to all images' }); score -= Math.min(imgsNoAlt * 2, 10); }

    if (!ogTitle) { issues.push({ type: 'info', category: 'Social', message: 'Missing Open Graph title', suggestion: 'Add og:title for better social sharing' }); score -= 2; }
    if (!ogDesc) { issues.push({ type: 'info', category: 'Social', message: 'Missing Open Graph description', suggestion: 'Add og:description for social previews' }); score -= 2; }
    if (!canonical) { issues.push({ type: 'info', category: 'Technical', message: 'No canonical URL set', suggestion: 'Add canonical link to prevent duplicate content' }); score -= 3; }
    if (wordCount < 300) { issues.push({ type: 'warning', category: 'Content', message: `Low word count (${wordCount})`, suggestion: 'Aim for at least 300 words' }); score -= 5; }

    const recommendations = [];
    if (h1Count > 0) recommendations.push('H1 tag present — good!');
    if (wordCount > 500) recommendations.push('Good content length!');
    if (metaDesc) recommendations.push('Meta description present — good!');
    if (title) recommendations.push('Title tag present — good!');

    score = Math.max(0, Math.min(100, score));

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { url, score, issues, stats: { titleLength: title.length, metaDescLength: metaDesc.length, h1Count, h2Count, linkCount, imageCount: imgCount, imagesWithoutAlt: imgsNoAlt, wordCount }, recommendations } }) };
  } catch (error) {
    console.error('Analysis error:', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not access website: ' + error.message }) };
  }
};
