import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUser, getUserFromToken } from '@/lib/auth'; // ← getUserFromToken add karo

// ✅ Helper — cookie ya localStorage token dono check karo
async function getAuthUser(req) {
  let user = await getUser();
  if (user) {
    console.log('✅ Bookmarks: User from cookie:', user.id);
    return user;
  }

  const token = req.headers.get('x-book-token');
  console.log('📥 Bookmarks: x-book-token header:', token ? token.substring(0, 50) + '...' : 'null');

  if (token) {
    user = await getUserFromToken(token);
    if (user) {
      console.log('✅ Bookmarks: User from x-book-token:', user.id);
    } else {
      console.log('❌ Bookmarks: getUserFromToken returned null');
    }
  }

  return user;
}

// GET
export async function GET(req, { params }) {
  try {
    const user = await getAuthUser(req); // ← change
    if (!user) {
      console.log('❌ Bookmarks GET: User not authenticated');
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Bookmarks GET: Authenticated as user', user.id, user.email);

    const { bookId } = await params;

    // First, check how many bookmarks exist for this book (any user)
    const [allBookmarks] = await pool.query(
      `SELECT b.id, b.user_id, u.email, u.external_user_id, b.book_id, b.page_index, b.created_at
       FROM bookmarks b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.book_id = ?
       ORDER BY b.user_id, b.created_at ASC`,
      [bookId]
    );
    console.log(`📊 Total bookmarks for book ${bookId}:`, allBookmarks.length);
    if (allBookmarks.length > 0) {
      const userIds = [...new Set(allBookmarks.map(b => b.user_id))];
      console.log('📊 Bookmarks belong to user_ids:', userIds);
      console.log('📊 Sample bookmark emails:', allBookmarks.slice(0, 3).map(b => ({ user_id: b.user_id, email: b.email, external_user_id: b.external_user_id })));
    }

    // ✅ FIX: Fetch bookmarks for current user OR users with same external_user_id
    let query;
    let queryParams;

    if (user.external_user_id) {
      // Match by user.id OR any user with same external_user_id
      query = `SELECT DISTINCT b.id, b.user_id, b.book_id, b.page_index, b.created_at
         FROM bookmarks b
         LEFT JOIN users u ON b.user_id = u.id
         WHERE b.book_id = ? AND (b.user_id = ? OR u.external_user_id = ?)
         ORDER BY b.page_index ASC`;
      queryParams = [bookId, user.id, user.external_user_id];
      console.log('📌 Fetching bookmarks for user_id:', user.id, 'OR external_user_id:', user.external_user_id);
    } else {
      // No external_user_id, just match by user.id
      query = `SELECT id, user_id, book_id, page_index, created_at
         FROM bookmarks
         WHERE book_id = ? AND user_id = ?
         ORDER BY page_index ASC`;
      queryParams = [bookId, user.id];
      console.log('📌 Fetching bookmarks for user_id:', user.id);
    }

    const [bookmarks] = await pool.query(query, queryParams);
    console.log('✅ Found', bookmarks.length, 'bookmarks for current user');

    return NextResponse.json({ success: true, data: bookmarks });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch bookmarks' }, { status: 500 });
  }
}

// POST
export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req); // ← change
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;
    const body = await req.json();
    const { page_index } = body;

    if (page_index === undefined) {
      return NextResponse.json({ success: false, message: 'Page index is required' }, { status: 400 });
    }

    const [existing] = await pool.query(
      `SELECT id FROM bookmarks WHERE book_id = ? AND user_id = ? AND page_index = ?`,
      [bookId, user.id, page_index]
    );

    if (existing.length > 0) {
      await pool.query(`DELETE FROM bookmarks WHERE id = ?`, [existing[0].id]);
      return NextResponse.json({ success: true, action: 'removed', message: 'Bookmark removed successfully' });
    } else {
      const [result] = await pool.query(
        `INSERT INTO bookmarks (book_id, user_id, page_index) VALUES (?, ?, ?)`,
        [bookId, user.id, page_index]
      );

      const [newBookmark] = await pool.query(
        `SELECT id, user_id, book_id, page_index, created_at FROM bookmarks WHERE id = ?`,
        [result.insertId]
      );

      return NextResponse.json({ success: true, action: 'added', data: newBookmark[0], message: 'Bookmark added successfully' }, { status: 201 });
    }
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to toggle bookmark' }, { status: 500 });
  }
}

// DELETE
export async function DELETE(req, { params }) {
  try {
    const user = await getAuthUser(req); // ← change
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;
    const { searchParams } = new URL(req.url);
    const bookmarkId = searchParams.get('id');

    if (!bookmarkId) {
      return NextResponse.json({ success: false, message: 'Bookmark ID is required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `DELETE FROM bookmarks WHERE id = ? AND book_id = ? AND user_id = ?`,
      [bookmarkId, bookId, user.id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'Bookmark not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Bookmark deleted successfully' });
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete bookmark' }, { status: 500 });
  }
}
