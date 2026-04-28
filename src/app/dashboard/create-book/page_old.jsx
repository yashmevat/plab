'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateBookPage() {
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAuthors, setExpandedAuthors] = useState({});
  const [expandedBooks, setExpandedBooks] = useState({});
  const [expandedTopics, setExpandedTopics] = useState({});

  useEffect(() => {
    fetchBooks();
  }, []);

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

  const toggleAuthorExpansion = (authorId) => {
    setExpandedAuthors(prev => ({
      ...prev,
      [authorId]: !prev[authorId]
    }));
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

  // Group books by author
  const groupBooksByAuthor = (booksList) => {
    const grouped = {};
    booksList.forEach(book => {
      const authorKey = book.author_id || 'unknown';
      if (!grouped[authorKey]) {
        grouped[authorKey] = {
          id: book.author_id,
          name: book.author_name || 'Unknown Author',
          email: book.author_email,
          books: []
        };
      }
      grouped[authorKey].books.push(book);
    });
    return Object.values(grouped);
  };

  const filteredBooks = books.filter(book =>
    book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    book.author_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const authorGroups = groupBooksByAuthor(filteredBooks);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create Book by Cloning</h1>
              <p className="mt-2 text-sm text-gray-600">
                Clone an existing book with all its content
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/authors')}
              className="inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Search & Stats */}
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
                <p className="text-sm text-gray-600">Available Books</p>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search books or authors..."
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

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading books...</p>
          </div>
        )}

        {!loading && filteredBooks.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-200">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-lg font-medium text-gray-900">No books found</p>
            <p className="text-sm text-gray-600 mt-1">Try adjusting your search criteria</p>
          </div>
        )}

        {/* Authors & Books Grid - Desktop */}
        {!loading && authorGroups.length > 0 && (
          <div className="hidden md:block bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Author / Book Details</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Content</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {authorGroups.map((author) => (
                    <>
                      {/* Author Row */}
                      <tr key={`author-${author.id}`} className="bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition">
                        <td className="px-6 py-4" colSpan="3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleAuthorExpansion(author.id)}
                              className="p-1 hover:bg-white/50 rounded transition"
                            >
                              <svg 
                                className={`w-6 h-6 text-indigo-700 transition-transform ${expandedAuthors[author.id] ? 'rotate-90' : ''}`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                              {author.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold text-gray-900 text-lg">{author.name}</span>
                              <p className="text-sm text-gray-600">{author.email}</p>
                              <p className="text-xs text-indigo-600 mt-0.5">
                                {author.books.length} {author.books.length === 1 ? 'Book' : 'Books'}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Books under this Author */}
                      {expandedAuthors[author.id] && author.books.map((book) => (
                        <>
                          {/* Book Row */}
                          <tr key={book.id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3 ml-12">
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
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                                  {book.title.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-medium text-gray-900">{book.title}</span>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Created {new Date(book.created_at).toLocaleDateString('en-US', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                                  {book.topics?.length || 0} Topics
                                </span>
                                <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                  {book.topics?.reduce((sum, t) => sum + (t.subtopic_count || 0), 0) || 0} Subtopics
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => handleCloneBook(book.id, book.title)}
                                disabled={loading}
                                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Clone Book
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Topics Rows */}
                          {expandedBooks[book.id] && book.topics && book.topics.length > 0 && (
                            book.topics.map((topic, idx) => (
                              <>
                                <tr key={`topic-${topic.id}`} className="bg-gray-50">
                                  <td className="px-6 py-3" colSpan="2">
                                    <div className="flex items-center gap-3 ml-24">
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
                                      {topic.subtopic_count || 0} Subtopics • {topic.page_count || 0} Pages
                                    </span>
                                  </td>
                                </tr>

                                {/* Expanded Subtopics Rows */}
                                {expandedTopics[topic.id] && topic.subtopics && topic.subtopics.length > 0 && (
                                  topic.subtopics.map((subtopic, subIdx) => (
                                    <tr key={`subtopic-${subtopic.id}`} className="bg-green-50">
                                      <td className="px-6 py-2" colSpan="2">
                                        <div className="flex items-center gap-3 ml-36">
                                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs">
                                            {idx + 1}.{subIdx + 1}
                                          </div>
                                          <span className="text-xs font-medium text-gray-700">{subtopic.name}</span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-2">
                                        <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                          {subtopic.page_count || 0} Pages
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </>
                            ))
                          )}
                        </>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Authors & Books Cards - Mobile */}
        {!loading && authorGroups.length > 0 && (
          <div className="md:hidden space-y-4">
            {authorGroups.map((author) => (
              <div key={`author-mobile-${author.id}`} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                {/* Author Header */}
                <button
                  onClick={() => toggleAuthorExpansion(author.id)}
                  className="w-full p-4 flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-colors"
                >
                  <svg 
                    className={`w-6 h-6 text-indigo-700 transition-transform ${expandedAuthors[author.id] ? 'rotate-90' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {author.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <h3 className="font-semibold text-gray-900 text-base truncate">{author.name}</h3>
                    <p className="text-xs text-gray-600">{author.email}</p>
                    <p className="text-xs text-indigo-600 mt-0.5">
                      {author.books.length} {author.books.length === 1 ? 'Book' : 'Books'}
                    </p>
                  </div>
                </button>

                {/* Books under this Author */}
                <div className={`transition-all duration-300 ${expandedAuthors[author.id] ? 'max-h-[5000px]' : 'max-h-0 overflow-hidden'}`}>
                  <div className="p-2 space-y-2">
                    {author.books.map((book) => (
                      <div key={`book-mobile-${book.id}`} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                        <button
                          onClick={() => toggleBookExpansion(book.id)}
                          className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 transition-colors"
                        >
                          <svg 
                            className={`w-5 h-5 text-gray-600 transition-transform ${expandedBooks[book.id] ? 'rotate-90' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                            {book.title.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <h4 className="font-medium text-gray-900 text-sm truncate">{book.title}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(book.created_at).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </p>
                          </div>
                        </button>

                        <div className={`transition-all duration-300 ${expandedBooks[book.id] ? 'max-h-[3000px]' : 'max-h-0 overflow-hidden'}`}>
                          <div className="px-3 pb-3 space-y-3">
                            <div className="flex gap-2 flex-wrap">
                              <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                                {book.topics?.length || 0} Topics
                              </span>
                              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                {book.topics?.reduce((sum, t) => sum + (t.subtopic_count || 0), 0) || 0} Subtopics
                              </span>
                            </div>
                            
                            <button 
                              onClick={() => handleCloneBook(book.id, book.title)}
                              disabled={loading}
                              className="w-full inline-flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:bg-gray-400"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Clone Book
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
