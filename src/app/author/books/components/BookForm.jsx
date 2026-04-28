// components/BookForm.jsx
'use client';
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
import { SortableTopicItem, SortableSubtopicItem } from './SortableItems';
import TopicItem from './TopicItem';

export default function BookForm({
  bookTitle,
  setBookTitle,
  topics,
  editingBookId,
  loading,
  handleAddTopic,
  handleOpenCloneTopicModal,
  handleTopicDragEnd,
  handleSubmit,
  handleReset
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
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
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Topics * {topics.length > 0 && `(${topics.length})`}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddTopic}
                className="inline-flex items-center px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs sm:text-sm font-medium"
              >
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Topic
              </button>

              <button
                type="button"
                onClick={handleOpenCloneTopicModal}
                className="inline-flex items-center px-2.5 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition text-xs sm:text-sm font-medium"
                title="Clone Topic"
              >
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
}
