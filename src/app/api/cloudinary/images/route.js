import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '3');
    const nextCursor = searchParams.get('next_cursor');

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    let searchQuery = cloudinary.search
      .expression('resource_type:image AND folder="" AND NOT public_id:sample*')
      .sort_by('created_at', 'desc')
      .max_results(limit);

    // Use cursor-based pagination if available (more efficient for large datasets)
    if (nextCursor) {
      searchQuery = searchQuery.next_cursor(nextCursor);
    }

    const result = await searchQuery.execute();

    const resources = result.resources || [];

    return NextResponse.json({
      resources: resources.map(r => ({
        public_id: r.public_id,
        url: r.secure_url,
        width: r.width,
        height: r.height,
        format: r.format,
        created_at: r.created_at,
        folder: r.folder || '',
        bytes: r.bytes,
      })),
      pagination: {
        page,
        limit,
        total_count: result.total_count,
        has_more: resources.length === limit,
        next_cursor: result.next_cursor || null,
      },
    });
  } catch (err) {
    console.error('[Cloudinary error]', err);

    // More detailed error logging
    console.error('Error details:', {
      message: err.message,
      status: err.http_code,
      error: err.error,
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch images',
        details: err.message,
      },
      { status: 500 }
    );
  }
}
