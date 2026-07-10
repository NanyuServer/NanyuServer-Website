// Database initialization for Neon PostgreSQL
const { Pool } = require('@neondatabase/serverless');

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      console.error('DATABASE_URL environment variable not set. Using local file storage.');
      return null;
    }
    
    pool = new Pool({ connectionString });
  }
  return pool;
}

async function initializeDatabase() {
  const pool = getPool();
  if (!pool) return false;
  
  try {
    const client = await pool.connect();
    
    // Create feedback table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        reply TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create index for status filtering
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
    `);
    
    client.release();
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Database initialization failed:', error);
    return false;
  }
}

async function queryDatabase(query, params = []) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not configured');
  }
  
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

module.exports = {
  getPool,
  initializeDatabase,
  queryDatabase
};
