// components/BooksDisplay.jsx
'use client';
import { Fragment, useState } from 'react';
import Link from 'next/link';

export default function BooksDisplay({ books, searchTerm, onEdit, onDelete }) {
  const [expandedBooks, setExpandedBooks] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({});

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
    book.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditClick = (book) => {
    onEdit(book);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* Books Table - Desktop Only */}
      <div className="hidden md:block bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Book Title</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Topics</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBooks.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <p className="text-lg font-medium">No books found</p>
                    <p className="text-sm mt-1">Create your first book to get started</p>
                  </td>
                </tr>
              ) : (
                filteredBooks.map((book) => (
                  <Fragment key={book.id}>
                    <tr className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleBookExpansion(book.id)}
                            className="p-1 hover:bg-gray-200 rounded transition"
                          >
                            <svg 
                              className={`w-5 h-5 text-gray-600 transition-transform ${expandedBooks[book.id] ? 'rotate-90' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                            {book.title.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{book.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                          {book.topics?.length || 0} Topics
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(book.created_at).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEditClick(book)}
                            className="inline-flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-medium"
                            title="Edit Book"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => onDelete(book.id)}
                            className="inline-flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm font-medium"
                            title="Delete Book"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <Link 
                            href={`/book/${book.id}`}
                            className="inline-flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-medium"
                            title="View Book"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Topics Rows */}
                    {expandedBooks[book.id] && book.topics && book.topics.length > 0 && (
                      book.topics.map((topic, idx) => (
                        <Fragment key={`topic-${topic.id}`}>
                          <tr className="bg-gray-50">
                            <td className="px-6 py-3" colSpan="2">
                              <div className="flex items-center gap-3 ml-12">
                                <button
                                  onClick={() => toggleTopicExpansion(topic.id)}
                                  className="p-1 hover:bg-gray-300 rounded transition"
                                >
                                  <svg 
                                    className={`w-4 h-4 text-gray-600 transition-transform ${expandedTopics[topic.id] ? 'rotate-90' : ''}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                                  {idx + 1}
                                </div>
                                <span className="text-sm font-medium text-gray-700">{topic.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                Topic
                              </span>
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-500">
                              {topic.subtopic_count || 0} Subtopics
                            </td>
                          </tr>

                          {/* Expanded Subtopics Rows */}
                          {expandedTopics[topic.id] && topic.subtopics && topic.subtopics.length > 0 && (
                            topic.subtopics.map((subtopic, subIdx) => (
                              <tr key={`subtopic-${subtopic.id}`} className="bg-green-50">
                                <td className="px-6 py-2" colSpan="2">
                                  <div className="flex items-center gap-3 ml-24">
                                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs">
                                      {idx + 1}.{subIdx + 1}
                                    </div>
                                    <span className="text-xs font-medium text-gray-700">{subtopic.name}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-2">
                                  <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                    Subtopic
                                  </span>
                                </td>
                                <td className="px-6 py-2 text-xs text-gray-500">
                                  {subtopic.description}
                                </td>
                              </tr>
                            ))
                          )}
                        </Fragment>
                      ))
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Books Accordion - Mobile Only */}
      <div className="md:hidden space-y-3">
        {filteredBooks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center border border-gray-200">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-lg font-medium text-gray-900">No books found</p>
            <p className="text-sm text-gray-600 mt-1">Create your first book to get started</p>
          </div>
        ) : (
          filteredBooks.map((book) => (
            <div key={book.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              {/* Book Header */}
              <button
                onClick={() => toggleBookExpansion(book.id)}
                className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors active:bg-gray-100"
              >
                <svg 
                  className={`w-5 h-5 text-gray-600 transition-transform flex-shrink-0 ${expandedBooks[book.id] ? 'rotate-90' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {book.title.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h3 className="font-semibold text-gray-900 text-base truncate">{book.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                      {book.topics?.length || 0} Topics
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(book.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded Content */}
              <div className={`transition-all duration-300 ease-in-out ${expandedBooks[book.id] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                <div className="px-4 pb-3 pt-2 bg-gray-50 border-t border-gray-200 flex gap-2">
                  <button 
                    onClick={() => handleEditClick(book)}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-medium active:bg-blue-300"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button 
                    onClick={() => onDelete(book.id)}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm font-medium active:bg-red-300"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
