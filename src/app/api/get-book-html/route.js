// src/app/api/get-book-html/route.js
export async function GET(req) {
  const bookId = new URL(req.url).searchParams.get('bookId');
  const base = 'https://plabcoachdb.vercel.app';
  
  const html = await fetch(`${base}/book/${bookId}`).then(r => r.text());
  
  // Sab /_next/ occurrences replace karo (HTML + JSON + escaped strings sab mein)
  const fixed = html
    .replace(/\/_next\//g, `${base}/_next/`)
    .replace(/\/favicon\.ico/g, `${base}/favicon.ico`);

  return new Response(fixed, { 
    headers: { 
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*'
    } 
  });
}
