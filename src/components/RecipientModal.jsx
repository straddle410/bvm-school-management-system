import { X, User } from 'lucide-react';

export default function RecipientModal({ log, recipients, loading, onClose }) {
  if (!log) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-semibold text-lg">Recipients</h2>
            <p className="text-sm text-gray-500 truncate max-w-xs">{log.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading recipients...</div>
          ) : recipients.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No recipients found</div>
          ) : (
            <ul className="space-y-2">
              {recipients.map((name, i) => (
                <li key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-50">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium">{name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 border-t text-sm text-gray-500 text-right">
          {!loading && `${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`}
        </div>
      </div>
    </div>
  );
}