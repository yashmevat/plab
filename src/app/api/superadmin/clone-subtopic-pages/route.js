// app/api/superadmin/clone-subtopic-pages/route.js
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import pool from '@/lib/db';

export async function POST(req) {
  const connection = await pool.getConnection();
  
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

    const { originalSubtopicId, newSubtopicId, newTopicId } = await req.json();

    if (!originalSubtopicId || !newSubtopicId || !newTopicId) {
      return NextResponse.json({ 
        success: false, 
        error: 'originalSubtopicId, newSubtopicId, and newTopicId are required' 
      }, { status: 400 });
    }

    await connection.beginTransaction();

    // Get all pages from original subtopic
    const [originalPages] = await connection.query(
      'SELECT * FROM pages WHERE subtopic_id = ? ORDER BY id',
      [originalSubtopicId]
    );

    let pagesCopied = 0;

    // Copy each page to the new subtopic
    for (const page of originalPages) {
      await connection.query(
        'INSERT INTO pages (topic_id, subtopic_id, content) VALUES (?, ?, ?)',
        [newTopicId, newSubtopicId, page.content]
      );
      pagesCopied++;
    }

    await connection.commit();

    return NextResponse.json({ 
      success: true, 
      message: `Successfully copied ${pagesCopied} pages`,
      pagesCopied
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error cloning subtopic pages:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to clone subtopic pages: ' + error.message 
    }, { status: 500 });
  } finally {
    connection.release();
  }
}
