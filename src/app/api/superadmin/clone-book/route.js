// app/api/superadmin/clone-book/route.js
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import pool from '@/lib/db';

export async function POST(req) {
  const connection = await pool.getConnection();
  
  console.log('=== CLONE BOOK API CALLED ===', new Date().toISOString());
  console.log('Code version: WITH PAGE CLONING');
  
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

    const { bookId, newTitle } = await req.json();

    if (!bookId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Book ID is required' 
      }, { status: 400 });
    }

    await connection.beginTransaction();

    // Get original book details
    const [originalBooks] = await connection.query(
      'SELECT * FROM books WHERE id = ?',
      [bookId]
    );

    if (originalBooks.length === 0) {
      await connection.rollback();
      return NextResponse.json({ 
        success: false, 
        error: 'Book not found' 
      }, { status: 404 });
    }

    const originalBook = originalBooks[0];
    const bookTitle = newTitle || `${originalBook.title} (Clone)`;

    // Get or generate clone_id (shared group identifier)
    let groupCloneId = originalBook.clone_id;
    
    if (!groupCloneId) {
      // Generate a unique clone_id for the group
      groupCloneId = Date.now().toString();
      
      
      // Set it on the original book
      await connection.query(
        'UPDATE books SET clone_id = ? WHERE id = ?',
        [groupCloneId, bookId]
      );
    }

    // Create new book with same clone_id (joins the group)
    const [newBookResult] = await connection.query(
      'INSERT INTO books (title, author_id, clone_id) VALUES (?, ?, ?)',
      [bookTitle, decoded.userId, groupCloneId]
    );

    const newBookId = newBookResult.insertId;

    // Get all topics for the original book
    const [topics] = await connection.query(
      'SELECT * FROM topics WHERE book_id = ?',
      [bookId]
    );

    const topicIdMap = {}; // oldTopicId -> newTopicId mapping

    // Clone topics
    for (const topic of topics) {
      // Get or generate topic clone_id
      let topicCloneId = topic.clone_id;
      
      if (!topicCloneId) {
        const randomNumber = Math.floor(100000 + Math.random() * 900000);
        const timestamp = Date.now();
        topicCloneId = `${randomNumber}-${timestamp}`;
        await connection.query(
          'UPDATE topics SET clone_id = ? WHERE id = ?',
          [topicCloneId, topic.id]
        );
      }

      const [newTopicResult] = await connection.query(
        'INSERT INTO topics (name, description, book_id, clone_id) VALUES (?, ?, ?, ?)',
        [topic.name, topic.description, newBookId, topicCloneId]
      );

      const newTopicId = newTopicResult.insertId;
      topicIdMap[topic.id] = newTopicId;

      // Get all subtopics for this topic
      const [subtopics] = await connection.query(
        'SELECT * FROM subtopics WHERE topic_id = ?',
        [topic.id]
      );

      const subtopicIdMap = {}; // oldSubtopicId -> newSubtopicId mapping

      // Clone subtopics
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

        const [newSubtopicResult] = await connection.query(
          'INSERT INTO subtopics (name, description, topic_id, book_id, author_id, clone_id) VALUES (?, ?, ?, ?, ?, ?)',
          [subtopic.name, subtopic.description, newTopicId, newBookId, decoded.userId, subtopicCloneId]
        );

        const newSubtopicId = newSubtopicResult.insertId;
        subtopicIdMap[subtopic.id] = newSubtopicId;

        // Get and clone pages for this subtopic
        const [subtopicPages] = await connection.query(
          'SELECT * FROM pages WHERE subtopic_id = ?',
          [subtopic.id]
        );

        console.log(`Cloning ${subtopicPages.length} pages for subtopic ${subtopic.id} -> ${newSubtopicId}`);

        for (const page of subtopicPages) {
          await connection.query(
            'INSERT INTO pages (topic_id, subtopic_id, content) VALUES (?, ?, ?)',
            [newTopicId, newSubtopicId, page.content]
          );
        }
      }

      // Get and clone pages directly under this topic (no subtopic)
      const [topicPages] = await connection.query(
        'SELECT * FROM pages WHERE topic_id = ? AND subtopic_id IS NULL',
        [topic.id]
      );

      console.log(`Cloning ${topicPages.length} direct pages for topic ${topic.id} -> ${newTopicId}`);

      for (const page of topicPages) {
        await connection.query(
          'INSERT INTO pages (topic_id, subtopic_id, content) VALUES (?, ?, ?)',
          [newTopicId, null, page.content]
        );
      }
    }

    await connection.commit();

    console.log(`✓ Book cloned successfully: ${bookId} -> ${newBookId}`);
    console.log(`✓ Total topics cloned: ${topics.length}`);

    // Fetch the newly created book with all its data
    const [newBooks] = await connection.query(`
      SELECT 
        b.id,
        b.title,
        b.author_id,
        b.created_at
      FROM books b
      WHERE b.id = ?
    `, [newBookId]);

    const newBook = newBooks[0];

    // Get topics with subtopics for the new book
    const [newTopics] = await connection.query(`
      SELECT 
        t.id,
        t.name,
        t.description,
        t.clone_id
      FROM topics t
      WHERE t.book_id = ?
      ORDER BY t.created_at
    `, [newBookId]);

    for (let topic of newTopics) {
      const [subtopics] = await connection.query(`
        SELECT 
          id,
          name,
          description,
          clone_id
        FROM subtopics
        WHERE topic_id = ?
        ORDER BY created_at
      `, [topic.id]);
      
      topic.subtopics = subtopics;
    }

    newBook.topics = newTopics;

    return NextResponse.json({ 
      success: true, 
      message: 'Book cloned successfully',
      data: {
        newBookId,
        originalBookId: bookId,
        book: newBook
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error cloning book:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to clone book: ' + error.message 
    }, { status: 500 });
  } finally {
    connection.release();
  }
}
