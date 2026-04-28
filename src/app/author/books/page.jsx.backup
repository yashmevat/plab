// app/author/books/page.jsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthorBooksPage() {
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [formData, setFormData] = useState({ 
    title: '', 
    subject_id: '',
    topics: []
  });
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [expandedBooks, setExpandedBooks] = useState({}); // Track which books are expanded

  useEffect(() => {
    fetchBooks();
    fetchSubjects();
  }, []);

  const fetchBooks = async () => {
    const res = await fetch('/api/author/books');
    const data = await res.json();
    if (data.success) setBooks(data.data);
  };

  const fetchSubjects = async () => {
    const res = await fetch('/api/author/subjects');
    const data = await res.json();
    if (data.success) setSubjects(data.data);
  };

  const handleAddTopic = () => {
    if (!formData.subject_id) {
      alert('Please select a subject first');
      return;
    }
    setFormData({
      ...formData,
      topics: [...formData.topics, { name: '' }]
    });
  };

  const handleRemoveTopic = (index) => {
    const newTopics = formData.topics.filter((_, i) => i !== index);
    setFormData({ ...formData, topics: newTopics });
  };

  const handleTopicChange = (index, value) => {
    const newTopics = [...formData.topics];
    newTopics[index].name = value;
    setFormData({ ...formData, topics: newTopics });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.topics.length === 0) {
      alert('Please add at least one topic');
      return;
    }

    const hasEmptyTopic = formData.topics.some(topic => !topic.name.trim());
    if (hasEmptyTopic) {
      alert('Please fill in all topic names');
      return;
    }

    setLoading(true);
    
    const method = editMode ? 'PUT' : 'POST';
    const body = editMode 
      ? JSON.stringify({ ...formData, id: editId })
      : JSON.stringify(formData);

    const res = await fetch('/api/author/books', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body
    });
    
    const data = await res.json();
    if (data.success) {
      setFormData({ title: '', subject_id: '', topics: [] });
      setEditMode(false);
      setEditId(null);
      setShowForm(false);
      fetchBooks();
      alert(editMode ? 'Book updated successfully!' : 'Book created successfully!');
    } else {
      alert('Error: ' + data.error);
    }
    setLoading(false);
  };

  const handleEdit = (book) => {
    setFormData({
      title: book.title,
      subject_id: book.subject_id,
      topics: book.topics || []
    });
    setEditMode(true);
    setEditId(book.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditId(null);
    setFormData({ title: '', subject_id: '', topics: [] });
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this book? All topics, chapters and pages will also be deleted.')) return;
    
    const res = await fetch(`/api/author/books?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      fetchBooks();
      alert('Book deleted successfully!');
    } else {
      alert('Error: ' + data.error);
    }
  };

  const toggleBookExpansion = (bookId) => {
    setExpandedBooks(prev => ({
      ...prev,
      [bookId]: !prev[bookId]
    }));
  };

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = !filterSubject || book.subject_id === parseInt(filterSubject);
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="min-h-full bg-gray-50">
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
                setShowForm(!showForm);
                if (editMode) handleCancelEdit();
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

        {/* Add/Edit Book Form - Collapsible */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200 animate-slideDown">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editMode ? '✏️ Edit Book' : '📚 Create New Book'}
              </h2>
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-gray-600"
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
                  placeholder="Enter book title (e.g., Introduction to Calculus)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  value={formData.subject_id}
                  onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                  required
                >
                  <option value="">Select Subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>

              {/* Topics Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Topics * {formData.topics.length > 0 && `(${formData.topics.length})`}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTopic}
                    disabled={!formData.subject_id}
                    className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition text-sm font-medium"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Topic
                  </button>
                </div>

                {!formData.subject_id && (
                  <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-lg">
                    Please select a subject first to add topics
                  </div>
                )}

                {formData.subject_id && formData.topics.length === 0 && (
                  <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-lg">
                    Click "Add Topic" button to add topics for this book
                  </div>
                )}

                {/* Topics List */}
                {formData.topics.length > 0 && (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {formData.topics.map((topic, index) => (
                      <div key={index} className="flex gap-2 items-center bg-gray-50 p-3 rounded-lg">
                        <span className="text-sm font-medium text-gray-600 min-w-[30px]">
                          {index + 1}.
                        </span>
                        <input
                          type="text"
                          placeholder="Enter topic name"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                          value={topic.name}
                          onChange={(e) => handleTopicChange(index, e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveTopic(index)}
                          className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                          title="Remove topic"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 sm:flex-none px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-lg hover:shadow-xl font-medium"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    editMode ? 'Update Book' : 'Create Book'
                  )}
                </button>
                <button 
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search & Filter */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Subject Filter */}
            <div className="relative">
              <select
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition appearance-none"
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
              >
                <option value="">All Subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
              <svg className="absolute right-3 top-4 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Books Table - Desktop */}
        <div className="hidden md:block bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Book Title</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Topics</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBooks.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <p className="text-lg font-medium">No books found</p>
                      <p className="text-sm mt-1">Create your first book to get started</p>
                    </td>
                  </tr>
                ) : (
                  filteredBooks.map((book) => (
                    <>
                      {/* Main Book Row */}
                      <tr key={book.id} className="hover:bg-gray-50 transition">
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
                          <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {book.subject_name}
                          </span>
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
                              onClick={() => handleEdit(book)}
                              className="inline-flex items-center px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition text-sm font-medium"
                              title="Edit Book"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button 
                              onClick={() => handleDelete(book.id)}
                              className="inline-flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm font-medium"
                              title="Delete Book"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Topics Rows */}
                      {expandedBooks[book.id] && book.topics && book.topics.length > 0 && (
                        book.topics.map((topic, idx) => (
                          <tr key={`topic-${topic.id}`} className="bg-gray-50">
                            <td className="px-6 py-3" colSpan="2">
                              <div className="flex items-center gap-3 ml-12">
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
                            <td className="px-6 py-3">
                              <button 
                                onClick={() => router.push(`/author/subtopics/${book.id}/${topic.id}`)}
                                className="inline-flex items-center px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition text-sm font-medium"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Subtopics
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Books Cards - Mobile */}
        <div className="md:hidden space-y-4">
          {filteredBooks.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-200">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-lg font-medium text-gray-900">No books found</p>
              <p className="text-sm text-gray-600 mt-1">Create your first book to get started</p>
            </div>
          ) : (
            filteredBooks.map((book) => (
              <div key={book.id} className="bg-white rounded-xl shadow-lg border border-gray-200">
                {/* Book Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                      {book.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-lg mb-2">{book.title}</h3>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="inline-flex items-center px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {book.subject_name}
                        </span>
                        {book.topics && book.topics.length > 0 && (
                          <span className="inline-flex items-center px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                            {book.topics.length} Topics
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Created {new Date(book.created_at).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Book Actions */}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggleBookExpansion(book.id)}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition text-sm font-medium"
                    >
                      <svg 
                        className={`w-4 h-4 mr-1 transition-transform ${expandedBooks[book.id] ? 'rotate-90' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {expandedBooks[book.id] ? 'Hide Topics' : 'Show Topics'}
                    </button>
                    <button 
                      onClick={() => handleEdit(book)}
                      className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => handleDelete(book.id)}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Topics List */}
                {expandedBooks[book.id] && book.topics && book.topics.length > 0 && (
                  <div className="p-4 bg-gray-50 space-y-2">
                    {book.topics.map((topic, idx) => (
                      <div key={topic.id} className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{topic.name}</p>
                              <p className="text-xs text-gray-500">{topic.subtopic_count || 0} Subtopics</p>
                            </div>
                          </div>
                          <button
                            onClick={() => router.push(`/author/subtopics/${book.id}/${topic.id}`)}
                            className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition text-xs font-medium"
                          >
                            Subtopics
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

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
