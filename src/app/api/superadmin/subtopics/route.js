// app/api/superadmin/subtopics/route.js
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
    const topicId = searchParams.get('topicId');

    if (!topicId) {
      return NextResponse.json({ 
        success: false, 
        error: 'topicId is required' 
      }, { status: 400 });
    }

    // Fetch subtopics for the topic
    const [subtopics] = await pool.query(
      `SELECT * FROM subtopics 
       WHERE topic_id = ?
       ORDER BY sort_order, id`,
      [topicId]
    );

    return NextResponse.json({ 
      success: true, 
      data: subtopics
    });

  } catch (error) {
    console.error('Error fetching subtopics:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch subtopics' 
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
    const { name, book_id, topic_id } = await req.json();

    if (!name || !book_id || !topic_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Name, book_id, and topic_id are required' 
      }, { status: 400 });
    }


    const cloneId = Date.now().toString();
    // Insert subtopic
    const [result] = await pool.query(
      'INSERT INTO subtopics (name, book_id, topic_id, author_id, clone_id) VALUES (?, ?, ?, ?, ?)',
      [name, book_id, topic_id, superadminId, cloneId]
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

    // Update subtopic
    await pool.query(
      'UPDATE subtopics SET name = ? WHERE id = ?',
      [name, id]
    );

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
    const subtopicId = searchParams.get('id');

    if (!subtopicId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Subtopic ID is required' 
      }, { status: 400 });
    }

    // Delete subtopic (cascade will handle pages)
    await pool.query('DELETE FROM subtopics WHERE id = ?', [subtopicId]);

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
