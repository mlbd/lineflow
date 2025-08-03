// lib/services/logosService.js
import pool from '../db.js';
import { v2 as cloudinary } from 'cloudinary';

export class LogosService {
  /**
   * Get all logos from database
   */
  static async getLogosFromDB() {
    try {
      const result = await pool.query('SELECT * FROM logos ORDER BY created_at DESC');
      return result.rows;
    } catch (error) {
      console.error('Error fetching logos from database:', error);
      throw error;
    }
  }

  /**
   * Save logos to database
   */
  static async saveLogosToDB(logos) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const logo of logos) {
        await client.query(
          `INSERT INTO logos (public_id, name, url, width, height, format, bytes, folder)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (public_id) 
           DO UPDATE SET 
             name = EXCLUDED.name,
             url = EXCLUDED.url,
             width = EXCLUDED.width,
             height = EXCLUDED.height,
             format = EXCLUDED.format,
             bytes = EXCLUDED.bytes,
             folder = EXCLUDED.folder,
             updated_at = CURRENT_TIMESTAMP`,
          [
            logo.public_id,
            logo.name,
            logo.url,
            logo.width,
            logo.height,
            logo.format,
            logo.bytes,
            logo.folder || '',
          ]
        );
      }

      await client.query('COMMIT');
      console.log(`Saved ${logos.length} logos to database`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error saving logos to database:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clear all logos from database (for cache refresh)
   */
  static async clearLogosFromDB() {
    try {
      const result = await pool.query('DELETE FROM logos');
      console.log(`Cleared ${result.rowCount} logos from database`);
      return result.rowCount;
    } catch (error) {
      console.error('Error clearing logos from database:', error);
      throw error;
    }
  }

  /**
   * Fetch logos from Cloudinary
   */
  static async fetchLogosFromCloudinary() {
    try {
      const result = await cloudinary.search
        .expression('resource_type:image AND folder="Experiment"')
        .sort_by('created_at', 'desc')
        .max_results(100)
        .execute();

      const resources = result.resources || [];

      return resources.map(r => ({
        public_id: r.public_id,
        name: r.public_id.split('/').pop(),
        url: r.secure_url,
        width: r.width,
        height: r.height,
        format: r.format,
        bytes: r.bytes,
        folder: r.folder || '',
        created_at: r.created_at,
      }));
    } catch (error) {
      console.error('Error fetching logos from Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Get logos with caching logic
   */
  static async getLogos(forceRefresh = false) {
    try {
      // If force refresh is requested, clear cache first
      if (forceRefresh) {
        await this.clearLogosFromDB();
      }

      // Try to get logos from database first
      const dbLogos = await this.getLogosFromDB();

      if (dbLogos.length > 0 && !forceRefresh) {
        console.log(`Retrieved ${dbLogos.length} logos from database cache`);
        return dbLogos;
      }

      // If no logos in database or force refresh, fetch from Cloudinary
      console.log('Fetching logos from Cloudinary...');
      const cloudinaryLogos = await this.fetchLogosFromCloudinary();

      // Save to database for future use
      if (cloudinaryLogos.length > 0) {
        await this.saveLogosToDB(cloudinaryLogos);
      }

      return cloudinaryLogos;
    } catch (error) {
      console.error('Error in getLogos:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  static async getStats() {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_logos,
          MIN(created_at) as oldest_logo,
          MAX(updated_at) as latest_update
        FROM logos
      `);

      return result.rows[0];
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw error;
    }
  }
}
