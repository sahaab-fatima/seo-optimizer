const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeUrl(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 10000
  });

  const html = response.data;
  const $ = cheerio.load(html);

  $('script, style, noscript, iframe').remove();

  const title = $('title').text().trim();
  const metaDescription = $('meta[name="description"]').attr('content') || '';
  const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const robots = $('meta[name="robots"]').attr('content') || '';

  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogDescription = $('meta[property="og:description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || '';

  const h1 = [];
  const h2 = [];
  const h3 = [];

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
      if (href.startsWith('/')) {
        const baseUrl = new URL(url);
        fullHref = `${baseUrl.origin}${href}`;
      }
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

module.exports = { scrapeUrl };
