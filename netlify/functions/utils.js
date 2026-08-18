const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeUrl(url) {
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 10000
  });
  const $ = cheerio.load(response.data);
  $('script, style, noscript, iframe').remove();

  const title = $('title').text().trim();
  const metaDescription = $('meta[name="description"]').attr('content') || '';
  const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const robots = $('meta[name="robots"]').attr('content') || '';
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogDescription = $('meta[property="og:description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || '';

  const h1 = [], h2 = [], h3 = [];
  $('h1').each((_, el) => { const t = $(el).text().trim(); if (t) h1.push(t); });
  $('h2').each((_, el) => { const t = $(el).text().trim(); if (t) h2.push(t); });
  $('h3').each((_, el) => { const t = $(el).text().trim(); if (t) h3.push(t); });

  const links = [];
  const baseDomain = new URL(url).hostname;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      let fullHref = href;
      if (href.startsWith('/')) { fullHref = new URL(url).origin + href; }
      let isExternal = false;
      try { isExternal = new URL(fullHref).hostname !== baseDomain; } catch {}
      links.push({ text: text.substring(0, 100), href: fullHref, isExternal });
    }
  });

  const images = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';
    if (src) images.push({ src, alt });
  });

  const textContent = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

  return { url, title, metaDescription, metaKeywords, h1, h2, h3, links, images, textContent: textContent.substring(0, 10000), canonical, ogTitle, ogDescription, ogImage, robots, wordCount };
}

function analyzeSEO(data) {
  const issues = [];
  let score = 100;

  if (!data.title) { issues.push({ type: 'error', category: 'Title', message: 'Missing page title', suggestion: 'Add a descriptive title between 50-60 characters' }); score -= 20; }
  else if (data.title.length < 30) { issues.push({ type: 'warning', category: 'Title', message: `Title is too short (${data.title.length} characters)`, suggestion: 'Aim for 50-60 characters' }); score -= 10; }
  else if (data.title.length > 60) { issues.push({ type: 'warning', category: 'Title', message: `Title is too long (${data.title.length} characters)`, suggestion: 'Keep title under 60 characters' }); score -= 5; }

  if (!data.metaDescription) { issues.push({ type: 'error', category: 'Meta Description', message: 'Missing meta description', suggestion: 'Add a compelling meta description between 150-160 characters' }); score -= 15; }
  else if (data.metaDescription.length < 120) { issues.push({ type: 'warning', category: 'Meta Description', message: `Meta description too short (${data.metaDescription.length})`, suggestion: 'Aim for 150-160 characters' }); score -= 5; }
  else if (data.metaDescription.length > 160) { issues.push({ type: 'warning', category: 'Meta Description', message: `Meta description too long (${data.metaDescription.length})`, suggestion: 'Keep under 160 characters' }); score -= 5; }

  if (data.h1.length === 0) { issues.push({ type: 'error', category: 'Headings', message: 'No H1 tag found', suggestion: 'Add exactly one H1 tag' }); score -= 15; }
  else if (data.h1.length > 1) { issues.push({ type: 'warning', category: 'Headings', message: `Multiple H1 tags (${data.h1.length})`, suggestion: 'Use only one H1 tag per page' }); score -= 5; }

  if (data.h2.length === 0 && data.h1.length > 0) { issues.push({ type: 'info', category: 'Headings', message: 'No H2 tags found', suggestion: 'Add H2 tags to organize content' }); score -= 3; }

  const imagesWithoutAlt = data.images.filter(img => !img.alt).length;
  if (imagesWithoutAlt > 0) { issues.push({ type: 'warning', category: 'Images', message: `${imagesWithoutAlt} image(s) missing alt text`, suggestion: 'Add descriptive alt text to all images' }); score -= Math.min(imagesWithoutAlt * 2, 10); }

  if (!data.ogTitle) { issues.push({ type: 'info', category: 'Social', message: 'Missing Open Graph title', suggestion: 'Add og:title for better social sharing' }); score -= 2; }
  if (!data.ogDescription) { issues.push({ type: 'info', category: 'Social', message: 'Missing Open Graph description', suggestion: 'Add og:description for social previews' }); score -= 2; }
  if (!data.canonical) { issues.push({ type: 'info', category: 'Technical', message: 'No canonical URL set', suggestion: 'Add canonical link to prevent duplicate content' }); score -= 3; }
  if (data.wordCount < 300) { issues.push({ type: 'warning', category: 'Content', message: `Low word count (${data.wordCount})`, suggestion: 'Aim for at least 300 words' }); score -= 5; }

  const recommendations = [];
  if (data.h1.length > 0) recommendations.push(`Heading "${data.h1[0].substring(0, 50)}..." is ${data.h1[0].length > 70 ? 'long' : 'good length'}`);
  if (data.wordCount > 500) recommendations.push('Good content length!');
  if (data.links.filter(l => l.isExternal).length > 0) recommendations.push(`${data.links.filter(l => l.isExternal).length} external link(s) found — good for SEO`);

  score = Math.max(0, Math.min(100, score));
  return { url: data.url, score, issues, stats: { titleLength: data.title.length, metaDescLength: data.metaDescription.length, h1Count: data.h1.length, h2Count: data.h2.length, linkCount: data.links.length, externalLinkCount: data.links.filter(l => l.isExternal).length, imageCount: data.images.length, imagesWithoutAlt, wordCount: data.wordCount }, recommendations };
}

module.exports = { scrapeUrl, analyzeSEO };
