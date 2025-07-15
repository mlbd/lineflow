import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET() {
  try {
    // Fetch all images inside the "Experiment" folder (up to 100)
    const result = await cloudinary.search
      .expression('resource_type:image AND folder="Experiment"')
      .sort_by('created_at', 'desc')
      .max_results(100)
      .execute();

    const resources = result.resources || [];

    console.log(
      '[Fetched from Cloudinary]',
      resources.map(r => r.public_id)
    ); // ✅ confirm in terminal

    return NextResponse.json({
      logos: resources.map(r => ({
        public_id: r.public_id,
        name: r.public_id.split('/').pop(),
        url: r.secure_url,
        width: r.width,
        height: r.height,
        format: r.format,
        bytes: r.bytes,
        folder: r.folder || '',
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    console.error('[Cloudinary Logos Error]', err);
    return NextResponse.json(
      {
        error: 'Failed to fetch logos',
        details: err.message,
      },
      { status: 500 }
    );
  }
}
