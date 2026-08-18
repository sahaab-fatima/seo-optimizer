exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { content, type } = JSON.parse(event.body);
    if (!content) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Content is required' }) };

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
      const desc = content.substring(0, 150).trim() + '...';
      result = { title, description: desc, keywords: topWords.length > 0 ? topWords : ['seo', 'content', 'optimization'] };
    } else if (type === 'improve') {
      const score = Math.min(95, Math.max(25, (wordCount > 200 ? 20 : 10) + (wordCount > 500 ? 15 : 0) + (sentences > 5 ? 10 : 5) + (avgWordsPerSentence < 25 ? 15 : 5) + (topWords.length > 3 ? 15 : 5) + 20));
      result = {
        score,
        suggestions: [
          wordCount < 300 ? 'Increase content to at least 300 words' : 'Good content length',
          avgWordsPerSentence > 25 ? 'Shorten sentences for readability' : 'Good sentence length',
          topWords.length < 3 ? 'Add more relevant keywords' : 'Good keyword usage',
          'Add a compelling title tag (50-60 characters)',
          'Write a meta description (150-160 characters)',
          'Use H2 and H3 headings to organize content'
        ],
        optimizedVersion: content
      };
    } else {
      const score = Math.min(95, Math.max(25, (wordCount > 200 ? 20 : 10) + (wordCount > 500 ? 15 : 0) + (sentences > 5 ? 10 : 5) + (topWords.length > 3 ? 15 : 5) + 25));
      result = {
        overallScore: score,
        strengths: [
          wordCount > 200 ? `Good content length (${wordCount} words)` : `Content length: ${wordCount} words`,
          topWords.length > 3 ? 'Multiple relevant keywords found' : 'Some keywords present',
          sentences > 3 ? 'Good content structure' : 'Content exists'
        ],
        weaknesses: [
          wordCount < 300 ? 'Content too short - aim for 300+ words' : null,
          avgWordsPerSentence > 25 ? 'Sentences too long - keep under 20 words' : null,
          topWords.length < 3 ? 'Not enough keyword variety' : null
        ].filter(Boolean),
        recommendations: [
          'Add target keyword in first 100 words',
          'Use H2 headings every 200-300 words',
          'Add internal links to related content',
          'Include at least one external authority link',
          'Add alt text to all images',
          'Write a meta description between 150-160 characters'
        ]
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: result }) };
  } catch (error) {
    console.error('Optimization error:', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Failed to optimize content' }) };
  }
};
