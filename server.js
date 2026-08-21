require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, initDB } = require('./server/db');

const authRoutes = require('./server/routes/auth');
const analyzeRoutes = require('./server/routes/analyze');
const optimizeRoutes = require('./server/routes/optimize');
const keywordsRoutes = require('./server/routes/keywords');
const historyRoutes = require('./server/routes/history');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let dbConnected = false;

async function connectDB() {
  if (dbConnected) return;
  try {
    await initDB();
    dbConnected = true;
    console.log('Connected to Neon PostgreSQL');
  } catch (err) {
    dbConnected = false;
    console.log('Database unavailable:', err.message);
  }
}

connectDB();

app.get('/api/health', async (req, res) => {
  if (!dbConnected) await connectDB();
  res.json({ status: 'ok', db: dbConnected, timestamp: new Date().toISOString() });
});

app.use('/api', async (req, res, next) => {
  if (!dbConnected) await connectDB();
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/optimize', optimizeRoutes);
app.use('/api/keywords', keywordsRoutes);
app.use('/api/history', historyRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
