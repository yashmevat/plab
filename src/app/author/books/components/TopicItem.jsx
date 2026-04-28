// components/TopicItem.jsx
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

export default function TopicItem({ 
  topic, 
  index,
  onTopicChange,
  onRemoveTopic,
  onAddPages,
  onAddSubtopic,
  onOpenCloneSubtopicModal,
  onSubtopicChange,
  onRemoveSubtopic,
  onAddPagesToSubtopic,
  onSubtopicDragEnd
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <SortableTopicItem key={topic.id} topic={topic} index={index}>
      {({ attributes, listeners, index: idx }) => (
        <div className="bg-gray-50 p-2 sm:p-4 rounded-lg border border-gray-200">
          {/* Topic Header Row */}
          <div className="flex gap-1.5 items-center mb-3">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="p-1.5 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing flex-shrink-0"
              title="Drag to reorder"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </button>
            <span className="text-xs font-medium text-gray-500 flex-shrink-0">
              {index + 1}.
            </span>
            <input
              type="text"
              placeholder="Enter topic name"
              className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-black"
              value={topic.name}
              onChange={(e) => onTopicChange(index, e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => onRemoveTopic(index)}
              className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition flex-shrink-0"
              title="Remove topic"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 ml-3 sm:ml-8">
            <button
              type="button"
              onClick={() => onAddPages(index)}
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
              onClick={() => onAddSubtopic(index)}
              className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Subtopic
            </button>

            <button
              type="button"
              onClick={() => onOpenCloneSubtopicModal(index)}
              className="flex-1 px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition text-sm font-medium"
              title="Clone Subtopic"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v10M16 7v10M3 12h18" />
              </svg>
              Clone Subtopic
            </button>
          </div>
          
          {topic.topicId && (
            <div className="mt-2 ml-3 sm:ml-8 flex flex-wrap gap-2">
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
            <div className="ml-2 sm:ml-8 mt-3 space-y-3 border-l-2 border-green-300 pl-2 sm:pl-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => onSubtopicDragEnd(index)(event)}
              >
                <SortableContext
                  items={topic.subtopics.map(s => `subtopic-${s.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {topic.subtopics.map((subtopic, subIdx) => (
                    <SortableSubtopicItem 
                      key={subtopic.id} 
                      subtopic={subtopic} 
                      topicIndex={index} 
                      subIdx={subIdx}
                    >
                      {({ attributes: subAttrs, listeners: subListeners }) => (
                        <div className="bg-green-50 p-2 rounded-lg border border-green-200">
                          {/* Subtopic row: input on top, buttons below on mobile */}
                          <div className="flex gap-1.5 items-center">
                            <button
                              type="button"
                              {...subAttrs}
                              {...subListeners}
                              className="p-1 hover:bg-green-200 rounded cursor-grab active:cursor-grabbing flex-shrink-0"
                              title="Drag to reorder"
                            >
                              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                              </svg>
                            </button>
                            <span className="text-xs font-medium text-gray-500 flex-shrink-0">
                              {index + 1}.{subIdx + 1}
                            </span>
                            <input
                              type="text"
                              placeholder="Enter subtopic name"
                              className="flex-1 min-w-0 px-2 py-1.5 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-xs text-black"
                              value={subtopic.name}
                              onChange={(e) => onSubtopicChange(index, subIdx, e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => onAddPagesToSubtopic(index, subIdx)}
                              className="p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex-shrink-0"
                              title="Add Pages"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveSubtopic(index, subIdx)}
                              className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition flex-shrink-0"
                              title="Delete subtopic"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          {subtopic.subtopicId && (
                            <span className="inline-flex items-center mt-1.5 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                              ✓ Saved
                            </span>
                          )}
                        </div>
                      )}
                    </SortableSubtopicItem>
                  ))}
                </SortableContext>
              </DndContext>
              
              <button
                type="button"
                onClick={() => onAddSubtopic(index)}
                className="w-full px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm font-medium border border-green-300"
              >
                + Add Another Subtopic
              </button>
            </div>
          )}
        </div>
      )}
    </SortableTopicItem>
  );
}
