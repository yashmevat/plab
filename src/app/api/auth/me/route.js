// app/api/auth/me/route.js
import { NextResponse } from 'next/server';
import { getUser, getUserFromToken } from '@/lib/auth';

export async function GET(req) {
  try {
    // First try cookie-based auth
    let user = await getUser();

    // Fallback: x-book-token header (iframe embed, localStorage token)
    if (!user) {
      const token = req.headers.get('x-book-token');
      if (token) {
        user = await getUserFromToken(token);
      }
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
