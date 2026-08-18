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

    async loadHistory() {
      try {
        const res = await fetch(`${API_BASE}/api/history/analyses`);
        const data = await res.json();
        if (data.success) this.history = data.data;
      } catch {}
    },

    async analyzeUrl() {
      if (!this.urlInput) return;
      const fromHome = this.currentTab === 'home';
      this.currentTab = 'analyze';
      this.isLoading = true; this.error = ''; this.analysisResult = null;
      try {
        const res = await fetch(`${API_BASE}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: this.urlInput })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        this.analysisResult = data.data.analysis;
        this.loadHistory();
      } catch (err) { this.error = err.message || 'Analysis failed'; }
      this.isLoading = false;
      this.$nextTick(() => { lucide.createIcons() });
    },

    async optimizeContent(type) {
      if (!this.contentInput) return;
      this.isLoading = true; this.error = ''; this.contentResult = null;
      try {
        const res = await fetch(`${API_BASE}/api/optimize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: this.contentInput, type })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        this.contentResult = data.data;
      } catch (err) { this.error = err.message || 'Optimization failed'; }
      this.isLoading = false;
      this.$nextTick(() => { lucide.createIcons() });
    },

    async researchKeywords() {
      if (!this.keywordInput) return;
      this.isLoading = true; this.error = ''; this.keywordResult = null;
      try {
        const res = await fetch(`${API_BASE}/api/keywords`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: this.keywordInput, count: 10 })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        this.keywordResult = data.data;
      } catch (err) { this.error = err.message || 'Research failed'; }
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
