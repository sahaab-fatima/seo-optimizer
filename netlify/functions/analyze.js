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
  const h3C = (html.match(/<h3[\s>]/gi) || []).length;
  const imgC = (html.match(/<img[\s>]/gi) || []).length;
  const noAlt = (html.match(/<img[^>]+>/gi) || []).filter(t => !t.match(/alt=["'][^"']+["']/)).length;
  const imgWithAlt = imgC - noAlt;
  const linkC = (html.match(/<a[\s>]/gi) || []).length;
  const internalLinks = (html.match(/<a[^>]+href=["'][^"']*#/gi) || []).length + (html.match(/<a[^>]+href=["'](\/[^"']*)/gi) || []).length;
  const externalLinks = (html.match(/<a[^>]+href=["']https?:\/\/(?!.*(?:github\.com|netlify\.app))/gi) || []).length;
  const txt = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wc = txt.split(/\s+/).filter(w => w.length > 0).length;
  const ogTitle = get(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) || get(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
  const ogDesc = get(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) || get(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i);
  const ogImage = get(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) || get(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
  const canonical = get(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const viewport = get(/<meta\s+name=["']viewport["']\s+content=["']([^"']+)["']/i);
  const charset = get(/<meta\s+charset=["']([^"']+)["']/i);
  const lang = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  const structuredData = (html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi) || []).length;

  const issues = [];
  const passed = [];
  let score = 100;

  // --- DEDUCTIONS (smaller, more fair) ---

  // Title
  if (!title) {
    issues.push({ type: 'error', category: 'Title', message: 'Missing page title', suggestion: 'Add a title between 50-60 characters' });
    score -= 12;
  } else {
    passed.push('Title tag present');
    if (title.length < 30) {
      issues.push({ type: 'warning', category: 'Title', message: 'Title too short (' + title.length + ' chars)', suggestion: 'Aim for 50-60 characters' });
      score -= 4;
    } else if (title.length > 60) {
      issues.push({ type: 'warning', category: 'Title', message: 'Title too long (' + title.length + ' chars)', suggestion: 'Keep under 60 characters' });
      score -= 3;
    } else {
      passed.push('Title length is perfect');
    }
  }

  // Meta Description
  if (!metaDesc) {
    issues.push({ type: 'error', category: 'Meta Description', message: 'Missing meta description', suggestion: 'Add a description 150-160 chars' });
    score -= 10;
  } else {
    passed.push('Meta description present');
    if (metaDesc.length < 120) {
      issues.push({ type: 'warning', category: 'Meta Description', message: 'Too short (' + metaDesc.length + ' chars)', suggestion: 'Aim for 150-160 characters' });
      score -= 3;
    } else if (metaDesc.length > 160) {
      issues.push({ type: 'info', category: 'Meta Description', message: 'Slightly long (' + metaDesc.length + ' chars)', suggestion: 'Keep under 160 characters' });
      score -= 2;
    } else {
      passed.push('Meta description length is good');
    }
  }

  // Headings
  if (h1C === 0) {
    issues.push({ type: 'error', category: 'Headings', message: 'No H1 tag found', suggestion: 'Add exactly one H1 tag' });
    score -= 10;
  } else {
    passed.push('H1 tag present');
    if (h1C > 1) {
      issues.push({ type: 'warning', category: 'Headings', message: 'Multiple H1 tags (' + h1C + ')', suggestion: 'Use only one H1 per page' });
      score -= 3;
    }
  }
  if (h2C === 0 && h1C > 0) {
    issues.push({ type: 'info', category: 'Headings', message: 'No H2 tags', suggestion: 'Add H2 subheadings to organize content' });
    score -= 2;
  } else if (h2C > 0) {
    passed.push('H2 subheadings present');
  }
  if (h3C > 0) passed.push('Good heading hierarchy (H3)');

  // Images
  if (imgC === 0) {
    issues.push({ type: 'info', category: 'Images', message: 'No images found', suggestion: 'Add relevant images for better engagement' });
    score -= 2;
  } else {
    if (noAlt > 0) {
      issues.push({ type: 'warning', category: 'Images', message: noAlt + ' image(s) missing alt text', suggestion: 'Add alt text to all images' });
      score -= Math.min(noAlt * 2, 6);
    }
    if (imgWithAlt > 0) passed.push(imgWithAlt + ' image(s) with alt text');
  }

  // Open Graph / Social
  if (!ogTitle) {
    issues.push({ type: 'info', category: 'Social', message: 'Missing og:title', suggestion: 'Add for better social sharing' });
    score -= 2;
  } else {
    passed.push('og:title present');
  }
  if (!ogDesc) {
    issues.push({ type: 'info', category: 'Social', message: 'Missing og:description', suggestion: 'Add for social previews' });
    score -= 2;
  } else {
    passed.push('og:description present');
  }
  if (!ogImage) {
    issues.push({ type: 'info', category: 'Social', message: 'Missing og:image', suggestion: 'Add an image for social previews' });
    score -= 2;
  } else {
    passed.push('og:image present');
  }

  // Technical
  if (!canonical) {
    issues.push({ type: 'info', category: 'Technical', message: 'No canonical URL', suggestion: 'Add canonical link to avoid duplicate content' });
    score -= 2;
  } else {
    passed.push('Canonical URL set');
  }
  if (!viewport) {
    issues.push({ type: 'warning', category: 'Technical', message: 'Missing viewport meta', suggestion: 'Add viewport for mobile responsiveness' });
    score -= 3;
  } else {
    passed.push('Viewport meta tag present');
  }
  if (!charset) {
    issues.push({ type: 'info', category: 'Technical', message: 'Missing charset declaration', suggestion: 'Add <meta charset="UTF-8">' });
    score -= 1;
  } else {
    passed.push('Charset declared');
  }
  if (!lang || !lang[1]) {
    issues.push({ type: 'info', category: 'Technical', message: 'Missing lang attribute on <html>', suggestion: 'Add lang="en" for accessibility' });
    score -= 1;
  } else {
    passed.push('Language attribute set');
  }

  // Content quality (balanced, not word count biased)
  if (wc < 150) {
    issues.push({ type: 'warning', category: 'Content', message: 'Very thin content (' + wc + ' words)', suggestion: 'Aim for 300+ words for meaningful content' });
    score -= 4;
  } else if (wc < 300) {
    issues.push({ type: 'info', category: 'Content', message: 'Light content (' + wc + ' words)', suggestion: 'Consider adding more detailed content (300+ words)' });
    score -= 2;
  } else if (wc > 500) {
    passed.push('Good content length (' + wc + ' words)');
  }

  // Links
  if (linkC === 0) {
    issues.push({ type: 'info', category: 'Links', message: 'No links found', suggestion: 'Add internal and external links' });
    score -= 2;
  } else {
    passed.push(linkC + ' links found');
    if (internalLinks > 0) passed.push('Internal links present');
    if (externalLinks > 0) passed.push('External links present');
  }

  // Structure bonus
  if (structuredData > 0) {
    passed.push('Structured data (JSON-LD) found');
    score += 2;
  }

  score = Math.max(0, Math.min(100, score));

  // Recommendations (only positive, actionable)
  const recs = [];
  if (!title) recs.push('Add a clear, descriptive title tag (50-60 chars)');
  else if (title.length < 50) recs.push('Expand your title to 50-60 characters for better click-through');
  if (!metaDesc) recs.push('Write a compelling meta description (150-160 chars)');
  else if (metaDesc.length < 150) recs.push('Expand meta description to 150-160 characters');
  if (h1C === 0) recs.push('Add one H1 tag with your main keyword');
  if (h2C === 0) recs.push('Use H2 subheadings to organize your content sections');
  if (noAlt > 0) recs.push('Add descriptive alt text to all images');
  if (!ogTitle || !ogDesc) recs.push('Add Open Graph tags for better social media sharing');
  if (!canonical) recs.push('Add a canonical URL to prevent duplicate content issues');
  if (wc < 300) recs.push('Expand content to 300+ words for better SEO');
  if (internalLinks === 0) recs.push('Add internal links to connect related pages');
  if (externalLinks === 0) recs.push('Add 1-2 external authority links for credibility');
  if (!viewport) recs.push('Add viewport meta tag for mobile optimization');
  if (recs.length === 0) recs.push('Your page is well optimized! Keep monitoring.');

  return { url, score, issues, passed, stats: { titleLength: title.length, metaDescLength: metaDesc.length, h1Count: h1C, h2Count: h2C, h3Count: h3C, linkCount: linkC, internalLinks, externalLinks, imageCount: imgC, imagesWithoutAlt: noAlt, imagesWithAlt: imgWithAlt, wordCount: wc, hasOgTitle: !!ogTitle, hasOgDesc: !!ogDesc, hasOgImage: !!ogImage, hasCanonical: !!canonical, hasViewport: !!viewport, hasCharset: !!charset, lang: lang ? lang[1] : null, structuredData }, recommendations: recs };
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
