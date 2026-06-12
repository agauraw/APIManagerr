import { usePlugins } from '../plugins';

export default function PluginManager({ onClose }) {
  const { plugins, enabledPlugins, setPluginEnabled } = usePlugins();

  const builtins = plugins.filter((p) => p.author === 'built-in');
  const externals = plugins.filter((p) => p.author === 'external');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-pm-panel border border-pm-border rounded-xl shadow-2xl w-[580px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-pm-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-100">Plugins</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {plugins.length} plugin{plugins.length !== 1 ? 's' : ''} loaded
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-fast text-base leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Built-in plugins */}
          <section>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2 px-1">
              Built-in
            </div>
            {builtins.length === 0 ? (
              <div className="text-xs text-gray-600 px-1">No built-in plugins</div>
            ) : (
              <div className="space-y-2">
                {builtins.map((plugin) => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    enabled={enabledPlugins[plugin.id] !== false}
                    onToggle={(v) => setPluginEnabled(plugin.id, v)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* External plugins */}
          <section>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2 px-1">
              External
            </div>
            {externals.length === 0 ? (
              <div className="text-xs text-gray-600 px-1">No external plugins loaded</div>
            ) : (
              <div className="space-y-2">
                {externals.map((plugin) => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    enabled={enabledPlugins[plugin.id] !== false}
                    onToggle={(v) => setPluginEnabled(plugin.id, v)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* How to add external plugins */}
          <section className="bg-pm-hover/30 border border-pm-border/50 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-300 mb-1.5">Adding External Plugins</div>
            <p className="text-xs text-gray-500 leading-relaxed mb-3">
              Place a plugin folder inside your{' '}
              <code className="text-pm-accent bg-pm-bg px-1 rounded">userData/plugins/</code> directory.
              Each plugin needs a <code className="text-gray-400 bg-pm-bg px-1 rounded">manifest.json</code> and a{' '}
              <code className="text-gray-400 bg-pm-bg px-1 rounded">renderer.js</code>.
              Restart the app to load new plugins.
            </p>
            <div className="text-xs text-gray-600 font-mono bg-pm-bg rounded p-2 leading-relaxed">
              userData/plugins/<br />
              {'  '}└── my-plugin/<br />
              {'      '}├── manifest.json<br />
              {'      '}├── renderer.js<br />
              {'      '}└── main.js&nbsp;&nbsp;&nbsp;<span className="text-gray-700">(optional — IPC handlers)</span>
            </div>
            {window.electronAPI?.plugins && (
              <button
                onClick={async () => {
                  const dir = await window.electronAPI.plugins.getPluginsDir();
                  alert(`Plugins directory:\n${dir}`);
                }}
                className="mt-3 text-xs text-pm-accent hover:text-green-300 transition-fast"
              >
                Show plugins directory →
              </button>
            )}
          </section>
        </div>

        <div className="border-t border-pm-border px-5 py-3 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="text-xs bg-pm-hover hover:bg-pm-border text-gray-300 rounded px-4 py-1.5 transition-fast"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PluginCard({ plugin, enabled, onToggle }) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-fast ${
        enabled
          ? 'border-pm-border bg-pm-bg/50'
          : 'border-pm-border/30 bg-pm-bg/20 opacity-50'
      }`}
    >
      <div className="text-xl flex-shrink-0 w-8 text-center">{plugin.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-gray-200">{plugin.name}</span>
          <span className="text-xs text-gray-600">v{plugin.version}</span>
          {plugin.author === 'external' && (
            <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded px-1.5 py-px">
              external
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 leading-relaxed truncate">{plugin.description}</div>
      </div>

      {/* Toggle switch */}
      <label className="flex-shrink-0 relative cursor-pointer">
        <input
          type="checkbox"
          className="sr-only"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <div
          className={`w-9 h-5 rounded-full transition-colors duration-200 ${
            enabled ? 'bg-pm-accent' : 'bg-gray-700'
          }`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
            enabled ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </label>
    </div>
  );
}
