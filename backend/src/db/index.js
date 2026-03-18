const { Pool } = require('pg');
require('dotenv').config();

// Supabase (and most hosted Postgres) requires SSL.
// Keep local installs working by only enabling SSL when the URL looks hosted.
const isHostedDb =
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.includes('supabase') ||
    process.env.NODE_ENV === 'production');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isHostedDb ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
