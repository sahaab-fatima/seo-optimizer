const mongoose = require('mongoose');

const keywordSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  keywords: [{ keyword: String, searchVolume: String, difficulty: String, relevance: Number }],
  longTailKeywords: [String],
  questions: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Keyword', keywordSchema);
