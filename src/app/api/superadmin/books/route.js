// app/api/superadmin/books/route.js
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
    
    // Check if user is superadmin
    if (decoded.role_id !== 1 && decoded.role_id !== 2) {
      return NextResponse.json({ success: false, error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    // Get all books with their topics, subtopics, and author info
    const [books] = await pool.query(`
      SELECT 
        b.id,
        b.title,
        b.author_id,
        b.created_at,
        u.username as author_name,
        u.email as author_email
      FROM books b
      LEFT JOIN users u ON b.author_id = u.id
      ORDER BY b.created_at DESC
    `);

    // Get topics and subtopics for each book
    for (let book of books) {
      const [topics] = await pool.query(`
        SELECT 
          t.id,
          t.name,
          t.description,
          t.clone_id,
          (SELECT COUNT(*) FROM subtopics WHERE topic_id = t.id) as subtopic_count,
          (SELECT COUNT(*) FROM pages WHERE topic_id = t.id) as page_count
        FROM topics t
        WHERE t.book_id = ?
        ORDER BY t.created_at
      `, [book.id]);
      
      // Get subtopics for each topic
      for (let topic of topics) {
        const [subtopics] = await pool.query(`
          SELECT 
            s.id,
            s.name,
            s.description,
            s.clone_id,
            (SELECT COUNT(*) FROM pages WHERE subtopic_id = s.id) as page_count
          FROM subtopics s
          WHERE s.topic_id = ?
          ORDER BY s.created_at
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

export async function POST(req) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    
    // Check if user is superadmin
    if (decoded.role_id !== 1 && decoded.role_id !== 2) {
      return NextResponse.json({ success: false, error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const superadminId = decoded.userId;
    const { title } = await req.json();

    if (!title) {
      return NextResponse.json({ 
        success: false, 
        error: 'Title is required' 
      }, { status: 400 });
    }

    // Insert book with superadmin as author
    const [bookResult] = await pool.query(
      'INSERT INTO books (title, author_id) VALUES (?, ?)',
      [title, superadminId]
    );

    const bookId = bookResult.insertId;

    return NextResponse.json({ 
      success: true, 
      message: 'Book created successfully',
      bookId 
    });

  } catch (error) {
    console.error('Error creating book:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create book' 
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
    
    // Check if user is superadmin
    if (decoded.role_id !== 1 && decoded.role_id !== 2) {
      return NextResponse.json({ success: false, error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get('id');

    if (!bookId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Book ID is required' 
      }, { status: 400 });
    }

    // Delete book (cascade will handle topics, subtopics, and pages)
    await pool.query('DELETE FROM books WHERE id = ?', [bookId]);

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
