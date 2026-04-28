import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUser, getUserFromToken } from '@/lib/auth'; // ← getUserFromToken add karo

// ✅ Helper — cookie ya localStorage token dono check karo
async function getAuthUser(req) {
  // Pehle cookie check karo
  let user = await getUser();
  if (user) {
    console.log('✅ User from cookie:', user.id, user.email);
    return user;
  }

  // Cookie nahi mila → header se token lo (localStorage wala)
  const token = req.headers.get('x-book-token');
  console.log("📥 x-book-token header:", token ? token.substring(0, 50) + '...' : 'null');

  if (token) {
    user = await getUserFromToken(token);
    if (user) {
      console.log('✅ User from x-book-token:', user.id, user.email);
    } else {
      console.log('❌ getUserFromToken returned null - token verification failed');
    }
  }

  return user;
}

// GET
export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req); // ← getUser() ki jagah

    if (!user) {
      console.log('❌ Highlights GET: User not authenticated');
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Highlights GET: Authenticated as user', user.id, user.email);

    const { bookId } = await params;

    // First, check how many highlights exist for this book (any user)
    const [allHighlights] = await pool.query(
      `SELECT h.id, h.book_id, h.user_id, u.email, u.external_user_id, h.title, h.page_index, h.selected_text, h.color, h.created_at
       FROM highlights h
       LEFT JOIN users u ON h.user_id = u.id
       WHERE h.book_id = ?
       ORDER BY h.user_id, h.page_index ASC`,
      [bookId]
    );
    console.log(`📊 Total highlights for book ${bookId}:`, allHighlights.length);
    if (allHighlights.length > 0) {
      const userIds = [...new Set(allHighlights.map(h => h.user_id))];
      console.log('📊 Highlights belong to user_ids:', userIds);
      console.log('📊 Sample highlight emails:', allHighlights.slice(0, 3).map(h => ({ user_id: h.user_id, email: h.email, external_user_id: h.external_user_id })));
    }

    // ✅ FIX: Fetch highlights for current user OR users with same external_user_id
    let query;
    let queryParams;

    if (user.external_user_id) {
      // Match by user.id OR any user with same external_user_id
      query = `SELECT DISTINCT h.id, h.book_id, h.user_id, h.title, h.page_index, h.selected_text, h.color, h.created_at
         FROM highlights h
         LEFT JOIN users u ON h.user_id = u.id
         WHERE h.book_id = ? AND (h.user_id = ? OR u.external_user_id = ?)
         ORDER BY h.page_index ASC, h.created_at ASC`;
      queryParams = [bookId, user.id, user.external_user_id];
      console.log('📌 Fetching highlights for user_id:', user.id, 'OR external_user_id:', user.external_user_id);
    } else {
      // No external_user_id, just match by user.id
      query = `SELECT id, book_id, user_id, title, page_index, selected_text, color, created_at
         FROM highlights
         WHERE book_id = ? AND user_id = ?
         ORDER BY page_index ASC, created_at ASC`;
      queryParams = [bookId, user.id];
      console.log('📌 Fetching highlights for user_id:', user.id);
    }

    const [highlights] = await pool.query(query, queryParams);
    console.log('✅ Found', highlights.length, 'highlights for current user');

    return NextResponse.json({ success: true, data: highlights });
  } catch (error) {
    console.error('Error fetching highlights:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch highlights' }, { status: 500 });
  }
}

// POST
export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req); // ← getUser() ki jagah
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;
    const body = await req.json();
    const { title, page_index, selected_text, color } = body;

    if (!title || page_index === undefined || !selected_text || !color) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO highlights (book_id, user_id, title, page_index, selected_text, color) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [bookId, user.id, title, page_index, selected_text, color]
    );

    const [newHighlight] = await pool.query(
      `SELECT id, book_id, user_id, title, page_index, selected_text, color, created_at 
       FROM highlights WHERE id = ?`,
      [result.insertId]
    );

    return NextResponse.json({ success: true, data: newHighlight[0], message: 'Highlight created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error creating highlight:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to create highlight' }, { status: 500 });
  }
}

// DELETE
export async function DELETE(req, { params }) {
  try {
    const user = await getAuthUser(req); // ← getUser() ki jagah
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;
    const { searchParams } = new URL(req.url);
    const highlightId = searchParams.get('id');

    if (!highlightId) {
      return NextResponse.json({ success: false, message: 'Highlight ID is required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `DELETE FROM highlights WHERE id = ? AND book_id = ? AND user_id = ?`,
      [highlightId, bookId, user.id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'Highlight not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Highlight deleted successfully' });
  } catch (error) {
    console.error('Error deleting highlight:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete highlight' }, { status: 500 });
  }
}
