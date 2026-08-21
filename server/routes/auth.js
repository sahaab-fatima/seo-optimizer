const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'seo-boost-secret-key-2024';

function isDbReady() {
  return require('mongoose').connection.readyState === 1;
}

// Register
router.post('/register', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'Database unavailable. Please try again later.' });
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already registered. Please login.' });

    const user = new User({ name, email, password });
    await user.save();
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ success: true, token, user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'Database unavailable. Please try again later.' });
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});

// Get Profile
router.get('/profile', auth, async (req, res) => {
  try { res.json({ success: true, user: req.user }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

// Upgrade Plan
router.post('/upgrade', auth, async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const { plan, paymentId } = req.body;
    if (!plan || !['basic', 'pro'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });

    const limits = { free: 10, basic: 100, pro: 99999 };
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.plan = plan;
    user.analysesLimit = limits[plan] || 10;
    user.paymentId = paymentId;
    user.planActivatedAt = new Date();
    await user.save();

    res.json({ success: true, user });
  } catch (error) {
    console.error('Upgrade error:', error);
    res.status(500).json({ error: error.message || 'Upgrade failed' });
  }
});

module.exports = router;
