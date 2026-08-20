require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./server/routes/auth');
const analyzeRoutes = require('./server/routes/analyze');
const optimizeRoutes = require('./server/routes/optimize');
const keywordsRoutes = require('./server/routes/keywords');
const historyRoutes = require('./server/routes/history');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection (with timeout and graceful fallback)
let dbConnected = false;
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 5000,
  connectTimeoutMS: 5000
})
  .then(() => { dbConnected = true; console.log('Connected to MongoDB Atlas'); })
  .catch(err => { dbConnected = false; console.log('MongoDB unavailable - running without database. History and auth disabled.'); });

// Make db status available to routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: dbConnected, timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/optimize', optimizeRoutes);
app.use('/api/keywords', keywordsRoutes);
app.use('/api/history', historyRoutes);

// Serve Frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
