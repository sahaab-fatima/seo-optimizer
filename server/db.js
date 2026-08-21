const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        plan VARCHAR(50) DEFAULT 'free',
        analyses_count INTEGER DEFAULT 0,
        analyses_limit INTEGER DEFAULT 10,
        payment_id VARCHAR(255),
        plan_activated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS analyses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        url TEXT,
        score INTEGER,
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS contents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        original_text TEXT,
        result JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS keywords (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        topic TEXT,
        result JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('PostgreSQL tables created/verified');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
