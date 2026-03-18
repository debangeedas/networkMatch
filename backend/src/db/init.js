const fs = require('fs');
const path = require('path');
const { pool } = require('./index');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(schema);
    console.log('Database schema initialized successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
}

initDb();
