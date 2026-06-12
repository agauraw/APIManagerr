import { useState } from 'react';
import { useStore } from '../store';

const RESPONSE_TABS = ['Body', 'Headers'];

export default function ResponseViewer() {
  const [activeTab, setActiveTab] = useState('Body');
  const [bodyView, setBodyView] = useState('pretty');

  const store = useStore();
  const activeTabData = store.tabs.find((t) => t.id === (store.activeTabId ?? store.tabs[0]?.id));
  const { response, loading } = activeTabData || {};

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-pm-bg">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <div className="w-8 h-8 border-2 border-pm-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Sending request…</span>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1 flex items-center justify-center bg-pm-bg">
        <div className="text-center text-gray-600">
          <div className="text-4xl mb-3">↑</div>
          <div className="text-sm">Send a request to see the response</div>
        </div>
      </div>
    );
  }

  if (response.error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-pm-bg">
        <div className="text-center max-w-sm">
          <div className="text-3xl mb-3">⚠</div>
          <div className="text-red-400 text-sm font-semibold mb-1">Request Failed</div>
          <div className="text-gray-400 text-xs font-mono bg-pm-panel border border-pm-border rounded p-3">
            {response.error}
          </div>
        </div>
      </div>
    );
  }

  const statusColor =
    response.status >= 500 ? 'text-red-400 bg-red-400/10' :
    response.status >= 400 ? 'text-amber-400 bg-amber-400/10' :
    response.status >= 300 ? 'text-yellow-400 bg-yellow-400/10' :
    response.status >= 200 ? 'text-green-400 bg-green-400/10' :
    'text-gray-400 bg-gray-400/10';

  const prettyJson = tryPrettyJson(response.data);

  return (
    <div className="flex-1 flex flex-col bg-pm-bg overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-pm-border bg-pm-panel flex-shrink-0">
        <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${statusColor}`}>
          {response.status} {response.statusText}
        </span>
        <span className="text-xs text-gray-500">
          Time: <span className="text-gray-300 font-mono">{response.time}ms</span>
        </span>
        <span className="text-xs text-gray-500">
          Size: <span className="text-gray-300 font-mono">{formatSize(response.size)}</span>
        </span>

        <div className="ml-auto flex gap-1">
          {RESPONSE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-0.5 rounded text-xs font-medium transition-fast ${
                activeTab === tab
                  ? 'bg-pm-accent text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {activeTab === 'Body' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* View mode switcher */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-pm-border flex-shrink-0">
            {['pretty', 'raw'].map((mode) => (
              <button
                key={mode}
                onClick={() => setBodyView(mode)}
                className={`text-xs px-2 py-0.5 rounded transition-fast capitalize ${
                  bodyView === mode ? 'text-gray-200 bg-pm-hover' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {mode}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-600 capitalize">
              {detectContentType(response.headers)}
            </span>
          </div>

          <div className="flex-1 overflow-auto p-3">
            {bodyView === 'pretty' && prettyJson ? (
              <JsonHighlight json={prettyJson} />
            ) : (
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words leading-5">
                {response.data}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Headers */}
      {activeTab === 'Headers' && (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-pm-border text-gray-500">
                <th className="text-left px-4 py-2 font-medium w-1/3">Header</th>
                <th className="text-left px-4 py-2 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(response.headers || {}).map(([key, value]) => (
                <tr key={key} className="border-b border-pm-border/30 hover:bg-pm-hover">
                  <td className="px-4 py-1.5 text-blue-300">{key}</td>
                  <td className="px-4 py-1.5 text-gray-300 break-all">{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function tryPrettyJson(data) {
  if (!data) return null;
  try {
    return JSON.stringify(JSON.parse(data), null, 2);
  } catch {
    return null;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function detectContentType(headers) {
  const ct = (headers?.['content-type'] || '').toLowerCase();
  if (ct.includes('json')) return 'JSON';
  if (ct.includes('html')) return 'HTML';
  if (ct.includes('xml')) return 'XML';
  if (ct.includes('text')) return 'Text';
  return '';
}

function JsonHighlight({ json }) {
  const html = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'json-key' : 'json-string';
        } else if (/true|false/.test(match)) {
          cls = 'json-bool';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );

  return (
    <pre
      className="text-xs font-mono leading-5 whitespace-pre-wrap break-words"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
