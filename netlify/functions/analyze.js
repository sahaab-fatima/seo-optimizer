const https = require('https');
const http = require('http');

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return fetchHtml(loc).then(resolve, reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function analyze(html, url) {
  const get = (p) => { const m = html.match(p); return m ? m[1].trim() : ''; };
  const title = get(/<title[^>]*>([^<]+)<\/title>/i);
  const metaDesc = get(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) || get(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  const h1C = (html.match(/<h1[\s>]/gi) || []).length;
  const h2C = (html.match(/<h2[\s>]/gi) || []).length;
  const imgC = (html.match(/<img[\s>]/gi) || []).length;
  const noAlt = (html.match(/<img[^>]+>/gi) || []).filter(t => !t.match(/alt=["'][^"']+["']/)).length;
  const linkC = (html.match(/<a[\s>]/gi) || []).length;
  const txt = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wc = txt.split(/\s+/).filter(w => w.length > 0).length;
  const ogTitle = get(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) || get(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
  const ogDesc = get(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) || get(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i);
  const canonical = get(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);

  const issues = [];
  let score = 100;
  if (!title) { issues.push({ type: 'error', category: 'Title', message: 'Missing page title', suggestion: 'Add a title between 50-60 characters' }); score -= 20; }
  else if (title.length < 30) { issues.push({ type: 'warning', category: 'Title', message: 'Title too short (' + title.length + ' chars)', suggestion: 'Aim for 50-60 characters' }); score -= 10; }
  else if (title.length > 60) { issues.push({ type: 'warning', category: 'Title', message: 'Title too long (' + title.length + ' chars)', suggestion: 'Keep under 60 characters' }); score -= 5; }
  if (!metaDesc) { issues.push({ type: 'error', category: 'Meta Description', message: 'Missing meta description', suggestion: 'Add a description 150-160 chars' }); score -= 15; }
  else if (metaDesc.length < 120) { issues.push({ type: 'warning', category: 'Meta Description', message: 'Too short (' + metaDesc.length + ' chars)', suggestion: 'Aim for 150-160 characters' }); score -= 5; }
  if (h1C === 0) { issues.push({ type: 'error', category: 'Headings', message: 'No H1 tag found', suggestion: 'Add exactly one H1 tag' }); score -= 15; }
  else if (h1C > 1) { issues.push({ type: 'warning', category: 'Headings', message: 'Multiple H1 tags (' + h1C + ')', suggestion: 'Use only one H1 per page' }); score -= 5; }
  if (h2C === 0 && h1C > 0) { issues.push({ type: 'info', category: 'Headings', message: 'No H2 tags', suggestion: 'Add H2 tags to organize content' }); score -= 3; }
  if (noAlt > 0) { issues.push({ type: 'warning', category: 'Images', message: noAlt + ' image(s) missing alt text', suggestion: 'Add alt text to all images' }); score -= Math.min(noAlt * 2, 10); }
  if (!ogTitle) { issues.push({ type: 'info', category: 'Social', message: 'Missing og:title', suggestion: 'Add for social sharing' }); score -= 2; }
  if (!ogDesc) { issues.push({ type: 'info', category: 'Social', message: 'Missing og:description', suggestion: 'Add for social previews' }); score -= 2; }
  if (!canonical) { issues.push({ type: 'info', category: 'Technical', message: 'No canonical URL', suggestion: 'Add canonical link' }); score -= 3; }
  if (wc < 300) { issues.push({ type: 'warning', category: 'Content', message: 'Low word count (' + wc + ')', suggestion: 'Aim for 300+ words' }); score -= 5; }

  const recs = [];
  if (h1C > 0) recs.push('H1 tag present');
  if (wc > 500) recs.push('Good content length');
  if (metaDesc) recs.push('Meta description present');
  if (title) recs.push('Title tag present');

  return { url, score: Math.max(0, Math.min(100, score)), issues, stats: { titleLength: title.length, metaDescLength: metaDesc.length, h1Count: h1C, h2Count: h2C, linkCount: linkC, imageCount: imgC, imagesWithoutAlt: noAlt, wordCount: wc }, recommendations: recs };
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { url } = JSON.parse(event.body);
    if (!url) return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL required' }) };
    try { new URL(url); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL' }) }; }

    const html = await fetchHtml(url);
    if (!html || html.length < 50) return { statusCode: 200, headers, body: JSON.stringify({ error: 'Empty response from website' }) };

    const result = analyze(html, url);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: result }) };
  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Could not fetch website: ' + e.message }) };
  }
};
