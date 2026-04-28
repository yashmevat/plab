// hooks/useDragAndDrop.js
'use client';
import { arrayMove } from '@dnd-kit/sortable';

export function useDragAndDrop(bookManagement) {
  const { topics, setTopics, currentBookId, bookTitle, saveFormState } = bookManagement;

  const handleTopicDragEnd = async (event) => {
    const { active, over } = event;
    
    console.log('🔄 Topic drag event:', { active: active.id, over: over?.id });
    
    if (!over || active.id === over.id) {
      console.log('❌ No drop or same position');
      return;
    }

    const oldIndex = topics.findIndex(t => t.id === active.id);
    const newIndex = topics.findIndex(t => t.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) {
      console.log('❌ Invalid index:', { oldIndex, newIndex });
      return;
    }

    const newTopics = arrayMove(topics, oldIndex, newIndex);
    setTopics(newTopics);
    saveFormState(bookTitle, currentBookId, newTopics);

    console.log('✅ Local reorder done');

    if (currentBookId) {
      const topicIdsWithDb = newTopics
        .filter(t => t.topicId)
        .map(t => t.topicId);
      
      console.log('🔍 Filtered topic IDs with DB:', topicIdsWithDb);
      
      if (topicIdsWithDb.length > 0) {
        try {
          console.log('📡 Calling API with:', { bookId: currentBookId, orderedIds: topicIdsWithDb });
          const res = await fetch('/api/author/reorder-topics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              bookId: currentBookId, 
              orderedIds: topicIdsWithDb 
            })
          });
          const data = await res.json();
          console.log('✅ API response:', data);
        } catch (error) {
          console.error('❌ Error saving topic order:', error);
        }
      } else {
        console.log('⚠️ No topics with DB IDs to sync');
      }
    } else {
      console.log('⚠️ Book not saved yet (no currentBookId)');
    }
  };

  const handleSubtopicDragEnd = (topicIndex) => async (event) => {
    const { active, over } = event;

    console.log('🔄 Subtopic drag event:', { active: active.id, over: over?.id, topicIndex });

    if (!over || active.id === over.id) {
      console.log('❌ No drop or same position');
      return;
    }

    const activeId = active.id.toString().replace('subtopic-', '');
    const overId = over.id.toString().replace('subtopic-', '');

    const topic = topics[topicIndex];
    const subtopics = topic.subtopics || [];

    console.log('📋 Topic:', topic.name, 'TopicId:', topic.topicId);
    console.log('📋 Current subtopics:', subtopics.map(s => ({ id: s.id, subtopicId: s.subtopicId, name: s.name })));
    console.log('📋 Active subtopic ID:', activeId, 'Over subtopic ID:', overId);

    const oldIndex = subtopics.findIndex(s => s.id.toString() === activeId);
    const newIndex = subtopics.findIndex(s => s.id.toString() === overId);

    if (oldIndex === -1 || newIndex === -1) {
      console.log('❌ Invalid index:', { oldIndex, newIndex });
      return;
    }

    const newSubtopics = arrayMove(subtopics, oldIndex, newIndex);
    const newTopics = [...topics];
    newTopics[topicIndex].subtopics = newSubtopics;
    setTopics(newTopics);
    saveFormState(bookTitle, currentBookId, newTopics);

    console.log('✅ Local reorder done');

    if (topic.topicId) {
      const subtopicIdsWithDb = newSubtopics
        .filter(s => s.subtopicId)
        .map(s => s.subtopicId);

      console.log('🔍 Filtered subtopic IDs with DB:', subtopicIdsWithDb);

      if (subtopicIdsWithDb.length > 0) {
        try {
          console.log('📡 Calling API with:', { topicId: topic.topicId, orderedIds: subtopicIdsWithDb });
          const res = await fetch('/api/author/reorder-subtopics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              topicId: topic.topicId, 
              orderedIds: subtopicIdsWithDb 
            })
          });
          const data = await res.json();
          console.log('✅ API response:', data);
        } catch (error) {
          console.error('❌ Error saving subtopic order:', error);
        }
      } else {
        console.log('⚠️ No subtopics with DB IDs to sync');
      }
    } else {
      console.log('⚠️ Topic not saved yet (no topicId)');
    }
  };

  return {
    handleTopicDragEnd,
    handleSubtopicDragEnd
  };
}
