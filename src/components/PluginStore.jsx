import { useState, useEffect } from 'react';
import { usePlugins } from '../plugins';

const CATALOG_URL =
  'https://raw.githubusercontent.com/agauraw/APIManagerr/amit/plugins-catalog.json';

export default function PluginStore() {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [state, setState] = useState({}); // id → 'installing'|'done'|'error'|'removing'
  const { plugins: installedPlugins } = usePlugins();

  const installedIds = new Set(installedPlugins.map((p) => p.id));

  async function loadCatalog() {
    if (!window.electronAPI?.plugins?.fetchCatalog) {
      setCatalogError('Plugin store not available in this version.');
      return;
    }
    setLoading(true);
    setCatalogError(null);
    const data = await window.electronAPI.plugins.fetchCatalog(CATALOG_URL);
    setLoading(false);
    if (data?.error) { setCatalogError(data.error); return; }
    if (!Array.isArray(data?.plugins)) { setCatalogError('Malformed catalog response.'); return; }
    setCatalog(data);
  }

  useEffect(() => { loadCatalog(); }, []);

  async function install(plugin) {
    setState((s) => ({ ...s, [plugin.id]: 'installing' }));
    const res = await window.electronAPI.plugins.install(plugin);
    if (res?.success) {
      setState((s) => ({ ...s, [plugin.id]: 'done' }));
    } else {
      setState((s) => ({ ...s, [plugin.id]: 'error' }));
      alert(`Install failed:\n${res?.error ?? 'Unknown error'}`);
    }
  }

  async function uninstall(pluginId) {
    if (!confirm('Remove this plugin? You may need to restart the app.')) return;
    setState((s) => ({ ...s, [pluginId]: 'removing' }));
    const res = await window.electronAPI.plugins.uninstall(pluginId);
    if (res?.success) {
      setState((s) => ({ ...s, [pluginId]: 'removed' }));
    } else {
      setState((s) => ({ ...s, [pluginId]: null }));
      alert(`Uninstall failed:\n${res?.error}`);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
        <div className="w-6 h-6 border-2 border-pm-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Fetching catalog from GitHub…</span>
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="text-2xl">🌐</div>
        <div className="text-xs text-red-400 text-center max-w-xs">{catalogError}</div>
        <button onClick={loadCatalog} className="text-xs text-pm-accent hover:underline mt-1">Retry</button>
      </div>
    );
  }

  if (!catalog) return null;

  const plugins = catalog.plugins ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500">{plugins.length} plugin{plugins.length !== 1 ? 's' : ''} in catalog</p>
        <button onClick={loadCatalog} className="text-xs text-gray-500 hover:text-gray-300 transition-fast">
          ↻ Refresh
        </button>
      </div>

      {plugins.map((plugin) => {
        const pluginState = state[plugin.id];
        const isInstalledLocally = installedIds.has(plugin.id);
        const isBuiltin = plugin.builtin === true;
        const effectivelyInstalled = isBuiltin || isInstalledLocally || pluginState === 'done';
        const isRemoved = pluginState === 'removed';

        return (
          <div
            key={plugin.id}
            className="flex items-start gap-3 p-3 rounded-lg border border-pm-border bg-pm-bg/50"
          >
            <div className="text-xl flex-shrink-0 w-8 text-center mt-0.5">{plugin.icon || '🔌'}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-xs font-semibold text-gray-200">{plugin.name}</span>
                <span className="text-xs text-gray-600">v{plugin.version}</span>
                {plugin.size && (
                  <span className="text-xs text-gray-700 font-mono">{plugin.size}</span>
                )}
                {isBuiltin && !isRemoved && (
                  <span className="text-xs bg-pm-accent/15 text-pm-accent border border-pm-accent/25 rounded px-1.5 py-px">
                    built-in
                  </span>
                )}
                {plugin.requiresRestart && !isBuiltin && (
                  <span className="text-xs text-gray-700">· restart required</span>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-1.5">{plugin.description}</p>
              {plugin.tags?.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {plugin.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-pm-hover text-gray-600 px-1.5 py-px rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-shrink-0 flex items-center gap-2">
              {isRemoved ? (
                <span className="text-xs text-gray-600 italic">Removed — restart app</span>
              ) : effectivelyInstalled ? (
                <>
                  <span className="text-xs text-green-400">✓ Installed</span>
                  {!isBuiltin && (
                    <button
                      onClick={() => uninstall(plugin.id)}
                      disabled={pluginState === 'removing'}
                      className="text-xs text-gray-600 hover:text-red-400 transition-fast disabled:opacity-40"
                    >
                      {pluginState === 'removing' ? '…' : 'Remove'}
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => install(plugin)}
                  disabled={pluginState === 'installing'}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-pm-accent hover:bg-green-500 disabled:opacity-50 text-white text-xs font-semibold rounded transition-fast"
                >
                  {pluginState === 'installing' ? (
                    <>
                      <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      Installing…
                    </>
                  ) : (
                    '⬇ Install'
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div className="mt-4 pt-4 border-t border-pm-border/50">
        <p className="text-xs text-gray-600 leading-relaxed">
          Want to publish a plugin?{' '}
          <span className="text-gray-500">
            Create a folder in{' '}
            <code className="text-pm-accent bg-pm-bg px-1 rounded">plugins/</code> and open a pull request to{' '}
            <code className="text-gray-400 bg-pm-bg px-1 rounded">agauraw/APIManagerr</code>.
          </span>
        </p>
      </div>
    </div>
  );
}
