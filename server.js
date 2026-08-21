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

// MongoDB Connection
let dbConnected = false;
const MONGODB_URI = process.env.MONGODB_URI;

function connectDB() {
  if (dbConnected) return Promise.resolve();
  if (!MONGODB_URI) {
    console.log('No MONGODB_URI found - running without database');
    return Promise.resolve();
  }
  return mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 8000,
    connectTimeoutMS: 8000
  }).then(() => {
    dbConnected = true;
    console.log('Connected to MongoDB Atlas');
  }).catch(err => {
    dbConnected = false;
    console.log('MongoDB connection failed:', err.message);
  });
}

// Connect on startup
connectDB();

// Make db status available to routes
app.get('/api/health', async (req, res) => {
  await connectDB();
  res.json({ status: 'ok', db: dbConnected, timestamp: new Date().toISOString() });
});

// Ensure DB connection before API routes
app.use('/api', async (req, res, next) => {
  await connectDB();
  next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

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

// For local development
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;
