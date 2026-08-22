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
    pageSpeedResult: null,
    backlinkResult: null,
    serpTitle: '',
    serpDesc: '',
    serpUrl: '',
    schemaType: 'article',
    schemaData: {},
    generatedSchema: '',
    readabilityResult: null,
    readabilityInput: '',
    faqItems: [{q:'',a:''}],
    history: [],
    // Auth
    user: null,
    token: null,
    showAuthModal: false,
    authMode: 'login',
    authName: '',
    authEmail: '',
    authPassword: '',
    authError: '',
    authLoading: false,

    init() {
      // Load token from localStorage
      this.token = localStorage.getItem('seo_token');
      this.user = JSON.parse(localStorage.getItem('seo_user') || 'null');
      this.loadHistory();
      this.$nextTick(() => { lucide.createIcons() });
      this.$watch('currentTab', () => { this.$nextTick(() => { lucide.createIcons() }) });
      this.$watch('analysisResult', () => { this.$nextTick(() => { lucide.createIcons() }) });
      this.$watch('contentResult', () => { this.$nextTick(() => { lucide.createIcons() }) });
      this.$watch('keywordResult', () => { this.$nextTick(() => { lucide.createIcons() }) });
      this.$watch('pageSpeedResult', () => { this.$nextTick(() => { lucide.createIcons() }) });
      this.$watch('backlinkResult', () => { this.$nextTick(() => { lucide.createIcons() }) });
      this.$watch('readabilityResult', () => { this.$nextTick(() => { lucide.createIcons() }) });
      this.$watch('isLoading', () => { this.$nextTick(() => { lucide.createIcons() }) });
      this.$watch('error', () => { this.$nextTick(() => { lucide.createIcons() }) });
      this.$watch('showAuthModal', () => { this.$nextTick(() => { lucide.createIcons() }) });
    },

    getAuthHeaders() {
      return this.token ? { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    },

    async login() {
      this.authLoading = true; this.authError = '';
      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: this.authEmail, password: this.authPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        this.token = data.token; this.user = data.user;
        localStorage.setItem('seo_token', this.token);
        localStorage.setItem('seo_user', JSON.stringify(this.user));
        this.showAuthModal = false; this.authEmail = ''; this.authPassword = '';
        this.loadHistory();
      } catch (e) { this.authError = e.message; }
      this.authLoading = false;
    },

    async register() {
      this.authLoading = true; this.authError = '';
      try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: this.authName, email: this.authEmail, password: this.authPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        this.token = data.token; this.user = data.user;
        localStorage.setItem('seo_token', this.token);
        localStorage.setItem('seo_user', JSON.stringify(this.user));
        this.showAuthModal = false; this.authName = ''; this.authEmail = ''; this.authPassword = '';
      } catch (e) { this.authError = e.message; }
      this.authLoading = false;
    },

    logout() {
      this.user = null; this.token = null;
      localStorage.removeItem('seo_token');
      localStorage.removeItem('seo_user');
      this.history = [];
    },

    resetResults() {
      this.analysisResult = null;
      this.contentResult = null;
      this.keywordResult = null;
      this.pageSpeedResult = null;
      this.backlinkResult = null;
      this.readabilityResult = null;
      this.generatedSchema = '';
      this.error = '';
    },

    getScoreLabel(score) {
      if (score >= 80) return 'Excellent';
      if (score >= 60) return 'Good';
      if (score >= 40) return 'Needs Work';
      return 'Poor';
    },

    async loadHistory() {
      if (this.token) {
        try {
          const res = await fetch(`${API_BASE}/api/history/analyses`, { headers: this.getAuthHeaders() });
          const data = await res.json();
          if (data.success) { this.history = data.data; return; }
        } catch (e) { console.log('Backend history failed, using local'); }
      }
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
      if (!url.match(/^https?:\/\//i)) url = 'https://' + url;
      try { new URL(url); } catch { this.error = 'Please enter a valid URL'; return; }

      this.currentTab = 'analyze';
      this.isLoading = true; this.error = ''; this.analysisResult = null;

      // Method 1: Backend API (best - server-side fetch, no CORS)
      try {
        const ctrl0 = new AbortController();
        const tid0 = setTimeout(() => ctrl0.abort(), 10000);
        const res = await fetch(`${API_BASE}/api/analyze`, {
          method: 'POST', headers: this.getAuthHeaders(),
          body: JSON.stringify({ url }),
          signal: ctrl0.signal
        });
        clearTimeout(tid0);
        const json = await res.json();
        if (json.success && json.data) {
          this.analysisResult = json.data.analysis || json.data;
          this.saveToHistory({ url, score: this.analysisResult.score, createdAt: new Date().toISOString() });
          if (this.user) { this.user.analysesCount = (this.user.analysesCount || 0) + 1; localStorage.setItem('seo_user', JSON.stringify(this.user)); }
          this.isLoading = false;
          this.$nextTick(() => { lucide.createIcons() });
          return;
        }
        if (json.error) throw new Error(json.error);
      } catch (e) { console.log('Backend API failed, trying fallback:', e.message); }

      // Method 2: Netlify function fallback
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
      } catch (e) { console.log('Netlify function failed:', e.message); }

      // Method 3: CORS proxy fallback
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
        const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
        const viewport = doc.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
        const h1 = [...doc.querySelectorAll('h1')].map(el => el.textContent.trim()).filter(Boolean);
        const h2 = [...doc.querySelectorAll('h2')].map(el => el.textContent.trim()).filter(Boolean);
        const h3 = [...doc.querySelectorAll('h3')].map(el => el.textContent.trim()).filter(Boolean);
        const images = [...doc.querySelectorAll('img')].map(el => ({ alt: el.getAttribute('alt') || '' }));
        const textContent = doc.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
        const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
        const imagesWithoutAlt = images.filter(img => !img.alt).length;
        const imagesWithAlt = images.length - imagesWithoutAlt;
        const linkCount = [...doc.querySelectorAll('a')].length;
        const htmlEl = doc.querySelector('html');
        const lang = htmlEl?.getAttribute('lang') || null;

        const issues = [];
        const passed = [];
        let score = 100;

        if (!title) { issues.push({ type: 'error', category: 'Title', message: 'Missing page title', suggestion: 'Add a title between 50-60 characters' }); score -= 12; }
        else { passed.push('Title tag present'); if (title.length < 30) { issues.push({ type: 'warning', category: 'Title', message: `Title too short (${title.length} chars)`, suggestion: 'Aim for 50-60 characters' }); score -= 4; } else if (title.length > 60) { issues.push({ type: 'warning', category: 'Title', message: `Title too long (${title.length} chars)`, suggestion: 'Keep under 60 characters' }); score -= 3; } else { passed.push('Title length is perfect'); } }
        if (!metaDesc) { issues.push({ type: 'error', category: 'Meta Description', message: 'Missing meta description', suggestion: 'Add a description 150-160 chars' }); score -= 10; }
        else { passed.push('Meta description present'); if (metaDesc.length < 120) { issues.push({ type: 'warning', category: 'Meta Description', message: `Too short (${metaDesc.length} chars)`, suggestion: 'Aim for 150-160 characters' }); score -= 3; } else if (metaDesc.length > 160) { issues.push({ type: 'info', category: 'Meta Description', message: `Slightly long (${metaDesc.length} chars)`, suggestion: 'Keep under 160 characters' }); score -= 2; } else { passed.push('Meta description length is good'); } }
        if (h1.length === 0) { issues.push({ type: 'error', category: 'Headings', message: 'No H1 tag found', suggestion: 'Add exactly one H1 tag' }); score -= 10; } else { passed.push('H1 tag present'); if (h1.length > 1) { issues.push({ type: 'warning', category: 'Headings', message: `Multiple H1 tags (${h1.length})`, suggestion: 'Use only one H1 per page' }); score -= 3; } }
        if (h2.length === 0 && h1.length > 0) { issues.push({ type: 'info', category: 'Headings', message: 'No H2 tags', suggestion: 'Add H2 subheadings to organize content' }); score -= 2; } else if (h2.length > 0) { passed.push('H2 subheadings present'); }
        if (h3.length > 0) passed.push('Good heading hierarchy (H3)');
        if (images.length === 0) { issues.push({ type: 'info', category: 'Images', message: 'No images found', suggestion: 'Add relevant images for better engagement' }); score -= 2; } else { if (imagesWithoutAlt > 0) { issues.push({ type: 'warning', category: 'Images', message: `${imagesWithoutAlt} image(s) missing alt text`, suggestion: 'Add alt text to all images' }); score -= Math.min(imagesWithoutAlt * 2, 6); } if (imagesWithAlt > 0) passed.push(`${imagesWithAlt} image(s) with alt text`); }
        if (!ogTitle) { issues.push({ type: 'info', category: 'Social', message: 'Missing og:title', suggestion: 'Add for better social sharing' }); score -= 2; } else { passed.push('og:title present'); }
        if (!ogDesc) { issues.push({ type: 'info', category: 'Social', message: 'Missing og:description', suggestion: 'Add for social previews' }); score -= 2; } else { passed.push('og:description present'); }
        if (!ogImage) { issues.push({ type: 'info', category: 'Social', message: 'Missing og:image', suggestion: 'Add an image for social previews' }); score -= 2; } else { passed.push('og:image present'); }
        if (!canonical) { issues.push({ type: 'info', category: 'Technical', message: 'No canonical URL', suggestion: 'Add canonical link' }); score -= 2; } else { passed.push('Canonical URL set'); }
        if (!viewport) { issues.push({ type: 'warning', category: 'Technical', message: 'Missing viewport meta', suggestion: 'Add viewport for mobile responsiveness' }); score -= 3; } else { passed.push('Viewport meta tag present'); }
        if (!lang) { issues.push({ type: 'info', category: 'Technical', message: 'Missing lang attribute on <html>', suggestion: 'Add lang="en" for accessibility' }); score -= 1; } else { passed.push('Language attribute set'); }
        if (wordCount < 150) { issues.push({ type: 'warning', category: 'Content', message: `Very thin content (${wordCount} words)`, suggestion: 'Aim for 300+ words' }); score -= 4; } else if (wordCount < 300) { issues.push({ type: 'info', category: 'Content', message: `Light content (${wordCount} words)`, suggestion: 'Consider adding more detailed content' }); score -= 2; } else if (wordCount > 500) { passed.push(`Good content length (${wordCount} words)`); }
        if (linkCount === 0) { issues.push({ type: 'info', category: 'Links', message: 'No links found', suggestion: 'Add internal and external links' }); score -= 2; } else { passed.push(`${linkCount} links found`); }

        score = Math.max(0, Math.min(100, score));

        const recs = [];
        if (!title) recs.push('Add a clear, descriptive title tag (50-60 chars)');
        else if (title.length < 50) recs.push('Expand your title to 50-60 characters');
        if (!metaDesc) recs.push('Write a compelling meta description (150-160 chars)');
        else if (metaDesc.length < 150) recs.push('Expand meta description to 150-160 characters');
        if (h1.length === 0) recs.push('Add one H1 tag with your main keyword');
        if (h2.length === 0) recs.push('Use H2 subheadings to organize your content');
        if (imagesWithoutAlt > 0) recs.push('Add descriptive alt text to all images');
        if (!ogTitle || !ogDesc) recs.push('Add Open Graph tags for social sharing');
        if (!canonical) recs.push('Add a canonical URL');
        if (wordCount < 300) recs.push('Expand content to 300+ words');
        if (!viewport) recs.push('Add viewport meta tag for mobile optimization');
        if (recs.length === 0) recs.push('Your page is well optimized! Keep monitoring.');

        return { url, score, issues, passed, stats: { titleLength: title.length, metaDescLength: metaDesc.length, h1Count: h1.length, h2Count: h2.length, h3Count: h3.length, linkCount, imageCount: images.length, imagesWithoutAlt, imagesWithAlt, wordCount, hasOgTitle: !!ogTitle, hasOgDesc: !!ogDesc, hasOgImage: !!ogImage, hasCanonical: !!canonical, hasViewport: !!viewport, lang }, recommendations: recs };
      } catch (e) {
        return { url, score: 0, issues: [{ type: 'error', category: 'Error', message: 'Could not parse HTML', suggestion: 'Check if HTML is valid' }], passed: [], stats: { titleLength: 0, metaDescLength: 0, h1Count: 0, h2Count: 0, h3Count: 0, linkCount: 0, imageCount: 0, imagesWithoutAlt: 0, imagesWithAlt: 0, wordCount: 0, hasOgTitle: false, hasOgDesc: false, hasOgImage: false, hasCanonical: false, hasViewport: false, lang: null }, recommendations: [] };
      }
    },

    // Content Optimization
    async optimizeContent(type) {
      if (!this.contentInput) return;
      this.isLoading = true; this.error = ''; this.contentResult = null;

      // Try backend API first (real AI) - 10s timeout
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 10000);
        const res = await fetch(`${API_BASE}/api/optimize`, {
          method: 'POST', headers: this.getAuthHeaders(),
          body: JSON.stringify({ content: this.contentInput, type }),
          signal: ctrl.signal
        });
        clearTimeout(tid);
        const json = await res.json();
        if (json.success && json.data) {
          this.contentResult = { type, ...json.data };
          this.isLoading = false;
          this.$nextTick(() => { lucide.createIcons() });
          return;
        }
      } catch (e) { console.log('Backend optimize failed, using local:', e.message); }

      // Fallback: client-side logic
      const content = this.contentInput;
      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const avgWordsPerSentence = sentences.length > 0 ? Math.round(wordCount / sentences.length) : 0;

      const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','can','shall','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','both','each','few','more','most','other','some','such','no','not','only','own','same','so','than','too','very','just','because','but','and','or','if','while','about','up','its','it','this','that','these','those','i','me','my','we','our','you','your','he','him','his','she','her','they','them','their','what','which','who','whom','welcome','page','post','blog','site','website','come','right','place','look','looking','find','found','read','reading','hello','hi','hey','new','old','like','want','need','get','got','make','made','know','think','see','say','said','go','going','come','coming','take','give','use','used','tell','ask','work','seem','feel','try','leave','call','keep','let','begin','show','hear','play','run','move','live','believe','hold','bring','happen','write','provide','sit','stand','lose','pay','meet','include','continue','learn','change','lead','understand','watch','follow','stop','create','speak','read','allow','add','spend','grow','open','walk','win','offer','remember','love','consider','appear','buy','wait','serve','die','send','expect','build','stay','fall','cut','reach','kill','remain','suggest','raise','pass','sell','require','report','decide','pull']);
      const words = content.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
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

        // Generate genuinely improved version
        let improved = content;

        // 1. Fix grammar issues
        improved = improved.replace(/\.\s*([a-z])/g, '. $1'); // space after period
        improved = improved.replace(/\bi\b/g, 'I'); // capitalize I
        improved = improved.replace(/\bi\s/g, 'I '); // capitalize I at word start

        // 2. Fix sentence capitalization
        improved = improved.replace(/(^|[.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase());

        // 3. Fix double spaces and punctuation
        improved = improved.replace(/\s{2,}/g, ' ');
        improved = improved.replace(/\.,/g, '.');
        improved = improved.replace(/,,/g, ',');
        improved = improved.replace(/\s+\./g, '.');

        // 4. Split into sentences for rewriting
        let rawSentences = improved.match(/[^.!?]+[.!?]+/g) || [improved];
        rawSentences = rawSentences.map(s => s.trim()).filter(s => s.length > 0);

        // 5. Rewrite weak/boring sentences
        const rewritten = rawSentences.map(s => {
          let r = s;
          const rl = r.toLowerCase();

          // Handle "page.i" type issues (period stuck to word)
          r = r.replace(/\.([A-Za-z])/g, '. $1');

          // "Welcome to my page" type → more engaging
          if (rl.match(/^welcome to my (page|blog|site|website)/)) {
            r = r.replace(/^(welcome to my (page|blog|site|website))/i, 'Welcome');
          }
          if (rl.match(/^welcome to my (page|blog|site|website)\.?$/i)) {
            return ''; // skip standalone "Welcome to my page." - will be replaced by intro
          }
          r = r.replace(/^(welcome to (my )?(page|blog|site|website))\.?\s*/i, '');

          // Fix "i post about" → better phrasing
          r = r.replace(/\bi (post|write|share|talk|discuss) about\b/gi, 'We cover');
          r = r.replace(/\bi (am|'m) (a|an) (blogger|writer|author|creator|content creator)/gi, 'As a professional content creator, I specialize in');

          // "page.i" type fix (already handled above)

          // Make statements more engaging
          r = r.replace(/^this is (a|my)/i, 'This comprehensive guide covers');
          r = r.replace(/^here is (a|my)/i, 'Below you will find');
          r = r.replace(/^here are/i, 'Below you will find');
          r = r.replace(/^i am/i, 'As a professional, I');
          r = r.replace(/^we are/i, 'Our team of experts');

          // Clean up
          r = r.trim();
          r = r.replace(/^\.\s*/, '');
          r = r.replace(/\s{2,}/g, ' ');
          if (r && !r.match(/[.!?]$/)) r += '.';

          return r;
        }).filter(s => s.length > 0);

        // 6. Rebuild improved content
        let finalSentences = [];

        // Detect topic phrase (try to find a meaningful 2-3 word phrase)
        let topicPhrase = mainKeyword;
        const contentLower = content.toLowerCase();
        // Try to find "about X" or "on X" phrases
        const topicMatch = contentLower.match(/(?:about|on|regarding|concerning|covering)\s+([a-z]+(?:\s+[a-z]+){0,2})/);
        if (topicMatch && topicMatch[1].split(' ').some(w => w.length > 3 && !stopWords.has(w))) {
          topicPhrase = topicMatch[1].trim();
        }

        // Add engaging intro
        if (topicPhrase && topicPhrase.length > 3) {
          finalSentences.push(`Discover everything you need to know about ${topicPhrase}.`);
        }

        // Add rewritten sentences
        finalSentences.push(...rewritten);

        // Add engaging conclusion
        if (topicPhrase && topicPhrase.length > 3) {
          finalSentences.push(`Stay updated with the latest ${topicPhrase} insights and expert analysis.`);
        }

        // 7. Build final content with paragraph breaks
        if (finalSentences.length > 4) {
          const mid = Math.ceil(finalSentences.length / 2);
          const firstHalf = finalSentences.slice(0, mid).join(' ');
          const secondHalf = finalSentences.slice(mid).join(' ');
          improved = firstHalf + '\n\n' + secondHalf;
        } else {
          improved = finalSentences.join(' ');
        }

        // 8. Final cleanup
        improved = improved.replace(/\s+/g, ' ').trim();
        if (improved.length > 0 && !improved.match(/[.!?]$/)) improved += '.';
        improved = improved.charAt(0).toUpperCase() + improved.slice(1);

        result = {
          score: Math.min(95, Math.max(15, score)),
          details,
          optimizedVersion: improved,
          keywordsFound: topWords.slice(0, 5),
          changes: [
            'Fixed grammar and punctuation',
            `Rewrote weak sentences for engagement`,
            mainKeyword && !content.toLowerCase().includes(mainKeyword) ? `Added "${mainKeyword}" keyword naturally` : `Used "${topicPhrase || mainKeyword}" as primary keyword`,
            improved.split('\n\n').length > 1 ? 'Added paragraph breaks for readability' : 'Improved text structure',
            'Removed double spaces and fixed formatting',
            'Added engaging introduction and conclusion'
          ],
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

    // Keyword Research
    async researchKeywords() {
      if (!this.keywordInput) return;
      this.isLoading = true; this.error = ''; this.keywordResult = null;

      // Try backend API first (real AI keywords) - 10s timeout
      try {
        const ctrl2 = new AbortController();
        const tid2 = setTimeout(() => ctrl2.abort(), 10000);
        const res = await fetch(`${API_BASE}/api/keywords`, {
          method: 'POST', headers: this.getAuthHeaders(),
          body: JSON.stringify({ topic: this.keywordInput, count: 10 }),
          signal: ctrl2.signal
        });
        clearTimeout(tid2);
        const json = await res.json();
        if (json.success && json.data) {
          this.keywordResult = json.data;
          this.isLoading = false;
          this.$nextTick(() => { lucide.createIcons() });
          return;
        }
      } catch (e) { console.log('Backend keywords failed, using local:', e.message); }

      // Fallback: local keyword generation
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

    async checkPageSpeed() {
      if (!this.urlInput) return;
      this.isLoading = true; this.error = ''; this.pageSpeedResult = null;
      try {
        const res = await fetch(`/api/pagespeed?url=${encodeURIComponent(this.urlInput)}`);
        const data = await res.json();
        if (data.success) this.pageSpeedResult = data.data;
        else this.error = data.error;
      } catch (e) { this.error = 'Failed to test page speed'; }
      this.isLoading = false;
    },

    async checkBacklinks() {
      if (!this.urlInput) return;
      this.isLoading = true; this.error = ''; this.backlinkResult = null;
      try {
        const res = await fetch(`/api/backlinks?url=${encodeURIComponent(this.urlInput)}`);
        const data = await res.json();
        if (data.success) this.backlinkResult = data.data;
        else this.error = data.error;
      } catch (e) { this.error = 'Failed to check backlinks'; }
      this.isLoading = false;
    },

    generateSchema() {
      let schema = {};
      if (this.schemaType === 'article') {
        schema = { "@context": "https://schema.org", "@type": "Article", "headline": this.schemaData.headline || "", "author": { "@type": "Person", "name": this.schemaData.author || "" }, "datePublished": this.schemaData.datePublished || "", "description": this.schemaData.description || "" };
      } else if (this.schemaType === 'product') {
        schema = { "@context": "https://schema.org", "@type": "Product", "name": this.schemaData.name || "", "description": this.schemaData.description || "", "brand": { "@type": "Brand", "name": this.schemaData.brand || "" }, "offers": { "@type": "Offer", "price": this.schemaData.price || "", "priceCurrency": "INR" } };
      } else if (this.schemaType === 'faq') {
        const faqs = (this.schemaData.faqs || []).filter(f => f.q && f.a);
        schema = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs.map(f => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })) };
      } else if (this.schemaType === 'localbusiness') {
        schema = { "@context": "https://schema.org", "@type": "LocalBusiness", "name": this.schemaData.name || "", "address": { "@type": "PostalAddress", "streetAddress": this.schemaData.address || "" }, "telephone": this.schemaData.phone || "" };
      }
      this.generatedSchema = JSON.stringify(schema, null, 2);
    },

    copySchema() {
      navigator.clipboard.writeText(this.generatedSchema);
    },

    addFaqItem() {
      if (!this.schemaData.faqs) this.schemaData.faqs = [];
      this.schemaData.faqs.push({q:'', a:''});
    },

    removeFaqItem(idx) {
      if (this.schemaData.faqs && this.schemaData.faqs.length > 1) {
        this.schemaData.faqs.splice(idx, 1);
      }
    },

    async checkReadability() {
      if (!this.readabilityInput) return;
      this.isLoading = true; this.error = ''; this.readabilityResult = null;
      try {
        const res = await fetch('/api/readability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: this.readabilityInput }) });
        const data = await res.json();
        if (data.success) this.readabilityResult = data.data;
        else this.error = data.error;
      } catch (e) { this.error = 'Failed to check readability'; }
      this.isLoading = false;
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

      // Changes made
      if (this.contentResult.changes?.length) {
        html += '<div class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"><p class="text-emerald-400 font-medium mb-2">Changes Made</p><ul class="space-y-1">';
        this.contentResult.changes.forEach(c => { html += `<li class="flex items-start gap-2 text-slate-300"><span class="text-emerald-400">&#10003;</span>${c}</li>` });
        html += '</ul></div>';
      }

      html += '</div>';
      return html;
    },

    downloadPDF() {
      if (!this.analysisResult) return;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const r = this.analysisResult;
      let y = 20;

      doc.setFontSize(22);
      doc.setTextColor(99, 102, 241);
      doc.text('SEOBoost - SEO Report', 20, y);
      y += 10;

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('Generated: ' + new Date().toLocaleDateString(), 20, y);
      y += 6;
      doc.text('URL: ' + (r.url || 'N/A'), 20, y);
      y += 10;

      doc.setDrawColor(99, 102, 241);
      doc.line(20, y, 190, y);
      y += 10;

      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text('Overall Score: ' + r.score + ' / 100', 20, y);
      y += 10;

      doc.setFontSize(12);
      doc.setTextColor(60);
      doc.text('Statistics', 20, y);
      y += 8;
      doc.setFontSize(10);
      const stats = [
        ['Title Length', r.stats.titleLength],
        ['Meta Description Length', r.stats.metaDescLength],
        ['Word Count', r.stats.wordCount],
        ['H1 Tags', r.stats.h1Count],
        ['Images', r.stats.imageCount],
        ['Links', r.stats.linkCount],
      ];
      stats.forEach(([label, val]) => {
        doc.text(label + ': ' + val, 25, y);
        y += 6;
      });
      y += 4;

      if (r.passed && r.passed.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(16, 185, 129);
        doc.text('Passed Checks (' + r.passed.length + ')', 20, y);
        y += 8;
        doc.setFontSize(9);
        doc.setTextColor(60);
        r.passed.forEach(c => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text('[PASS] ' + c, 25, y);
          y += 5;
        });
        y += 4;
      }

      if (r.issues && r.issues.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(220, 38, 38);
        doc.text('Issues Found (' + r.issues.length + ')', 20, y);
        y += 8;
        doc.setFontSize(9);
        r.issues.forEach(issue => {
          if (y > 270) { doc.addPage(); y = 20; }
          const icon = issue.type === 'error' ? '[ERROR]' : issue.type === 'warning' ? '[WARN]' : '[INFO]';
          doc.setTextColor(issue.type === 'error' ? 220 : issue.type === 'warning' ? 200 : 50, issue.type === 'error' ? 38 : issue.type === 'warning' ? 150 : 100, issue.type === 'error' ? 38 : 30);
          doc.text(icon + ' ' + issue.category + ' - ' + issue.message, 25, y);
          y += 5;
          doc.setTextColor(100);
          const suggestion = doc.splitTextToSize('Fix: ' + issue.suggestion, 160);
          suggestion.forEach(line => { doc.text(line, 30, y); y += 4; });
          y += 2;
        });
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('SEOBoost Report | Page ' + i + ' of ' + pageCount, 105, 290, { align: 'center' });
      }

      const host = r.url ? new URL(r.url).hostname.replace('www.', '') : 'website';
      doc.save('SEO-Report-' + host + '.pdf');
    }
  };
}
