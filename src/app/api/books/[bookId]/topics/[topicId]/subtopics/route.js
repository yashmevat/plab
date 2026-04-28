// app/api/books/[bookId]/topics/[topicId]/subtopics/route.js
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { bookId, topicId } = await params;

    // Fetch all subtopics for this topic with page count
    const [rows] = await pool.query(
      `SELECT 
        st.id, 
        st.name, 
        st.description,
        st.topic_id,
        st.book_id,
        st.author_id,
        st.created_at,
        COUNT(p.id) as page_count
       FROM subtopics st
       LEFT JOIN pages p ON st.id = p.subtopic_id
       WHERE st.book_id = ? AND st.topic_id = ?
       GROUP BY st.id
       ORDER BY st.sort_order, st.created_at ASC`,
      [bookId, topicId]
    );
    
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Subtopics GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
