const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');
const Content = require('../models/Content');
const Keyword = require('../models/Keyword');

router.get('/analyses', async (req, res) => {
  try {
    const data = await Analysis.find().sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/contents', async (req, res) => {
  try {
    const data = await Content.find().sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/keywords', async (req, res) => {
  try {
    const data = await Keyword.find().sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
