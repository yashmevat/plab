// app/api/superadmin/clone-topic/route.js
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
    
    // Check if user is superadmin or author
    if (decoded.role_id !== 1 && decoded.role_id !== 2) {
      return NextResponse.json({ success: false, error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const superadminId = decoded.userId;
    const { topic_id, new_book_id, new_topic_name } = await req.json();

    if (!topic_id || !new_book_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'topic_id and new_book_id are required' 
      }, { status: 400 });
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get original topic
      const [topics] = await connection.query(
        'SELECT * FROM topics WHERE id = ?',
        [topic_id]
      );

      if (topics.length === 0) {
        await connection.rollback();
        connection.release();
        return NextResponse.json({ 
          success: false, 
          error: 'Topic not found' 
        }, { status: 404 });
      }

      const originalTopic = topics[0];

      // Get or generate topic clone_id
      let topicCloneId = originalTopic.clone_id;
      
      if (!topicCloneId) {
        const randomNumber = Math.floor(100000 + Math.random() * 900000);
        const timestamp = Date.now();
        topicCloneId = `${randomNumber}-${timestamp}`;
        await connection.query(
          'UPDATE topics SET clone_id = ? WHERE id = ?',
          [topicCloneId, topic_id]
        );
      }

      // Get next sort_order for the target book
      const [maxTopicOrder] = await connection.query(
        'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM topics WHERE book_id = ?',
        [new_book_id]
      );
      const nextTopicSortOrder = maxTopicOrder[0].max_order + 1;

      // Create new topic with same clone_id and proper sort_order
      const topicName = new_topic_name || originalTopic.name;
      const [topicResult] = await connection.query(
        'INSERT INTO topics (name, book_id, description, clone_id, sort_order) VALUES (?, ?, ?, ?, ?)',
        [topicName, new_book_id, originalTopic.description, topicCloneId, nextTopicSortOrder]
      );

      const newTopicId = topicResult.insertId;

      // Get all subtopics of the original topic
      const [subtopics] = await connection.query(
        'SELECT * FROM subtopics WHERE topic_id = ?',
        [topic_id]
      );

      const subtopicIdMap = {}; // Map old subtopic IDs to new ones

      // Get the starting sort_order for subtopics in the new topic
      const [maxSubtopicOrder] = await connection.query(
        'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM subtopics WHERE topic_id = ?',
        [newTopicId]
      );
      let nextSubtopicSortOrder = maxSubtopicOrder[0].max_order + 1;

      // Clone each subtopic
      for (const subtopic of subtopics) {
        // Get or generate subtopic clone_id
        let subtopicCloneId = subtopic.clone_id;
        
        if (!subtopicCloneId) {
          const randomNumber = Math.floor(100000 + Math.random() * 900000);
          const timestamp = Date.now();
          subtopicCloneId = `${randomNumber}-${timestamp}`;
          await connection.query(
            'UPDATE subtopics SET clone_id = ? WHERE id = ?',
            [subtopicCloneId, subtopic.id]
          );
        }

        const [subtopicResult] = await connection.query(
          'INSERT INTO subtopics (name, book_id, topic_id, author_id, description, clone_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [subtopic.name, new_book_id, newTopicId, superadminId, subtopic.description, subtopicCloneId, nextSubtopicSortOrder]
        );

        subtopicIdMap[subtopic.id] = subtopicResult.insertId;
        nextSubtopicSortOrder++; // Increment for next subtopic
      }

      // Get all pages for the topic (direct pages without subtopic)
      const [topicPages] = await connection.query(
        'SELECT * FROM pages WHERE topic_id = ? AND subtopic_id IS NULL',
        [topic_id]
      );

      // Clone topic pages (pages table only has: id, topic_id, subtopic_id, content, created_at)
      for (const page of topicPages) {
        await connection.query(
          'INSERT INTO pages (topic_id, subtopic_id, content) VALUES (?, ?, ?)',
          [newTopicId, null, page.content]
        );
      }

      // Get all pages for subtopics
      const [subtopicPages] = await connection.query(
        'SELECT * FROM pages WHERE topic_id = ? AND subtopic_id IS NOT NULL',
        [topic_id]
      );

      // Clone subtopic pages
      for (const page of subtopicPages) {
        const newSubtopicId = subtopicIdMap[page.subtopic_id];
        if (newSubtopicId) {
          await connection.query(
            'INSERT INTO pages (topic_id, subtopic_id, content) VALUES (?, ?, ?)',
            [newTopicId, newSubtopicId, page.content]
          );
        }
      }

      await connection.commit();
      connection.release();

      return NextResponse.json({ 
        success: true, 
        message: 'Topic cloned successfully',
        data: {
          newTopicId,
          originalTopicId: topic_id,
          subtopicsCloned: subtopics.length,
          pagesCloned: topicPages.length + subtopicPages.length,
          subtopicIdMap // Return mapping of original subtopic IDs to new ones
        }
      });

    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (error) {
    console.error('Error cloning topic:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to clone topic: ' + error.message 
    }, { status: 500 });
  }
}
