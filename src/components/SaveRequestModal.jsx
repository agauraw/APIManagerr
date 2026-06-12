import { useState } from 'react';
import { useStore } from '../store';

export default function SaveRequestModal({ request, tabName, onClose }) {
  const { collections, createCollection, saveRequestToCollection, updateTab, activeTabId, tabs } = useStore();

  const [requestName, setRequestName] = useState(tabName || request.url || 'New Request');
  const [selectedCollectionId, setSelectedCollectionId] = useState(collections[0]?._id || '');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [mode, setMode] = useState(collections.length ? 'existing' : 'new');

  function handleSave() {
    const name = requestName.trim() || 'New Request';
    let collectionId = selectedCollectionId;

    if (mode === 'new') {
      const colName = newCollectionName.trim();
      if (!colName) return;
      collectionId = createCollection(colName);
    } else if (!collectionId) {
      return;
    }

    saveRequestToCollection(collectionId, name, request);

    // Update tab name to match saved name
    const tab = tabs.find((t) => t.id === activeTabId);
    if (tab) updateTab(activeTabId, { name, saved: true });

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-pm-panel border border-pm-border rounded-lg shadow-2xl w-[420px] z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-pm-border">
          <h2 className="text-sm font-semibold text-gray-200">Save Request</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Request name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Request Name</label>
            <input
              type="text"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              autoFocus
              className="w-full bg-pm-input border border-pm-border rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-pm-accent"
            />
          </div>

          {/* Collection choice */}
          <div>
            <label className="block text-xs text-gray-400 mb-2 font-medium">Save to Collection</label>
            <div className="flex gap-3 mb-3">
              {collections.length > 0 && (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="colMode"
                    checked={mode === 'existing'}
                    onChange={() => setMode('existing')}
                    className="accent-pm-accent"
                  />
                  <span className="text-xs text-gray-300">Existing</span>
                </label>
              )}
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="colMode"
                  checked={mode === 'new'}
                  onChange={() => setMode('new')}
                  className="accent-pm-accent"
                />
                <span className="text-xs text-gray-300">New Collection</span>
              </label>
            </div>

            {mode === 'existing' && (
              <select
                value={selectedCollectionId}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
                className="w-full bg-pm-input border border-pm-border rounded px-3 py-2 text-sm text-gray-300 outline-none focus:border-pm-accent"
              >
                {collections.map((col) => (
                  <option key={col._id} value={col._id}>{col.name}</option>
                ))}
              </select>
            )}

            {mode === 'new' && (
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Collection name…"
                className="w-full bg-pm-input border border-pm-border rounded px-3 py-2 text-sm text-gray-300 outline-none focus:border-pm-accent"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-pm-border">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-400 hover:text-white transition-fast"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={mode === 'new' ? !newCollectionName.trim() : !selectedCollectionId}
            className="px-5 py-1.5 text-sm bg-pm-accent hover:bg-green-500 disabled:opacity-40 text-white rounded font-medium transition-fast"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
