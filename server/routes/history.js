const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');
const Content = require('../models/Content');
const Keyword = require('../models/Keyword');
const auth = require('../middleware/auth');

function isDbReady() {
  return require('mongoose').connection.readyState === 1;
}

router.get('/analyses', auth, async (req, res) => {
  if (!isDbReady()) return res.json({ success: true, data: [] });
  try {
    const data = await Analysis.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/contents', auth, async (req, res) => {
  if (!isDbReady()) return res.json({ success: true, data: [] });
  try {
    const data = await Content.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/keywords', auth, async (req, res) => {
  if (!isDbReady()) return res.json({ success: true, data: [] });
  try {
    const data = await Keyword.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
