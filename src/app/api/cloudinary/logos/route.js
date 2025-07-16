// app/api/cloudinary/logos/route.js
import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { LogosService } from '@/lib/services/logosService';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET(request) {
  try {
    // Check if force refresh is requested
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    
    // Get logos with caching logic
    const logos = await LogosService.getLogos(forceRefresh);
    
    // Get database stats for debugging
    const stats = await LogosService.getStats();
    
    return NextResponse.json({
      logos,
      stats,
      source: forceRefresh ? 'cloudinary' : (logos.length > 0 ? 'database' : 'cloudinary'),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Logos API Error]', err);
    return NextResponse.json(
      {
        error: 'Failed to fetch logos',
        details: err.message,
      },
      { status: 500 }
    );
  }
}

// New endpoint to clear cache
export async function DELETE() {
  try {
    const clearedCount = await LogosService.clearLogosFromDB();
    
    return NextResponse.json({
      success: true,
      message: `Cache cleared successfully. Removed ${clearedCount} logos.`,
      clearedCount
    });
  } catch (err) {
    console.error('[Clear Cache Error]', err);
    return NextResponse.json(
      {
        error: 'Failed to clear cache',
        details: err.message,
      },
      { status: 500 }
    );
  }
}