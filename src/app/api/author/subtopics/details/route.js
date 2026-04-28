// app/api/author/subtopics/details/route.js
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(req) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const authorId = decoded.userId;

    const { searchParams } = new URL(req.url);
    const subtopicId = searchParams.get('subtopic_id');

    if (!subtopicId) {
      return NextResponse.json({ 
        success: false, 
        error: 'subtopic_id is required' 
      }, { status: 400 });
    }

    // Get subtopic with book and topic info
    const [rows] = await pool.query(`
      SELECT 
        st.id,
        st.name,
        st.book_id,
        st.topic_id,
        b.title as book_title,
        t.name as topic_name
      FROM subtopics st
      INNER JOIN books b ON st.book_id = b.id
      INNER JOIN topics t ON st.topic_id = t.id
      WHERE st.id = ? AND st.author_id = ?
    `, [subtopicId, authorId]);

    if (rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Subtopic not found' 
      }, { status: 404 });
    }

    const subtopic = rows[0];

    return NextResponse.json({
      success: true,
      subtopic: {
        id: subtopic.id,
        name: subtopic.name,
        book_id: subtopic.book_id,
        topic_id: subtopic.topic_id
      },
      book: {
        id: subtopic.book_id,
        title: subtopic.book_title
      },
      topic: {
        id: subtopic.topic_id,
        name: subtopic.topic_name
      }
    });

  } catch (error) {
    console.error('Error fetching subtopic details:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch subtopic details' 
    }, { status: 500 });
  }
}
