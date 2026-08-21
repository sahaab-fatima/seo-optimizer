const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'seo-boost-secret-key-2024';

function getUserId(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId;
  } catch { return null; }
}

// Get analyses history
router.get('/analyses', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.json({ success: true, data: [] });
    const result = await pool.query('SELECT * FROM analyses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId]);
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Get contents history
router.get('/contents', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.json({ success: true, data: [] });
    const result = await pool.query('SELECT * FROM contents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId]);
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Get keywords history
router.get('/keywords', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.json({ success: true, data: [] });
    const result = await pool.query('SELECT * FROM keywords WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId]);
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
