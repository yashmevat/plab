
'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Search, BookOpen, User, LogOut, LogIn, ChevronRight, Users } from 'lucide-react';

export default function BooksList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, logout } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // token from URL: /?token=...
  const tokenFromUrl = searchParams.get('token');

  useEffect(() => {
    fetchAllBooks();
  }, []);

  const fetchAllBooks = async () => {
    try {
      const res = await fetch('/api/books');
      const data = await res.json();
      if (data.success) {
        setBooks(data.data);
      }
    } catch (error) {
      console.error('Error fetching books:', error);
    } finally {
      setLoading(false);
    }
  };

  // book click + token forward
  const handleBookClick = (bookId) => {
    const targetUrl = tokenFromUrl
      ? `/embed/book/${bookId}`
      : `/embed/book/${bookId}`;

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleLogout = async () => {
    await logout();
  };

  const filteredBooks = books.filter((book) =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.author_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const gradients = [
    'from-blue-400 to-cyan-300',
    'from-purple-400 to-pink-300',
    'from-green-400 to-teal-300',
    'from-orange-400 to-yellow-300',
    'from-rose-400 to-pink-300',
    'from-indigo-400 to-blue-300',
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-400 border-t-transparent mx-auto"></div>
          <p className="mt-6 text-lg text-gray-700 font-medium">Loading amazing books...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      {/* ... बाकी code same रहने दो, change सिर्फ handleBookClick और tokenFromUrl वाला हिस्सा है ... */}

      {/* Books Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {filteredBooks.length === 0 ? (
          // ... no-books UI same ...
          <div className="text-center py-12 sm:py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No Books Found' : 'No Books Available'}
            </h2>
            <p className="text-sm sm:text-base text-gray-500">
              {searchQuery ? 'Try a different search term' : 'Check back later for new additions'}
            </p>
          </div>
        ) : (
          <>
            {/* heading */}
            <div className="mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                {searchQuery ? 'Search Results' : 'All Books'}
              </h2>
              <p className="text-sm sm:text-base text-gray-600">
                {filteredBooks.length} book{filteredBooks.length !== 1 ? 's' : ''} available
              </p>
            </div>

            {/* cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {filteredBooks.map((book, index) => (
                <div
                  key={book.id}
                  onClick={() => handleBookClick(book.id)}
                  className="bg-white rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:-translate-y-1 overflow-hidden group"
                >
                  {/* cover + info same as before */}
                  {/* ... */}
                  <div className="p-4">
                    <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-3 line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {book.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg">
                        <User className="w-4 h-4" />
                        <span className="line-clamp-1 font-medium">{book.author_name}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBookClick(book.id);
                      }}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium text-sm sm:text-base flex items-center justify-center gap-2 group"
                    >
                      <span>Read Book</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer same */}
    </div>
  );
}
