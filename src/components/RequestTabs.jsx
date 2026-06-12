import { useStore } from '../store';

const METHOD_COLORS = {
  GET: 'text-blue-400',
  POST: 'text-green-400',
  PUT: 'text-yellow-400',
  DELETE: 'text-red-400',
  PATCH: 'text-teal-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-blue-300',
};

export default function RequestTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useStore();
  const active = activeTabId ?? tabs[0]?.id;

  return (
    <div className="flex items-center bg-pm-bg border-b border-pm-border overflow-x-auto flex-shrink-0 h-9">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const method = tab.request?.method || 'GET';
        const color = METHOD_COLORS[method] || 'text-gray-400';

        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-pm-border flex-shrink-0 max-w-48 group transition-fast ${
              isActive
                ? 'bg-pm-panel border-b-2 border-b-pm-accent'
                : 'hover:bg-pm-hover text-gray-500'
            }`}
          >
            {tab.type === 'db' ? (
              <span className="text-xs font-mono font-bold text-teal-400 flex-shrink-0">SQL</span>
            ) : (
              <span className={`text-xs font-mono font-bold flex-shrink-0 ${color}`}>{method}</span>
            )}
            <span className="text-xs truncate flex-1 text-gray-300">
              {tab.name || (tab.type === 'db' ? 'SQL Query' : 'New Request')}
            </span>
            {tab.loading && (
              <span className="w-2 h-2 rounded-full bg-pm-accent animate-pulse flex-shrink-0" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white ml-1 flex-shrink-0 transition-fast leading-none"
              title="Close tab"
            >
              ✕
            </button>
          </div>
        );
      })}

      <button
        onClick={() => addTab()}
        className="px-3 py-1.5 text-gray-500 hover:text-gray-200 hover:bg-pm-hover text-sm flex-shrink-0 transition-fast"
        title="New tab"
      >
        +
      </button>
    </div>
  );
}
