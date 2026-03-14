const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const { pool } = require('./db');

async function initDb() {
  const sqlPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await pool.query(sql);
    console.log('Database schema initialized.');
  } catch (error) {
    console.error('Failed to initialize database schema:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

initDb();
