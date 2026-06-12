const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // HTTP
  sendRequest: (config) => ipcRenderer.invoke('send-request', config),

  // Postman collection import / export
  importCollection: () => ipcRenderer.invoke('import-collection'),
  exportCollection: (data) => ipcRenderer.invoke('export-collection', data),

  // Swagger / OpenAPI import / export
  importSwagger: () => ipcRenderer.invoke('import-swagger'),
  exportSwagger: (spec, defaultName) => ipcRenderer.invoke('export-swagger', { spec, defaultName }),

  // Collection file-system persistence
  collections: {
    loadAll: () => ipcRenderer.invoke('collections:load-all'),
    save: (collection) => ipcRenderer.invoke('collections:save', collection),
    delete: (id) => ipcRenderer.invoke('collections:delete', id),
    getDir: () => ipcRenderer.invoke('collections:get-dir'),
  },

  // MySQL database
  db: {
    testConnection: (cfg) => ipcRenderer.invoke('db:test-connection', cfg),
    connect: (cfg) => ipcRenderer.invoke('db:connect', cfg),
    disconnect: (id) => ipcRenderer.invoke('db:disconnect', id),
    listDatabases: (id) => ipcRenderer.invoke('db:list-databases', id),
    listTables: (id, database) => ipcRenderer.invoke('db:list-tables', { id, database }),
    describeTable: (id, database, table) => ipcRenderer.invoke('db:describe-table', { id, database, table }),
    executeQuery: (id, database, query) => ipcRenderer.invoke('db:execute-query', { id, database, query }),
  },

  // PostgreSQL
  pg: {
    testConnection: (cfg) => ipcRenderer.invoke('pg:test-connection', cfg),
    connect: (cfg) => ipcRenderer.invoke('pg:connect', cfg),
    disconnect: (id) => ipcRenderer.invoke('pg:disconnect', id),
    listSchemas: (id) => ipcRenderer.invoke('pg:list-schemas', id),
    listTables: (id, schema) => ipcRenderer.invoke('pg:list-tables', { id, schema }),
    describeTable: (id, schema, table) => ipcRenderer.invoke('pg:describe-table', { id, schema, table }),
    executeQuery: (id, query) => ipcRenderer.invoke('pg:execute-query', { id, query }),
  },

  // MongoDB
  mongo: {
    testConnection: (cfg) => ipcRenderer.invoke('mongo:test-connection', cfg),
    connect: (cfg) => ipcRenderer.invoke('mongo:connect', cfg),
    disconnect: (id) => ipcRenderer.invoke('mongo:disconnect', id),
    listDatabases: (id) => ipcRenderer.invoke('mongo:list-databases', id),
    listCollections: (id, database) => ipcRenderer.invoke('mongo:list-collections', { id, database }),
    execute: (id, database, collection, operation, filter, options) =>
      ipcRenderer.invoke('mongo:execute', { id, database, collection, operation, filter, options }),
  },

  // Plugin system
  plugins: {
    listExternal: () => ipcRenderer.invoke('plugin:list-external'),
    getRenderer: (id) => ipcRenderer.invoke('plugin:get-renderer', id),
    getPluginsDir: () => ipcRenderer.invoke('plugin:get-plugins-dir'),
    fetchCatalog: (url) => ipcRenderer.invoke('plugin:fetch-catalog', url),
    install: (pluginEntry) => ipcRenderer.invoke('plugin:install', pluginEntry),
    uninstall: (id) => ipcRenderer.invoke('plugin:uninstall', id),
  },

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
});
