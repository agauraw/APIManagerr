import { useState } from 'react';
import PluginManager from '@desktop/components/PluginManager';
import EnvironmentManager from '@desktop/components/EnvironmentManager';

export default function NavBar() {
  const [showPlugins, setShowPlugins] = useState(false);
  const [showEnv, setShowEnv] = useState(false);

  return (
    <>
      <header className="flex items-center gap-3 h-11 px-4 bg-pm-panel border-b border-pm-border flex-shrink-0 select-none">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-6 h-6 rounded-md bg-pm-accent flex items-center justify-center flex-shrink-0">
            <span className="text-pm-bg font-bold text-xs leading-none">A</span>
          </div>
          <span className="text-xs font-semibold text-gray-300 hidden sm:block">API Manager</span>
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <button
          onClick={() => setShowEnv(true)}
          className="flex items-center gap-1.5 px-3 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-pm-hover rounded transition-fast"
          title="Environments"
        >
          🌿 Environments
        </button>

        <button
          onClick={() => setShowPlugins(true)}
          className="flex items-center gap-1.5 px-3 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-pm-hover rounded transition-fast"
          title="Plugins"
        >
          🔌 Plugins
        </button>

        <a
          href="https://github.com/agauraw/APIManagerr"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1 text-xs text-gray-500 hover:text-gray-300 hover:bg-pm-hover rounded transition-fast"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          GitHub
        </a>
      </header>

      {showPlugins && <PluginManager onClose={() => setShowPlugins(false)} />}
      {showEnv && <EnvironmentManager onClose={() => setShowEnv(false)} />}
    </>
  );
}
