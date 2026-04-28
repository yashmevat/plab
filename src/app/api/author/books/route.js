// app/api/author/books/route.js
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import pool from '@/lib/db';

export async function POST(req) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const authorId = decoded.userId;

    const { title } = await req.json();

    if (!title) {
      return NextResponse.json({ 
        success: false, 
        error: 'Title is required' 
      }, { status: 400 });
    }

    // Generate a compact unique identifier for cloning
    // Use timestamp-only to avoid truncation if DB column is small
    const cloneId = Date.now().toString();

    // Insert book with clone_id as unique identifier
    const [bookResult] = await pool.query(
      'INSERT INTO books (title, author_id, clone_id) VALUES (?, ?, ?)',
      [title, authorId, cloneId]
    );

    const bookId = bookResult.insertId;

    return NextResponse.json({ 
      success: true, 
      message: 'Book created successfully',
      bookId,
      cloneId
    });

  } catch (error) {
    console.error('Error creating book:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create book' 
    }, { status: 500 });
  }
}

// app/api/author/books/route.js - GET method
export async function GET(req) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const authorId = decoded.userId;

    // Get books with their topics
    const [books] = await pool.query(`
      SELECT 
        b.id,
        b.title,
        b.created_at
      FROM books b
      WHERE b.author_id = ?
      ORDER BY b.created_at DESC
    `, [authorId]);

    // Get topics for each book with subtopic count
    for (let book of books) {
      const [topics] = await pool.query(`
        SELECT 
          t.id,
          t.name,
          t.clone_id,
          (SELECT COUNT(*) FROM subtopics WHERE topic_id = t.id) as subtopic_count
        FROM topics t
        WHERE t.book_id = ?
        ORDER BY t.sort_order, t.created_at
      `, [book.id]);
      
      // Get subtopics for each topic
      for (let topic of topics) {
        const [subtopics] = await pool.query(`
          SELECT 
            id,
            name,
            description,
            clone_id
          FROM subtopics
          WHERE topic_id = ?
          ORDER BY sort_order, created_at
        `, [topic.id]);
        
        topic.subtopics = subtopics;
      }
      
      book.topics = topics;
    }

    return NextResponse.json({ success: true, data: books });

  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch books' 
    }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const authorId = decoded.userId;

    const { id, title } = await req.json();

    if (!id || !title) {
      return NextResponse.json({ 
        success: false, 
        error: 'Book ID and title are required' 
      }, { status: 400 });
    }

    // Update book
    const [result] = await pool.query(
      'UPDATE books SET title = ? WHERE id = ? AND author_id = ?',
      [title, id, authorId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Book not found or unauthorized' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Book updated successfully' 
    });

  } catch (error) {
    console.error('Error updating book:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update book' 
    }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const authorId = decoded.userId;

    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get('id');

    if (!bookId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Book ID required' 
      }, { status: 400 });
    }

    // Delete book (topics will be deleted by CASCADE)
    const [result] = await pool.query(
      'DELETE FROM books WHERE id = ? AND author_id = ?',
      [bookId, authorId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Book not found or unauthorized' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Book deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting book:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete book' 
    }, { status: 500 });
  }
}