// components/CloneTopicModal.jsx
export default function CloneTopicModal({
  show,
  loading,
  allBooks,
  currentBookId,
  selectedSourceBook,
  availableTopics,
  selectedTopics,
  topicTitles,
  onClose,
  onSourceBookChange,
  onTopicSelection,
  onSelectAllTopics,
  onTopicTitleChange,
  onSave
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Clone Topics</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Select Source Book */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Source Book *
              </label>
              <select
                value={selectedSourceBook}
                onChange={(e) => onSourceBookChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
              >
                <option value="">-- Select a book --</option>
                {allBooks.filter(book => book.id !== currentBookId).map(book => (
                  <option key={book.id} value={book.id}>{book.title}</option>
                ))}
              </select>
            </div>

            {/* Select Topics */}
            {availableTopics.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Select Topics to Clone *
                  </label>
                  <button
                    type="button"
                    onClick={onSelectAllTopics}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    {selectedTopics.length === availableTopics.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {availableTopics.map(topic => (
                    <label key={topic.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={selectedTopics.includes(topic.id)}
                        onChange={() => onTopicSelection(topic.id)}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span className="text-sm text-black">{topic.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Edit Topic Titles */}
            {selectedTopics.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Edit Topic Titles
                </label>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {selectedTopics.map((topicId, idx) => (
                    <div key={topicId}>
                      <label className="block text-xs text-gray-600 mb-1">
                        Topic {idx + 1}
                      </label>
                      <input
                        type="text"
                        value={topicTitles[topicId] || ''}
                        onChange={(e) => onTopicTitleChange(topicId, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"
                        placeholder="Topic title"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onSave}
              disabled={loading || selectedTopics.length === 0}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition font-medium"
            >
              {loading ? 'Cloning...' : 'Clone Topics'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
