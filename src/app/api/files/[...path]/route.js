import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { path: filePath } = await params;

    if (!filePath || filePath.length === 0) {
      return NextResponse.json({ message: 'File path required' }, { status: 400 });
    }

    // Join the path segments and normalize
    const relativePath = path.normalize(filePath.join('/'));

    // Construct the full file path
    const fullPath = path.join(process.cwd(), 'public', relativePath);

    // Security check: ensure the file is within the public directory
    const publicDir = path.normalize(path.join(process.cwd(), 'public'));
    const normalizedFullPath = path.normalize(fullPath);

    if (!normalizedFullPath.startsWith(publicDir)) {
      console.warn('[FILE SERVE] Access denied for path:', relativePath);
      return NextResponse.json({ message: 'Access denied' }, { status: 403 });
    }

    // Check if file exists
    if (!existsSync(normalizedFullPath)) {
      console.warn('[FILE SERVE] File not found:', relativePath);
      return NextResponse.json({ message: 'File not found' }, { status: 404 });
    }

    // Get file stats for additional headers
    const fileStats = await stat(normalizedFullPath);

    // Read the file
    const fileBuffer = await readFile(normalizedFullPath);

    // Determine content type based on file extension
    const ext = path.extname(normalizedFullPath).toLowerCase();
    let contentType = 'application/octet-stream';

    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
        case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.doc':
        contentType = 'application/msword';
        break;
      case '.docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
    }

    // Return the file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStats.size.toString(),
        'Last-Modified': fileStats.mtime.toUTCString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        // Add CORS headers for images
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('[FILE SERVE] error for path:', request.url, error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

