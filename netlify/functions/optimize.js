const { connectDB, Content } = require('./db');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { content, type } = JSON.parse(event.body);
    if (!content) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Content is required' }) };

    // Try AI API first
    let result;
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.xiaomimimo.com/v1',
        timeout: 20000
      });

      let systemPrompt = '';
      let userPrompt = '';
      if (type === 'meta') {
        systemPrompt = 'Return only valid JSON. No markdown. No code blocks.';
        userPrompt = `Generate SEO meta tags for this content. Return JSON: {"title":"max 60 chars","description":"max 160 chars","keywords":["word1","word2"]}`;
      } else if (type === 'improve') {
        systemPrompt = 'Return only valid JSON. No markdown. No code blocks.';
        userPrompt = `Rate this content SEO score 0-100 and suggest improvements. Return JSON: {"score":75,"suggestions":["tip1","tip2"],"optimizedVersion":"improved text here"}`;
      } else {
        systemPrompt = 'Return only valid JSON. No markdown. No code blocks.';
        userPrompt = `Analyze SEO of this content. Return JSON: {"overallScore":75,"strengths":["good1"],"weaknesses":["bad1"],"recommendations":["fix1"]}`;
      }

      const completion = await openai.chat.completions.create({
        model: 'mimo-v2.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt + '\n\nContent:\n' + content.substring(0, 3000) }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      const responseText = completion.choices[0].message.content || '{}';
      let cleanText = responseText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) { result = JSON.parse(jsonMatch[0]); }
    } catch (apiErr) {
      console.warn('AI API failed, using fallback:', apiErr.message);
    }

    // Fallback: basic analysis without AI
    if (!result) {
      const wordCount = content.split(/\s+/).length;
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
      const avgWordsPerSentence = sentences > 0 ? Math.round(wordCount / sentences) : 0;

      if (type === 'meta') {
        const firstSentence = content.split('.')[0].substring(0, 60);
        result = {
          title: firstSentence || 'Optimized Page Title',
          description: content.substring(0, 155) + '...',
          keywords: content.toLowerCase().split(/\s+/).filter((w, i, a) => a.indexOf(w) === i && w.length > 3).slice(0, 10)
        };
      } else if (type === 'improve') {
        result = {
          score: Math.min(100, Math.max(30, wordCount > 200 ? 70 : 50)),
          suggestions: [
            wordCount < 300 ? 'Add more content (at least 300 words)' : 'Good content length',
            'Add relevant keywords naturally',
            'Use headings to structure content',
            'Add internal and external links'
          ],
          optimizedVersion: content
        };
      } else {
        result = {
          overallScore: Math.min(100, Math.max(30, wordCount > 200 ? 65 : 45)),
          strengths: [
            wordCount > 100 ? 'Decent content length' : 'Content exists',
            content.includes('.') ? 'Proper punctuation' : 'Basic formatting'
          ],
          weaknesses: [
            wordCount < 300 ? 'Content too short' : 'Could be longer',
            'May need more keywords',
            'Add more headings'
          ],
          recommendations: [
            'Add target keywords in first paragraph',
            'Use H2 and H3 headings',
            'Add meta description',
            'Include internal links'
          ]
        };
      }
    }

    // DB save - fire and forget
    connectDB().then(db => {
      if (db) new Content({ originalContent: content.substring(0, 500), type, result }).save().catch(() => {});
    }).catch(() => {});

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: result }) };
  } catch (error) {
    console.error('Optimization error:', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Failed to optimize content' }) };
  }
};
