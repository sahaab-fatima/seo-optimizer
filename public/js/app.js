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

    // URL Analysis - using AllOrigins CORS proxy
    async analyzeUrl() {
      if (!this.urlInput) return;
      let url = this.urlInput.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
      try { new URL(url); } catch { this.error = 'Please enter a valid URL'; return; }

      this.currentTab = 'analyze';
      this.isLoading = true; this.error = ''; this.analysisResult = null;

      try {
        // Try multiple CORS proxies
        const proxies = [
          `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
          `https://corsproxy.io/?${encodeURIComponent(url)}`,
          `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
        ];
        
        let html = '';
        let lastError;
        for (const proxyUrl of proxies) {
          try {
            const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
            if (res.ok) { html = await res.text(); break; }
          } catch (e) { lastError = e; }
        }
        if (!html) throw new Error('Could not fetch website. It may be blocking automated access.');

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const title = doc.querySelector('title')?.textContent?.trim() || '';
        const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const metaKeywords = doc.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
        const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
        const robots = doc.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
        const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
        const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
        const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

        const h1 = [...doc.querySelectorAll('h1')].map(el => el.textContent.trim()).filter(Boolean);
        const h2 = [...doc.querySelectorAll('h2')].map(el => el.textContent.trim()).filter(Boolean);
        const h3 = [...doc.querySelectorAll('h3')].map(el => el.textContent.trim()).filter(Boolean);

        const baseDomain = new URL(url).hostname;
        const links = [...doc.querySelectorAll('a[href]')].map(el => {
          const href = el.getAttribute('href') || '';
          const text = el.textContent.trim().substring(0, 100);
          if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null;
          let fullHref = href;
          if (href.startsWith('/')) fullHref = new URL(url).origin + href;
          let isExternal = false;
          try { isExternal = new URL(fullHref).hostname !== baseDomain; } catch {}
          return { text, href: fullHref, isExternal };
        }).filter(Boolean);

        const images = [...doc.querySelectorAll('img')].map(el => ({
          src: el.getAttribute('src') || '',
          alt: el.getAttribute('alt') || ''
        }));

        const textContent = doc.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
        const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

        const scrapedData = { url, title, metaDescription: metaDesc, metaKeywords, h1, h2, h3, links, images, textContent: textContent.substring(0, 10000), canonical, ogTitle, ogDescription: ogDesc, ogImage, robots, wordCount };

        // Analyze SEO
        const issues = [];
        let score = 100;

        if (!title) { issues.push({ type: 'error', category: 'Title', message: 'Missing page title', suggestion: 'Add a descriptive title between 50-60 characters' }); score -= 20; }
        else if (title.length < 30) { issues.push({ type: 'warning', category: 'Title', message: `Title is too short (${title.length} characters)`, suggestion: 'Aim for 50-60 characters' }); score -= 10; }
        else if (title.length > 60) { issues.push({ type: 'warning', category: 'Title', message: `Title is too long (${title.length} characters)`, suggestion: 'Keep title under 60 characters' }); score -= 5; }

        if (!metaDesc) { issues.push({ type: 'error', category: 'Meta Description', message: 'Missing meta description', suggestion: 'Add a compelling meta description between 150-160 characters' }); score -= 15; }
        else if (metaDesc.length < 120) { issues.push({ type: 'warning', category: 'Meta Description', message: `Meta description too short (${metaDesc.length})`, suggestion: 'Aim for 150-160 characters' }); score -= 5; }
        else if (metaDesc.length > 160) { issues.push({ type: 'warning', category: 'Meta Description', message: `Meta description too long (${metaDesc.length})`, suggestion: 'Keep under 160 characters' }); score -= 5; }

        if (h1.length === 0) { issues.push({ type: 'error', category: 'Headings', message: 'No H1 tag found', suggestion: 'Add exactly one H1 tag' }); score -= 15; }
        else if (h1.length > 1) { issues.push({ type: 'warning', category: 'Headings', message: `Multiple H1 tags (${h1.length})`, suggestion: 'Use only one H1 tag per page' }); score -= 5; }

        if (h2.length === 0 && h1.length > 0) { issues.push({ type: 'info', category: 'Headings', message: 'No H2 tags found', suggestion: 'Add H2 tags to organize content' }); score -= 3; }

        const imagesWithoutAlt = images.filter(img => !img.alt).length;
        if (imagesWithoutAlt > 0) { issues.push({ type: 'warning', category: 'Images', message: `${imagesWithoutAlt} image(s) missing alt text`, suggestion: 'Add descriptive alt text to all images' }); score -= Math.min(imagesWithoutAlt * 2, 10); }

        if (!ogTitle) { issues.push({ type: 'info', category: 'Social', message: 'Missing Open Graph title', suggestion: 'Add og:title for better social sharing' }); score -= 2; }
        if (!ogDesc) { issues.push({ type: 'info', category: 'Social', message: 'Missing Open Graph description', suggestion: 'Add og:description for social previews' }); score -= 2; }
        if (!canonical) { issues.push({ type: 'info', category: 'Technical', message: 'No canonical URL set', suggestion: 'Add canonical link to prevent duplicate content' }); score -= 3; }
        if (wordCount < 300) { issues.push({ type: 'warning', category: 'Content', message: `Low word count (${wordCount})`, suggestion: 'Aim for at least 300 words' }); score -= 5; }

        const recommendations = [];
        if (h1.length > 0) recommendations.push(`Heading "${h1[0].substring(0, 50)}..." is ${h1[0].length > 70 ? 'long' : 'good length'}`);
        if (wordCount > 500) recommendations.push('Good content length!');
        if (links.filter(l => l.isExternal).length > 0) recommendations.push(`${links.filter(l => l.isExternal).length} external link(s) found — good for SEO`);

        score = Math.max(0, Math.min(100, score));

        const analysis = { url, score, issues, stats: { titleLength: title.length, metaDescLength: metaDesc.length, h1Count: h1.length, h2Count: h2.length, linkCount: links.length, externalLinkCount: links.filter(l => l.isExternal).length, imageCount: images.length, imagesWithoutAlt, wordCount }, recommendations };

        this.analysisResult = analysis;
        this.saveToHistory({ url, score, createdAt: new Date().toISOString() });
      } catch (err) { this.error = err.message || 'Failed to analyze URL. Try a different website.'; }
      this.isLoading = false;
      this.$nextTick(() => { lucide.createIcons() });
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
