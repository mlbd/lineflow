import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Ensure these are ONLY server-side (no NEXT_PUBLIC)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Force Node runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get('file'); // Blob
    if (!file) return NextResponse.json({ message: 'No file' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ resource_type: 'image' }, (err, res) =>
        err ? reject(err) : resolve(res)
      );
      stream.end(buffer);
    });

    console.log('Cloudinary upload result:', result);

    return NextResponse.json({
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      secure_url: result.secure_url,
      bytes: result.bytes,
    });
  } catch (e) {
    console.error('Cloudinary upload error:', e);
    return NextResponse.json({ message: 'Upload failed' }, { status: 500 });
  }
}
