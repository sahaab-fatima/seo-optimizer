const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');
const Content = require('../models/Content');
const Keyword = require('../models/Keyword');
const auth = require('../middleware/auth');

// Get user's analysis history
router.get('/analyses', auth, async (req, res) => {
  try {
    const data = await Analysis.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's content history
router.get('/contents', auth, async (req, res) => {
  try {
    const data = await Content.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's keyword history
router.get('/keywords', auth, async (req, res) => {
  try {
    const data = await Keyword.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete single analysis
router.delete('/analyses/:id', auth, async (req, res) => {
  try {
    await Analysis.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all history
router.delete('/clear', auth, async (req, res) => {
  try {
    await Analysis.deleteMany({ userId: req.userId });
    await Content.deleteMany({ userId: req.userId });
    await Keyword.deleteMany({ userId: req.userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
