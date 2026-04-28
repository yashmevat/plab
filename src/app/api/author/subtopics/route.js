// app/api/author/subtopics/route.js
import { NextResponse } from 'next/server';
import { verifyToken, ROLES } from '@/lib/auth';
import pool from '@/lib/db';

// GET - Fetch subtopics for a specific topic
export async function GET(req) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const requesterId = decoded.userId;
    const requesterRole = decoded.role_id;

    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get('book_id');
    const topicId = searchParams.get('topic_id');

    if (!topicId) {
      return NextResponse.json({ 
        success: false, 
        error: 'topic_id is required' 
      }, { status: 400 });
    }

    // If requester is SUPERADMIN, bypass author ownership checks
    if (requesterRole === ROLES.SUPERADMIN) {
      // Fetch topic and book if available
      const [topics] = await pool.query(
        'SELECT id, name, description, book_id FROM topics WHERE id = ?',
        [topicId]
      );

      if (topics.length === 0) {
        return NextResponse.json({ success: false, error: 'Topic not found' }, { status: 404 });
      }

      const actualBookId = topics[0].book_id;

      const [subtopics] = await pool.query(
        `SELECT id, name, description, created_at, updated_at FROM subtopics WHERE topic_id = ? AND book_id = ? ORDER BY sort_order, created_at ASC`,
        [topicId, actualBookId]
      );

      const [books] = await pool.query('SELECT id, title FROM books WHERE id = ?', [actualBookId]);

      return NextResponse.json({ success: true, book: books[0] || null, topic: topics[0], subtopics });
    }

    // For authors: require book_id OR verify via topic -> book
    const decodedAuthorId = requesterId;

    let actualBookId = bookId;
    if (!actualBookId) {
      const [topicRows] = await pool.query('SELECT book_id FROM topics WHERE id = ?', [topicId]);
      if (topicRows.length === 0) return NextResponse.json({ success: false, error: 'Topic not found' }, { status: 404 });
      actualBookId = topicRows[0].book_id;
    }

    // Verify book belongs to this author
    const [books] = await pool.query('SELECT id, title FROM books WHERE id = ? AND author_id = ?', [actualBookId, decodedAuthorId]);
    if (books.length === 0) {
      return NextResponse.json({ success: false, error: 'Book not found or unauthorized' }, { status: 404 });
    }

    // Verify topic belongs to book
    const [topics] = await pool.query('SELECT id, name, description FROM topics WHERE id = ? AND book_id = ?', [topicId, actualBookId]);
    if (topics.length === 0) return NextResponse.json({ success: false, error: 'Topic not found' }, { status: 404 });

    // Get subtopics for this author/book/topic
    const [subtopics] = await pool.query(`
      SELECT id, name, description, created_at, updated_at
      FROM subtopics
      WHERE book_id = ? AND topic_id = ? AND author_id = ?
      ORDER BY sort_order, created_at ASC
    `, [actualBookId, topicId, decodedAuthorId]);

    return NextResponse.json({ success: true, book: books[0], topic: topics[0], subtopics });

  } catch (error) {
    console.error('Error fetching subtopics:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch subtopics' 
    }, { status: 500 });
  }
}

// POST - Create a new subtopic
export async function POST(req) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const authorId = decoded.userId;
    const userRole = decoded.role_id;

    const { name, description, book_id, topic_id, clone_id } = await req.json();

    // Validation
    if (!name || !book_id || !topic_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Name, book_id, and topic_id are required' 
      }, { status: 400 });
    }

    // Superadmin can create subtopics for any book, authors can only create subtopics for their own books
    if (userRole !== 1) { // Not SUPERADMIN
      // Verify book belongs to author
      const [books] = await pool.query(
        'SELECT id FROM books WHERE id = ? AND author_id = ?',
        [book_id, authorId]
      );

      if (books.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Book not found or unauthorized' 
        }, { status: 404 });
      }
    }

    // Verify topic belongs to book
    const [topics] = await pool.query(
      'SELECT id FROM topics WHERE id = ? AND book_id = ?',
      [topic_id, book_id]
    );

    if (topics.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Topic not found' 
      }, { status: 404 });
    }

   
    const cloneId = clone_id || Date.now().toString();

    // Get the next sort_order for this topic (max + 1, or 1 if none exist)
    const [maxOrder] = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM subtopics WHERE topic_id = ?',
      [topic_id]
    );
    const nextSortOrder = maxOrder[0].max_order + 1;

    const [result] = await pool.query(
      'INSERT INTO subtopics (name, description, topic_id, book_id, author_id, clone_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name.trim(), description?.trim() || null, topic_id, book_id, authorId, cloneId, nextSortOrder]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Subtopic created successfully',
      id: result.insertId 
    });

  } catch (error) {
    console.error('Error creating subtopic:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create subtopic' 
    }, { status: 500 });
  }
}

// PUT - Update an existing subtopic
export async function PUT(req) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const authorId = decoded.userId;
    const userRole = decoded.role_id;

    const { id, name, description } = await req.json();

    // Validation
    if (!id || !name) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID and name are required' 
      }, { status: 400 });
    }

    // Superadmin can update any subtopic, authors can only update their own
    let result;
    if (userRole === 1) { // SUPERADMIN
      [result] = await pool.query(
        'UPDATE subtopics SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name.trim(), description?.trim() || null, id]
      );
    } else {
      [result] = await pool.query(
        'UPDATE subtopics SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND author_id = ?',
        [name.trim(), description?.trim() || null, id, authorId]
      );
    }

    if (result.affectedRows === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Subtopic not found or unauthorized' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Subtopic updated successfully' 
    });

  } catch (error) {
    console.error('Error updating subtopic:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update subtopic' 
    }, { status: 500 });
  }
}

// DELETE - Delete a subtopic
export async function DELETE(req) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const authorId = decoded.userId;
    const userRole = decoded.role_id;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Subtopic ID is required' 
      }, { status: 400 });
    }

    // Superadmin can delete any subtopic, authors can only delete their own
    let result;
    if (userRole === 1) { // SUPERADMIN
      [result] = await pool.query(
        'DELETE FROM subtopics WHERE id = ?',
        [id]
      );
    } else {
      [result] = await pool.query(
        'DELETE FROM subtopics WHERE id = ? AND author_id = ?',
        [id, authorId]
      );
    }

    if (result.affectedRows === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Subtopic not found or unauthorized' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Subtopic deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting subtopic:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete subtopic' 
    }, { status: 500 });
  }
}
