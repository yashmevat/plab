// app/api/superadmin/sync-changes/route.js
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

    const { changes, clonedTopics, currentTopics } = await req.json();
    
    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      let updatedCount = 0;
      const superadminId = decoded.userId;

      // First, sync topic/subtopic name and description changes using clone_id
      if (changes && Array.isArray(changes)) {
        for (const change of changes) {
          const { type, id, originalId, data, syncToOriginal } = change;

          if (!syncToOriginal) {
            continue;
          }

          if (type === 'topic') {
            // Get clone_id from original topic
            const [originalTopic] = await connection.query(
              'SELECT clone_id FROM topics WHERE id = ?',
              [originalId]
            );
            
            if (originalTopic.length > 0 && originalTopic[0].clone_id) {
              // Update ALL topics with matching clone_id
              const [result] = await connection.query(
                'UPDATE topics SET name = ?, description = ? WHERE clone_id = ?',
                [data.name, data.description || null, originalTopic[0].clone_id]
              );
              updatedCount += result.affectedRows;
            }
          } else if (type === 'subtopic') {
            // Get clone_id from original subtopic
            const [originalSubtopic] = await connection.query(
              'SELECT clone_id FROM subtopics WHERE id = ?',
              [originalId]
            );
            
            if (originalSubtopic.length > 0 && originalSubtopic[0].clone_id) {
              // Update ALL subtopics with matching clone_id
              const [result] = await connection.query(
                'UPDATE subtopics SET name = ?, description = ? WHERE clone_id = ?',
                [data.name, data.description || null, originalSubtopic[0].clone_id]
              );
              updatedCount += result.affectedRows;
            }
          }
        }
      }

      // Sync subtopics sort_order for cloned topics - sync everywhere based on clone_id
      if (clonedTopics && Array.isArray(clonedTopics) && currentTopics && Array.isArray(currentTopics)) {
        for (const clonedTopic of clonedTopics) {
          const { newTopicId, originalTopicId } = clonedTopic;
          
          // Get all subtopics from the new topic with their sort_order and clone_id
          const [sourceSubtopics] = await connection.query(
            'SELECT id, clone_id, sort_order FROM subtopics WHERE topic_id = ? AND clone_id IS NOT NULL',
            [newTopicId]
          );
          
          // For each subtopic, update sort_order everywhere with same clone_id
          for (const sourceSubtopic of sourceSubtopics) {
            if (sourceSubtopic.clone_id) {
              await connection.query(
                'UPDATE subtopics SET sort_order = ? WHERE clone_id = ? AND id != ?',
                [sourceSubtopic.sort_order, sourceSubtopic.clone_id, sourceSubtopic.id]
              );
            }
          }
        }
      }

      // Handle ALL new subtopics for cloned topics (manually added OR newly cloned) - sync everywhere
      if (clonedTopics && Array.isArray(clonedTopics) && currentTopics && Array.isArray(currentTopics)) {
        for (const clonedTopic of clonedTopics) {
          const { newTopicId, originalTopicId, subtopics: originalClonedSubtopics } = clonedTopic;
          
          // Find corresponding current topic to check for ALL subtopics
          const currentTopic = currentTopics.find(t => t.topicId === newTopicId && t.isCloned);
          
          if (currentTopic && currentTopic.subtopics) {
            // Get clone_id of the topic to find ALL topics with same clone_id
            const [topicCloneData] = await connection.query(
              'SELECT clone_id, book_id FROM topics WHERE id = ?',
              [originalTopicId]
            );
            
            if (topicCloneData.length > 0 && topicCloneData[0].clone_id) {
              const topicCloneId = topicCloneData[0].clone_id;
              
              // Find ALL topics everywhere with this clone_id
              const [allMatchingTopics] = await connection.query(
                'SELECT id, book_id FROM topics WHERE clone_id = ?',
                [topicCloneId]
              );
              
              // Process ALL subtopics from current topic
              for (const subtopic of currentTopic.subtopics) {
                // Only process saved subtopics
                if (!subtopic.subtopicId) continue;
                
                // Get the subtopic details from database (including clone_id and sort_order)
                const [subtopicDetails] = await connection.query(
                  'SELECT id, name, description, clone_id, sort_order FROM subtopics WHERE id = ?',
                  [subtopic.subtopicId]
                );
                
                if (subtopicDetails.length > 0) {
                  const subtopicData = subtopicDetails[0];
                  let subtopicCloneId = subtopicData.clone_id;
                  
                  // If subtopic doesn't have clone_id, generate one and update
                  if (!subtopicCloneId) {
                    subtopicCloneId = `clone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    await connection.query(
                      'UPDATE subtopics SET clone_id = ? WHERE id = ?',
                      [subtopicCloneId, subtopicData.id]
                    );
                  }
                  
                  // Create this subtopic in ALL matching topics if it doesn't exist
                  for (const matchingTopic of allMatchingTopics) {
                    // Skip the current topic itself
                    if (matchingTopic.id === newTopicId) continue;
                    
                    // Check if subtopic already exists in this topic
                    const [existingCheck] = await connection.query(
                      'SELECT id FROM subtopics WHERE topic_id = ? AND clone_id = ?',
                      [matchingTopic.id, subtopicCloneId]
                    );
                    
                    if (existingCheck.length === 0) {
                      // Subtopic doesn't exist, create it
                      const [insertResult] = await connection.query(
                        'INSERT INTO subtopics (name, book_id, topic_id, author_id, description, clone_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [subtopicData.name, matchingTopic.book_id, matchingTopic.id, superadminId, subtopicData.description, subtopicCloneId, subtopicData.sort_order]
                      );
                      
                      const newSubtopicId = insertResult.insertId;
                      updatedCount++;
                      
                      // Copy pages from source subtopic
                      const [sourcePages] = await connection.query(
                        'SELECT content FROM pages WHERE subtopic_id = ? ORDER BY id',
                        [subtopicData.id]
                      );
                      
                      for (const page of sourcePages) {
                        await connection.query(
                          'INSERT INTO pages (topic_id, subtopic_id, content) VALUES (?, ?, ?)',
                          [matchingTopic.id, newSubtopicId, page.content]
                        );
                        updatedCount++;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Handle deleted subtopics for cloned topics - delete everywhere based on clone_id
      if (clonedTopics && Array.isArray(clonedTopics) && currentTopics && Array.isArray(currentTopics)) {
        for (const clonedTopic of clonedTopics) {
          const { newTopicId, originalTopicId, subtopics: clonedSubtopics } = clonedTopic;
          
          // Find corresponding current topic
          const currentTopic = currentTopics.find(t => t.topicId === newTopicId && t.isCloned);
          
          if (currentTopic && clonedSubtopics && Array.isArray(clonedSubtopics)) {
            // Get current subtopic IDs in the new book
            const currentSubtopicIds = new Set(
              (currentTopic.subtopics || []).map(s => s.subtopicId).filter(id => id)
            );
            
            // Find deleted subtopics (were in original clone but not in current)
            const deletedSubtopics = clonedSubtopics.filter(
              s => s.newSubtopicId && !currentSubtopicIds.has(s.newSubtopicId) && s.originalSubtopicId
            );
            
            // Delete these subtopics EVERYWHERE based on clone_id
            for (const deletedSubtopic of deletedSubtopics) {
              // Get clone_id of the deleted subtopic
              const [subtopicCloneData] = await connection.query(
                'SELECT clone_id FROM subtopics WHERE id = ?',
                [deletedSubtopic.originalSubtopicId]
              );
              
              if (subtopicCloneData.length > 0 && subtopicCloneData[0].clone_id) {
                const subtopicCloneId = subtopicCloneData[0].clone_id;
                
                // Find ALL subtopics with this clone_id
                const [allMatchingSubtopics] = await connection.query(
                  'SELECT id FROM subtopics WHERE clone_id = ?',
                  [subtopicCloneId]
                );
                
                // Delete all matching subtopics and their pages
                for (const matchingSubtopic of allMatchingSubtopics) {
                  await connection.query(
                    'DELETE FROM pages WHERE subtopic_id = ?',
                    [matchingSubtopic.id]
                  );
                  
                  await connection.query(
                    'DELETE FROM subtopics WHERE id = ?',
                    [matchingSubtopic.id]
                  );
                  
                  updatedCount++;
                }
              }
            }
          }
        }
      }

      // Now sync all pages for cloned topics - sync EVERYWHERE based on clone_id
      if (clonedTopics && Array.isArray(clonedTopics)) {
        for (const clonedTopic of clonedTopics) {
          const { newTopicId, originalTopicId, subtopics } = clonedTopic;

          // Get clone_id of the topic
          const [topicCloneData] = await connection.query(
            'SELECT clone_id FROM topics WHERE id = ?',
            [originalTopicId]
          );
          
          if (topicCloneData.length > 0 && topicCloneData[0].clone_id) {
            const topicCloneId = topicCloneData[0].clone_id;
            
            // Find ALL topics with this clone_id
            const [allMatchingTopics] = await connection.query(
              'SELECT id FROM topics WHERE clone_id = ?',
              [topicCloneId]
            );
            
            // Get pages from the source (new) topic
            const [sourceTopicPages] = await connection.query(
              'SELECT content FROM pages WHERE topic_id = ? AND subtopic_id IS NULL ORDER BY id',
              [newTopicId]
            );
            
            // Sync pages to ALL matching topics
            for (const matchingTopic of allMatchingTopics) {
              // Skip the source topic itself
              if (matchingTopic.id === newTopicId) continue;
              
              const [existingPages] = await connection.query(
                'SELECT id FROM pages WHERE topic_id = ? AND subtopic_id IS NULL ORDER BY id',
                [matchingTopic.id]
              );
              
              // Delete extra pages if target has more than source
              if (existingPages.length > sourceTopicPages.length) {
                for (let i = sourceTopicPages.length; i < existingPages.length; i++) {
                  await connection.query('DELETE FROM pages WHERE id = ?', [existingPages[i].id]);
                  updatedCount++;
                }
              }
              
              // Update existing and add new pages
              for (let i = 0; i < sourceTopicPages.length; i++) {
                if (i < existingPages.length) {
                  await connection.query(
                    'UPDATE pages SET content = ? WHERE id = ?',
                    [sourceTopicPages[i].content, existingPages[i].id]
                  );
                  updatedCount++;
                } else {
                  await connection.query(
                    'INSERT INTO pages (topic_id, subtopic_id, content) VALUES (?, NULL, ?)',
                    [matchingTopic.id, sourceTopicPages[i].content]
                  );
                  updatedCount++;
                }
              }
            }
          }

          // Sync pages for each subtopic - sync EVERYWHERE based on clone_id
          if (subtopics && Array.isArray(subtopics)) {
            for (const subtopic of subtopics) {
              const { newSubtopicId, originalSubtopicId } = subtopic;

              if (!originalSubtopicId) continue;

              // Get clone_id of the subtopic
              const [subtopicCloneData] = await connection.query(
                'SELECT clone_id FROM subtopics WHERE id = ?',
                [originalSubtopicId]
              );
              
              if (subtopicCloneData.length > 0 && subtopicCloneData[0].clone_id) {
                const subtopicCloneId = subtopicCloneData[0].clone_id;
                
                // Find ALL subtopics with this clone_id
                const [allMatchingSubtopics] = await connection.query(
                  'SELECT id, topic_id FROM subtopics WHERE clone_id = ?',
                  [subtopicCloneId]
                );
                
                // Get pages from the source (new) subtopic
                const [sourceSubtopicPages] = await connection.query(
                  'SELECT content FROM pages WHERE subtopic_id = ? ORDER BY id',
                  [newSubtopicId]
                );
                
                // Sync pages to ALL matching subtopics
                for (const matchingSubtopic of allMatchingSubtopics) {
                  // Skip the source subtopic itself
                  if (matchingSubtopic.id === newSubtopicId) continue;
                  
                  const [existingPages] = await connection.query(
                    'SELECT id FROM pages WHERE subtopic_id = ? ORDER BY id',
                    [matchingSubtopic.id]
                  );
                  
                  // Delete extra pages if target has more than source
                  if (existingPages.length > sourceSubtopicPages.length) {
                    for (let i = sourceSubtopicPages.length; i < existingPages.length; i++) {
                      await connection.query('DELETE FROM pages WHERE id = ?', [existingPages[i].id]);
                      updatedCount++;
                    }
                  }
                  
                  // Update existing and add new pages
                  for (let i = 0; i < sourceSubtopicPages.length; i++) {
                    if (i < existingPages.length) {
                      await connection.query(
                        'UPDATE pages SET content = ? WHERE id = ?',
                        [sourceSubtopicPages[i].content, existingPages[i].id]
                      );
                      updatedCount++;
                    } else {
                      await connection.query(
                        'INSERT INTO pages (topic_id, subtopic_id, content) VALUES (?, ?, ?)',
                        [matchingSubtopic.topic_id, matchingSubtopic.id, sourceSubtopicPages[i].content]
                      );
                      updatedCount++;
                    }
                  }
                }
              }
            }
          }
        }
      }

      await connection.commit();
      connection.release();

      return NextResponse.json({ 
        success: true, 
        message: `Successfully synced ${updatedCount} changes to original book(s)`,
        updatedCount
      });

    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }

  } catch (error) {
    console.error('Error syncing changes:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to sync changes: ' + error.message 
    }, { status: 500 });
  }
}
