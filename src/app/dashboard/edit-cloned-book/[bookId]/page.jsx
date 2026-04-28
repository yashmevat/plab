'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function EditClonedBookPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = params.bookId;
  
  const [bookTitle, setBookTitle] = useState('');
  const [originalBookId, setOriginalBookId] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDualUpdateModal, setShowDualUpdateModal] = useState(false);
  const savingTopics = useRef(new Set());
  const savingSubtopics = useRef(new Set());

  useEffect(() => {
    // Load cloned book data from localStorage
    const clonedData = localStorage.getItem('clonedBookData');
    if (clonedData) {
      const data = JSON.parse(clonedData);
      if (data.newBookId == bookId) {
        setOriginalBookId(data.originalBookId);
        setBookTitle(data.book.title);
        
        // Load topics with subtopics
        const loadedTopics = (data.book.topics || []).map((topic, idx) => ({
          id: Date.now() + idx,
          name: topic.name,
          topicId: topic.id,
          clone_id: topic.clone_id || null,
          hasSubtopics: topic.subtopics && topic.subtopics.length > 0,
          subtopics: (topic.subtopics || []).map((subtopic, subIdx) => ({
            id: Date.now() + idx * 1000 + subIdx,
            name: subtopic.name,
            subtopicId: subtopic.id,
            clone_id: subtopic.clone_id || null
          }))
        }));
        
        setTopics(loadedTopics);
      }
    }
  }, [bookId]);

  const handleAddTopic = () => {
    const newTopics = [...topics, { id: Date.now(), name: '', hasSubtopics: false, topicId: null, subtopics: [] }];
    setTopics(newTopics);
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
  };

  const handleTopicChange = (index, value) => {
    const newTopics = [...topics];
    newTopics[index].name = value;
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
        const res = await fetch('/api/author/topics', {
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
        const res = await fetch('/api/author/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: topic.name, 
            book_id: bookId 
          })
        });
        
        const data = await res.json();
        if (data.success) {
          const newTopics = [...topics];
          newTopics[index].topicId = data.topicId;
          setTopics(newTopics);
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
        // Open in new tab to preserve current state
        window.open(`/author/pages/topic/${updatedTopic.topicId}`, '_blank');
        return;
      }
      
      savingTopics.current.add(saveKey);
      setLoading(true);
      const res = await fetch('/api/author/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: topic.name, 
          book_id: bookId 
        })
      });
      
      const data = await res.json();
      savingTopics.current.delete(saveKey);
      if (data.success) {
        const newTopics = [...topics];
        newTopics[index].topicId = data.topicId;
        setTopics(newTopics);
        setLoading(false);
        // Open in new tab to preserve current state
        window.open(`/author/pages/topic/${data.topicId}`, '_blank');
      } else {
        alert('Error: ' + data.error);
        setLoading(false);
      }
    } else {
      // Open in new tab to preserve current state
      window.open(`/author/pages/topic/${topic.topicId}`, '_blank');
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
          book_id: bookId 
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
    }
  };

  const handleSubtopicChange = (topicIndex, subtopicIndex, value) => {
    const newTopics = [...topics];
    newTopics[topicIndex].subtopics[subtopicIndex].name = value;
    setTopics(newTopics);
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
        const res = await fetch('/api/author/subtopics', {
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
        const res = await fetch('/api/author/subtopics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: subtopic.name,
            book_id: bookId,
            topic_id: topic.topicId
          })
        });
        
        const data = await res.json();
        if (data.success) {
          const newTopics = [...topics];
          newTopics[topicIndex].subtopics[subtopicIndex].subtopicId = data.id;
          setTopics(newTopics);
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
        // Open in new tab to preserve current state
        window.open(`/author/pages/${updatedSubtopic.subtopicId}`, '_blank');
        return;
      }
      
      savingSubtopics.current.add(saveKey);
      setLoading(true);
      const res = await fetch('/api/author/subtopics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: subtopic.name,
          book_id: bookId,
          topic_id: topic.topicId
        })
      });
      
      const data = await res.json();
      savingSubtopics.current.delete(saveKey);
      if (data.success) {
        const newTopics = [...topics];
        newTopics[topicIndex].subtopics[subtopicIndex].subtopicId = data.id;
        setTopics(newTopics);
        setLoading(false);
        // Open in new tab to preserve current state
        window.open(`/author/pages/${data.id}`, '_blank');
      } else {
        alert('Error: ' + data.error);
        setLoading(false);
      }
    } else {
      // Open in new tab to preserve current state
      window.open(`/author/pages/${subtopic.subtopicId}`, '_blank');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Show dual update modal
    setShowDualUpdateModal(true);
  };

  const handleConfirmUpdate = async (updateBoth) => {
    setShowDualUpdateModal(false);
    setLoading(true);

    try {
      // Prepare updates data
      const updatesData = {
        bookTitle: bookTitle,
        topics: topics.map(topic => ({
          name: topic.name,
          description: null,
          clone_id: topic.clone_id || null,
          subtopics: topic.subtopics.map(subtopic => ({
            name: subtopic.name,
            description: null,
            clone_id: subtopic.clone_id || null
          }))
        }))
      };

      // Determine which books to update
      const bookIdsToUpdate = updateBoth ? [bookId, originalBookId] : [bookId];

      const res = await fetch('/api/superadmin/update-books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookIds: bookIdsToUpdate,
          updates: updatesData
        })
      });

      const data = await res.json();
      
      if (data.success) {
        localStorage.removeItem('clonedBookData');
        alert(updateBoth ? 'All books updated successfully!' : 'Book updated successfully!');
        router.push('/dashboard/create-book');
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating books:', error);
      alert('Failed to update books');
    }
    
    setLoading(false);
  };

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel? All unsaved changes will be lost.')) {
      localStorage.removeItem('clonedBookData');
      router.push('/dashboard/create-book');
    }
  };

  return (
    <div className="min-h-full bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-200 rounded-lg transition"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Cloned Book</h1>
              <p className="mt-2 text-sm text-gray-600">
                Modify the book structure and content
              </p>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Book Title *
              </label>
              <input
                type="text"
                placeholder="Enter book title"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-black"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                required
              />
            </div>

            {/* Topics Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Topics * {topics.length > 0 && `(${topics.length})`}
                </label>
                <button
                  type="button"
                  onClick={handleAddTopic}
                  className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Topic
                </button>
              </div>

              {topics.length === 0 && (
                <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-lg">
                  Click "Add Topic" button to add topics for this book
                </div>
              )}

              {/* Topics List */}
              {topics.length > 0 && (
                <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-1">
                  {topics.map((topic, index) => (
                    <div key={topic.id} className="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
                      <div className="flex gap-2 items-start mb-3">
                        <span className="text-sm font-medium text-gray-600 min-w-[24px] sm:min-w-[30px] mt-2">
                          {index + 1}.
                        </span>
                        <input
                          type="text"
                          placeholder="Enter topic name"
                          className="flex-1 px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-black"
                          value={topic.name}
                          onChange={(e) => handleTopicChange(index, e.target.value)}
                          onBlur={() => handleTopicBlur(index)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveTopic(index)}
                          className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition flex-shrink-0"
                          title="Remove topic"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2 ml-6 sm:ml-8">
                        <button
                          type="button"
                          onClick={() => handleAddPages(index)}
                          disabled={topic.hasSubtopics}
                          className={`flex-1 px-3 py-2 rounded-lg transition text-sm font-medium ${
                            topic.hasSubtopics
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-purple-600 text-white hover:bg-purple-700'
                          }`}
                        >
                          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Add Pages
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddSubtopic(index)}
                          className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                        >
                          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Subtopic
                        </button>
                      </div>
                      
                      {topic.topicId && (
                        <div className="mt-2 ml-6 sm:ml-8 flex flex-wrap gap-2">
                          <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                            ✓ Saved
                          </span>
                          {topic.hasSubtopics && (
                            <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                              Has {topic.subtopics.length} Subtopic(s)
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Subtopics Section */}
                      {topic.hasSubtopics && topic.subtopics.length > 0 && (
                        <div className="ml-6 sm:ml-8 mt-3 space-y-3 border-l-2 border-green-300 pl-3 sm:pl-4">
                          {topic.subtopics.map((subtopic, subIdx) => (
                            <div key={subtopic.id} className="bg-green-50 p-3 rounded-lg border border-green-200">
                              <div className="flex gap-2 items-start mb-2">
                                <span className="text-xs font-medium text-gray-600 min-w-[35px] sm:min-w-[40px] mt-2">
                                  {index + 1}.{subIdx + 1}
                                </span>
                                <input
                                  type="text"
                                  placeholder="Enter subtopic name"
                                  className="flex-1 px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm text-black"
                                  value={subtopic.name}
                                  onChange={(e) => handleSubtopicChange(index, subIdx, e.target.value)}
                                  onBlur={() => handleSubtopicBlur(index, subIdx)}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddPagesToSubtopic(index, subIdx)}
                                  className="px-2 sm:px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-xs font-medium flex-shrink-0"
                                >
                                  <svg className="w-3 h-3 inline sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="hidden sm:inline">Pages</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSubtopic(index, subIdx)}
                                  className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition flex-shrink-0"
                                  title="Delete subtopic"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                              {subtopic.subtopicId && (
                                <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium ml-10 sm:ml-12">
                                  ✓ Saved
                                </span>
                              )}
                            </div>
                          ))}
                          
                          <button
                            type="button"
                            onClick={() => handleAddSubtopic(index)}
                            className="w-full px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm font-medium border border-green-300"
                          >
                            + Add Another Subtopic
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full sm:w-auto sm:flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-lg hover:shadow-xl font-medium"
              >
                {loading ? 'Processing...' : 'Update Changes'}
              </button>
              <button 
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Dual Update Modal */}
      {showDualUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Update Options</h3>
            </div>

            <p className="text-gray-600 mb-6">
              Do you want the changes to be applied to:
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleConfirmUpdate(true)}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-left flex items-center gap-3"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <div>
                  <div className="font-semibold">All Books</div>
                  <div className="text-xs text-indigo-100">Update all books in the clone tree</div>
                </div>
              </button>

              <button
                onClick={() => handleConfirmUpdate(false)}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-left flex items-center gap-3"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <div className="font-semibold">Only This Book</div>
                  <div className="text-xs text-green-100">Update only the cloned book</div>
                </div>
              </button>

              <button
                onClick={() => setShowDualUpdateModal(false)}
                className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
