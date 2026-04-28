// app/api/books/[bookId]/route.js
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { bookId } = await params;

    const [rows] = await pool.query(
      `SELECT 
        b.id, 
        b.title, 
        b.created_at,
        u.username as author_name
       FROM books b 
       LEFT JOIN users u ON b.author_id = u.id
       WHERE b.id = ?`,
      [bookId]
    );
    
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
