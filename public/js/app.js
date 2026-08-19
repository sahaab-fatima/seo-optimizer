const API_BASE = '';

function seoApp() {
  return {
    currentTab: 'home',
    urlInput: '',
    contentInput: '',
    keywordInput: '',
    isLoading: false,
    error: '',
    analysisResult: null,
    contentResult: null,
    keywordResult: null,
    history: [],

    init() {
      this.loadHistory();
      this.$nextTick(() => { lucide.createIcons() });
      this.$watch('currentTab', () => { this.$nextTick(() => { lucide.createIcons() }) });
      this.$watch('analysisResult', () => { this.$nextTick(() => { lucide.createIcons() }) });
      this.$watch('contentResult', () => { this.$nextTick(() => { lucide.createIcons() }) });
      this.$watch('keywordResult', () => { this.$nextTick(() => { lucide.createIcons() }) });
      this.$watch('isLoading', () => { this.$nextTick(() => { lucide.createIcons() }) });
      this.$watch('error', () => { this.$nextTick(() => { lucide.createIcons() }) });
    },

    resetResults() {
      this.analysisResult = null;
      this.contentResult = null;
      this.keywordResult = null;
      this.error = '';
    },

    getScoreLabel(score) {
      if (score >= 80) return 'Excellent';
      if (score >= 60) return 'Good';
      if (score >= 40) return 'Needs Work';
      return 'Poor';
    },

    loadHistory() {
      try {
        const stored = localStorage.getItem('seo_history');
        this.history = stored ? JSON.parse(stored) : [];
      } catch { this.history = []; }
    },

    saveToHistory(entry) {
      this.history.unshift(entry);
      if (this.history.length > 20) this.history = this.history.slice(0, 20);
      localStorage.setItem('seo_history', JSON.stringify(this.history));
    },

    // URL Analysis
    async analyzeUrl() {
      if (!this.urlInput) return;
      let url = this.urlInput.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
      try { new URL(url); } catch { this.error = 'Please enter a valid URL'; return; }

      this.currentTab = 'analyze';
      this.isLoading = true; this.error = ''; this.analysisResult = null;

      // Method 1: Google PageSpeed directly (supports CORS)
      try {
        const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=seo&strategy=mobile`;
        const res = await fetch(psiUrl);
        const data = await res.json();
        if (data.lighthouseResult) {
          this.analysisResult = this.parsePsiResult(data, url);
          this.saveToHistory({ url, score: this.analysisResult.score, createdAt: new Date().toISOString() });
          this.isLoading = false;
          this.$nextTick(() => { lucide.createIcons() });
          return;
        }
      } catch (e) { console.log('Direct PSI failed:', e); }

      // Method 2: Via Netlify function
      try {
        const res = await fetch('/.netlify/functions/pagespeed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const json = await res.json();
        if (json.success && json.data && json.data.lighthouseResult) {
          this.analysisResult = this.parsePsiResult(json.data, url);
          this.saveToHistory({ url, score: this.analysisResult.score, createdAt: new Date().toISOString() });
          this.isLoading = false;
          this.$nextTick(() => { lucide.createIcons() });
          return;
        }
      } catch (e) { console.log('Function PSI failed:', e); }

      // Method 3: CORS proxy
      const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`
      ];
      for (const proxyUrl of proxies) {
        try {
          const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
          if (res.ok) {
            const html = await res.text();
            if (html && html.length > 100) {
              this.analysisResult = this.analyzeHtmlLocal(html, url);
              this.saveToHistory({ url, score: this.analysisResult.score, createdAt: new Date().toISOString() });
              this.isLoading = false;
              this.$nextTick(() => { lucide.createIcons() });
              return;
            }
          }
        } catch (e) { continue; }
      }

      this.error = 'Could not analyze. Try again or try a different URL.';
      this.isLoading = false;
      this.$nextTick(() => { lucide.createIcons() });
    },

    parsePsiResult(data, url) {
      const lr = data.lighthouseResult;
      const audits = lr.audits || {};
      const seo = lr.categories?.seo || {};

      const issues = [];
      let score = Math.round((seo.score || 0) * 100);

      const check = (id, errType, cat, msg, fix) => {
        const a = audits[id];
        if (a && a.score !== null && a.score < 1) {
          issues.push({ type: errType, category: cat, message: msg, suggestion: fix });
        }
      };

      check('document-title', 'error', 'Title', 'Missing or invalid page title', 'Add a descriptive title between 50-60 characters');
      check('meta-description', 'error', 'Meta Description', 'Missing meta description', 'Add a compelling description 150-160 chars');
      check('heading-order', 'warning', 'Headings', 'Heading order is incorrect', 'Use H1 > H2 > H3 in order');
      check('image-alt', 'warning', 'Images', 'Images missing alt text', 'Add descriptive alt text to all images');
      check('link-text', 'warning', 'Links', 'Links missing descriptive text', 'Use meaningful link text');
      check('crawlable-anchors', 'info', 'Technical', 'Some links may not be crawlable', 'Use standard HTML links');
      check('is-crawlable', 'error', 'Technical', 'Page may not be crawlable', 'Check robots.txt and meta robots');
      check('robots-txt', 'error', 'Technical', 'Issues with robots.txt', 'Verify robots.txt allows crawling');
      check('hreflang', 'info', 'Technical', 'Missing hreflang tags', 'Add hreflang for international audiences');
      check('canonical', 'info', 'Technical', 'Missing canonical tag', 'Add canonical link');
      check('structured-data', 'info', 'Technical', 'No structured data found', 'Add JSON-LD structured data');

      if (audits['document-title']?.score === 1) issues.push({ type: 'pass', category: 'Title', message: 'Title tag present', suggestion: '' });
      if (audits['meta-description']?.score === 1) issues.push({ type: 'pass', category: 'Meta Description', message: 'Meta description present', suggestion: '' });
      if (audits['image-alt']?.score === 1) issues.push({ type: 'pass', category: 'Images', message: 'All images have alt text', suggestion: '' });

      const recs = [];
      if (audits['document-title']?.score === 1) recs.push('Title tag present');
      if (audits['meta-description']?.score === 1) recs.push('Meta description present');
      if (audits['image-alt']?.score === 1) recs.push('Image alt text present');
      if (score >= 80) recs.push('Good overall SEO score');
      if (score < 50) recs.push('Needs significant SEO improvements');

      const desc = audits['meta-description']?.displayValue || '';
      const titleLen = audits['document-title']?.details?.items?.[0]?.title?.length || 0;

      return {
        url, score, issues,
        stats: { titleLength: titleLen, metaDescLength: desc.length, h1Count: 0, h2Count: 0, linkCount: 0, imageCount: 0, imagesWithoutAlt: 0, wordCount: 0 },
        recommendations: recs,
        psiDetails: true
      };
    },

    // Local HTML analyzer (client-side)
    analyzeHtmlLocal(html, url) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const title = doc.querySelector('title')?.textContent?.trim() || '';
        const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
        const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
        const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
        const h1 = [...doc.querySelectorAll('h1')].map(el => el.textContent.trim()).filter(Boolean);
        const h2 = [...doc.querySelectorAll('h2')].map(el => el.textContent.trim()).filter(Boolean);
        const images = [...doc.querySelectorAll('img')].map(el => ({ alt: el.getAttribute('alt') || '' }));
        const textContent = doc.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
        const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
        const imagesWithoutAlt = images.filter(img => !img.alt).length;

        const issues = [];
        let score = 100;
        if (!title) { issues.push({ type: 'error', category: 'Title', message: 'Missing page title', suggestion: 'Add a descriptive title between 50-60 characters' }); score -= 20; }
        else if (title.length < 30) { issues.push({ type: 'warning', category: 'Title', message: `Title too short (${title.length} chars)`, suggestion: 'Aim for 50-60 characters' }); score -= 10; }
        else if (title.length > 60) { issues.push({ type: 'warning', category: 'Title', message: `Title too long (${title.length} chars)`, suggestion: 'Keep under 60 characters' }); score -= 5; }
        if (!metaDesc) { issues.push({ type: 'error', category: 'Meta Description', message: 'Missing meta description', suggestion: 'Add a compelling description 150-160 chars' }); score -= 15; }
        else if (metaDesc.length < 120) { issues.push({ type: 'warning', category: 'Meta Description', message: `Too short (${metaDesc.length} chars)`, suggestion: 'Aim for 150-160 characters' }); score -= 5; }
        if (h1.length === 0) { issues.push({ type: 'error', category: 'Headings', message: 'No H1 tag found', suggestion: 'Add exactly one H1 tag' }); score -= 15; }
        else if (h1.length > 1) { issues.push({ type: 'warning', category: 'Headings', message: `Multiple H1 tags (${h1.length})`, suggestion: 'Use only one H1 per page' }); score -= 5; }
        if (h2.length === 0 && h1.length > 0) { issues.push({ type: 'info', category: 'Headings', message: 'No H2 tags found', suggestion: 'Add H2 tags to organize content' }); score -= 3; }
        if (imagesWithoutAlt > 0) { issues.push({ type: 'warning', category: 'Images', message: `${imagesWithoutAlt} image(s) missing alt text`, suggestion: 'Add descriptive alt text' }); score -= Math.min(imagesWithoutAlt * 2, 10); }
        if (!ogTitle) { issues.push({ type: 'info', category: 'Social', message: 'Missing og:title', suggestion: 'Add for better social sharing' }); score -= 2; }
        if (!ogDesc) { issues.push({ type: 'info', category: 'Social', message: 'Missing og:description', suggestion: 'Add for social previews' }); score -= 2; }
        if (!canonical) { issues.push({ type: 'info', category: 'Technical', message: 'No canonical URL', suggestion: 'Add canonical link' }); score -= 3; }
        if (wordCount < 300) { issues.push({ type: 'warning', category: 'Content', message: `Low word count (${wordCount})`, suggestion: 'Aim for at least 300 words' }); score -= 5; }

        const recs = [];
        if (h1.length > 0) recs.push('H1 tag present');
        if (wordCount > 500) recs.push('Good content length');
        if (metaDesc) recs.push('Meta description present');
        if (title) recs.push('Title tag present');

        return { url, score: Math.max(0, Math.min(100, score)), issues, stats: { titleLength: title.length, metaDescLength: metaDesc.length, h1Count: h1.length, h2Count: h2.length, linkCount: 0, imageCount: images.length, imagesWithoutAlt, wordCount }, recommendations: recs };
      } catch (e) {
        return { url, score: 0, issues: [{ type: 'error', category: 'Error', message: 'Could not parse HTML', suggestion: 'Check if HTML is valid' }], stats: { titleLength: 0, metaDescLength: 0, h1Count: 0, h2Count: 0, linkCount: 0, imageCount: 0, imagesWithoutAlt: 0, wordCount: 0 }, recommendations: [] };
      }
    },

    // Content Optimization - local
    optimizeContent(type) {
      if (!this.contentInput) return;
      this.isLoading = true; this.error = ''; this.contentResult = null;

      const content = this.contentInput;
      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
      const avgWordsPerSentence = sentences > 0 ? Math.round(wordCount / sentences) : 0;

      const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','can','shall','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','both','each','few','more','most','other','some','such','no','not','only','own','same','so','than','too','very','just','because','but','and','or','if','while','about','up','its','it','this','that','these','those','i','me','my','we','our','you','your','he','him','his','she','her','they','them','their','what','which','who','whom']);
      const words = content.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
      const wordFreq = {};
      words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
      const topWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);

      let result;
      if (type === 'meta') {
        const title = content.split('.')[0].substring(0, 55).trim() || 'Optimized Page Title';
        result = { title, description: content.substring(0, 150).trim() + '...', keywords: topWords.length > 0 ? topWords : ['seo', 'content', 'optimization'] };
      } else if (type === 'improve') {
        const score = Math.min(95, Math.max(25, (wordCount > 200 ? 20 : 10) + (wordCount > 500 ? 15 : 0) + (sentences > 5 ? 10 : 5) + (avgWordsPerSentence < 25 ? 15 : 5) + (topWords.length > 3 ? 15 : 5) + 20));
        result = { score, suggestions: [wordCount < 300 ? 'Increase content to at least 300 words' : 'Good content length', avgWordsPerSentence > 25 ? 'Shorten sentences for readability' : 'Good sentence length', topWords.length < 3 ? 'Add more relevant keywords' : 'Good keyword usage', 'Add a compelling title tag', 'Write a meta description', 'Use H2 and H3 headings'], optimizedVersion: content };
      } else {
        const score = Math.min(95, Math.max(25, (wordCount > 200 ? 20 : 10) + (wordCount > 500 ? 15 : 0) + (sentences > 5 ? 10 : 5) + (topWords.length > 3 ? 15 : 5) + 25));
        result = { overallScore: score, strengths: [wordCount > 200 ? `Good content length (${wordCount} words)` : `Content length: ${wordCount} words`, topWords.length > 3 ? 'Multiple relevant keywords found' : 'Some keywords present', sentences > 3 ? 'Good content structure' : 'Content exists'], weaknesses: [wordCount < 300 ? 'Content too short - aim for 300+ words' : null, avgWordsPerSentence > 25 ? 'Sentences too long - keep under 20 words' : null, topWords.length < 3 ? 'Not enough keyword variety' : null].filter(Boolean), recommendations: ['Add target keyword in first 100 words', 'Use H2 headings every 200-300 words', 'Add internal links to related content', 'Include at least one external authority link', 'Add alt text to all images', 'Write a meta description between 150-160 characters'] };
      }

      this.contentResult = result;
      this.isLoading = false;
      this.$nextTick(() => { lucide.createIcons() });
    },

    // Keyword Research - local
    researchKeywords() {
      if (!this.keywordInput) return;
      this.isLoading = true; this.error = ''; this.keywordResult = null;

      const t = this.keywordInput.toLowerCase().trim();
      this.keywordResult = {
        keywords: [
          { keyword: t, searchVolume: 'high', difficulty: 'high', relevance: 95 },
          { keyword: `${t} guide`, searchVolume: 'medium', difficulty: 'medium', relevance: 88 },
          { keyword: `best ${t}`, searchVolume: 'high', difficulty: 'high', relevance: 90 },
          { keyword: `${t} tips`, searchVolume: 'medium', difficulty: 'low', relevance: 85 },
          { keyword: `how to ${t}`, searchVolume: 'high', difficulty: 'medium', relevance: 92 },
          { keyword: `${t} for beginners`, searchVolume: 'medium', difficulty: 'low', relevance: 87 },
          { keyword: `${t} tutorial`, searchVolume: 'medium', difficulty: 'medium', relevance: 83 },
          { keyword: `top ${t}`, searchVolume: 'medium', difficulty: 'medium', relevance: 80 },
          { keyword: `${t} strategies`, searchVolume: 'low', difficulty: 'low', relevance: 78 },
          { keyword: `${t} tools`, searchVolume: 'medium', difficulty: 'medium', relevance: 82 }
        ],
        longTailKeywords: [`best ${t} for beginners`, `how to start with ${t}`, `${t} tips and tricks 2026`, `free ${t} tools online`, `${t} step by step guide`],
        questions: [`What is ${t}?`, `How to learn ${t}?`, `Why is ${t} important?`, `What are the best ${t} tools?`, `How to improve ${t}?`]
      };

      this.isLoading = false;
      this.$nextTick(() => { lucide.createIcons() });
    },

    formatContentResult() {
      if (!this.contentResult) return '';
      let html = '<div class="space-y-4">';
      if (this.contentResult.overallScore) html += `<div class="flex items-center gap-4"><span class="text-slate-400">Score:</span><span class="text-2xl font-bold ${this.contentResult.overallScore >= 80 ? 'text-emerald-400' : this.contentResult.overallScore >= 60 ? 'text-amber-400' : 'text-red-400'}">${this.contentResult.overallScore}/100</span></div>`;
      if (this.contentResult.score) html += `<div class="flex items-center gap-4"><span class="text-slate-400">Score:</span><span class="text-2xl font-bold ${this.contentResult.score >= 80 ? 'text-emerald-400' : this.contentResult.score >= 60 ? 'text-amber-400' : 'text-red-400'}">${this.contentResult.score}/100</span></div>`;
      if (this.contentResult.strengths) { html += '<div><p class="text-emerald-400 font-medium mb-2">Strengths</p><ul class="space-y-1">'; this.contentResult.strengths.forEach(s => { html += `<li class="flex items-start gap-2 text-slate-300"><span class="text-emerald-400">&#10003;</span>${s}</li>` }); html += '</ul></div>'; }
      if (this.contentResult.weaknesses) { html += '<div><p class="text-amber-400 font-medium mb-2">Areas to Improve</p><ul class="space-y-1">'; this.contentResult.weaknesses.forEach(w => { html += `<li class="flex items-start gap-2 text-slate-300"><span class="text-amber-400">!</span>${w}</li>` }); html += '</ul></div>'; }
      if (this.contentResult.recommendations) { html += '<div><p class="text-indigo-400 font-medium mb-2">Recommendations</p><ul class="space-y-1">'; this.contentResult.recommendations.forEach(r => { html += `<li class="flex items-start gap-2 text-slate-300"><span class="text-indigo-400">&rarr;</span>${r}</li>` }); html += '</ul></div>'; }
      if (this.contentResult.title) html += `<div class="bg-slate-900 rounded-xl p-4"><p class="text-sm text-slate-400 mb-1">Generated Title</p><p class="text-slate-300">${this.contentResult.title}</p></div>`;
      if (this.contentResult.description) html += `<div class="bg-slate-900 rounded-xl p-4"><p class="text-sm text-slate-400 mb-1">Generated Description</p><p class="text-slate-300">${this.contentResult.description}</p></div>`;
      if (this.contentResult.keywords) { html += '<div class="bg-slate-900 rounded-xl p-4"><p class="text-sm text-slate-400 mb-2">Keywords</p><div class="flex flex-wrap gap-2">'; this.contentResult.keywords.forEach(k => { html += `<span class="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-sm">${k}</span>` }); html += '</div></div>'; }
      if (this.contentResult.suggestions) { html += '<div><p class="text-indigo-400 font-medium mb-2">Suggestions</p><ul class="space-y-1">'; this.contentResult.suggestions.forEach(s => { html += `<li class="flex items-start gap-2 text-slate-300"><span class="text-indigo-400">&bull;</span>${s}</li>` }); html += '</ul></div>'; }
      if (this.contentResult.optimizedVersion) html += `<div class="bg-slate-900 rounded-xl p-4"><p class="text-sm text-slate-400 mb-2">Optimized Version</p><p class="text-slate-300 whitespace-pre-wrap">${this.contentResult.optimizedVersion}</p></div>`;
      html += '</div>';
      return html;
    }
  };
}
