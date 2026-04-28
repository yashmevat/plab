// app/api/books/[bookId]/topics/[topicId]/subtopics/[subtopicId]/pages/route.js
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { bookId, topicId, subtopicId } = await params;

    // Fetch all pages for this subtopic
    const [rows] = await pool.query(
      `SELECT 
        p.id, 
        p.subtopic_id,
        p.content,
        p.created_at
       FROM pages p
       INNER JOIN subtopics st ON p.subtopic_id = st.id
       WHERE p.subtopic_id = ? 
         AND st.topic_id = ? 
         AND st.book_id = ?
       ORDER BY p.id ASC`,
      [subtopicId, topicId, bookId]
    );
    
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Pages GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
