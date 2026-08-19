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
      // Accept any format: with http, https, or just domain
      if (!url.match(/^https?:\/\//i)) url = 'https://' + url;
      try { new URL(url); } catch { this.error = 'Please enter a valid URL'; return; }

      this.currentTab = 'analyze';
      this.isLoading = true; this.error = ''; this.analysisResult = null;

      // Method 1: Server-side fetch via Netlify function (fast, no CORS issues)
      try {
        const res = await fetch('/.netlify/functions/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const json = await res.json();
        if (json.success && json.data) {
          this.analysisResult = json.data;
          this.saveToHistory({ url, score: json.data.score, createdAt: new Date().toISOString() });
          this.isLoading = false;
          this.$nextTick(() => { lucide.createIcons() });
          return;
        }
        if (json.error) throw new Error(json.error);
      } catch (e) { console.log('Function failed:', e.message); }

      // Method 2: CORS proxy fallback
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

    // Content Optimization
    optimizeContent(type) {
      if (!this.contentInput) return;
      this.isLoading = true; this.error = ''; this.contentResult = null;

      const content = this.contentInput;
      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const avgWordsPerSentence = sentences.length > 0 ? Math.round(wordCount / sentences.length) : 0;

      const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','can','shall','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','both','each','few','more','most','other','some','such','no','not','only','own','same','so','than','too','very','just','because','but','and','or','if','while','about','up','its','it','this','that','these','those','i','me','my','we','our','you','your','he','him','his','she','her','they','them','their','what','which','who','whom']);
      const words = content.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
      const wordFreq = {};
      words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
      const topWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
      const mainKeyword = topWords[0] || content.split(/\s+/)[0]?.toLowerCase() || 'topic';

      // Extract first meaningful sentence for title base
      const firstSentence = sentences[0]?.trim() || content.substring(0, 100);

      let result;
      if (type === 'meta') {
        // Generate smart title
        let seoTitle = firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1);
        if (seoTitle.length > 55) seoTitle = seoTitle.substring(0, 52) + '...';
        if (!seoTitle.endsWith('.') && !seoTitle.endsWith('!')) seoTitle += ' | ' + mainKeyword.charAt(0).toUpperCase() + mainKeyword.slice(1);

        // Generate smart meta description
        let seoDesc = '';
        if (sentences.length > 1) {
          seoDesc = sentences[0].trim() + ' ' + sentences[1].trim();
        } else {
          seoDesc = content.substring(0, 140).trim();
        }
        if (seoDesc.length > 155) seoDesc = seoDesc.substring(0, 152) + '...';
        if (!seoDesc.endsWith('.')) seoDesc += '.';

        // Find primary keywords from content
        const primaryKeywords = topWords.slice(0, 5);
        const secondaryKeywords = topWords.slice(5, 10);

        result = {
          title: seoTitle,
          titleLength: seoTitle.length,
          titleStatus: seoTitle.length >= 50 && seoTitle.length <= 60 ? 'Perfect' : seoTitle.length < 50 ? 'Could be longer' : 'Slightly long',
          description: seoDesc,
          descLength: seoDesc.length,
          descStatus: seoDesc.length >= 150 && seoDesc.length <= 160 ? 'Perfect' : seoDesc.length < 150 ? 'Could be longer' : 'Slightly long',
          primaryKeywords,
          secondaryKeywords,
          suggestions: [
            `Use "${mainKeyword}" in your title tag`,
            `Include "${mainKeyword}" in the first 100 words`,
            primaryKeywords.length >= 3 ? 'Good keyword variety' : 'Add more relevant keywords',
            seoTitle.length >= 50 && seoTitle.length <= 60 ? 'Title length is perfect' : 'Aim for 50-60 character title',
            seoDesc.length >= 150 ? 'Meta description length is good' : 'Expand description to 150-160 characters'
          ]
        };
      } else if (type === 'improve') {
        // Calculate detailed SEO score
        let score = 50;
        const details = [];

        // Content length analysis
        if (wordCount > 1500) { score += 20; details.push({ check: 'Excellent content length (' + wordCount + ' words)', status: 'pass' }); }
        else if (wordCount > 800) { score += 15; details.push({ check: 'Good content length (' + wordCount + ' words)', status: 'pass' }); }
        else if (wordCount > 300) { score += 8; details.push({ check: 'Content length (' + wordCount + ' words) - aim for 800+ for better ranking', status: 'warn' }); }
        else { details.push({ check: 'Content too short (' + wordCount + ' words) - aim for 800+ words', status: 'fail' }); }

        // Keyword density
        const primaryDensity = words.length > 0 ? ((wordFreq[mainKeyword] || 0) / words.length * 100).toFixed(1) : 0;
        if (primaryDensity >= 1 && primaryDensity <= 2.5) { score += 15; details.push({ check: `"${mainKeyword}" density is ${primaryDensity}% - perfect`, status: 'pass' }); }
        else if (primaryDensity > 0) { score += 8; details.push({ check: `"${mainKeyword}" density is ${primaryDensity}% - aim for 1-2.5%`, status: 'warn' }); }
        else { details.push({ check: `"${mainKeyword}" not found enough - add it naturally`, status: 'fail' }); }

        // Sentence readability
        if (avgWordsPerSentence <= 18) { score += 10; details.push({ check: 'Good readability (avg ' + avgWordsPerSentence + ' words/sentence)', status: 'pass' }); }
        else if (avgWordsPerSentence <= 25) { score += 5; details.push({ check: 'Sentences are a bit long (avg ' + avgWordsPerSentence + ' words) - aim for under 18', status: 'warn' }); }
        else { details.push({ check: 'Sentences too long (avg ' + avgWordsPerSentence + ' words) - break them up', status: 'fail' }); }

        // Keyword variety
        if (topWords.length >= 6) { score += 10; details.push({ check: 'Good keyword variety (' + topWords.length + ' unique keywords)', status: 'pass' }); }
        else { score += 5; details.push({ check: 'Low keyword variety - add more related terms', status: 'warn' }); }

        // Structure
        if (content.includes('\n') || content.includes('•') || content.includes('-')) { score += 5; details.push({ check: 'Content has some structure', status: 'pass' }); }
        else { details.push({ check: 'Add bullet points, lists, or line breaks for better readability', status: 'warn' }); }

        // Generate improved version
        let improved = content;
        // Capitalize first letter of each sentence
        improved = improved.replace(/(^|[.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase());
        // Ensure it starts with a capital letter
        if (improved[0]) improved = improved[0].toUpperCase() + improved.slice(1);

        // Add keyword suggestions naturally
        if (!content.toLowerCase().includes(mainKeyword)) {
          improved = `When it comes to ${mainKeyword}, ${improved.charAt(0).toLowerCase() + improved.slice(1)}`;
        }

        result = {
          score: Math.min(95, Math.max(15, score)),
          details,
          optimizedVersion: improved,
          keywordsFound: topWords.slice(0, 5),
          recommendations: [
            `Target keyword: "${mainKeyword}" - use it 2-3% of the time`,
            'Add the keyword in your first 100 words',
            'Use H2 headings every 200-300 words with keywords',
            'Add internal links to related pages on your site',
            'Include at least one external authority link',
            'Add images with descriptive alt text containing your keyword',
            `Write a meta description of 150-160 characters using "${mainKeyword}"`,
            wordCount < 500 ? `Expand content to 800+ words (currently ${wordCount})` : 'Good content length'
          ]
        };
      } else {
        // Analyze SEO
        let score = 50;
        const strengths = [];
        const weaknesses = [];

        // Length check
        if (wordCount > 1000) { score += 18; strengths.push(`Excellent length: ${wordCount} words`); }
        else if (wordCount > 500) { score += 12; strengths.push(`Good length: ${wordCount} words`); }
        else if (wordCount > 300) { score += 5; strengths.push(`Decent length: ${wordCount} words`); }
        else { weaknesses.push(`Too short: ${wordCount} words - aim for 800+`); }

        // Readability
        if (avgWordsPerSentence <= 18) { score += 12; strengths.push('Easy to read - short sentences'); }
        else if (avgWordsPerSentence <= 25) { score += 5; strengths.push('Readable but could be better'); }
        else { weaknesses.push('Hard to read - sentences too long (avg ' + avgWordsPerSentence + ' words)'); }

        // Keywords
        if (topWords.length >= 5) { score += 10; strengths.push(`Rich keyword variety: ${topWords.slice(0, 3).join(', ')}`); }
        else { weaknesses.push('Needs more keyword variety - add related terms'); }

        // Primary keyword usage
        const primaryCount = wordFreq[mainKeyword] || 0;
        if (primaryCount >= 3) { score += 10; strengths.push(`"${mainKeyword}" used ${primaryCount} times - good`); }
        else { weaknesses.push(`"${mainKeyword}" used only ${primaryCount} times - use it 3-5+ times`); }

        result = {
          overallScore: Math.min(95, Math.max(15, score)),
          strengths,
          weaknesses,
          topKeywords: topWords.slice(0, 8),
          recommendations: [
            `Primary keyword: "${mainKeyword}"`,
            `Current word count: ${wordCount} - aim for 800+`,
            'Add the keyword in your title, first paragraph, and headings',
            'Use H2/H3 headings with keywords every 200-300 words',
            'Add internal links to related content',
            'Include 1-2 external authority links',
            'Add images with keyword-rich alt text',
            'Write a compelling meta description',
            'Make content scannable with bullets and short paragraphs'
          ]
        };
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

      // Score
      const score = this.contentResult.overallScore || this.contentResult.score;
      if (score) {
        const color = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
        html += `<div class="flex items-center gap-4"><span class="text-slate-400">SEO Score:</span><span class="text-3xl font-bold ${color}">${score}/100</span></div>`;
      }

      // Strengths
      if (this.contentResult.strengths?.length) {
        html += '<div><p class="text-emerald-400 font-medium mb-2">Strengths</p><ul class="space-y-1">';
        this.contentResult.strengths.forEach(s => { html += `<li class="flex items-start gap-2 text-slate-300"><span class="text-emerald-400">&#10003;</span>${s}</li>` });
        html += '</ul></div>';
      }

      // Weaknesses
      if (this.contentResult.weaknesses?.length) {
        html += '<div><p class="text-amber-400 font-medium mb-2">Weaknesses</p><ul class="space-y-1">';
        this.contentResult.weaknesses.forEach(w => { html += `<li class="flex items-start gap-2 text-slate-300"><span class="text-amber-400">!</span>${w}</li>` });
        html += '</ul></div>';
      }

      // Details (for improve)
      if (this.contentResult.details?.length) {
        html += '<div><p class="text-indigo-400 font-medium mb-2">Analysis</p><ul class="space-y-1">';
        this.contentResult.details.forEach(d => {
          const icon = d.status === 'pass' ? '<span class="text-emerald-400">&#10003;</span>' : d.status === 'warn' ? '<span class="text-amber-400">!</span>' : '<span class="text-red-400">&#10007;</span>';
          html += `<li class="flex items-start gap-2 text-slate-300">${icon}${d.check}</li>`;
        });
        html += '</ul></div>';
      }

      // Meta tags
      if (this.contentResult.title) {
        html += `<div class="bg-slate-900 rounded-xl p-4"><p class="text-sm text-slate-400 mb-1">Generated Title Tag (${this.contentResult.titleLength || this.contentResult.title.length} chars) <span class="${this.contentResult.titleStatus === 'Perfect' ? 'text-emerald-400' : 'text-amber-400'}">${this.contentResult.titleStatus || ''}</span></p><p class="text-slate-300 font-medium">${this.contentResult.title}</p></div>`;
      }
      if (this.contentResult.description) {
        html += `<div class="bg-slate-900 rounded-xl p-4"><p class="text-sm text-slate-400 mb-1">Generated Meta Description (${this.contentResult.descLength || this.contentResult.description.length} chars) <span class="${this.contentResult.descStatus === 'Perfect' ? 'text-emerald-400' : 'text-amber-400'}">${this.contentResult.descStatus || ''}</span></p><p class="text-slate-300">${this.contentResult.description}</p></div>`;
      }

      // Keywords found
      if (this.contentResult.primaryKeywords?.length) {
        html += '<div class="bg-slate-900 rounded-xl p-4"><p class="text-sm text-slate-400 mb-2">Primary Keywords Found</p><div class="flex flex-wrap gap-2">';
        this.contentResult.primaryKeywords.forEach(k => { html += `<span class="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-sm font-medium">${k}</span>` });
        html += '</div></div>';
      }
      if (this.contentResult.secondaryKeywords?.length) {
        html += '<div class="bg-slate-900 rounded-xl p-4"><p class="text-sm text-slate-400 mb-2">Secondary Keywords</p><div class="flex flex-wrap gap-2">';
        this.contentResult.secondaryKeywords.forEach(k => { html += `<span class="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm">${k}</span>` });
        html += '</div></div>';
      }
      if (this.contentResult.topKeywords?.length) {
        html += '<div class="bg-slate-900 rounded-xl p-4"><p class="text-sm text-slate-400 mb-2">Top Keywords Found</p><div class="flex flex-wrap gap-2">';
        this.contentResult.topKeywords.forEach(k => { html += `<span class="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-sm">${k}</span>` });
        html += '</div></div>';
      }

      // Recommendations
      if (this.contentResult.recommendations?.length) {
        html += '<div><p class="text-indigo-400 font-medium mb-2">Recommendations</p><ul class="space-y-1">';
        this.contentResult.recommendations.forEach(r => { html += `<li class="flex items-start gap-2 text-slate-300"><span class="text-indigo-400">&rarr;</span>${r}</li>` });
        html += '</ul></div>';
      }

      // Optimized version
      if (this.contentResult.optimizedVersion) {
        html += `<div class="bg-slate-900 rounded-xl p-4"><p class="text-sm text-slate-400 mb-2">Optimized Content</p><p class="text-slate-300 whitespace-pre-wrap leading-relaxed">${this.contentResult.optimizedVersion}</p></div>`;
      }

      html += '</div>';
      return html;
    }
  };
}
