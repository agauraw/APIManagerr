import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

const newRequest = () => ({
  method: 'GET',
  url: '',
  params: [{ key: '', value: '', enabled: true }],
  headers: [{ key: '', value: '', enabled: true }],
  bodyType: 'none',
  bodyRaw: '',
  bodyForm: [{ key: '', value: '', enabled: true }],
  auth: { type: 'none', token: '', username: '', password: '', key: '', value: '', in: 'header' },
});

const newTab = (overrides = {}) => ({
  id: uid(),
  name: 'New Request',
  saved: false,
  request: newRequest(),
  response: null,
  loading: false,
  ...overrides,
});

export const useStore = create(
  persist(
    (set, get) => ({
      // ── Tabs ──────────────────────────────────────────────────────────────
      tabs: [newTab()],
      activeTabId: null,

      get activeTab() {
        const { tabs, activeTabId } = get();
        return tabs.find((t) => t.id === activeTabId) ?? tabs[0];
      },

      addTab: (overrides = {}) => {
        const tab = newTab(overrides);
        set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
        return tab.id;
      },

      closeTab: (id) => {
        set((s) => {
          const tabs = s.tabs.filter((t) => t.id !== id);
          if (!tabs.length) {
            const fresh = newTab();
            return { tabs: [fresh], activeTabId: fresh.id };
          }
          const activeTabId =
            s.activeTabId === id
              ? tabs[Math.max(0, s.tabs.findIndex((t) => t.id === id) - 1)].id
              : s.activeTabId;
          return { tabs, activeTabId };
        });
      },

      setActiveTab: (id) => set({ activeTabId: id }),

      updateTab: (id, patch) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      updateRequest: (id, patch) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === id ? { ...t, request: { ...t.request, ...patch } } : t
          ),
        })),

      setResponse: (id, response) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, response, loading: false } : t)),
        })),

      setLoading: (id, loading) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, loading } : t)),
        })),

      // ── Collections ───────────────────────────────────────────────────────
      collections: [],

      // Called once on app mount — loads every <id>.json from userData/collections/
      loadCollectionsFromDisk: async () => {
        if (!window.electronAPI) return;
        const cols = await window.electronAPI.collections.loadAll();
        if (cols) set({ collections: cols });
      },

      addCollection: (collection) => {
        // Normalize: parseCollection uses 'id', internal format uses '_id'.
        // Strip _raw (large redundant blob) before writing to disk.
        const { _raw, id, ...rest } = collection;
        const col = { ...rest, _id: rest._id || id || uid() };
        set((s) => ({ collections: [...s.collections, col] }));
        window.electronAPI?.collections.save(col);
        return col._id;
      },

      createCollection: (name) => {
        const col = { _id: uid(), name, description: '', items: [] };
        set((s) => ({ collections: [...s.collections, col] }));
        window.electronAPI?.collections.save(col);
        return col._id;
      },

      removeCollection: (id) => {
        set((s) => ({ collections: s.collections.filter((c) => c._id !== id) }));
        window.electronAPI?.collections.delete(id);
      },

      // Append a request item to the root of a collection, then flush to disk
      saveRequestToCollection: (collectionId, name, request) => {
        let updated = null;
        set((s) => {
          const collections = s.collections.map((col) => {
            if (col._id !== collectionId) return col;
            const item = { type: 'request', name, request };
            updated = { ...col, items: [...(col.items || []), item] };
            return updated;
          });
          return { collections };
        });
        if (updated) window.electronAPI?.collections.save(updated);
      },

      // ── History ───────────────────────────────────────────────────────────
      history: [],

      addToHistory: (entry) =>
        set((s) => ({
          history: [{ ...entry, id: uid(), timestamp: Date.now() }, ...s.history].slice(0, 200),
        })),

      clearHistory: () => set({ history: [] }),

      // ── Environments ──────────────────────────────────────────────────────
      environments: [],
      activeEnvId: null,

      addEnvironment: (name) => {
        const env = { id: uid(), name, variables: [] };
        set((s) => ({ environments: [...s.environments, env] }));
        return env.id;
      },

      updateEnvironment: (id, patch) =>
        set((s) => ({
          environments: s.environments.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      removeEnvironment: (id) =>
        set((s) => ({
          environments: s.environments.filter((e) => e.id !== id),
          activeEnvId: s.activeEnvId === id ? null : s.activeEnvId,
        })),

      setActiveEnv: (id) => set({ activeEnvId: id }),

      get activeEnv() {
        const { environments, activeEnvId } = get();
        return environments.find((e) => e.id === activeEnvId) ?? null;
      },

      // ── DB Tabs ───────────────────────────────────────────────────────────
      addDbTab: (opts = {}) => {
        const tab = {
          id: uid(),
          type: 'db',
          name: opts.name || 'Query',
          db: {
            connectionId: opts.connectionId || '',
            database: opts.database || '',
            // SQL (MySQL / PostgreSQL)
            query: opts.query || '',
            // MongoDB
            collection: opts.collection || '',
            operation: opts.operation || 'find',
            filter: opts.filter || '{}',
          },
          result: null,
          loading: false,
        };
        set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
        return tab.id;
      },

      updateDbTab: (id, patch) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      // ── DB Connections ────────────────────────────────────────────────────
      dbConnections: [],

      addDbConnection: (conn) => {
        const c = { id: uid(), ...conn };
        set((s) => ({ dbConnections: [...s.dbConnections, c] }));
        return c.id;
      },

      updateDbConnection: (id, patch) =>
        set((s) => ({
          dbConnections: s.dbConnections.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeDbConnection: (id) => {
        set((s) => ({ dbConnections: s.dbConnections.filter((c) => c.id !== id) }));
        window.electronAPI?.db.disconnect(id);
      },

      // ── Sidebar ───────────────────────────────────────────────────────────
      sidebarTab: 'collections',
      setSidebarTab: (tab) => set({ sidebarTab: tab }),

      // ── Plugin registry ───────────────────────────────────────────────────
      // Persisted map of pluginId → boolean (absent = enabled by default)
      enabledPlugins: {},

      setPluginEnabled: (id, enabled) =>
        set((s) => ({ enabledPlugins: { ...s.enabledPlugins, [id]: enabled } })),
    }),
    {
      name: 'api-manager-v1',
      partialize: (s) => ({
        collections: s.collections,
        history: s.history,
        environments: s.environments,
        activeEnvId: s.activeEnvId,
        dbConnections: s.dbConnections,
        enabledPlugins: s.enabledPlugins,
      }),
    }
  )
);

export const newRequestTemplate = newRequest;
export const newTabTemplate = newTab;
