import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAllPlugins, subscribe, registerPlugin } from './registry';
import { useStore } from '../store';

const PluginContext = createContext({
  plugins: [],
  activePlugins: [],
  enabledPlugins: {},
  setPluginEnabled: () => {},
});

export function usePlugins() {
  return useContext(PluginContext);
}

export function usePlugin(id) {
  const { plugins } = useContext(PluginContext);
  return plugins.find((p) => p.id === id) ?? null;
}

export function useIsPluginEnabled(id) {
  const { enabledPlugins } = useContext(PluginContext);
  return enabledPlugins[id] !== false;
}

export function PluginProvider({ children }) {
  const [plugins, setPlugins] = useState(getAllPlugins);
  const enabledPlugins = useStore((s) => s.enabledPlugins);
  const setPluginEnabled = useStore((s) => s.setPluginEnabled);

  // Re-sync when the registry changes (new plugin registered / unregistered)
  useEffect(() => subscribe(() => setPlugins(getAllPlugins())), []);

  // Load external plugins from userData/plugins/ once on mount
  useEffect(() => { loadExternalPlugins(); }, []);

  // Only expose plugins whose enabled flag is not explicitly set to false
  const activePlugins = plugins.filter((p) => enabledPlugins[p.id] !== false);

  return (
    <PluginContext.Provider value={{ plugins, activePlugins, enabledPlugins, setPluginEnabled }}>
      {children}
    </PluginContext.Provider>
  );
}

// ─── External Plugin Loader ────────────────────────────────────────────────────

async function loadExternalPlugins() {
  if (!window.electronAPI?.plugins) return;
  try {
    const manifests = await window.electronAPI.plugins.listExternal();
    if (!Array.isArray(manifests)) return;

    for (const manifest of manifests) {
      if (!manifest.id) continue;
      try {
        const code = await window.electronAPI.plugins.getRenderer(manifest.id);
        if (!code) continue;

        const def = await executePluginScript(code, manifest.id);
        if (def?.id) {
          registerPlugin({ author: 'external', ...manifest, ...def });
        }
      } catch (e) {
        console.error(`[PluginLoader] Failed to load "${manifest.id}":`, e);
      }
    }
  } catch (e) {
    console.error('[PluginLoader] Failed to list external plugins:', e);
  }
}

/**
 * Executes an IIFE-style plugin script via a blob URL.
 *
 * The script receives the plugin API via window.__pluginAPI and must
 * declare its definition as window.__pluginDef = { id, name, ... }.
 *
 * Example renderer.js:
 *   (function() {
 *     const { React, ipc } = window.__pluginAPI;
 *     function MySidebar() { return React.createElement('div', null, 'Hello'); }
 *     window.__pluginDef = {
 *       id: 'my-plugin',
 *       name: 'My Plugin',
 *       sidebarTab: { label: 'My Plugin', order: 20, component: MySidebar },
 *     };
 *   })();
 */
function executePluginScript(code, id) {
  return new Promise((resolve) => {
    window.__pluginAPI = { React, ipc: window.electronAPI };
    window.__pluginDef = null;

    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const script = document.createElement('script');
    script.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (script.parentNode) document.head.removeChild(script);
      delete window.__pluginAPI;
    };

    script.onload = () => {
      cleanup();
      const def = window.__pluginDef;
      delete window.__pluginDef;
      resolve(def);
    };

    script.onerror = () => {
      cleanup();
      console.error(`[PluginLoader] Script execution failed for plugin "${id}"`);
      resolve(null);
    };

    document.head.appendChild(script);
  });
}
