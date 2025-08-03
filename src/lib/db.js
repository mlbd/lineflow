// lib/db.js
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export default pool;

// // lib/schema.sql
// -- Create logos table to cache Cloudinary data
// CREATE TABLE IF NOT EXISTS logos (
//   id SERIAL PRIMARY KEY,
//   public_id VARCHAR(500) UNIQUE NOT NULL,
//   name VARCHAR(255) NOT NULL,
//   url TEXT NOT NULL,
//   width INTEGER,
//   height INTEGER,
//   format VARCHAR(10),
//   bytes BIGINT,
//   folder VARCHAR(255),
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );

// -- Create index for faster queries
// CREATE INDEX IF NOT EXISTS idx_logos_public_id ON logos(public_id);
// CREATE INDEX IF NOT EXISTS idx_logos_folder ON logos(folder);

// -- Create function to update updated_at timestamp
// CREATE OR REPLACE FUNCTION update_updated_at_column()
// RETURNS TRIGGER AS $$
// BEGIN
//   NEW.updated_at = CURRENT_TIMESTAMP;
//   RETURN NEW;
// END;
// $$ language 'plpgsql';

// -- Create trigger to auto-update updated_at
// CREATE TRIGGER update_logos_updated_at
//   BEFORE UPDATE ON logos
//   FOR EACH ROW
//   EXECUTE FUNCTION update_updated_at_column();
