// app/api/author/pages/route.js
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUser, ROLES } from '@/lib/auth';

// GET - Fetch pages for a subtopic or topic
export async function GET(request) {
  try {
    const user = await getUser();
    
    if (!user || (user.role_id !== ROLES.AUTHOR && user.role_id !== ROLES.SUPERADMIN)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subtopic_id = searchParams.get('subtopic_id');
    const topic_id = searchParams.get('topic_id');

    if (!subtopic_id && !topic_id) {
      return NextResponse.json(
        { success: false, error: 'Subtopic ID or Topic ID is required' },
        { status: 400 }
      );
    }

    if (subtopic_id) {
      // Verify subtopic belongs to author
      const [subtopics] = await pool.query(
        'SELECT id FROM subtopics WHERE id = ? AND author_id = ?',
        [subtopic_id, user.id]
      );

      if (subtopics.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Subtopic not found or unauthorized' },
          { status: 403 }
        );
      }

      // Fetch all pages for the subtopic
      const [rows] = await pool.query(
        `SELECT id, topic_id, subtopic_id, content, created_at
         FROM pages 
         WHERE subtopic_id = ?
         ORDER BY id ASC`,
        [subtopic_id]
      );
      
      return NextResponse.json({ success: true, data: rows });
    } else {
      // Fetch pages for topic (where subtopic_id is NULL)
      // First verify topic belongs to author
      const [topics] = await pool.query(
        `SELECT t.id FROM topics t
         JOIN books b ON t.book_id = b.id
         WHERE t.id = ? AND b.author_id = ?`,
        [topic_id, user.id]
      );

      if (topics.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Topic not found or unauthorized' },
          { status: 403 }
        );
      }

      // Fetch all pages for the topic
      const [rows] = await pool.query(
        `SELECT id, topic_id, subtopic_id, content, created_at
         FROM pages 
         WHERE topic_id = ? AND subtopic_id IS NULL
         ORDER BY id ASC`,
        [topic_id]
      );
      
      return NextResponse.json({ success: true, data: rows });
    }
  } catch (error) {
    console.error('Pages GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Create new page
export async function POST(request) {
  try {
    const user = await getUser();
    
    if (!user || (user.role_id !== ROLES.AUTHOR && user.role_id !== ROLES.SUPERADMIN)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { topic_id, subtopic_id, content } = await request.json();
    
    if (!topic_id && !subtopic_id) {
      return NextResponse.json(
        { success: false, error: 'Topic ID or Subtopic ID is required' },
        { status: 400 }
      );
    }

    if (subtopic_id) {
      // Superadmin can create pages for any subtopic, authors can only create pages for their own subtopics
      let subtopics;
      if (user.role_id === ROLES.SUPERADMIN) {
        [subtopics] = await pool.query(
          'SELECT id, topic_id FROM subtopics WHERE id = ?',
          [subtopic_id]
        );
      } else {
        [subtopics] = await pool.query(
          'SELECT id, topic_id FROM subtopics WHERE id = ? AND author_id = ?',
          [subtopic_id, user.id]
        );
      }

      if (subtopics.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Subtopic not found or unauthorized' },
          { status: 403 }
        );
      }

      const [result] = await pool.query(
        'INSERT INTO pages (topic_id, subtopic_id, content) VALUES (?, ?, ?)',
        [subtopics[0].topic_id, subtopic_id, content || '']
      );
      
      return NextResponse.json({ 
        success: true, 
        data: { id: result.insertId } 
      });
    } else {
      // Creating page for topic (subtopic_id will be NULL)
      // Superadmin can create pages for any topic, authors can only create pages for their own topics
      let topics;
      if (user.role_id === ROLES.SUPERADMIN) {
        [topics] = await pool.query(
          'SELECT id FROM topics WHERE id = ?',
          [topic_id]
        );
      } else {
        [topics] = await pool.query(
          `SELECT t.id FROM topics t
           JOIN books b ON t.book_id = b.id
           WHERE t.id = ? AND b.author_id = ?`,
          [topic_id, user.id]
        );
      }

      if (topics.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Topic not found or unauthorized' },
          { status: 403 }
        );
      }

      const [result] = await pool.query(
        'INSERT INTO pages (topic_id, subtopic_id, content) VALUES (?, NULL, ?)',
        [topic_id, content || '']
      );
      
      return NextResponse.json({ 
        success: true, 
        data: { id: result.insertId } 
      });
    }
  } catch (error) {
    console.error('Pages POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update page
export async function PUT(request) {
  try {
    const user = await getUser();
    
    if (!user || (user.role_id !== ROLES.AUTHOR && user.role_id !== ROLES.SUPERADMIN)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, content } = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // Superadmin can update any page, authors can only update their own pages
    if (user.role_id !== ROLES.SUPERADMIN) {
      // Verify page belongs to author through subtopic or topic
      const [pages] = await pool.query(
        `SELECT p.id FROM pages p
         LEFT JOIN subtopics st ON p.subtopic_id = st.id
         LEFT JOIN topics t ON p.topic_id = t.id
         LEFT JOIN books b ON t.book_id = b.id
         WHERE p.id = ? AND (st.author_id = ? OR b.author_id = ?)`,
        [id, user.id, user.id]
      );

      if (pages.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Page not found or unauthorized' },
          { status: 403 }
        );
      }
    }

    await pool.query(
      'UPDATE pages SET content = ? WHERE id = ?',
      [content || '', id]
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pages PUT Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Delete page
export async function DELETE(request) {
  try {
    const user = await getUser();
    
    if (!user || (user.role_id !== ROLES.AUTHOR && user.role_id !== ROLES.SUPERADMIN)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // Superadmin can delete any page, authors can only delete their own pages
    if (user.role_id !== ROLES.SUPERADMIN) {
      // Verify page belongs to author through subtopic or topic
      const [pages] = await pool.query(
        `SELECT p.id FROM pages p
         LEFT JOIN subtopics st ON p.subtopic_id = st.id
         LEFT JOIN topics t ON p.topic_id = t.id
         LEFT JOIN books b ON t.book_id = b.id
         WHERE p.id = ? AND (st.author_id = ? OR b.author_id = ?)`,
        [id, user.id, user.id]
      );

      if (pages.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Page not found or unauthorized' },
          { status: 403 }
        );
      }
    }

    await pool.query('DELETE FROM pages WHERE id = ?', [id]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pages DELETE Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
