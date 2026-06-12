import { useState, useMemo } from 'react';
import { exportToOpenAPI } from '../utils/swaggerExporter';

export default function SwaggerPublisher({ collection, onClose }) {
  const [serverUrl, setServerUrl] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [copied, setCopied] = useState(false);

  const spec = useMemo(
    () => exportToOpenAPI(collection, { serverUrl: serverUrl.trim(), version: version.trim() || '1.0.0' }),
    [collection, serverUrl, version]
  );

  const specJson = useMemo(() => JSON.stringify(spec, null, 2), [spec]);

  const endpointCount = useMemo(() => Object.keys(spec.paths || {}).length, [spec]);
  const operationCount = useMemo(
    () =>
      Object.values(spec.paths || {}).reduce(
        (sum, path) => sum + Object.keys(path).length,
        0
      ),
    [spec]
  );

  async function handleDownload() {
    if (window.electronAPI) {
      await window.electronAPI.exportSwagger(spec, collection.name);
    } else {
      // Browser fallback: trigger download
      const blob = new Blob([specJson], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${collection.name || 'openapi'}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(specJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-pm-panel border border-pm-border rounded-lg shadow-2xl w-[780px] max-h-[88vh] flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-pm-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lg">📤</span>
            <div>
              <h2 className="text-sm font-semibold text-gray-200">Publish as Swagger / OpenAPI 3.0</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {collection.name} · {endpointCount} paths · {operationCount} operations
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">✕</button>
        </div>

        {/* Config bar */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-pm-border bg-pm-bg/40 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <label className="text-xs text-gray-400 whitespace-nowrap">Server URL</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://api.example.com (auto-detected)"
              className="flex-1 bg-pm-input border border-pm-border rounded px-2 py-1 text-xs text-gray-300 font-mono outline-none focus:border-pm-accent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 whitespace-nowrap">Version</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
              className="w-24 bg-pm-input border border-pm-border rounded px-2 py-1 text-xs text-gray-300 font-mono outline-none focus:border-pm-accent"
            />
          </div>
        </div>

        {/* Spec preview */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: path summary */}
          <div className="w-52 flex-shrink-0 border-r border-pm-border overflow-y-auto">
            <div className="px-3 py-2 text-xs text-gray-500 font-medium uppercase tracking-wide border-b border-pm-border">
              Paths
            </div>
            {Object.entries(spec.paths || {}).map(([pathStr, methods]) => (
              <div key={pathStr} className="border-b border-pm-border/40">
                <div className="px-3 py-1.5 text-xs text-gray-300 font-mono truncate" title={pathStr}>
                  {pathStr}
                </div>
                <div className="flex flex-wrap gap-1 px-3 pb-1.5">
                  {Object.keys(methods).map((m) => (
                    <span
                      key={m}
                      className={`text-xs font-mono font-bold uppercase method-${m.toUpperCase()}`}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {!Object.keys(spec.paths || {}).length && (
              <div className="px-3 py-4 text-xs text-gray-600">No paths found</div>
            )}
          </div>

          {/* JSON preview */}
          <div className="flex-1 overflow-auto bg-pm-bg">
            <pre className="p-4 text-xs font-mono text-gray-300 whitespace-pre leading-5">
              <JsonHighlight json={specJson} />
            </pre>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-pm-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              OpenAPI 3.0.0 · JSON or YAML (choose in save dialog)
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="px-4 py-1.5 text-sm bg-pm-hover border border-pm-border text-gray-300 hover:text-white rounded transition-fast"
            >
              {copied ? '✓ Copied' : 'Copy JSON'}
            </button>
            <button
              onClick={handleDownload}
              className="px-5 py-1.5 text-sm bg-pm-accent hover:bg-green-500 text-white rounded font-medium transition-fast"
            >
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
        if (/^"/.test(match)) cls = /:$/.test(match) ? 'json-key' : 'json-string';
        else if (/true|false/.test(match)) cls = 'json-bool';
        else if (/null/.test(match)) cls = 'json-null';
        return `<span class="${cls}">${match}</span>`;
      }
    );
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
