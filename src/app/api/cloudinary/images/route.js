
// ./src/app/api/cloudinary/images/route.js
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
    const limit = parseInt(searchParams.get('limit') || '3');
    const nextCursor = searchParams.get('next_cursor');
    const folder = searchParams.get('folder'); // note: can be undefined or ''

    // Build expression
    let expression = 'resource_type:image AND NOT public_id:sample*';
    if (folder && folder.trim() !== '') {
      expression = `resource_type:image AND folder="${folder}" AND NOT public_id:sample*`;
    }

    let searchQuery = cloudinary.search
      .expression(expression)
      .sort_by('created_at', 'desc')
      .max_results(limit);

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
        limit,
        total_count: result.total_count,
        has_more: !!result.next_cursor,
        next_cursor: result.next_cursor || null,
      },
    });
  } catch (err) {
    console.error('[Cloudinary error]', err);

    return NextResponse.json(
      {
        error: 'Failed to fetch images',
        details: err.message,
      },
      { status: 500 }
    );
  }
}
