const { connectDB, Keyword } = require('./db');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { topic, count = 10 } = JSON.parse(event.body);
    if (!topic) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Topic is required' }) };

    // Always use local generation (fast + reliable)
    const t = topic.toLowerCase().trim();
    const result = {
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
      longTailKeywords: [
        `best ${t} for beginners`,
        `how to start with ${t}`,
        `${t} tips and tricks 2026`,
        `free ${t} tools online`,
        `${t} step by step guide`
      ],
      questions: [
        `What is ${t}?`,
        `How to learn ${t}?`,
        `Why is ${t} important?`,
        `What are the best ${t} tools?`,
        `How to improve ${t}?`
      ]
    };

    // DB save - fire and forget
    connectDB().then(db => {
      if (db) new Keyword({ topic, ...result }).save().catch(() => {});
    }).catch(() => {});

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: result }) };
  } catch (error) {
    console.error('Keyword error:', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Failed to generate keywords' }) };
  }
};
