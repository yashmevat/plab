// app/author/books/page.jsx
'use client';
import { useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { useBookManagement } from './hooks/useBookManagement';
import { useTopicManagement } from './hooks/useTopicManagement';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useCloneManagement } from './hooks/useCloneManagement';

import { SortableTopicItem } from './components/SortableItems';
import TopicItem from './components/TopicItem';
import CloneTopicModal from './components/CloneTopicModal';
import CloneSubtopicModal from './components/CloneSubtopicModal';
import SyncModal from './components/SyncModal';
import BooksDisplay from './components/BooksDisplay';

export default function AuthorBooksPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const topRef = useRef(null);
  
  // Use custom hooks
  const bookManagement = useBookManagement();
  const topicManagement = useTopicManagement(bookManagement);
  const dragAndDrop = useDragAndDrop(bookManagement);
  const cloneManagement = useCloneManagement(bookManagement);

  const {
    books,
    bookTitle,
    setBookTitle,
    topics,
    loading,
    showForm,
    setShowForm,
    editingBookId,
    handleAddTopic,
    handleRemoveTopic,
    handleTopicChange,
    handleReset,
    handleDelete,
    handleEdit,
  } = bookManagement;

  const {
    handleAddPages,
    handleAddSubtopic,
    handleSubtopicChange,
    handleRemoveSubtopic,
    handleAddPagesToSubtopic
  } = topicManagement;

  const { handleTopicDragEnd, handleSubtopicDragEnd } = dragAndDrop;

  const {
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
    showSyncModal,
    setShowSyncModal,
    isEditMode,
    setIsEditMode
  } = cloneManagement;

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ensureTitleSaved = async () => {
      const { setLoading, currentBookId, fetchBooks, saveFormState } = bookManagement;
      const idToUpdate = editingBookId || currentBookId;
      if (!idToUpdate) return;

      try {
        setLoading(true);
        const res = await fetch('/api/author/books', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: idToUpdate, title: bookTitle })
        });
        const data = await res.json();
        if (data.success) {
          await fetchBooks();
          saveFormState(bookTitle, idToUpdate, topics);
        } else {
          console.error('Failed to update book title before sync:', data.error);
        }
      } catch (error) {
        console.error('Error updating title before sync:', error);
      }
      setLoading(false);
    };

    if (editingBookId) {
      await ensureTitleSaved();
      setIsEditMode(true);
      setShowSyncModal(true);
    } else {
      if (!bookManagement.currentBookId) {
        alert('Please add at least one topic before finishing');
        return;
      }
      await ensureTitleSaved();
      setIsEditMode(false);
      setShowSyncModal(true);
    }
  };

  const handleSyncChanges = async (syncEverywhere) => {
    const { setLoading, fetchBooks, currentBookId, saveFormState } = bookManagement;
    setLoading(true);
    try {
      if (syncEverywhere) {
        const changes = [];
        const clonedTopicsInfo = [];
        
        for (const topic of topics) {
          const hasClonedSubtopics = (topic.subtopics || []).some(s => !!s.cloneId || !!s.originalSubtopicId);
          if (topic.cloneId || hasClonedSubtopics) {
            clonedTopicsInfo.push({
              newTopicId: topic.topicId,
              originalTopicId: topic.topicId,
              subtopics: (topic.subtopics || []).map(s => ({
                newSubtopicId: s.subtopicId,
                originalSubtopicId: s.originalSubtopicId || s.subtopicId,
                isCloned: !!s.cloneId
              }))
            });
            
            if (topic.cloneId) {
              changes.push({
                type: 'topic',
                id: topic.topicId,
                originalId: topic.topicId,
                data: {
                  name: topic.name,
                  description: null
                },
                syncToOriginal: true
              });
            }
            
            for (const subtopic of (topic.subtopics || [])) {
              if (subtopic.cloneId) {
                changes.push({
                  type: 'subtopic',
                  id: subtopic.subtopicId,
                  originalId: subtopic.subtopicId,
                  data: {
                    name: subtopic.name,
                    description: null
                  },
                  syncToOriginal: true
                });
              }
            }
          }
        }
        
        if (changes.length > 0 || clonedTopicsInfo.length > 0) {
          const res = await fetch('/api/superadmin/sync-changes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              changes: changes,
              clonedTopics: clonedTopicsInfo,
              currentTopics: topics.map(t => ({
                topicId: t.topicId,
                name: t.name,
                isCloned: !!t.cloneId,
                subtopics: (t.subtopics || []).map(s => ({
                  subtopicId: s.subtopicId,
                  name: s.name,
                  isCloned: !!s.cloneId
                }))
              }))
            })
          });
          
          const data = await res.json();
          if (!data.success) {
            alert('Failed to sync changes: ' + data.error);
            setLoading(false);
            return;
          }
        }
      }
      
      if (isEditMode) {
        const res = await fetch('/api/author/books', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: editingBookId,
            title: bookTitle 
          })
        });
        
        const data = await res.json();
        if (data.success) {
          await fetchBooks();
          setShowSyncModal(false);
          handleReset(true);
          alert('Book updated successfully!');
        } else {
          alert('Error: ' + data.error);
        }
      } else {
        await fetchBooks();
        setShowSyncModal(false);
        handleReset(true);
        alert('Book created successfully!');
      }
    } catch (error) {
      console.error('Error syncing changes:', error);
      alert('Failed to sync changes');
    }
    setLoading(false);
  };

  const handleEditAndScroll = (book) => {
    handleEdit(book);
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="min-h-full bg-gray-50" ref={topRef}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Books</h1>
              <p className="mt-2 text-sm text-gray-600">
                Create and manage your books
              </p>
            </div>
            <button
              onClick={() => {
                if (showForm) {
                  handleReset();
                } else {
                  setShowForm(true);
                }
              }}
              className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showForm ? 'Cancel' : 'Create New Book'}
            </button>
          </div>
        </div>

        {/* Add Book Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-8 border border-gray-200 animate-slideDown">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {editingBookId ? '✏️ Edit Book' : '📚 Create New Book'}
              </h2>
              <button
                onClick={handleReset}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

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
                  <div className="flex items-center gap-2">
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

                    <button
                      type="button"
                      onClick={handleOpenCloneTopicModal}
                      className="inline-flex items-center px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition text-sm font-medium"
                      title="Clone Topic"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v10M16 7v10M3 12h18" />
                      </svg>
                      Clone Topic
                    </button>
                  </div>
                </div>

                {topics.length === 0 && (
                  <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-lg">
                    Click "Add Topic" button to add topics for this book
                  </div>
                )}

                {/* Topics List */}
                {topics.length > 0 && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleTopicDragEnd}
                  >
                    <SortableContext
                      items={topics.map(t => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-1">
                        {topics.map((topic, index) => (
                          <TopicItem 
                            key={topic.id} 
                            topic={topic} 
                            index={index}
                            onTopicChange={handleTopicChange}
                            onRemoveTopic={handleRemoveTopic}
                            onAddPages={handleAddPages}
                            onAddSubtopic={handleAddSubtopic}
                            onOpenCloneSubtopicModal={handleOpenCloneSubtopicModal}
                            onSubtopicChange={handleSubtopicChange}
                            onRemoveSubtopic={handleRemoveSubtopic}
                            onAddPagesToSubtopic={handleAddPagesToSubtopic}
                            onSubtopicDragEnd={handleSubtopicDragEnd}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full sm:w-auto sm:flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-lg hover:shadow-xl font-medium"
                >
                  {loading ? 'Saving...' : (editingBookId ? 'Update Book' : 'Done')}
                </button>
                <button 
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search & Filter */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stats */}
            <div className="flex items-center gap-4">
              <div className="bg-indigo-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{books.length}</p>
                <p className="text-sm text-gray-600">Total Books</p>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search books..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-black"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Books Display */}
        <BooksDisplay 
          books={books} 
          searchTerm={searchTerm} 
          onEdit={handleEditAndScroll} 
          onDelete={handleDelete} 
        />
      </div>

      {/* Modals */}
      <CloneTopicModal
        show={showCloneTopicModal}
        loading={loading}
        allBooks={allBooks}
        currentBookId={bookManagement.currentBookId}
        selectedSourceBook={selectedSourceBook}
        availableTopics={availableTopics}
        selectedTopics={selectedTopics}
        topicTitles={topicTitles}
        onClose={handleCloseCloneTopicModal}
        onSourceBookChange={handleSourceBookChange}
        onTopicSelection={handleTopicSelection}
        onSelectAllTopics={handleSelectAllTopics}
        onTopicTitleChange={(topicId, value) => setTopicTitles(prev => ({ ...prev, [topicId]: value }))}
        onSave={handleCloneTopicsSave}
      />

      <CloneSubtopicModal
        show={showCloneSubtopicModal}
        loading={loading}
        allBooks={allBooks}
        currentBookId={bookManagement.currentBookId}
        selectedSourceBookForSubtopic={selectedSourceBookForSubtopic}
        availableTopicsForSubtopic={availableTopicsForSubtopic}
        selectedSourceTopic={selectedSourceTopic}
        availableSubtopics={availableSubtopics}
        selectedSubtopics={selectedSubtopics}
        subtopicTitles={subtopicTitles}
        onClose={handleCloseCloneSubtopicModal}
        onSourceBookChange={handleSourceBookChangeForSubtopic}
        onSourceTopicChange={handleSourceTopicChange}
        onSubtopicSelection={handleSubtopicSelection}
        onSelectAllSubtopics={handleSelectAllSubtopics}
        onSubtopicTitleChange={(subtopicId, value) => setSubtopicTitles(prev => ({ ...prev, [subtopicId]: value }))}
        onSave={handleCloneSubtopicsSave}
      />

      <SyncModal
        show={showSyncModal}
        loading={loading}
        onSync={handleSyncChanges}
        onClose={() => setShowSyncModal(false)}
      />

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
