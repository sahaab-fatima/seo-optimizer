const mongoose = require('mongoose');

let cached = null;

async function connectDB() {
  if (cached && mongoose.connection.readyState === 1) return cached;
  await mongoose.connect(process.env.MONGODB_URI);
  cached = mongoose;
  return cached;
}

const analysisSchema = new mongoose.Schema({
  url: String, score: Number,
  issues: [{ type: { type: String }, category: String, message: String, suggestion: String }],
  stats: { titleLength: Number, metaDescLength: Number, h1Count: Number, h2Count: Number, linkCount: Number, imageCount: Number, wordCount: Number },
  recommendations: [String],
  createdAt: { type: Date, default: Date.now }
});

const contentSchema = new mongoose.Schema({
  originalContent: String, type: String, result: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

const keywordSchema = new mongoose.Schema({
  topic: String,
  keywords: [{ keyword: String, searchVolume: String, difficulty: String, relevance: Number }],
  longTailKeywords: [String], questions: [String],
  createdAt: { type: Date, default: Date.now }
});

const Analysis = mongoose.models.Analysis || mongoose.model('Analysis', analysisSchema);
const Content = mongoose.models.Content || mongoose.model('Content', contentSchema);
const Keyword = mongoose.models.Keyword || mongoose.model('Keyword', keywordSchema);

module.exports = { connectDB, Analysis, Content, Keyword };
