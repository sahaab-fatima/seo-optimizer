const { connectDB, Keyword } = require('./db');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { topic, count = 10 } = JSON.parse(event.body);
    if (!topic) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Topic is required' }) };

    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.xiaomimimo.com/v1',
      timeout: 25000
    });

    const completion = await openai.chat.completions.create({
      model: 'mimo-v2.5',
      messages: [
        { role: 'system', content: 'You are a keyword research expert. Return JSON with: keywords (array of {keyword, searchVolume: high/medium/low, difficulty: high/medium/low, relevance: 0-100}), longTailKeywords (array), questions (array). Only return valid JSON. Do not use markdown. Only raw JSON.' },
        { role: 'user', content: `Generate ${count} keyword ideas for: "${topic}"` }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const responseText = completion.choices[0].message.content || '{}';
    let result;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) { result = JSON.parse(jsonMatch[0]); } else { result = { keywords: [], longTailKeywords: [], questions: [] }; }

    // DB save - fire and forget, don't block response
    connectDB().then(db => {
      if (db) new Keyword({ topic, ...result }).save().catch(() => {});
    }).catch(() => {});

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: result }) };
  } catch (error) {
    console.error('Keyword error:', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Failed to generate keywords' }) };
  }
};
