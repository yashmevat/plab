'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateBookPage() {
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [books, setBooks] = useState([]);
  const [bookTitle, setBookTitle] = useState('');
  const [currentBookId, setCurrentBookId] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedBooks, setExpandedBooks] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({}); // Left panel topics
  const [clonedTopics, setClonedTopics] = useState([]); // Track cloned topics with original IDs
  const [modifiedItems, setModifiedItems] = useState([]); // Track modified topics/subtopics
  const savingTopics = useRef(new Set());
  const savingSubtopics = useRef(new Set());

  const saveFormState = () => {
    if (showCreateForm && bookTitle) {
      localStorage.setItem('superadminBookFormState', JSON.stringify({
        bookTitle,
        currentBookId,
        topics,
        clonedTopics,
        modifiedItems,
        showCreateForm: true
      }));
    }
  };

  const clearFormState = () => {
    localStorage.removeItem('superadminBookFormState');
  };

  useEffect(() => {
    fetchBooks();
    
    // Restore form state from localStorage
    const savedFormState = localStorage.getItem('superadminBookFormState');
    if (savedFormState) {
      const formState = JSON.parse(savedFormState);
      setBookTitle(formState.bookTitle || '');
      setCurrentBookId(formState.currentBookId || null);
      setTopics(formState.topics || []);
      setClonedTopics(formState.clonedTopics || []);
      setModifiedItems(formState.modifiedItems || []);
      if (formState.showCreateForm) {
        setShowCreateForm(true);
      }
    }
  }, []);

  // Save form state whenever it changes
  useEffect(() => {
    if (showCreateForm && bookTitle) {
      saveFormState();
    }
  }, [showCreateForm, bookTitle, currentBookId, topics, clonedTopics, modifiedItems]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/books');
      const data = await res.json();
      if (data.success) {
        setBooks(data.data);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error fetching books:', error);
      alert('Failed to fetch books');
    }
    setLoading(false);
  };

  const handleCreateBookClick = () => {
    setShowCreateForm(true);
  };

  const handleAddTopic = async () => {
    if (!bookTitle.trim()) {
      alert('Please enter a book title first');
      return;
    }

    // Create book if not already created
    if (!currentBookId) {
      setLoading(true);
      const res = await fetch('/api/superadmin/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bookTitle })
      });
      
      const data = await res.json();
      setLoading(false);
      if (data.success) {
        const newBookId = data.bookId;
        const newTopics = [...topics, { 
          id: Date.now(), 
          name: '', 
          hasSubtopics: false, 
          topicId: null, 
          subtopics: [],
          isCloned: false,
          originalTopicId: null
        }];
        setCurrentBookId(newBookId);
        setTopics(newTopics);
        saveFormState();
      } else {
        alert('Error: ' + data.error);
      }
    } else {
      const newTopics = [...topics, { 
        id: Date.now(), 
        name: '', 
        hasSubtopics: false, 
        topicId: null, 
        subtopics: [],
        isCloned: false,
        originalTopicId: null
      }];
      setTopics(newTopics);
      saveFormState();
    }
  };

  const handleCloneTopic = async (originalTopicId, topicName) => {
    if (!bookTitle.trim()) {
      alert('Please enter a book title first');
      return;
    }

    // Create book if not already created
    let bookIdToUse = currentBookId;
    if (!bookIdToUse) {
      setLoading(true);
      const res = await fetch('/api/superadmin/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bookTitle })
      });
      
      const data = await res.json();
      if (data.success) {
        bookIdToUse = data.bookId;
        setCurrentBookId(bookIdToUse);
      } else {
        alert('Error creating book: ' + data.error);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/clone-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: originalTopicId,
          new_book_id: bookIdToUse
        })
      });

      const data = await res.json();
      if (data.success) {
        // Fetch the newly cloned topic details
        const booksRes = await fetch('/api/superadmin/books');
        const booksData = await booksRes.json();
        
        if (booksData.success) {
          const currentBook = booksData.data.find(b => b.id === bookIdToUse);
          if (currentBook) {
            const clonedTopic = currentBook.topics.find(t => t.id === data.data.newTopicId);
            
            if (clonedTopic) {
              // Create reverse mapping: newSubtopicId -> originalSubtopicId
              const subtopicIdMap = data.data.subtopicIdMap || {};
              const reverseMap = {};
              Object.keys(subtopicIdMap).forEach(originalId => {
                const newId = subtopicIdMap[originalId];
                reverseMap[newId] = parseInt(originalId);
              });

              const newTopicObj = {
                id: Date.now(),
                name: clonedTopic.name,
                topicId: clonedTopic.id,
                hasSubtopics: clonedTopic.subtopics && clonedTopic.subtopics.length > 0,
                subtopics: (clonedTopic.subtopics || []).map((subtopic, idx) => ({
                  id: Date.now() + idx,
                  name: subtopic.name,
                  subtopicId: subtopic.id,
                  isCloned: true,
                  originalSubtopicId: reverseMap[subtopic.id] || null // Set the original subtopic ID from mapping
                })),
                isCloned: true,
                originalTopicId: originalTopicId
              };

              const updatedTopics = [...topics, newTopicObj];
              const updatedClonedTopics = [...clonedTopics, {
                newTopicId: data.data.newTopicId,
                originalTopicId: originalTopicId,
                subtopics: (clonedTopic.subtopics || []).map(subtopic => ({
                  newSubtopicId: subtopic.id,
                  originalSubtopicId: reverseMap[subtopic.id] || null
                }))
              }];
              
              setTopics(updatedTopics);
              setClonedTopics(updatedClonedTopics);
              saveFormState();
              
              alert(`Topic "${topicName}" cloned successfully with ${data.data.subtopicsCloned} subtopics and ${data.data.pagesCloned} pages!`);
            }
          }
        }
      } else {
        alert('Error cloning topic: ' + data.error);
      }
    } catch (error) {
      console.error('Error cloning topic:', error);
      alert('Failed to clone topic');
    }
    setLoading(false);
  };

  const handleCloneBook = async (bookId, bookTitle) => {
    const confirmed = confirm(`Clone "${bookTitle}"?\n\nThis will create a new book with all topics, subtopics, and pages.`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/clone-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bookId,
          newTitle: `${bookTitle} (Clone)`
        })
      });

      const data = await res.json();
      if (data.success) {
        // Store cloned book data in localStorage for editing
        localStorage.setItem('clonedBookData', JSON.stringify({
          newBookId: data.data.newBookId,
          originalBookId: data.data.originalBookId,
          book: data.data.book
        }));
        
        // Redirect to edit page
        router.push(`/dashboard/edit-cloned-book/${data.data.newBookId}`);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error cloning book:', error);
      alert('Failed to clone book');
    }
    setLoading(false);
  };

  const handleTopicChange = (index, value) => {
    const newTopics = [...topics];
    const topic = newTopics[index];
    topic.name = value;
    
    // Track modification if it's a cloned topic
    if (topic.isCloned && topic.topicId) {
      const existingModIdx = modifiedItems.findIndex(
        item => item.type === 'topic' && item.id === topic.topicId
      );
      if (existingModIdx >= 0) {
        modifiedItems[existingModIdx].data.name = value;
      } else {
        setModifiedItems([...modifiedItems, {
          type: 'topic',
          id: topic.topicId,
          originalId: topic.originalTopicId,
          data: { name: value }
        }]);
      }
    }
    
    setTopics(newTopics);
  };

  const handleTopicBlur = async (index) => {
    const topic = topics[index];
    
    if (!topic.name.trim()) return;
    
    const saveKey = `topic-${index}`;
    
    if (savingTopics.current.has(saveKey)) return;
    
    savingTopics.current.add(saveKey);
    setLoading(true);
    
    try {
      if (topic.topicId) {
        // Update existing topic
        const res = await fetch('/api/superadmin/topics', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: topic.topicId,
            name: topic.name
          })
        });
        
        const data = await res.json();
        if (!data.success) {
          alert('Error updating topic: ' + data.error);
        }
      } else {
        // Create new topic
        const res = await fetch('/api/superadmin/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: topic.name, 
            book_id: currentBookId 
          })
        });
        
        const data = await res.json();
        if (data.success) {
          const newTopics = [...topics];
          newTopics[index].topicId = data.topicId;
          setTopics(newTopics);
          saveFormState();
        } else {
          alert('Error: ' + data.error);
        }
      }
    } catch (error) {
      console.error('Error saving topic:', error);
    }
    
    savingTopics.current.delete(saveKey);
    setLoading(false);
  };

  const handleRemoveTopic = async (index) => {
    const topic = topics[index];
    
    if (topic.topicId) {
      if (!confirm(`Are you sure you want to delete "${topic.name}"? This will also delete all its subtopics and pages.`)) {
        return;
      }
      
      setLoading(true);
      try {
        const res = await fetch(`/api/superadmin/topics?id=${topic.topicId}`, {
          method: 'DELETE'
        });
        
        const data = await res.json();
        if (!data.success) {
          alert('Error deleting topic: ' + data.error);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Error deleting topic:', error);
        alert('Failed to delete topic');
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    
    const newTopics = topics.filter((_, i) => i !== index);
    setTopics(newTopics);
    saveFormState();
  };

  const handleAddSubtopic = async (topicIndex) => {
    const topic = topics[topicIndex];
    
    if (!topic.name.trim()) {
      alert('Please enter topic name first');
      return;
    }
    
    const saveKey = `topic-${topicIndex}`;
    
    // If topic not saved, save it first
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
          subtopicId: null,
          isCloned: false,
          originalSubtopicId: null
        });
        setTopics(newTopics);
        setLoading(false);
        return;
      }
      
      savingTopics.current.add(saveKey);
      setLoading(true);
      const res = await fetch('/api/superadmin/topics', {
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
          subtopicId: null,
          isCloned: false,
          originalSubtopicId: null
        });
        setTopics(newTopics);
        saveFormState();
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
        subtopicId: null,
        isCloned: false,
        originalSubtopicId: null
      });
      setTopics(newTopics);
      saveFormState();
    }
  };

  const handleSubtopicChange = (topicIndex, subtopicIndex, value) => {
    const newTopics = [...topics];
    const subtopic = newTopics[topicIndex].subtopics[subtopicIndex];
    subtopic.name = value;
    
    // Track modification if it's a cloned subtopic
    if (subtopic.isCloned && subtopic.subtopicId) {
      const existingModIdx = modifiedItems.findIndex(
        item => item.type === 'subtopic' && item.id === subtopic.subtopicId
      );
      if (existingModIdx >= 0) {
        modifiedItems[existingModIdx].data.name = value;
      } else {
        setModifiedItems([...modifiedItems, {
          type: 'subtopic',
          id: subtopic.subtopicId,
          originalId: subtopic.originalSubtopicId,
          data: { name: value }
        }]);
      }
    }
    
    setTopics(newTopics);
    saveFormState();
  };

  const handleSubtopicBlur = async (topicIndex, subtopicIndex) => {
    const topic = topics[topicIndex];
    const subtopic = topic.subtopics[subtopicIndex];
    
    if (!subtopic.name.trim()) return;
    
    const saveKey = `${topicIndex}-${subtopicIndex}`;
    
    if (savingSubtopics.current.has(saveKey)) return;
    
    savingSubtopics.current.add(saveKey);
    setLoading(true);
    
    try {
      if (subtopic.subtopicId) {
        // Update existing subtopic
        const res = await fetch('/api/superadmin/subtopics', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: subtopic.subtopicId,
            name: subtopic.name
          })
        });
        
        const data = await res.json();
        if (!data.success) {
          alert('Error updating subtopic: ' + data.error);
        }
      } else {
        // Create new subtopic
        const res = await fetch('/api/superadmin/subtopics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: subtopic.name,
            book_id: currentBookId,
            topic_id: topic.topicId
          })
        });
        
        const data = await res.json();
        if (data.success) {
          const newTopics = [...topics];
          newTopics[topicIndex].subtopics[subtopicIndex].subtopicId = data.id;
          setTopics(newTopics);
          saveFormState();
        } else {
          alert('Error: ' + data.error);
        }
      }
    } catch (error) {
      console.error('Error saving subtopic:', error);
    }
    
    savingSubtopics.current.delete(saveKey);
    setLoading(false);
  };

  const handleAddSubtopicToExpandedTopic = async (originalSubtopic, originalTopic) => {
    // Find which topic has subtopics expanded (hasSubtopics = true) in the right panel
    const expandedTopicIndices = topics
      .map((t, idx) => ({ topic: t, index: idx }))
      .filter(item => item.topic.hasSubtopics && item.topic.topicId) // Must have topicId
      .map(item => item.index);
    
    if (expandedTopicIndices.length === 0) {
      alert('Please add subtopics to a saved topic in the right panel first (topic must be saved)');
      return;
    }
    
    // Use the first expanded topic
    const targetTopicIndex = expandedTopicIndices[0];
    const targetTopic = topics[targetTopicIndex];
    
    if (!targetTopic || !targetTopic.topicId) {
      alert('Target topic not found or not yet saved');
      return;
    }
    
    // Check if subtopic already exists in target topic
    const exists = targetTopic.subtopics?.some(
      s => s.originalSubtopicId === originalSubtopic.id || s.name === originalSubtopic.name
    );
    
    if (exists) {
      alert(`Subtopic "${originalSubtopic.name}" already exists in topic "${targetTopic.name}"`);
      return;
    }
    
    setLoading(true);
    
    try {
      // Create subtopic on server immediately
      const res = await fetch('/api/superadmin/subtopics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: originalSubtopic.name,
          book_id: currentBookId,
          topic_id: targetTopic.topicId
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        const newSubtopicId = data.id;
        
        // Copy pages from original subtopic to new subtopic
        let pagesCopied = 0;
        try {
          const pagesRes = await fetch('/api/superadmin/clone-subtopic-pages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              originalSubtopicId: originalSubtopic.id,
              newSubtopicId: newSubtopicId,
              newTopicId: targetTopic.topicId
            })
          });
          
          const pagesData = await pagesRes.json();
          if (pagesData.success) {
            pagesCopied = pagesData.pagesCopied || 0;
          } else {
            console.warn('Pages copy failed:', pagesData.error);
          }
        } catch (err) {
          console.warn('Failed to copy pages:', err);
        }
        
        // Add subtopic to target topic with proper IDs
        const newTopics = [...topics];
        if (!newTopics[targetTopicIndex].hasSubtopics) {
          newTopics[targetTopicIndex].hasSubtopics = true;
          newTopics[targetTopicIndex].subtopics = [];
        }
        
        newTopics[targetTopicIndex].subtopics.push({
          id: Date.now(),
          name: originalSubtopic.name,
          subtopicId: newSubtopicId,
          isCloned: true,
          originalSubtopicId: originalSubtopic.id
        });
        
        setTopics(newTopics);
        
        // Update clonedTopics tracking
        const existingClonedTopic = clonedTopics.find(
          ct => ct.newTopicId === targetTopic.topicId
        );
        
        if (existingClonedTopic) {
          // Add to existing cloned topic's subtopics
          existingClonedTopic.subtopics.push({
            newSubtopicId: newSubtopicId,
            originalSubtopicId: originalSubtopic.id
          });
          setClonedTopics([...clonedTopics]);
        } else {
          // Create new entry for this topic (it may be manually created, not cloned)
          setClonedTopics([...clonedTopics, {
            newTopicId: targetTopic.topicId,
            originalTopicId: targetTopic.originalTopicId || null,
            subtopics: [{
              newSubtopicId: newSubtopicId,
              originalSubtopicId: originalSubtopic.id
            }]
          }]);
        }
        
        saveFormState();
        alert(`Subtopic "${originalSubtopic.name}" added to topic "${targetTopic.name}"!\n${pagesCopied} pages copied successfully.`);
      } else {
        alert('Error creating subtopic: ' + data.error);
      }
    } catch (error) {
      console.error('Error adding subtopic:', error);
      alert('Failed to add subtopic');
    }
    
    setLoading(false);
  };

  const handleRemoveSubtopic = async (topicIndex, subtopicIndex) => {
    const subtopic = topics[topicIndex].subtopics[subtopicIndex];
    
    if (subtopic.subtopicId) {
      if (!confirm(`Are you sure you want to delete "${subtopic.name}"? This will also delete all its pages.`)) {
        return;
      }
      
      setLoading(true);
      try {
        const res = await fetch(`/api/superadmin/subtopics?id=${subtopic.subtopicId}`, {
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
    saveFormState();
  };

  const handleSyncDialog = async () => {
    // Check if there are any cloned topics (pages might have been modified)
    if (modifiedItems.length === 0 && clonedTopics.length === 0) {
      // No modifications to sync
      await fetchBooks();
      handleReset();
      alert('Book created successfully!');
      return;
    }

    // Show dialog asking user if they want to sync changes
    const syncToOriginal = confirm(
      `You have cloned topics from existing books and may have made changes.\n\n` +
      `Do you want to apply ALL changes to the original book(s)?\n` +
      `This includes:\n` +
      `- Topic/Subtopic name changes${modifiedItems.length > 0 ? ' (' + modifiedItems.length + ')' : ''}\n` +
      `- Manually added subtopics\n` +
      `- Deleted subtopics\n` +
      `- All page changes (added, updated, deleted)\n` +
      `- Page sequence will be maintained\n\n` +
      `Click OK to sync everything to original books,\n` +
      `or Cancel to keep changes only in this new book.`
    );

    if (syncToOriginal) {
      setLoading(true);
      try {
        const changesToSync = modifiedItems.map(item => ({
          ...item,
          syncToOriginal: true
        }));

        const res = await fetch('/api/superadmin/sync-changes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            changes: changesToSync,
            clonedTopics: clonedTopics,
            currentTopics: topics // Send current topics state to detect manually added subtopics
          })
        });

        const data = await res.json();
        if (data.success) {
          alert(`Book created successfully!\n\nSynced ${data.updatedCount} changes to original book(s), including:\n- Topic/Subtopic names\n- Manually added subtopics\n- Deleted subtopics\n- All pages (added, updated, deleted)\n- Page sequence maintained`);
        } else {
          alert('Error syncing changes: ' + data.error);
        }
      } catch (error) {
        console.error('Error syncing changes:', error);
        alert('Failed to sync changes');
      }
      setLoading(false);
    }

    await fetchBooks();
    handleReset();
    if (!syncToOriginal) {
      alert('Book created successfully! Changes kept only in new book.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentBookId) {
      alert('Please add at least one topic before saving');
      return;
    }

    // Check if there are any modifications to cloned topics
    await handleSyncDialog();
  };

  const handleReset = () => {
    setBookTitle('');
    setCurrentBookId(null);
    setTopics([]);
    setShowCreateForm(false);
    setClonedTopics([]);
    setModifiedItems([]);
    clearFormState();
  };

  const toggleBookExpansion = (bookId) => {
    setExpandedBooks(prev => ({
      ...prev,
      [bookId]: !prev[bookId]
    }));
  };

  const toggleTopicExpansion = (topicId) => {
    setExpandedTopics(prev => ({
      ...prev,
      [topicId]: !prev[topicId]
    }));
  };

  const filteredBooks = books.filter(book =>
    book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.author_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!showCreateForm) {
    return (
      <div className="min-h-full bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Create New Book</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Create a new book and manage topics from existing books
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreateBookClick}
                  className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-lg hover:shadow-xl font-medium"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Book
                </button>
                <button
                  onClick={() => router.push('/dashboard/authors')}
                  className="inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition shadow-lg hover:shadow-xl"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-200">
            <svg className="w-24 h-24 mx-auto mb-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to Create Your Book?</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Click the "Create Book" button to start building your book. You can create custom topics or add topics from existing books.
            </p>
            <button
              onClick={handleCreateBookClick}
              className="inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-lg hover:shadow-xl font-medium text-lg"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Get Started
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create New Book</h1>
              <p className="mt-1 text-sm text-gray-600">
                Add custom topics or choose from existing books
              </p>
            </div>
            <button
              onClick={handleReset}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
          </div>
        </div>

        {/* Two Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT PANEL - Existing Books */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <h2 className="text-lg font-bold text-white">Existing Books & Topics</h2>
              <p className="text-sm text-indigo-100 mt-1">Click + to add topics to your new book</p>
            </div>

            <div className="p-4">
              {/* Search */}
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search books..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-black text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Books List */}
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto space-y-2 pr-2">
                {loading && (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                )}

                {!loading && filteredBooks.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No books found
                  </div>
                )}

                {!loading && filteredBooks.map((book) => (
                  <div key={book.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Book Header */}
                    <div className="flex items-stretch">
                      <button
                        onClick={() => toggleBookExpansion(book.id)}
                        className="flex-1 px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                      >
                        <svg 
                          className={`w-4 h-4 text-gray-600 transition-transform flex-shrink-0 ${expandedBooks[book.id] ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {book.title.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{book.title}</h3>
                          <p className="text-xs text-gray-500">{book.topics?.length || 0} topics</p>
                        </div>
                      </button>
                      
                      {/* Clone Book Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloneBook(book.id, book.title);
                        }}
                        disabled={loading}
                        className="px-3 py-3 bg-gradient-to-br from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 border-l border-gray-200 flex items-center gap-2"
                        title="Clone entire book"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-semibold hidden sm:inline">Clone</span>
                      </button>
                    </div>

                    {/* Topics List */}
                    {expandedBooks[book.id] && book.topics && book.topics.length > 0 && (
                      <div className="bg-gray-50 border-t border-gray-200">
                        {book.topics.map((topic, idx) => (
                          <div key={topic.id} className="border-b border-gray-200 last:border-b-0">
                            {/* Topic Header */}
                            <div className="px-4 py-2 flex items-center gap-2">
                              <button
                                onClick={() => toggleTopicExpansion(topic.id)}
                                className="p-1 hover:bg-gray-200 rounded"
                              >
                                <svg 
                                  className={`w-3 h-3 text-gray-600 transition-transform ${expandedTopics[topic.id] ? 'rotate-90' : ''}`}
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900 truncate">{topic.name}</p>
                                <p className="text-xs text-gray-500">{topic.subtopic_count || 0} subtopics</p>
                              </div>
                              <button
                                onClick={() => handleCloneTopic(topic.id, topic.name)}
                                disabled={loading}
                                className="flex-shrink-0 p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition disabled:opacity-50"
                                title="Add this topic to new book"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>

                            {/* Subtopics List */}
                            {expandedTopics[topic.id] && topic.subtopics && topic.subtopics.length > 0 && (
                              <div className="bg-green-50 pl-8">
                                {topic.subtopics.map((subtopic, subIdx) => (
                                  <div key={subtopic.id} className="px-4 py-2 flex items-start gap-2 border-t border-green-100">
                                    <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mt-0.5">
                                      {idx + 1}.{subIdx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-gray-900">{subtopic.name}</p>
                                      <p className="text-xs text-gray-500">{subtopic.page_count || 0} pages</p>
                                    </div>
                                    <button
                                      onClick={() => handleAddSubtopicToExpandedTopic(subtopic, topic)}
                                      disabled={loading}
                                      className="flex-shrink-0 p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition disabled:opacity-50"
                                      title="Add this subtopic to expanded topic"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL - Create Book Form */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4">
              <h2 className="text-lg font-bold text-white">New Book Details</h2>
              <p className="text-sm text-green-100 mt-1">Fill in the details and add topics</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 max-h-[calc(100vh-280px)] overflow-y-auto">
              {/* Book Title */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Book Title *
                </label>
                <input
                  type="text"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-black"
                  placeholder="Enter book title"
                  required
                />
              </div>

              {/* Topics Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    Topics
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTopic}
                    className="inline-flex items-center px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition text-sm font-medium"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Topic
                  </button>
                </div>

                {topics.length === 0 && (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-gray-600 font-medium">No topics yet</p>
                    <p className="text-xs text-gray-500 mt-1">Add a topic or clone from existing books</p>
                  </div>
                )}

                {topics.map((topic, index) => (
                  <div key={topic.id} className={`mb-3 p-3 rounded-lg border ${topic.hasSubtopics ? 'bg-blue-50 border-blue-300 border-2' : 'bg-gray-50 border-gray-200'}`}>
                    {/* Topic Input Row */}
                    <div className="flex items-center gap-2 mb-2">
                      {topic.hasSubtopics && (
                        <div className="flex-shrink-0">
                          <span className="inline-flex items-center px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-bold" title="This topic can receive subtopics from left panel">
                            ⬅ ACTIVE
                          </span>
                        </div>
                      )}
                      <input
                        type="text"
                        value={topic.name}
                        onChange={(e) => handleTopicChange(index, e.target.value)}
                        onBlur={() => handleTopicBlur(index)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-black text-sm"
                        placeholder="Topic name"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(index)}
                        className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition flex-shrink-0"
                        title="Remove topic"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Cloned Badge */}
                    {topic.isCloned && (
                      <div className="mb-2">
                        <span className="inline-flex items-center px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Cloned from existing book
                        </span>
                      </div>
                    )}

                    {/* Action Buttons Row */}
                    {!topic.hasSubtopics && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddSubtopic(index)}
                          className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-xs font-medium border border-blue-200"
                        >
                          + Add Subtopics
                        </button>
                        <button
                          type="button"
                          onClick={() => { saveFormState(); router.push(`/author/pages/topic/${topic.topicId}`); }}
                          disabled={!topic.topicId}
                          className="flex-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-xs font-medium border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add Pages
                        </button>
                      </div>
                    )}

                    {/* Subtopics */}
                    {topic.hasSubtopics && (
                      <div className="mt-2 space-y-2">
                        {topic.subtopics.map((subtopic, subIdx) => (
                          <div key={subtopic.id} className="ml-4 pl-3 border-l-2 border-blue-200">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                {subIdx + 1}
                              </div>
                              <input
                                type="text"
                                value={subtopic.name}
                                onChange={(e) => handleSubtopicChange(index, subIdx, e.target.value)}
                                onBlur={() => handleSubtopicBlur(index, subIdx)}
                                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-black text-xs"
                                placeholder="Subtopic name"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveSubtopic(index, subIdx)}
                                className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition flex-shrink-0"
                                title="Remove subtopic"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <div className="ml-8 mt-1">
                              <button
                                type="button"
                                onClick={() => { saveFormState(); router.push(`/author/pages/${subtopic.subtopicId}`); }}
                                disabled={!subtopic.subtopicId}
                                className="px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 transition text-xs font-medium border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Add Pages
                              </button>
                            </div>
                          </div>
                        ))}
                        
                        <button
                          type="button"
                          onClick={() => handleAddSubtopic(index)}
                          className="w-full ml-4 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-xs font-medium border border-blue-200"
                        >
                          + Add Another Subtopic
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading || !bookTitle.trim()}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-lg hover:shadow-xl font-medium"
                >
                  {loading ? 'Saving...' : 'Save Book'}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
