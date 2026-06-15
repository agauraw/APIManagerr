// Fetch-based shim that matches window.electronAPI surface
// so all desktop components work in the browser unchanged.

const p = (path, body) =>
  fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());

function browseFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = (ev) => resolve({ content: ev.target.result, name: file.name });
      reader.readAsText(file);
    };
    input.click();
  });
}

function downloadBlob(content, filename, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const api = {
  sendRequest: (config) => p('/proxy', config),

  importCollection: async () => {
    const file = await browseFile('.json');
    if (!file) return null;
    try { return JSON.parse(file.content); } catch { return { error: 'Failed to parse JSON' }; }
  },

  exportCollection: (data) => {
    downloadBlob(JSON.stringify(data, null, 2), `${data?.info?.name || 'collection'}.json`);
    return true;
  },

  importSwagger: async () => {
    const file = await browseFile('.json,.yaml,.yml');
    if (!file) return null;
    const ext = file.name.split('.').pop().toLowerCase();
    return p('/swagger/parse', { content: file.content, ext });
  },

  exportSwagger: (spec, defaultName) => {
    downloadBlob(JSON.stringify(spec, null, 2), `${defaultName || 'openapi'}.json`);
    return true;
  },

  collections: {
    loadAll: () => fetch('/api/collections').then((r) => r.json()),
    save: (col) => p('/collections', col),
    delete: (id) => fetch(`/api/collections/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    getDir: () => Promise.resolve(null),
  },

  db: {
    testConnection: (cfg) => p('/db/mysql/test', cfg),
    connect: (cfg) => p('/db/mysql/connect', cfg),
    disconnect: (id) => p('/db/mysql/disconnect', { id }),
    listDatabases: (id) => p('/db/mysql/list-databases', { id }),
    listTables: (id, database) => p('/db/mysql/list-tables', { id, database }),
    describeTable: (id, database, table) => p('/db/mysql/describe-table', { id, database, table }),
    executeQuery: (id, database, query) => p('/db/mysql/query', { id, database, query }),
  },

  pg: {
    testConnection: (cfg) => p('/db/pg/test', cfg),
    connect: (cfg) => p('/db/pg/connect', cfg),
    disconnect: (id) => p('/db/pg/disconnect', { id }),
    listSchemas: (id) => p('/db/pg/list-schemas', { id }),
    listTables: (id, schema) => p('/db/pg/list-tables', { id, schema }),
    describeTable: (id, schema, table) => p('/db/pg/describe-table', { id, schema, table }),
    executeQuery: (id, query) => p('/db/pg/query', { id, query }),
  },

  mongo: {
    testConnection: (cfg) => p('/db/mongo/test', cfg),
    connect: (cfg) => p('/db/mongo/connect', cfg),
    disconnect: (id) => p('/db/mongo/disconnect', { id }),
    listDatabases: (id) => p('/db/mongo/list-databases', { id }),
    listCollections: (id, database) => p('/db/mongo/list-collections', { id, database }),
    execute: (id, database, collection, operation, filter, options) =>
      p('/db/mongo/execute', { id, database, collection, operation, filter, options }),
  },

  plugins: {
    listExternal: () => Promise.resolve([]),
    getRenderer: () => Promise.resolve(null),
    getPluginsDir: () => Promise.resolve(null),
    fetchCatalog: (url) => p('/plugins/fetch-catalog', { url }),
    install: () => Promise.resolve({ success: false, error: 'Plugin install not supported in web version' }),
    uninstall: () => Promise.resolve({ success: false, error: 'Not supported in web version' }),
  },

  // no-ops — no OS window in browser
  minimizeWindow: () => {},
  maximizeWindow: () => {},
  closeWindow: () => {},
};
