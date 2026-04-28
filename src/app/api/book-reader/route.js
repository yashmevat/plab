// app/api/book-reader/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get('bookId') || '';
  const BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';

  const pageRes = await fetch(`${BASE}/embed/book/${bookId}`);
  let html = await pageRes.text();

  // 1. HTML attributes mein replace karo (already ho raha tha)
  html = html.replaceAll('src="/_next/', `src="${BASE}/_next/`);
  html = html.replaceAll('href="/_next/', `href="${BASE}/_next/`);

  // 2. RSC JSON payload ke andar bhi replace karo
  html = html.replaceAll('"/_next/', `"${BASE}/_next/`);
  html = html.replaceAll("'/_next/", `'${BASE}/_next/`);

  // 3. Favicon bhi fix karo
  html = html.replaceAll('href="/favicon', `href="${BASE}/favicon`);

  // 4. Font/media paths fix karo
  html = html.replaceAll('"/_next/static/media/', `"${BASE}/_next/static/media/`);

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'X-Frame-Options': 'ALLOWALL',
    },
  });
}
