// app/api/author/topics/route.js
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUser, ROLES } from '@/lib/auth';

// POST - Create a new topic
export async function POST(request) {
  try {
    const user = await getUser();
    
    if (!user || (user.role_id !== ROLES.AUTHOR && user.role_id !== ROLES.SUPERADMIN)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { name, book_id } = await request.json();

    if (!name || !book_id) {
      return NextResponse.json(
        { success: false, error: 'Topic name and book ID are required' },
        { status: 400 }
      );
    }

    // Superadmin can create topics for any book, authors can only create topics for their own books
    if (user.role_id !== ROLES.SUPERADMIN) {
      // Verify that the book belongs to the author
      const [bookCheck] = await pool.query(
        'SELECT id FROM books WHERE id = ? AND author_id = ?',
        [book_id, user.id]
      );

      if (bookCheck.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Book not found or unauthorized' },
          { status: 403 }
        );
      }
    }


     
    const cloneId = Date.now().toString();

    // Get the next sort_order for this book (max + 1, or 1 if none exist)
    const [maxOrder] = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM topics WHERE book_id = ?',
      [book_id]
    );
    const nextSortOrder = maxOrder[0].max_order + 1;

    // Insert topic
    const [result] = await pool.query(
      'INSERT INTO topics (name, book_id, clone_id, sort_order) VALUES (?, ?, ?, ?)',
      [name, book_id, cloneId, nextSortOrder]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Topic created successfully',
      topicId: result.insertId
    });

  } catch (error) {
    console.error('Error creating topic:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET - Fetch topics for a specific subject or book
export async function GET(request) {
  try {
    const user = await getUser();
    
    if (!user || (user.role_id !== ROLES.AUTHOR && user.role_id !== ROLES.SUPERADMIN)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const book_id = searchParams.get('book_id');

    if (!book_id) {
      return NextResponse.json(
        { success: false, error: 'Book ID is required' },
        { status: 400 }
      );
    }

    // Get topics for this book
    const [rows] = await pool.query(
      'SELECT id, name, book_id, created_at FROM topics WHERE book_id = ? ORDER BY sort_order, created_at ASC',
      [book_id]
    );
    
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching topics:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update an existing topic
export async function PUT(request) {
  try {
    const user = await getUser();
    
    if (!user || (user.role_id !== ROLES.AUTHOR && user.role_id !== ROLES.SUPERADMIN)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, name } = await request.json();

    if (!id || !name) {
      return NextResponse.json(
        { success: false, error: 'Topic ID and name are required' },
        { status: 400 }
      );
    }

    // Superadmin can edit any topic, authors can only edit their own
    if (user.role_id !== ROLES.SUPERADMIN) {
      // Verify topic belongs to a book owned by the author
      const [topicCheck] = await pool.query(
        `SELECT t.id FROM topics t 
         JOIN books b ON t.book_id = b.id 
         WHERE t.id = ? AND b.author_id = ?`,
        [id, user.id]
      );

      if (topicCheck.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Topic not found or unauthorized' },
          { status: 403 }
        );
      }
    }

    // Update topic name
    await pool.query(
      'UPDATE topics SET name = ? WHERE id = ?',
      [name, id]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Topic updated successfully'
    });

  } catch (error) {
    console.error('Error updating topic:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Delete a topic and its subtopics and pages
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
        { success: false, error: 'Topic ID is required' },
        { status: 400 }
      );
    }

    // Superadmin can delete any topic, authors can only delete their own
    if (user.role_id !== ROLES.SUPERADMIN) {
      // Verify topic belongs to a book owned by the author
      const [topicCheck] = await pool.query(
        `SELECT t.id FROM topics t 
         JOIN books b ON t.book_id = b.id 
         WHERE t.id = ? AND b.author_id = ?`,
        [id, user.id]
      );

      if (topicCheck.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Topic not found or unauthorized' },
          { status: 403 }
        );
      }
    }

    // Delete pages for this topic (including subtopic pages)
    await pool.query('DELETE FROM pages WHERE topic_id = ?', [id]);
    
    // Delete subtopics for this topic
    await pool.query('DELETE FROM subtopics WHERE topic_id = ?', [id]);
    
    // Delete the topic itself
    await pool.query('DELETE FROM topics WHERE id = ?', [id]);

    return NextResponse.json({ 
      success: true, 
      message: 'Topic deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting topic:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
