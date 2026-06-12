import { useState } from 'react';
import { useStore } from '../store';
import { useIsPluginEnabled } from '../plugins';

export default function CollectionTree({ collection, onExport, onDelete, onPublish }) {
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const swaggerEnabled = useIsPluginEnabled('swagger');

  return (
    <div className="select-none">
      {/* Collection header */}
      <div
        className="flex items-center gap-1 px-2 py-1.5 hover:bg-pm-hover group cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-gray-400 text-xs w-3">{expanded ? '▾' : '▸'}</span>
        <span className="text-sm mr-1">📁</span>
        <span className="text-xs font-medium text-gray-200 flex-1 truncate">{collection.name}</span>

        {/* Always-visible Export button + overflow menu */}
        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onExport}
            title="Export as Postman collection"
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-green-400 px-1.5 py-0.5 rounded text-xs transition-fast"
          >
            ↓
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu((m) => !m)}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white px-1 rounded text-xs transition-fast"
            >
              ⋯
            </button>
            {showMenu && (
              <CollectionMenu
                onExport={() => { onExport(); setShowMenu(false); }}
                onPublish={swaggerEnabled && onPublish ? () => { onPublish(); setShowMenu(false); } : null}
                onDelete={() => { onDelete(); setShowMenu(false); }}
                onClose={() => setShowMenu(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      {expanded && (
        <div className="ml-4">
          {(collection.items || []).map((item, i) => (
            <TreeItem key={i} item={item} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionMenu({ onExport, onPublish, onDelete, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 bg-pm-panel border border-pm-border rounded shadow-xl z-20 py-1 min-w-[160px]">
        <button
          onClick={onExport}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-pm-hover flex items-center gap-2"
        >
          <span>📦</span> Export (Postman)
        </button>
        {onPublish && (
          <button
            onClick={onPublish}
            className="w-full text-left px-3 py-1.5 text-xs text-blue-300 hover:bg-pm-hover flex items-center gap-2"
          >
            <span>📤</span> Publish as Swagger
          </button>
        )}
        <div className="border-t border-pm-border my-1" />
        <button
          onClick={onDelete}
          className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-pm-hover"
        >
          Delete
        </button>
      </div>
    </>
  );
}

function TreeItem({ item, depth }) {
  const [expanded, setExpanded] = useState(true);
  const { addTab } = useStore();

  if (item.type === 'folder') {
    return (
      <div>
        <div
          className="flex items-center gap-1 py-1 hover:bg-pm-hover cursor-pointer px-1 rounded"
          onClick={() => setExpanded((e) => !e)}
        >
          <span className="text-gray-500 text-xs w-3">{expanded ? '▾' : '▸'}</span>
          <span className="text-xs mr-1">📂</span>
          <span className="text-xs text-gray-300 truncate">{item.name}</span>
        </div>
        {expanded && (
          <div className="ml-3">
            {(item.items || []).map((child, i) => (
              <TreeItem key={i} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Request item
  const method = item.request?.method || 'GET';
  return (
    <button
      className="w-full text-left flex items-center gap-1.5 py-1 px-1 hover:bg-pm-hover rounded group"
      onClick={() =>
        addTab({
          name: item.name,
          request: item.request,
          saved: true,
        })
      }
      title={item.request?.url || ''}
    >
      <span className={`text-xs font-mono font-bold method-${method} w-14 flex-shrink-0 text-right`}>
        {method}
      </span>
      <span className="text-xs text-gray-300 truncate">{item.name}</span>
    </button>
  );
}
