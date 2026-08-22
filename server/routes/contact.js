const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'Name, email and message are required' });

    await pool.query(
      'CREATE TABLE IF NOT EXISTS contacts (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), subject VARCHAR(500), message TEXT, created_at TIMESTAMP DEFAULT NOW())'
    );
    await pool.query(
      'INSERT INTO contacts (name, email, subject, message) VALUES ($1, $2, $3, $4)',
      [name, email, subject || '', message]
    );
    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
