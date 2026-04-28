// app/api/author/topics/details/route.js
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUser, ROLES } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getUser();
    
    if (!user || (user.role_id !== ROLES.AUTHOR && user.role_id !== ROLES.SUPERADMIN)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const topic_id = searchParams.get('topic_id');

    if (!topic_id) {
      return NextResponse.json(
        { success: false, error: 'Topic ID is required' },
        { status: 400 }
      );
    }

    // Get topic details with book information
    const [topicRows] = await pool.query(
      `SELECT t.id, t.name, t.book_id, b.title as book_title, b.author_id
       FROM topics t
       JOIN books b ON t.book_id = b.id
       WHERE t.id = ?`,
      [topic_id]
    );

    if (topicRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Topic not found' },
        { status: 404 }
      );
    }

    const topic = topicRows[0];

    // If requester is AUTHOR, verify the book belongs to them. SUPERADMIN bypasses this.
    if (user.role_id === ROLES.AUTHOR && topic.author_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      topic: {
        id: topic.id,
        name: topic.name,
        book_id: topic.book_id
      },
      book: {
        id: topic.book_id,
        title: topic.book_title
      }
    });

  } catch (error) {
    console.error('Error fetching topic details:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
