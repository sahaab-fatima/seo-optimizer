const { connectDB, Content } = require('./db');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { content, type } = JSON.parse(event.body);
    if (!content) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Content is required' }) };

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1' });

    let systemPrompt = '';
    if (type === 'meta') {
      systemPrompt = 'You are an SEO expert. Generate optimized meta tags. Return JSON with: title (max 60 chars), description (max 160 chars), keywords (array of 5-10). Only return valid JSON.';
    } else if (type === 'improve') {
      systemPrompt = 'You are an SEO content optimizer. Return JSON with: score (0-100), suggestions (array), optimizedVersion (improved text). Only return valid JSON.';
    } else {
      systemPrompt = 'You are an SEO expert. Return JSON with: overallScore (0-100), strengths (array), weaknesses (array), recommendations (array). Only return valid JSON.';
    }

    const completion = await openai.chat.completions.create({
      model: 'mimo-v2.5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this content:\n\n${content.substring(0, 3000)}` }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const responseText = completion.choices[0].message.content || '{}';
    let result;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) { result = JSON.parse(jsonMatch[0]); } else { result = { raw: responseText }; }

    await connectDB();
    const saved = new Content({ originalContent: content.substring(0, 500), type, result });
    await saved.save();

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: result }) };
  } catch (error) {
    console.error('Optimization error:', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Failed to optimize content' }) };
  }
};
