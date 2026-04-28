// hooks/useBookManagement.js
'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function useBookManagement() {
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [bookTitle, setBookTitle] = useState('');
  const [currentBookId, setCurrentBookId] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingBookId, setEditingBookId] = useState(null);
  const savingTopics = useRef(new Set());
  const savingSubtopics = useRef(new Set());
  const topicUpdateTimers = useRef({}); // For debouncing topic updates

  useEffect(() => {
    fetchBooks();
    
    // Restore form state from localStorage
    const savedFormState = localStorage.getItem('bookFormState');
    if (savedFormState) {
      const formState = JSON.parse(savedFormState);
      setBookTitle(formState.bookTitle || '');
      setCurrentBookId(formState.currentBookId || null);
      setTopics(formState.topics || []);
      setEditingBookId(formState.editingBookId || null);
      setShowForm(true);
    }
  }, []);

  const fetchBooks = async () => {
    const res = await fetch('/api/author/books');
    const data = await res.json();
    if (data.success) setBooks(data.data);
  };

  const saveFormState = (title, bookId, topicsData, editingId = null) => {
    const stateToSave = {
      bookTitle: title,
      currentBookId: bookId,
      topics: topicsData,
      editingBookId: editingId ?? editingBookId ?? null
    };
    localStorage.setItem('bookFormState', JSON.stringify(stateToSave));
  };

  const clearFormState = () => {
    localStorage.removeItem('bookFormState');
  };

  const handleAddTopic = async () => {
    if (!bookTitle.trim()) {
      alert('Please enter a book title first');
      return;
    }

    if (!currentBookId) {
      const res = await fetch('/api/author/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bookTitle })
      });
      
      const data = await res.json();
      if (data.success) {
        const newBookId = data.bookId;
        const newTopics = [...topics, { id: Date.now(), name: '', hasSubtopics: false, topicId: null, subtopics: [] }];
        setCurrentBookId(newBookId);
        setTopics(newTopics);
        saveFormState(bookTitle, newBookId, newTopics);
      } else {
        alert('Error: ' + data.error);
      }
    } else {
      const newTopics = [...topics, { id: Date.now(), name: '', hasSubtopics: false, topicId: null, subtopics: [] }];
      setTopics(newTopics);
      saveFormState(bookTitle, currentBookId, newTopics);
    }
  };

  const handleRemoveTopic = async (index) => {
    const topic = topics[index];
    
    if (topic.topicId) {
      if (!confirm(`Are you sure you want to delete "${topic.name}"? This will also delete all its subtopics and pages.`)) {
        return;
      }
      
      setLoading(true);
      try {
        const res = await fetch(`/api/author/topics?id=${topic.topicId}`, {
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
    saveFormState(bookTitle, currentBookId, newTopics);
  };

  const handleTopicChange = async (index, value) => {
    const newTopics = topics.map((topic, i) => 
      i === index ? { ...topic, name: value } : topic
    );
    setTopics(newTopics);
    saveFormState(bookTitle, currentBookId, newTopics);
    
    // If topic already has an ID (saved in backend), update it with debouncing
    const topic = topics[index];
    if (topic.topicId && value.trim()) {
      // Clear previous timer for this topic
      if (topicUpdateTimers.current[index]) {
        clearTimeout(topicUpdateTimers.current[index]);
      }
      
      // Set new timer to update after 800ms of no typing
      topicUpdateTimers.current[index] = setTimeout(async () => {
        try {
          const res = await fetch('/api/author/topics', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              id: topic.topicId, 
              name: value,
              book_id: currentBookId
            })
          });
          
          const data = await res.json();
          if (!data.success) {
            console.error('Error updating topic:', data.error);
          }
        } catch (error) {
          console.error('Error updating topic:', error);
        }
      }, 800);
    }
  };

  const handleReset = async (skipDeletion = false) => {
    if (currentBookId && !editingBookId && !skipDeletion) {
      try {
        await fetch(`/api/author/books?id=${currentBookId}`, { method: 'DELETE' });
        await fetchBooks();
      } catch (error) {
        console.error('Error deleting incomplete book:', error);
      }
    }
    
    setBookTitle('');
    setCurrentBookId(null);
    setTopics([]);
    setShowForm(false);
    setEditingBookId(null);
    clearFormState();
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this book? All topics and pages will also be deleted.')) return;
    
    const res = await fetch(`/api/author/books?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      fetchBooks();
      alert('Book deleted successfully!');
    } else {
      alert('Error: ' + data.error);
    }
  };

  const handleEdit = (book) => {
    setEditingBookId(book.id);
    setBookTitle(book.title);
    setCurrentBookId(book.id);
    
    const loadedTopics = book.topics.map((topic, idx) => ({
      id: Date.now() + idx,
      name: topic.name,
      topicId: topic.id,
      hasSubtopics: topic.subtopics && topic.subtopics.length > 0,
      cloneId: topic.clone_id || null,
      isCloned: !!topic.clone_id,
      subtopics: (topic.subtopics || []).map((subtopic, subIdx) => ({
        id: Date.now() + idx * 1000 + subIdx,
        name: subtopic.name,
        subtopicId: subtopic.id,
        cloneId: subtopic.clone_id || null,
        isCloned: !!subtopic.clone_id
      }))
    }));
    
    setTopics(loadedTopics);
    setShowForm(true);
    saveFormState(book.title, book.id, loadedTopics, book.id);
  };

  return {
    books,
    bookTitle,
    setBookTitle,
    currentBookId,
    setCurrentBookId,
    topics,
    setTopics,
    loading,
    setLoading,
    showForm,
    setShowForm,
    editingBookId,
    setEditingBookId,
    savingTopics,
    savingSubtopics,
    topicUpdateTimers,
    fetchBooks,
    saveFormState,
    clearFormState,
    handleAddTopic,
    handleRemoveTopic,
    handleTopicChange,
    handleReset,
    handleDelete,
    handleEdit,
    router
  };
}
