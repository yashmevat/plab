// hooks/useTopicManagement.js
'use client';

export function useTopicManagement(bookManagement) {
  const { 
    topics, 
    setTopics, 
    currentBookId, 
    bookTitle, 
    savingTopics,
    savingSubtopics,
    topicUpdateTimers,
    setLoading,
    saveFormState,
    router
  } = bookManagement;

  const handleAddPages = async (index) => {
    const topic = topics[index];
    
    if (!topic.name.trim()) {
      alert('Please enter topic name first');
      return;
    }
    
    const saveKey = `topic-${index}`;
    
    if (!topic.topicId) {
      if (savingTopics.current.has(saveKey)) {
        setLoading(true);
        const startTime = Date.now();
        while (savingTopics.current.has(saveKey) && Date.now() - startTime < 15000) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const updatedTopic = topics[index];
        if (!updatedTopic.topicId) {
          alert('Topic save failed, please try again');
          setLoading(false);
          return;
        }
        
        setLoading(false);
        router.push(`/author/pages/topic/${updatedTopic.topicId}`);
        return;
      }
      
      savingTopics.current.add(saveKey);
      setLoading(true);
      const res = await fetch('/api/author/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: topic.name, 
          book_id: currentBookId 
        })
      });
      
      const data = await res.json();
      savingTopics.current.delete(saveKey);
      if (data.success) {
        const newTopics = [...topics];
        newTopics[index].topicId = data.topicId;
        setTopics(newTopics);
        saveFormState(bookTitle, currentBookId, newTopics);
        setLoading(false);
        router.push(`/author/pages/topic/${data.topicId}`);
      } else {
        alert('Error: ' + data.error);
        setLoading(false);
      }
    } else {
      router.push(`/author/pages/topic/${topic.topicId}`);
    }
  };

  const handleAddSubtopic = async (topicIndex) => {
    const topic = topics[topicIndex];
    
    if (!topic.name.trim()) {
      alert('Please enter topic name first');
      return;
    }
    
    const saveKey = `topic-${topicIndex}`;
    
    if (!topic.topicId) {
      if (savingTopics.current.has(saveKey)) {
        setLoading(true);
        const startTime = Date.now();
        while (savingTopics.current.has(saveKey) && Date.now() - startTime < 15000) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const updatedTopic = topics[topicIndex];
        if (!updatedTopic.topicId) {
          alert('Topic save failed, please try again');
          setLoading(false);
          return;
        }
        
        const newTopics = [...topics];
        newTopics[topicIndex].hasSubtopics = true;
        newTopics[topicIndex].subtopics.push({
          id: Date.now(),
          name: '',
          subtopicId: null
        });
        setTopics(newTopics);
        saveFormState(bookTitle, currentBookId, newTopics);
        setLoading(false);
        return;
      }
      
      savingTopics.current.add(saveKey);
      setLoading(true);
      const res = await fetch('/api/author/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: topic.name, 
          book_id: currentBookId 
        })
      });
      
      const data = await res.json();
      savingTopics.current.delete(saveKey);
      if (data.success) {
        const newTopics = [...topics];
        newTopics[topicIndex].topicId = data.topicId;
        newTopics[topicIndex].hasSubtopics = true;
        newTopics[topicIndex].subtopics.push({
          id: Date.now(),
          name: '',
          subtopicId: null
        });
        setTopics(newTopics);
        saveFormState(bookTitle, currentBookId, newTopics);
        setLoading(false);
      } else {
        alert('Error: ' + data.error);
        setLoading(false);
      }
    } else {
      const newTopics = [...topics];
      newTopics[topicIndex].hasSubtopics = true;
      newTopics[topicIndex].subtopics.push({
        id: Date.now(),
        name: '',
        subtopicId: null
      });
      setTopics(newTopics);
      saveFormState(bookTitle, currentBookId, newTopics);
    }
  };

  const handleSubtopicChange = async (topicIndex, subtopicIndex, value) => {
    const newTopics = topics.map((topic, ti) => {
      if (ti !== topicIndex) return topic;
      const newSubtopics = (topic.subtopics || []).map((subtopic, si) => 
        si === subtopicIndex ? { ...subtopic, name: value } : subtopic
      );
      return { ...topic, subtopics: newSubtopics };
    });
    setTopics(newTopics);
    saveFormState(bookTitle, currentBookId, newTopics);
    
    // If subtopic already has an ID (saved in backend), update it with debouncing
    const topic = topics[topicIndex];
    const subtopic = topic.subtopics[subtopicIndex];
    if (subtopic.subtopicId && value.trim()) {
      // Create unique key for this subtopic
      const timerKey = `subtopic-${topicIndex}-${subtopicIndex}`;
      
      // Clear previous timer for this subtopic
      if (topicUpdateTimers.current[timerKey]) {
        clearTimeout(topicUpdateTimers.current[timerKey]);
      }
      
      // Set new timer to update after 800ms of no typing
      topicUpdateTimers.current[timerKey] = setTimeout(async () => {
        try {
          const res = await fetch('/api/author/subtopics', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              id: subtopic.subtopicId, 
              name: value,
              topic_id: topic.topicId
            })
          });
          
          const data = await res.json();
          if (!data.success) {
            console.error('Error updating subtopic:', data.error);
          }
        } catch (error) {
          console.error('Error updating subtopic:', error);
        }
      }, 800);
    }
  };

  const handleRemoveSubtopic = async (topicIndex, subtopicIndex) => {
    const subtopic = topics[topicIndex].subtopics[subtopicIndex];
    
    if (subtopic.subtopicId) {
      if (!confirm(`Are you sure you want to delete "${subtopic.name}"? This will also delete all its pages.`)) {
        return;
      }
      
      setLoading(true);
      try {
        const res = await fetch(`/api/author/subtopics?id=${subtopic.subtopicId}`, {
          method: 'DELETE'
        });
        
        const data = await res.json();
        if (!data.success) {
          alert('Error deleting subtopic: ' + data.error);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Error deleting subtopic:', error);
        alert('Failed to delete subtopic');
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    
    const newTopics = [...topics];
    newTopics[topicIndex].subtopics.splice(subtopicIndex, 1);
    
    if (newTopics[topicIndex].subtopics.length === 0) {
      newTopics[topicIndex].hasSubtopics = false;
    }
    
    setTopics(newTopics);
    saveFormState(bookTitle, currentBookId, newTopics);
  };

  const handleAddPagesToSubtopic = async (topicIndex, subtopicIndex) => {
    const topic = topics[topicIndex];
    const subtopic = topic.subtopics[subtopicIndex];
    
    if (!subtopic.name.trim()) {
      alert('Please enter subtopic name first');
      return;
    }
    
    const saveKey = `${topicIndex}-${subtopicIndex}`;
    
    if (!subtopic.subtopicId) {
      if (savingSubtopics.current.has(saveKey)) {
        setLoading(true);
        const startTime = Date.now();
        while (savingSubtopics.current.has(saveKey) && Date.now() - startTime < 15000) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const updatedSubtopic = topics[topicIndex].subtopics[subtopicIndex];
        if (!updatedSubtopic.subtopicId) {
          alert('Subtopic save failed, please try again');
          setLoading(false);
          return;
        }
        
        setLoading(false);
        router.push(`/author/pages/${updatedSubtopic.subtopicId}`);
        return;
      }
      
      savingSubtopics.current.add(saveKey);
      setLoading(true);
      const res = await fetch('/api/author/subtopics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: subtopic.name,
          book_id: currentBookId,
          topic_id: topic.topicId
        })
      });
      
      const data = await res.json();
      savingSubtopics.current.delete(saveKey);
      if (data.success) {
        const newTopics = [...topics];
        newTopics[topicIndex].subtopics[subtopicIndex].subtopicId = data.id;
        setTopics(newTopics);
        saveFormState(bookTitle, currentBookId, newTopics);
        setLoading(false);
        router.push(`/author/pages/${data.id}`);
      } else {
        alert('Error: ' + data.error);
        setLoading(false);
      }
    } else {
      router.push(`/author/pages/${subtopic.subtopicId}`);
    }
  };

  return {
    handleAddPages,
    handleAddSubtopic,
    handleSubtopicChange,
    handleRemoveSubtopic,
    handleAddPagesToSubtopic
  };
}
