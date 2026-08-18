const https = require('https');
const http = require('http');

function fetchUrl(url, maxRedirects = 3) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const client = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      },
      timeout: 8000
    };
    client.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return fetchUrl(loc, maxRedirects - 1).then(resolve, reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, html: data }));
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('Timeout')); });
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

  if (!title) { issues.push({ type: 'error', category: 'Title', message: 'Missing page title', suggestion: 'Add a descriptive title between 50-60 characters' }); score -= 20; }
  else if (title.length < 30) { issues.push({ type: 'warning', category: 'Title', message: `Title is too short (${title.length} chars)`, suggestion: 'Aim for 50-60 characters' }); score -= 10; }
  else if (title.length > 60) { issues.push({ type: 'warning', category: 'Title', message: `Title is too long (${title.length} chars)`, suggestion: 'Keep title under 60 characters' }); score -= 5; }

  if (!metaDesc) { issues.push({ type: 'error', category: 'Meta Description', message: 'Missing meta description', suggestion: 'Add a compelling meta description between 150-160 characters' }); score -= 15; }
  else if (metaDesc.length < 120) { issues.push({ type: 'warning', category: 'Meta Description', message: `Too short (${metaDesc.length} chars)`, suggestion: 'Aim for 150-160 characters' }); score -= 5; }

  if (h1C === 0) { issues.push({ type: 'error', category: 'Headings', message: 'No H1 tag found', suggestion: 'Add exactly one H1 tag' }); score -= 15; }
  else if (h1C > 1) { issues.push({ type: 'warning', category: 'Headings', message: `Multiple H1 tags (${h1C})`, suggestion: 'Use only one H1 per page' }); score -= 5; }

  if (h2C === 0 && h1C > 0) { issues.push({ type: 'info', category: 'Headings', message: 'No H2 tags found', suggestion: 'Add H2 tags to organize content' }); score -= 3; }
  if (noAlt > 0) { issues.push({ type: 'warning', category: 'Images', message: `${noAlt} image(s) missing alt text`, suggestion: 'Add descriptive alt text' }); score -= Math.min(noAlt * 2, 10); }
  if (!ogTitle) { issues.push({ type: 'info', category: 'Social', message: 'Missing og:title', suggestion: 'Add for better social sharing' }); score -= 2; }
  if (!ogDesc) { issues.push({ type: 'info', category: 'Social', message: 'Missing og:description', suggestion: 'Add for social previews' }); score -= 2; }
  if (!canonical) { issues.push({ type: 'info', category: 'Technical', message: 'No canonical URL', suggestion: 'Add canonical link' }); score -= 3; }
  if (wc < 300) { issues.push({ type: 'warning', category: 'Content', message: `Low word count (${wc})`, suggestion: 'Aim for at least 300 words' }); score -= 5; }

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
    const { url, html: manualHtml } = JSON.parse(event.body);
    if (!url) return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL is required' }) };
    try { new URL(url); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL format' }) }; }

    let html = manualHtml;

    if (!html) {
      try {
        const result = await fetchUrl(url);
        html = result.html;
      } catch (e) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { url, score: 0, blocked: true, error: 'Could not access website: ' + e.message, issues: [{ type: 'error', category: 'Access', message: 'Website blocked automated access', suggestion: 'This site has bot protection. Try analyzing a different URL, or paste your HTML source in the field below.' }], stats: { titleLength: 0, metaDescLength: 0, h1Count: 0, h2Count: 0, linkCount: 0, imageCount: 0, imagesWithoutAlt: 0, wordCount: 0 }, recommendations: ['Try a different URL', 'Paste your page HTML manually for analysis'] } }) };
      }
    }

    const analysis = analyze(html, url);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: analysis }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error: ' + error.message }) };
  }
};
