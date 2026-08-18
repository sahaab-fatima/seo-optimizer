const API_BASE = '';

function seoApp() {
  return {
    currentTab: 'home',
    urlInput: '',
    htmlInput: '',
    showHtmlFallback: false,
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

    // URL Analysis - server-side via Netlify function
    async analyzeUrl() {
      if (!this.urlInput) return;
      let url = this.urlInput.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
      try { new URL(url); } catch { this.error = 'Please enter a valid URL'; return; }

      this.currentTab = 'analyze';
      this.isLoading = true; this.error = ''; this.analysisResult = null; this.showHtmlFallback = false;

      try {
        const body = { url };
        if (this.htmlInput && this.htmlInput.trim().length > 50) body.html = this.htmlInput.trim();

        const res = await fetch('/.netlify/functions/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Analysis failed');

        // If server returned blocked=true, show fallback
        if (data.data.blocked) {
          this.showHtmlFallback = true;
          this.error = '';
          this.isLoading = false;
          this.$nextTick(() => { lucide.createIcons() });
          return;
        }

        this.analysisResult = data.data;
        this.saveToHistory({ url, score: data.data.score, createdAt: new Date().toISOString() });
      } catch (err) {
        this.showHtmlFallback = true;
        this.error = '';
      }
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
