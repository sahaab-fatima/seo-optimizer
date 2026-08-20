const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  url: { type: String, required: true },
  score: { type: Number, required: true },
  issues: [{
    type: { type: String, enum: ['error', 'warning', 'info'] },
    category: String,
    message: String,
    suggestion: String
  }],
  passed: [String],
  stats: {
    titleLength: Number,
    metaDescLength: Number,
    h1Count: Number,
    h2Count: Number,
    linkCount: Number,
    imageCount: Number,
    imagesWithoutAlt: Number,
    wordCount: Number
  },
  recommendations: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Analysis', analysisSchema);
