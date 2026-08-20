const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  originalContent: { type: String, required: true },
  type: { type: String, enum: ['analyze', 'meta', 'improve'], required: true },
  result: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Content', contentSchema);
