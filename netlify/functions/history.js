const { connectDB, Analysis, Content, Keyword } = require('./db');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    await connectDB();
    const path = event.path.split('/').pop();

    let data;
    if (path === 'analyses') data = await Analysis.find().sort({ createdAt: -1 }).limit(20);
    else if (path === 'contents') data = await Content.find().sort({ createdAt: -1 }).limit(20);
    else if (path === 'keywords') data = await Keyword.find().sort({ createdAt: -1 }).limit(20);
    else return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
