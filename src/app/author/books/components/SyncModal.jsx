// components/SyncModal.jsx
export default function SyncModal({ show, loading, onSync, onClose }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Sync Changes</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-gray-700 mb-6">
            You have cloned topics/subtopics and made changes. How would you like to apply these changes?
          </p>

          <div className="space-y-3">
            <button
              onClick={() => onSync(false)}
              disabled={loading}
              className="w-full px-6 py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition font-medium text-left"
            >
              <div className="font-semibold text-lg mb-1">Only This Book</div>
              <div className="text-sm text-indigo-100">Changes will only affect this book</div>
            </button>

            <button
              onClick={() => onSync(true)}
              disabled={loading}
              className="w-full px-6 py-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 transition font-medium text-left"
            >
              <div className="font-semibold text-lg mb-1">Sync Everywhere</div>
              <div className="text-sm text-orange-100">Apply changes to all cloned instances across books</div>
            </button>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="w-full mt-4 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
