const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  url: { type: String, required: true },
  score: { type: Number, required: true },
  issues: [{
    type: { type: String, enum: ['error', 'warning', 'info'] },
    category: String,
    message: String,
    suggestion: String
  }],
  stats: {
    titleLength: Number,
    metaDescLength: Number,
    h1Count: Number,
    h2Count: Number,
    linkCount: Number,
    imageCount: Number,
    wordCount: Number
  },
  recommendations: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Analysis', analysisSchema);
