const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'seo-boost-secret-key-2024';

function isDbReady() {
  try { pool && pool.totalCount !== undefined; return true; } catch { return false; }
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, plan, analyses_count, analyses_limit',
      [name, email.toLowerCase(), hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { ...user, analysesCount: user.analyses_count, analysesLimit: user.analyses_limit } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...safeUser } = user;
    res.json({ success: true, token, user: { ...safeUser, analysesCount: safeUser.analyses_count, analysesLimit: safeUser.analyses_limit } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});

// Get Profile
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT id, name, email, plan, analyses_count, analyses_limit FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({ success: true, user: { ...u, analysesCount: u.analyses_count, analysesLimit: u.analyses_limit } });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Upgrade Plan
router.post('/upgrade', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    const { plan, paymentId } = req.body;
    if (!plan || !['basic', 'pro'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });

    const limits = { free: 10, basic: 100, pro: 99999 };
    const result = await pool.query(
      'UPDATE users SET plan = $1, analyses_limit = $2, payment_id = $3, plan_activated_at = NOW() WHERE id = $4 RETURNING id, name, email, plan, analyses_count, analyses_limit',
      [plan, limits[plan], paymentId, decoded.userId]
    );

    const u = result.rows[0];
    res.json({ success: true, user: { ...u, analysesCount: u.analyses_count, analysesLimit: u.analyses_limit } });
  } catch (error) {
    console.error('Upgrade error:', error);
    res.status(500).json({ error: error.message || 'Upgrade failed' });
  }
});

module.exports = router;
