// app/api/books/route.js
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT 
        b.id, 
        b.title, 
        b.created_at,
        u.username as author_name,
        (SELECT COUNT(*) FROM topics WHERE book_id = b.id) as topic_count,
        (SELECT COUNT(*) FROM subtopics WHERE book_id = b.id) as subtopic_count
       FROM books b 
       LEFT JOIN users u ON b.author_id = u.id
       ORDER BY b.created_at DESC`
    );
    
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Books GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
