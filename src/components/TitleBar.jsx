import { useState } from 'react';
import { useStore } from '../store';
import PluginManager from './PluginManager';

const isElectron = !!window.electronAPI;

export default function TitleBar({ onOpenEnvManager }) {
  const [showAbout, setShowAbout] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const { environments, activeEnvId, setActiveEnv } = useStore();

  return (
    <div className="titlebar-drag flex items-center justify-between h-10 bg-pm-panel border-b border-pm-border px-3 flex-shrink-0">
      {/* App name + About */}
      <div className="titlebar-no-drag flex items-center gap-2 relative">
        <button
          onClick={() => setShowAbout((v) => !v)}
          className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-pm-hover transition-fast"
          title="About API Manager"
        >
          <img src="/favicon.svg" alt="API Manager" className="w-6 h-6 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-200 select-none">API Manager</span>
        </button>

        {showAbout && (
          <AboutPanel onClose={() => setShowAbout(false)} />
        )}
      </div>

      {/* Center: Environment selector + Plugins */}
      <div className="titlebar-no-drag flex items-center gap-2">
        <select
          value={activeEnvId || ''}
          onChange={(e) => setActiveEnv(e.target.value || null)}
          className="bg-pm-input text-gray-300 text-xs border border-pm-border rounded px-2 py-1 outline-none focus:border-pm-accent"
        >
          <option value="">No Environment</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>
        <button
          onClick={onOpenEnvManager}
          className="titlebar-no-drag text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-pm-hover transition-fast"
          title="Manage Environments"
        >
          ⚙
        </button>
        <button
          onClick={() => setShowPlugins(true)}
          className="titlebar-no-drag text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-pm-hover transition-fast"
          title="Plugins"
        >
          🔌
        </button>
      </div>

      {showPlugins && <PluginManager onClose={() => setShowPlugins(false)} />}

      {/* Window controls */}
      {isElectron && (
        <div className="titlebar-no-drag flex items-center gap-1">
          <button
            onClick={() => window.electronAPI.minimizeWindow()}
            className="w-8 h-6 rounded text-gray-400 hover:text-white hover:bg-pm-hover flex items-center justify-center text-xs transition-fast"
            title="Minimize"
          >
            −
          </button>
          <button
            onClick={() => window.electronAPI.maximizeWindow()}
            className="w-8 h-6 rounded text-gray-400 hover:text-white hover:bg-pm-hover flex items-center justify-center text-xs transition-fast"
            title="Maximize"
          >
            □
          </button>
          <button
            onClick={() => window.electronAPI.closeWindow()}
            className="w-8 h-6 rounded text-gray-400 hover:text-white hover:bg-red-600 flex items-center justify-center text-xs transition-fast"
            title="Close"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function AboutPanel({ onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-full mt-2 bg-pm-panel border border-pm-border rounded-lg shadow-2xl z-50 w-72 p-5">
        <div className="flex items-center gap-3 mb-4">
          <img src="/favicon.svg" alt="logo" className="w-10 h-10" />
          <div>
            <div className="text-sm font-bold text-gray-100">API Manager</div>
            <div className="text-xs text-gray-500">Version 1.0.0</div>
          </div>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          A lightweight Postman-like API client with Swagger/OpenAPI support.
          Import collections, test endpoints, and publish specs — all from your desktop.
        </p>

        <div className="border-t border-pm-border pt-3">
          <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">License</div>
          <div className="text-xs text-gray-300">
            MIT License
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Copyright © 2026 <span className="text-gray-300 font-medium">Gauraw</span>
          </div>
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">
            Permission is hereby granted, free of charge, to any person obtaining a copy
            of this software to use, copy, modify, merge, publish, distribute, sublicense,
            and/or sell copies, subject to the MIT License conditions.
          </p>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full text-xs bg-pm-hover hover:bg-pm-border text-gray-300 rounded py-1.5 transition-fast"
        >
          Close
        </button>
      </div>
    </>
  );
}
