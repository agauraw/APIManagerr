import { useState } from 'react';
import { useStore } from '../store';
import { usePlugins, useIsPluginEnabled } from '../plugins';
import { parseCollection, collectionToPostman } from '../utils/postmanParser';
import { parseSwaggerSpec } from '../utils/swaggerParser';
import CollectionTree from './CollectionTree';
import SwaggerPublisher from './SwaggerPublisher';

const STATIC_TABS = [
  { id: 'collections', label: 'Collections' },
  { id: 'history', label: 'History' },
];

export default function Sidebar() {
  const [newColName, setNewColName] = useState('');
  const [showNewColInput, setShowNewColInput] = useState(false);
  const [publishingCol, setPublishingCol] = useState(null);

  const {
    sidebarTab, setSidebarTab,
    collections, addCollection, createCollection, removeCollection,
    history, clearHistory,
    addTab,
  } = useStore();

  const { activePlugins } = usePlugins();
  const swaggerEnabled = useIsPluginEnabled('swagger');

  // Collect sidebar tabs contributed by active plugins (sorted by order)
  const pluginTabs = activePlugins
    .filter((p) => p.sidebarTab)
    .sort((a, b) => (a.sidebarTab.order ?? 99) - (b.sidebarTab.order ?? 99));

  const allTabs = [
    ...STATIC_TABS,
    ...pluginTabs.map((p) => ({ id: p.id, label: p.sidebarTab.label })),
  ];

  // Guard: if the active sidebar tab belongs to a now-disabled plugin, fall back
  const validTab = allTabs.find((t) => t.id === sidebarTab) ? sidebarTab : 'collections';

  async function handleImportPostman() {
    if (!window.electronAPI) return alert('Import only works in Electron');
    const raw = await window.electronAPI.importCollection();
    if (!raw) return;
    if (raw.error) return alert('Failed to read file: ' + raw.error);
    try {
      const col = parseCollection(raw);
      addCollection(col);
    } catch (e) {
      alert('Invalid Postman collection: ' + e.message);
    }
  }

  async function handleImportSwagger() {
    if (!window.electronAPI) return alert('Import only works in Electron');
    const spec = await window.electronAPI.importSwagger();
    if (!spec) return;
    if (spec.error) return alert('Failed to read file: ' + spec.error);
    try {
      const col = parseSwaggerSpec(spec);
      addCollection(col);
    } catch (e) {
      alert('Invalid Swagger/OpenAPI spec: ' + e.message);
    }
  }

  async function handleExport(col) {
    if (!window.electronAPI) return alert('Export only works in Electron');
    const postman = collectionToPostman(col);
    await window.electronAPI.exportCollection(postman);
  }

  function openFromHistory(entry) {
    addTab({ request: entry.request, name: entry.request.url || 'Request' });
  }

  return (
    <div className="w-72 flex-shrink-0 bg-pm-panel border-r border-pm-border flex flex-col overflow-hidden">
      {/* Tab nav */}
      <div className="flex border-b border-pm-border flex-shrink-0 overflow-x-auto">
        {allTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSidebarTab(tab.id)}
            className={`flex-shrink-0 flex-1 py-2 px-2 text-xs font-medium transition-fast whitespace-nowrap ${
              validTab === tab.id
                ? 'text-pm-accent border-b-2 border-pm-accent bg-pm-hover'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Collections */}
      {validTab === 'collections' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-col gap-1.5 p-2 border-b border-pm-border flex-shrink-0">
            <div className="flex gap-1.5">
              <ImportMenu
                onImportPostman={handleImportPostman}
                onImportSwagger={swaggerEnabled ? handleImportSwagger : null}
              />
              <button
                onClick={() => setShowNewColInput((v) => !v)}
                className="flex-1 text-xs bg-pm-hover hover:bg-pm-border text-gray-300 rounded px-2 py-1.5 transition-fast border border-pm-border"
              >
                + New
              </button>
              <button
                onClick={() => addTab()}
                className="text-xs bg-pm-hover hover:bg-pm-border text-gray-300 rounded px-2 py-1.5 transition-fast border border-pm-border"
                title="New request tab"
              >
                + Tab
              </button>
            </div>

            {showNewColInput && (
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newColName.trim()) {
                      createCollection(newColName.trim());
                      setNewColName('');
                      setShowNewColInput(false);
                    }
                    if (e.key === 'Escape') setShowNewColInput(false);
                  }}
                  placeholder="Collection name…"
                  className="flex-1 bg-pm-input border border-pm-border rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-pm-accent"
                />
                <button
                  onClick={() => {
                    if (newColName.trim()) {
                      createCollection(newColName.trim());
                      setNewColName('');
                      setShowNewColInput(false);
                    }
                  }}
                  className="text-xs bg-pm-accent text-white rounded px-2 py-1 transition-fast"
                >
                  Create
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {collections.length === 0 ? (
              <div className="text-center text-gray-500 text-xs mt-8 px-4">
                <div className="text-2xl mb-2">📁</div>
                <div>Import or create a collection to get started</div>
              </div>
            ) : (
              collections.map((col) => (
                <CollectionTree
                  key={col._id}
                  collection={col}
                  onExport={() => handleExport(col)}
                  onDelete={() => removeCollection(col._id)}
                  onPublish={swaggerEnabled ? () => setPublishingCol(col) : null}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* History */}
      {validTab === 'history' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
            <span className="text-xs text-gray-400">{history.length} requests</span>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-xs text-gray-500 hover:text-red-400 transition-fast"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <div className="text-center text-gray-500 text-xs mt-8">No history yet</div>
            ) : (
              history.map((entry) => (
                <HistoryItem key={entry.id} entry={entry} onClick={() => openFromHistory(entry)} />
              ))
            )}
          </div>
        </div>
      )}

      {/* Plugin sidebar tabs */}
      {pluginTabs.map((plugin) =>
        validTab === plugin.id ? (
          <plugin.sidebarTab.component key={plugin.id} />
        ) : null
      )}

      {/* Swagger Publisher modal */}
      {publishingCol && (
        <SwaggerPublisher
          collection={publishingCol}
          onClose={() => setPublishingCol(null)}
        />
      )}
    </div>
  );
}

function ImportMenu({ onImportPostman, onImportSwagger }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex flex-1">
      <button
        onClick={onImportPostman}
        className="flex-1 text-xs bg-pm-accent hover:bg-green-500 text-white rounded-l px-2 py-1.5 font-medium transition-fast"
        title="Import Postman collection"
      >
        Import
      </button>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs bg-green-600 hover:bg-green-500 text-white rounded-r px-1.5 py-1.5 border-l border-green-700 transition-fast"
        title="Import options"
      >
        ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 bg-pm-panel border border-pm-border rounded shadow-xl z-20 min-w-[160px]">
            <button
              onClick={() => { onImportPostman(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-pm-hover flex items-center gap-2"
            >
              <span>📦</span> Postman Collection
            </button>
            {onImportSwagger && (
              <button
                onClick={() => { onImportSwagger(); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-pm-hover flex items-center gap-2"
              >
                <span>📄</span> Swagger / OpenAPI
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function HistoryItem({ entry, onClick }) {
  const { request, response, timestamp } = entry;
  const method = request.method || 'GET';
  const time = new Date(timestamp).toLocaleTimeString();

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 hover:bg-pm-hover border-b border-pm-border/50 transition-fast group"
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span className={`text-xs font-mono font-bold method-${method} w-14 flex-shrink-0`}>{method}</span>
        {response && (
          <span
            className={`text-xs font-mono px-1 rounded flex-shrink-0 ${
              response.status >= 200 && response.status < 300
                ? 'text-green-400'
                : response.status >= 400
                ? 'text-red-400'
                : 'text-yellow-400'
            }`}
          >
            {response.status}
          </span>
        )}
        <span className="text-xs text-gray-500 ml-auto">{time}</span>
      </div>
      <div className="text-xs text-gray-400 truncate font-mono">
        {request.url || '(no url)'}
      </div>
    </button>
  );
}
