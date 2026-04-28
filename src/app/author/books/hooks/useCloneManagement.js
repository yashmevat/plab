// hooks/useCloneManagement.js
'use client';
import { useState } from 'react';

export function useCloneManagement(bookManagement) {
  const { 
    bookTitle, 
    currentBookId, 
    setCurrentBookId, 
    topics, 
    setTopics, 
    setLoading, 
    savingTopics,
    saveFormState,
    fetchBooks 
  } = bookManagement;

  // Clone Topic Modal State
  const [showCloneTopicModal, setShowCloneTopicModal] = useState(false);
  const [allBooks, setAllBooks] = useState([]);
  const [selectedSourceBook, setSelectedSourceBook] = useState('');
  const [availableTopics, setAvailableTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [topicTitles, setTopicTitles] = useState({});

  // Clone Subtopic Modal State
  const [showCloneSubtopicModal, setShowCloneSubtopicModal] = useState(false);
  const [selectedSourceBookForSubtopic, setSelectedSourceBookForSubtopic] = useState('');
  const [availableTopicsForSubtopic, setAvailableTopicsForSubtopic] = useState([]);
  const [selectedSourceTopic, setSelectedSourceTopic] = useState('');
  const [availableSubtopics, setAvailableSubtopics] = useState([]);
  const [selectedSubtopics, setSelectedSubtopics] = useState([]);
  const [subtopicTitles, setSubtopicTitles] = useState({});
  const [targetTopicIndex, setTargetTopicIndex] = useState(null);

  // Sync Changes Modal State
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleOpenCloneTopicModal = async () => {
    if (!bookTitle.trim()) {
      alert('Please enter a book title first');
      return;
    }

    let bookId = currentBookId;

    if (!bookId) {
      setLoading(true);
      const res = await fetch('/api/author/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bookTitle })
      });
      
      const data = await res.json();
      if (data.success) {
        bookId = data.bookId;
        setCurrentBookId(bookId);
        saveFormState(bookTitle, bookId, topics);
      } else {
        alert('Error: ' + data.error);
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/books');
      const data = await res.json();
      if (data.success) {
        setAllBooks(data.data || []);
        setShowCloneTopicModal(true);
      } else {
        alert('Failed to load books');
      }
    } catch (error) {
      console.error('Error loading books:', error);
      alert('Failed to load books');
    }
    setLoading(false);
  };

  const handleSourceBookChange = async (bookId) => {
    setSelectedSourceBook(bookId);
    setSelectedTopics([]);
    setTopicTitles({});
    
    if (!bookId) {
      setAvailableTopics([]);
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/topics?bookId=${bookId}`);
      const data = await res.json();
      if (data.success) {
        setAvailableTopics(data.data || []);
      }
    } catch (error) {
      console.error('Error loading topics:', error);
    }
    setLoading(false);
  };

  const handleTopicSelection = (topicId) => {
    setSelectedTopics(prev => {
      if (prev.includes(topicId)) {
        const newSelected = prev.filter(id => id !== topicId);
        const newTitles = { ...topicTitles };
        delete newTitles[topicId];
        setTopicTitles(newTitles);
        return newSelected;
      } else {
        const topic = availableTopics.find(t => t.id === topicId);
        if (topic) {
          setTopicTitles(prev => ({ ...prev, [topicId]: topic.name }));
        }
        return [...prev, topicId];
      }
    });
  };

  const handleSelectAllTopics = () => {
    if (selectedTopics.length === availableTopics.length) {
      setSelectedTopics([]);
      setTopicTitles({});
    } else {
      const allIds = availableTopics.map(t => t.id);
      const titles = {};
      availableTopics.forEach(t => {
        titles[t.id] = t.name;
      });
      setSelectedTopics(allIds);
      setTopicTitles(titles);
    }
  };

  const handleCloneTopicsSave = async () => {
    if (selectedTopics.length === 0) {
      alert('Please select at least one topic to clone');
      return;
    }
    
    if (!currentBookId) {
      alert('Book ID not found. Please try again.');
      return;
    }
    
    setLoading(true);
    try {
      const clonedTopicIds = [];
      
      for (const topicId of selectedTopics) {
        const newTopicName = topicTitles[topicId];
        
        const res = await fetch('/api/superadmin/clone-topic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic_id: topicId,
            new_book_id: parseInt(currentBookId),
            new_topic_name: newTopicName
          })
        });
        
        const data = await res.json();
        if (!data.success) {
          alert(`Failed to clone topic: ${data.error}`);
          setLoading(false);
          return;
        }
        
        if (data.data && data.data.newTopicId) {
          clonedTopicIds.push({
            id: data.data.newTopicId,
            name: newTopicName,
            originalId: topicId
          });
        }
      }
      
      const topicsRes = await fetch(`/api/superadmin/topics?bookId=${currentBookId}`);
      const topicsData = await topicsRes.json();
      
      if (topicsData.success) {
        const newTopics = [...topics];
        
        for (const clonedInfo of clonedTopicIds) {
          const topicFromDb = topicsData.data.find(t => t.id === clonedInfo.id);
          
          if (topicFromDb) {
            const originalSubtopicsRes = await fetch(`/api/superadmin/subtopics?topicId=${clonedInfo.originalId}`);
            const originalSubtopicsData = await originalSubtopicsRes.json();
            const originalSubtopics = originalSubtopicsData.success ? originalSubtopicsData.data : [];
            
            const subtopicsRes = await fetch(`/api/superadmin/subtopics?topicId=${topicFromDb.id}`);
            const subtopicsData = await subtopicsRes.json();
            
            const subtopics = subtopicsData.success ? (subtopicsData.data || []).map((s, idx) => {
              const originalSubtopic = originalSubtopics[idx];
              return {
                id: Date.now() + Math.random() + idx,
                name: s.name,
                subtopicId: s.id,
                isCloned: true,
                originalSubtopicId: originalSubtopic ? originalSubtopic.id : null,
                cloneId: s.clone_id || null
              };
            }) : [];
            
            newTopics.push({
              id: Date.now() + Math.random(),
              name: topicFromDb.name,
              topicId: topicFromDb.id,
              hasSubtopics: subtopics.length > 0,
              subtopics: subtopics,
              isCloned: true,
              originalTopicId: clonedInfo.originalId,
              cloneId: topicFromDb.clone_id
            });
          }
        }
        
        setTopics(newTopics);
        saveFormState(bookTitle, currentBookId, newTopics);
      }
      
      await fetchBooks();
      
      setShowCloneTopicModal(false);
      setSelectedSourceBook('');
      setAvailableTopics([]);
      setSelectedTopics([]);
      setTopicTitles({});
      
      alert('Topics cloned successfully!');
    } catch (error) {
      console.error('Error cloning topics:', error);
      alert('Failed to clone topics');
    }
    setLoading(false);
  };

  const handleCloseCloneTopicModal = () => {
    setShowCloneTopicModal(false);
    setSelectedSourceBook('');
    setAvailableTopics([]);
    setSelectedTopics([]);
    setTopicTitles({});
  };

  const ensureTopicSavedForCloning = async (topicIndex) => {
    const topic = topics[topicIndex];

    if (!topic || !topic.name?.trim()) {
      alert('Please enter topic name first');
      return null;
    }

    if (topic.topicId) {
      return topic.topicId;
    }

    const saveKey = `topic-${topicIndex}`;

    if (savingTopics.current.has(saveKey)) {
      const startTime = Date.now();
      while (savingTopics.current.has(saveKey) && Date.now() - startTime < 15000) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      return topics[topicIndex]?.topicId || null;
    }

    savingTopics.current.add(saveKey);
    try {
      const res = await fetch('/api/author/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: topic.name,
          book_id: currentBookId
        })
      });

      const data = await res.json();
      if (!data.success) {
        alert('Error: ' + data.error);
        return null;
      }

      const newTopics = [...topics];
      newTopics[topicIndex] = {
        ...newTopics[topicIndex],
        topicId: data.topicId
      };
      setTopics(newTopics);
      saveFormState(bookTitle, currentBookId, newTopics);

      return data.topicId;
    } catch (error) {
      console.error('Error saving topic before clone:', error);
      alert('Failed to save topic before cloning subtopics');
      return null;
    } finally {
      savingTopics.current.delete(saveKey);
    }
  };

  const handleOpenCloneSubtopicModal = async (topicIndex) => {
    if (!bookTitle.trim()) {
      alert('Please enter a book title first');
      return;
    }

    let bookId = currentBookId;

    if (!bookId) {
      setLoading(true);
      const res = await fetch('/api/author/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bookTitle })
      });
      
      const data = await res.json();
      if (data.success) {
        bookId = data.bookId;
        setCurrentBookId(bookId);
        saveFormState(bookTitle, bookId, topics);
      } else {
        alert('Error: ' + data.error);
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    
    const savedTopicId = await ensureTopicSavedForCloning(topicIndex);
    if (!savedTopicId) {
      return;
    }
    
    setTargetTopicIndex(topicIndex);
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/books');
      const data = await res.json();
      if (data.success) {
        setAllBooks(data.data || []);
        setShowCloneSubtopicModal(true);
      } else {
        alert('Failed to load books');
      }
    } catch (error) {
      console.error('Error loading books:', error);
      alert('Failed to load books');
    }
    setLoading(false);
  };

  const handleSourceBookChangeForSubtopic = async (bookId) => {
    setSelectedSourceBookForSubtopic(bookId);
    setSelectedSourceTopic('');
    setAvailableTopicsForSubtopic([]);
    setAvailableSubtopics([]);
    setSelectedSubtopics([]);
    setSubtopicTitles({});

    if (!bookId) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/topics?bookId=${bookId}`);
      const data = await res.json();
      if (data.success) {
        setAvailableTopicsForSubtopic(data.data || []);
      } else {
        alert('Failed to load topics');
      }
    } catch (error) {
      console.error('Error loading source topics for subtopic clone:', error);
      alert('Failed to load topics');
    }
    setLoading(false);
  };

  const handleSourceTopicChange = async (topicId) => {
    setSelectedSourceTopic(topicId);
    setAvailableSubtopics([]);
    setSelectedSubtopics([]);
    setSubtopicTitles({});

    if (!topicId) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/subtopics?topicId=${topicId}`);
      const data = await res.json();
      if (data.success) {
        setAvailableSubtopics(data.data || []);
      } else {
        alert('Failed to load subtopics');
      }
    } catch (error) {
      console.error('Error loading source subtopics:', error);
      alert('Failed to load subtopics');
    }
    setLoading(false);
  };

  const handleSubtopicSelection = (subtopicId) => {
    setSelectedSubtopics(prev => {
      if (prev.includes(subtopicId)) {
        const newSelected = prev.filter(id => id !== subtopicId);
        const newTitles = { ...subtopicTitles };
        delete newTitles[subtopicId];
        setSubtopicTitles(newTitles);
        return newSelected;
      }

      const subtopic = availableSubtopics.find(s => s.id === subtopicId);
      if (subtopic) {
        setSubtopicTitles(prevTitles => ({
          ...prevTitles,
          [subtopicId]: subtopic.name
        }));
      }

      return [...prev, subtopicId];
    });
  };

  const handleSelectAllSubtopics = () => {
    if (selectedSubtopics.length === availableSubtopics.length) {
      setSelectedSubtopics([]);
      setSubtopicTitles({});
      return;
    }

    const allIds = availableSubtopics.map(s => s.id);
    const titles = {};
    availableSubtopics.forEach(s => {
      titles[s.id] = s.name;
    });

    setSelectedSubtopics(allIds);
    setSubtopicTitles(titles);
  };

  const handleCloneSubtopicsSave = async () => {
    if (targetTopicIndex === null || targetTopicIndex === undefined) {
      alert('Target topic is not selected');
      return;
    }

    if (selectedSubtopics.length === 0) {
      alert('Please select at least one subtopic to clone');
      return;
    }

    const targetTopic = topics[targetTopicIndex];
    if (!targetTopic || !targetTopic.topicId) {
      alert('Target topic not found or not saved yet');
      return;
    }

    setLoading(true);
    try {
      const clonedSubtopics = [];
      let totalPagesCopied = 0;

      for (const sourceSubtopicId of selectedSubtopics) {
        const sourceSubtopic = availableSubtopics.find(s => s.id === sourceSubtopicId);
        if (!sourceSubtopic) {
          continue;
        }

        const newName = (subtopicTitles[sourceSubtopicId] || sourceSubtopic.name || '').trim();
        if (!newName) {
          alert('Subtopic title cannot be empty');
          setLoading(false);
          return;
        }

        const alreadyExists = (targetTopic.subtopics || []).some(s => {
          const sameOriginal = s.originalSubtopicId && s.originalSubtopicId === sourceSubtopicId;
          const sameName = (s.name || '').trim().toLowerCase() === newName.toLowerCase();
          return sameOriginal || sameName;
        });

        if (alreadyExists) {
          continue;
        }

        const createRes = await fetch('/api/author/subtopics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newName,
            book_id: currentBookId,
            topic_id: targetTopic.topicId,
            clone_id: sourceSubtopic.clone_id || null
          })
        });

        const createData = await createRes.json();
        if (!createData.success) {
          alert('Failed to clone subtopic: ' + createData.error);
          setLoading(false);
          return;
        }

        const newSubtopicId = createData.id;

        const pagesRes = await fetch('/api/superadmin/clone-subtopic-pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalSubtopicId: sourceSubtopicId,
            newSubtopicId,
            newTopicId: targetTopic.topicId
          })
        });

        const pagesData = await pagesRes.json();
        if (!pagesData.success) {
          alert('Subtopic was created, but copying pages failed: ' + pagesData.error);
        } else {
          totalPagesCopied += pagesData.pagesCopied || 0;
        }

        clonedSubtopics.push({
          id: Date.now() + Math.random(),
          name: newName,
          subtopicId: newSubtopicId,
          isCloned: true,
          originalSubtopicId: sourceSubtopicId,
          cloneId: sourceSubtopic.clone_id || null
        });
      }

      if (clonedSubtopics.length === 0) {
        alert('No new subtopics were cloned. They may already exist in this topic.');
        setLoading(false);
        return;
      }

      const newTopics = [...topics];
      const existingSubtopics = newTopics[targetTopicIndex].subtopics || [];
      newTopics[targetTopicIndex] = {
        ...newTopics[targetTopicIndex],
        hasSubtopics: true,
        subtopics: [...existingSubtopics, ...clonedSubtopics]
      };

      setTopics(newTopics);
      saveFormState(bookTitle, currentBookId, newTopics);
      await fetchBooks();

      handleCloseCloneSubtopicModal();
      alert(`Subtopics cloned successfully! ${totalPagesCopied} page(s) copied.`);
    } catch (error) {
      console.error('Error cloning subtopics:', error);
      alert('Failed to clone subtopics');
    }
    setLoading(false);
  };

  const handleCloseCloneSubtopicModal = () => {
    setShowCloneSubtopicModal(false);
    setSelectedSourceBookForSubtopic('');
    setAvailableTopicsForSubtopic([]);
    setSelectedSourceTopic('');
    setAvailableSubtopics([]);
    setSelectedSubtopics([]);
    setSubtopicTitles({});
    setTargetTopicIndex(null);
  };

  return {
    // Clone Topic Modal
    showCloneTopicModal,
    allBooks,
    selectedSourceBook,
    availableTopics,
    selectedTopics,
    topicTitles,
    setTopicTitles,
    handleOpenCloneTopicModal,
    handleSourceBookChange,
    handleTopicSelection,
    handleSelectAllTopics,
    handleCloneTopicsSave,
    handleCloseCloneTopicModal,
    
    // Clone Subtopic Modal
    showCloneSubtopicModal,
    handleOpenCloneSubtopicModal,
    handleCloseCloneSubtopicModal,
    selectedSourceBookForSubtopic,
    availableTopicsForSubtopic,
    selectedSourceTopic,
    availableSubtopics,
    selectedSubtopics,
    subtopicTitles,
    setSubtopicTitles,
    handleSourceBookChangeForSubtopic,
    handleSourceTopicChange,
    handleSubtopicSelection,
    handleSelectAllSubtopics,
    handleCloneSubtopicsSave,
    
    // Sync Modal
    showSyncModal,
    setShowSyncModal,
    isEditMode,
    setIsEditMode
  };
}
