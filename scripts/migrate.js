const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function runMigration() {
  try {
    // Debug: Check if DATABASE_URL is loaded
    console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'Yes' : 'No');

    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL not found in environment variables');
      console.log('Make sure .env.local exists with DATABASE_URL');
      return;
    }

    const schemaPath = path.join(__dirname, '../lib/schema.sql');

    // Check if schema file exists
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ Schema file not found:', schemaPath);
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('🚀 Running migration...');
    console.log('📁 Schema file:', schemaPath);

    await pool.query(schema);
    console.log('✅ Schema executed successfully!');
  } catch (error) {
    console.error('❌ Error executing schema:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
