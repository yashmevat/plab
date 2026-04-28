// app/api/books/[bookId]/topics/route.js
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { bookId } = await params;

    // Fetch all topics for this book with subtopic count
    const [rows] = await pool.query(
      `SELECT 
        t.id, 
        t.name, 
        t.description,
        t.book_id,
        t.created_at,
        COUNT(st.id) as subtopic_count
       FROM topics t
       LEFT JOIN subtopics st ON t.id = st.topic_id
       WHERE t.book_id = ?
       GROUP BY t.id
       ORDER BY t.sort_order, t.created_at ASC`,
      [bookId]
    );
    
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Topics GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
