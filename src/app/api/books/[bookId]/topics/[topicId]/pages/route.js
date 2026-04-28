// app/api/books/[bookId]/topics/[topicId]/pages/route.js
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { bookId, topicId } = await params;

    // Fetch pages for this topic where subtopic_id is NULL (topic-level pages)
    const [rows] = await pool.query(
      `SELECT 
        id, 
        topic_id,
        subtopic_id,
        content,
        created_at
       FROM pages
       WHERE topic_id = ? AND subtopic_id IS NULL
       ORDER BY created_at ASC`,
      [topicId]
    );
    
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Topic Pages GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
