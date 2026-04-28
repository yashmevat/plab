// app/api/superadmin/topics/route.js
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
    
    // Check if user is superadmin or author
    if (decoded.role_id !== 1 && decoded.role_id !== 2) {
      return NextResponse.json({ success: false, error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get('bookId');

    if (!bookId) {
      return NextResponse.json({ 
        success: false, 
        error: 'bookId is required' 
      }, { status: 400 });
    }

    // Fetch topics for the book with subtopic count
    const [topics] = await pool.query(
      `SELECT t.*, 
        (SELECT COUNT(*) FROM subtopics WHERE topic_id = t.id) as subtopic_count
       FROM topics t 
       WHERE t.book_id = ?
       ORDER BY t.sort_order, t.id`,
      [bookId]
    );

    return NextResponse.json({ 
      success: true, 
      data: topics
    });

  } catch (error) {
    console.error('Error fetching topics:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch topics' 
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
    if (decoded.role_id !== 1 &&decoded.role_id !== 2) {
      return NextResponse.json({ success: false, error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { name, book_id } = await req.json();

    if (!name || !book_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Name and book_id are required' 
      }, { status: 400 });
    }

    const cloneId = Date.now().toString();
    // Insert topic (no author_id in topics table according to schema)
    const [result] = await pool.query(
      'INSERT INTO topics (name, book_id, description, clone_id) VALUES (?, ?, ?, ?)',
      [name, book_id, null, cloneId]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Topic created successfully',
      topicId: result.insertId
    });

  } catch (error) {
    console.error('Error creating topic:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create topic' 
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
    
    // Check if user is superadmin
    if (decoded.role_id !== 1 &&decoded.role_id !== 2) {
      return NextResponse.json({ success: false, error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { id, name } = await req.json();

    if (!id || !name) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID and name are required' 
      }, { status: 400 });
    }

    // Update topic
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
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update topic' 
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
    const topicId = searchParams.get('id');

    if (!topicId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Topic ID is required' 
      }, { status: 400 });
    }

    // Delete topic (cascade will handle subtopics and pages)
    await pool.query('DELETE FROM topics WHERE id = ?', [topicId]);

    return NextResponse.json({ 
      success: true, 
      message: 'Topic deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting topic:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete topic' 
    }, { status: 500 });
  }
}
