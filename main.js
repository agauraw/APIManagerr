const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const axios = require('axios');
const jsYaml = require('js-yaml');
const mysql = require('mysql2/promise');
const { Client: PgClient } = require('pg');
const { MongoClient } = require('mongodb');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize', () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window-close', () => win.close());

  return win;
}

app.whenReady().then(() => {
  loadExternalPluginMains();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── HTTP Request Handler ─────────────────────────────────────────────────────
ipcMain.handle('send-request', async (_event, config) => {
  const startTime = Date.now();

  try {
    const headers = { ...(config.headers || {}) };

    // Auth injection
    if (config.auth) {
      const { type } = config.auth;
      if (type === 'bearer' && config.auth.token) {
        headers['Authorization'] = `Bearer ${config.auth.token}`;
      } else if (type === 'basic' && config.auth.username) {
        const cred = Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${cred}`;
      } else if (type === 'apikey' && config.auth.key) {
        if (config.auth.in === 'header') {
          headers[config.auth.key] = config.auth.value;
        }
      }
    }

    const axiosConfig = {
      method: config.method,
      url: config.url,
      headers,
      params: config.params || {},
      timeout: 30000,
      validateStatus: () => true,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      responseType: 'arraybuffer',
    };

    // Body
    if (config.bodyType === 'json' && config.body) {
      axiosConfig.data = config.body;
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    } else if (config.bodyType === 'form' && config.body) {
      const params = new URLSearchParams();
      (config.body || []).forEach(([k, v]) => k && params.append(k, v));
      axiosConfig.data = params.toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (config.bodyType === 'raw' && config.body) {
      axiosConfig.data = config.body;
    }

    const response = await axios(axiosConfig);
    const elapsed = Date.now() - startTime;

    const rawBuffer = Buffer.from(response.data);
    const contentType = (response.headers['content-type'] || '').toLowerCase();
    const isText = contentType.includes('json') || contentType.includes('text') || contentType.includes('xml') || contentType.includes('html') || contentType.includes('javascript');
    const responseText = isText ? rawBuffer.toString('utf8') : `[Binary data: ${rawBuffer.length} bytes]`;

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: responseText,
      time: elapsed,
      size: rawBuffer.length,
      error: null,
    };
  } catch (err) {
    return {
      status: 0,
      statusText: 'Error',
      headers: {},
      data: null,
      time: Date.now() - startTime,
      size: 0,
      error: err.message,
    };
  }
});

// ─── Collection File Storage ──────────────────────────────────────────────────
// Each collection is saved as <_id>.json inside userData/collections/

function getCollectionsDir() {
  const dir = path.join(app.getPath('userData'), 'collections');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

ipcMain.handle('collections:load-all', () => {
  const dir = getCollectionsDir();
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
});

ipcMain.handle('collections:save', (_event, collection) => {
  const dir = getCollectionsDir();
  const filePath = path.join(dir, `${collection._id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(collection, null, 2), 'utf8');
  return true;
});

ipcMain.handle('collections:delete', (_event, id) => {
  const filePath = path.join(getCollectionsDir(), `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
});

ipcMain.handle('collections:get-dir', () => getCollectionsDir());

// ─── File Dialogs ─────────────────────────────────────────────────────────────
ipcMain.handle('import-collection', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Import Postman Collection',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  try {
    return JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
  } catch {
    return { error: 'Failed to parse JSON' };
  }
});

ipcMain.handle('export-collection', async (_event, data) => {
  const name = data?.info?.name || 'collection';
  const result = await dialog.showSaveDialog({
    title: 'Export Collection',
    defaultPath: `${name}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled) return false;
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
  return true;
});

// ─── Swagger / OpenAPI ────────────────────────────────────────────────────────

// Opens a file dialog, reads the file, returns the parsed spec object (JSON or YAML)
ipcMain.handle('import-swagger', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Import Swagger / OpenAPI Spec',
    filters: [
      { name: 'API Spec (JSON / YAML)', extensions: ['json', 'yaml', 'yml'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;

  const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
  try {
    const ext = path.extname(result.filePaths[0]).toLowerCase();
    const spec = ext === '.yaml' || ext === '.yml' ? jsYaml.load(raw) : JSON.parse(raw);
    return spec;
  } catch (e) {
    return { error: e.message };
  }
});

// Saves an OpenAPI spec object as JSON or YAML (chosen by user in save dialog)
ipcMain.handle('export-swagger', async (_event, { spec, defaultName }) => {
  const result = await dialog.showSaveDialog({
    title: 'Publish / Export Swagger Spec',
    defaultPath: `${defaultName || 'openapi'}.json`,
    filters: [
      { name: 'JSON', extensions: ['json'] },
      { name: 'YAML', extensions: ['yaml', 'yml'] },
    ],
  });
  if (result.canceled) return false;

  const ext = path.extname(result.filePath).toLowerCase();
  const content =
    ext === '.yaml' || ext === '.yml'
      ? jsYaml.dump(spec, { indent: 2 })
      : JSON.stringify(spec, null, 2);

  fs.writeFileSync(result.filePath, content, 'utf-8');
  return true;
});

// ─── MySQL Database ────────────────────────────────────────────────────────────
// Active connections keyed by connection id (string → mysql2 connection object)
const dbPool = new Map();

function serializeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) { out[k] = null; continue; }
    if (Buffer.isBuffer(v)) { out[k] = v.toString('hex'); continue; }
    if (v instanceof Date) { out[k] = v.toISOString(); continue; }
    if (typeof v === 'bigint') { out[k] = v.toString(); continue; }
    out[k] = String(v);
  }
  return out;
}

ipcMain.handle('db:test-connection', async (_event, cfg) => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: cfg.host || '127.0.0.1',
      port: Number(cfg.port) || 3306,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database || undefined,
      connectTimeout: 8000,
    });
    await conn.ping();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    if (conn) try { await conn.end(); } catch {}
  }
});

ipcMain.handle('db:connect', async (_event, cfg) => {
  if (dbPool.has(cfg.id)) {
    try { await dbPool.get(cfg.id).end(); } catch {}
    dbPool.delete(cfg.id);
  }
  try {
    const conn = await mysql.createConnection({
      host: cfg.host || '127.0.0.1',
      port: Number(cfg.port) || 3306,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database || undefined,
      connectTimeout: 8000,
    });
    dbPool.set(cfg.id, conn);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('db:disconnect', async (_event, id) => {
  if (dbPool.has(id)) {
    try { await dbPool.get(id).end(); } catch {}
    dbPool.delete(id);
  }
  return true;
});

ipcMain.handle('db:list-databases', async (_event, id) => {
  const conn = dbPool.get(id);
  if (!conn) return { error: 'Not connected' };
  try {
    const [rows] = await conn.execute('SHOW DATABASES');
    return rows.map((r) => r.Database);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('db:list-tables', async (_event, { id, database }) => {
  const conn = dbPool.get(id);
  if (!conn) return { error: 'Not connected' };
  try {
    const sql = `SHOW FULL TABLES FROM \`${database.replace(/`/g, '')}\``;
    const [rows] = await conn.execute(sql);
    const key = `Tables_in_${database}`;
    return rows.map((r) => ({ name: r[key], type: r.Table_type === 'VIEW' ? 'view' : 'table' }));
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('db:describe-table', async (_event, { id, database, table }) => {
  const conn = dbPool.get(id);
  if (!conn) return { error: 'Not connected' };
  try {
    const db = database.replace(/`/g, '');
    const tbl = table.replace(/`/g, '');
    const [rows] = await conn.execute(`DESCRIBE \`${db}\`.\`${tbl}\``);
    return rows.map(serializeRow);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('db:execute-query', async (_event, { id, database, query }) => {
  const conn = dbPool.get(id);
  if (!conn) return { error: 'Not connected', rows: [], fields: [], rowCount: 0, time: 0 };
  const start = Date.now();
  try {
    if (database) {
      await conn.execute(`USE \`${database.replace(/`/g, '')}\``);
    }
    const [rows, fields] = await conn.execute(query);
    const elapsed = Date.now() - start;

    if (Array.isArray(rows)) {
      return {
        rows: rows.map(serializeRow),
        fields: (fields || []).map((f) => ({ name: f.name, type: f.type })),
        rowCount: rows.length,
        time: elapsed,
        error: null,
      };
    }
    // DML / DDL result
    return {
      rows: [],
      fields: [],
      rowCount: rows.affectedRows ?? 0,
      time: elapsed,
      message: `Query OK — ${rows.affectedRows ?? 0} row(s) affected`,
      error: null,
    };
  } catch (e) {
    return { error: e.message, rows: [], fields: [], rowCount: 0, time: Date.now() - start };
  }
});

// ─── PostgreSQL ───────────────────────────────────────────────────────────────
const pgClients = new Map(); // id → pg.Client

function makePgClient(cfg) {
  return new PgClient({
    host: cfg.host || '127.0.0.1',
    port: Number(cfg.port) || 5432,
    user: cfg.user || undefined,
    password: cfg.password || undefined,
    database: cfg.database || 'postgres',
    connectionTimeoutMillis: 8000,
  });
}

ipcMain.handle('pg:test-connection', async (_event, cfg) => {
  const client = makePgClient(cfg);
  try {
    await client.connect();
    await client.query('SELECT 1');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    try { await client.end(); } catch {}
  }
});

ipcMain.handle('pg:connect', async (_event, cfg) => {
  if (pgClients.has(cfg.id)) {
    try { await pgClients.get(cfg.id).end(); } catch {}
    pgClients.delete(cfg.id);
  }
  const client = makePgClient(cfg);
  try {
    await client.connect();
    pgClients.set(cfg.id, client);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('pg:disconnect', async (_event, id) => {
  if (pgClients.has(id)) {
    try { await pgClients.get(id).end(); } catch {}
    pgClients.delete(id);
  }
  return true;
});

ipcMain.handle('pg:list-schemas', async (_event, id) => {
  const client = pgClients.get(id);
  if (!client) return { error: 'Not connected' };
  try {
    const res = await client.query(`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name NOT IN ('information_schema','pg_catalog','pg_toast')
        AND schema_name NOT LIKE 'pg_temp%'
        AND schema_name NOT LIKE 'pg_toast_temp%'
      ORDER BY schema_name
    `);
    return res.rows.map((r) => r.schema_name);
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle('pg:list-tables', async (_event, { id, schema }) => {
  const client = pgClients.get(id);
  if (!client) return { error: 'Not connected' };
  try {
    const res = await client.query(
      `SELECT table_name, table_type FROM information_schema.tables
       WHERE table_schema = $1 ORDER BY table_name`,
      [schema]
    );
    return res.rows.map((r) => ({
      name: r.table_name,
      type: r.table_type === 'VIEW' ? 'view' : 'table',
    }));
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle('pg:describe-table', async (_event, { id, schema, table }) => {
  const client = pgClients.get(id);
  if (!client) return { error: 'Not connected' };
  try {
    const res = await client.query(
      `SELECT
         c.column_name AS "Field",
         c.data_type || CASE WHEN c.character_maximum_length IS NOT NULL
           THEN '(' || c.character_maximum_length || ')' ELSE '' END AS "Type",
         c.is_nullable AS "Null",
         CASE WHEN pk.column_name IS NOT NULL THEN 'PRI' ELSE '' END AS "Key"
       FROM information_schema.columns c
       LEFT JOIN (
         SELECT kcu.column_name FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1 AND tc.table_name = $2
       ) pk ON c.column_name = pk.column_name
       WHERE c.table_schema = $1 AND c.table_name = $2
       ORDER BY c.ordinal_position`,
      [schema, table]
    );
    return res.rows;
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle('pg:execute-query', async (_event, { id, query }) => {
  const client = pgClients.get(id);
  if (!client) return { error: 'Not connected', rows: [], fields: [], rowCount: 0, time: 0 };
  const start = Date.now();
  try {
    const res = await client.query(query);
    const elapsed = Date.now() - start;
    if (res.fields && res.fields.length > 0) {
      return {
        rows: res.rows.map((row) => {
          const out = {};
          for (const [k, v] of Object.entries(row)) {
            if (v === null || v === undefined) out[k] = null;
            else if (v instanceof Date) out[k] = v.toISOString();
            else if (typeof v === 'object') out[k] = JSON.stringify(v);
            else out[k] = String(v);
          }
          return out;
        }),
        fields: res.fields.map((f) => ({ name: f.name, type: String(f.dataTypeID) })),
        rowCount: res.rowCount ?? res.rows.length,
        time: elapsed, error: null,
      };
    }
    return {
      rows: [], fields: [], rowCount: res.rowCount ?? 0, time: elapsed,
      message: `Query OK — ${res.rowCount ?? 0} row(s) affected`, error: null,
    };
  } catch (e) {
    return { error: e.message, rows: [], fields: [], rowCount: 0, time: Date.now() - start };
  }
});

// ─── MongoDB ──────────────────────────────────────────────────────────────────
const mongoClients = new Map(); // id → MongoClient

function buildMongoUri(cfg) {
  if (cfg.uri) return cfg.uri;
  const auth = cfg.user ? `${encodeURIComponent(cfg.user)}:${encodeURIComponent(cfg.password || '')}@` : '';
  const dbPart = cfg.database ? `/${cfg.database}` : '';
  return `mongodb://${auth}${cfg.host || '127.0.0.1'}:${cfg.port || 27017}${dbPart}`;
}

function serializeMongoDoc(doc) {
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v === null || v === undefined) { out[k] = null; continue; }
    if (v && typeof v === 'object' && typeof v.toString === 'function' && v.constructor?.name === 'ObjectId') {
      out[k] = v.toString(); continue;
    }
    if (v instanceof Date) { out[k] = v.toISOString(); continue; }
    if (Buffer.isBuffer(v)) { out[k] = v.toString('hex'); continue; }
    if (typeof v === 'object') { out[k] = JSON.stringify(v); continue; }
    out[k] = String(v);
  }
  return out;
}

ipcMain.handle('mongo:test-connection', async (_event, cfg) => {
  const client = new MongoClient(buildMongoUri(cfg), { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    try { await client.close(); } catch {}
  }
});

ipcMain.handle('mongo:connect', async (_event, cfg) => {
  if (mongoClients.has(cfg.id)) {
    try { await mongoClients.get(cfg.id).close(); } catch {}
    mongoClients.delete(cfg.id);
  }
  const client = new MongoClient(buildMongoUri(cfg), { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    mongoClients.set(cfg.id, client);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('mongo:disconnect', async (_event, id) => {
  if (mongoClients.has(id)) {
    try { await mongoClients.get(id).close(); } catch {}
    mongoClients.delete(id);
  }
  return true;
});

ipcMain.handle('mongo:list-databases', async (_event, id) => {
  const client = mongoClients.get(id);
  if (!client) return { error: 'Not connected' };
  try {
    const res = await client.db('admin').command({ listDatabases: 1 });
    return res.databases
      .map((d) => d.name)
      .filter((n) => !['admin', 'local', 'config'].includes(n));
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle('mongo:list-collections', async (_event, { id, database }) => {
  const client = mongoClients.get(id);
  if (!client) return { error: 'Not connected' };
  try {
    const cols = await client.db(database).listCollections().toArray();
    return cols.map((c) => ({ name: c.name, type: c.type || 'collection' }));
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle('mongo:execute', async (_event, { id, database, collection, operation, filter, options }) => {
  const client = mongoClients.get(id);
  if (!client) return { error: 'Not connected', rows: [], fields: [], rowCount: 0, time: 0 };
  const start = Date.now();
  try {
    const coll = client.db(database).collection(collection);
    let filterObj = {};
    let optionsObj = {};
    try { filterObj = filter ? JSON.parse(filter) : {}; }
    catch (e) { return { error: `Invalid JSON: ${e.message}`, rows: [], fields: [], rowCount: 0, time: 0 }; }
    try { optionsObj = options ? JSON.parse(options) : {}; } catch {}

    let docs;
    switch (operation) {
      case 'find': {
        let cursor = coll.find(filterObj).limit(optionsObj.limit || 100);
        if (optionsObj.sort) cursor = cursor.sort(optionsObj.sort);
        docs = await cursor.toArray();
        break;
      }
      case 'aggregate': {
        const pipeline = Array.isArray(filterObj) ? filterObj : [filterObj];
        docs = await coll.aggregate(pipeline).toArray();
        break;
      }
      case 'count': {
        const count = await coll.countDocuments(filterObj);
        return { rows: [{ count }], fields: [{ name: 'count', type: 'number' }], rowCount: 1, time: Date.now() - start, error: null };
      }
      case 'insertOne': {
        const r = await coll.insertOne(filterObj);
        return { rows: [], fields: [], rowCount: 1, time: Date.now() - start, message: `Inserted — _id: ${r.insertedId}`, error: null };
      }
      case 'deleteOne': {
        const r = await coll.deleteOne(filterObj);
        return { rows: [], fields: [], rowCount: r.deletedCount, time: Date.now() - start, message: `Deleted ${r.deletedCount} document(s)`, error: null };
      }
      case 'deleteMany': {
        const r = await coll.deleteMany(filterObj);
        return { rows: [], fields: [], rowCount: r.deletedCount, time: Date.now() - start, message: `Deleted ${r.deletedCount} document(s)`, error: null };
      }
      default:
        return { error: `Unknown operation: ${operation}`, rows: [], fields: [], rowCount: 0, time: 0 };
    }

    const elapsed = Date.now() - start;
    const rows = docs.map(serializeMongoDoc);
    const allKeys = [...new Set(rows.flatMap(Object.keys))];
    return { rows, fields: allKeys.map((k) => ({ name: k, type: 'mixed' })), rowCount: rows.length, time: elapsed, error: null };
  } catch (e) {
    return { error: e.message, rows: [], fields: [], rowCount: 0, time: Date.now() - start };
  }
});

// Disconnect all on quit
app.on('will-quit', () => {
  for (const conn of dbPool.values()) {
    try { conn.end(); } catch {}
  }
  for (const c of pgClients.values()) { try { c.end(); } catch {} }
  for (const c of mongoClients.values()) { try { c.close(); } catch {} }
});

// ─── Plugin Download / Install ────────────────────────────────────────────────

function downloadFileFromUrl(url, dest) {
  const ALLOWED_HOSTS = ['raw.githubusercontent.com', 'objects.githubusercontent.com'];
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { return reject(new Error('Invalid URL')); }
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return reject(new Error('Only GitHub URLs are allowed'));
    }
    const file = fs.createWriteStream(dest);
    const get = (targetUrl) => {
      let p;
      try { p = new URL(targetUrl); } catch { return reject(new Error('Invalid redirect URL')); }
      https.get({ hostname: p.hostname, path: p.pathname + p.search, headers: { 'User-Agent': 'API-Manager/1.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlink(dest, () => {});
          const loc = res.headers.location;
          if (!loc) return reject(new Error('Redirect with no Location'));
          return downloadFileFromUrl(loc, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        res.on('error', (e) => { file.close(); fs.unlink(dest, () => {}); reject(e); });
      }).on('error', (e) => { file.close(); fs.unlink(dest, () => {}); reject(e); });
    };
    get(url);
  });
}

function fetchUrlJson(url) {
  const ALLOWED_HOSTS = ['raw.githubusercontent.com'];
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { return reject(new Error('Invalid URL')); }
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) return reject(new Error('Only GitHub raw URLs allowed'));
    https.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, headers: { 'User-Agent': 'API-Manager/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} — file not found on GitHub`));
        }
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Invalid JSON: ' + e.message)); }
      });
    }).on('error', reject);
  });
}

ipcMain.handle('plugin:fetch-catalog', async (_event, url) => {
  try { return await fetchUrlJson(url); }
  catch (e) { return { error: e.message }; }
});

ipcMain.handle('plugin:install', async (_event, pluginEntry) => {
  try {
    const { id, files } = pluginEntry || {};
    if (!id || !files || typeof files !== 'object') return { success: false, error: 'Invalid plugin entry' };
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId) return { success: false, error: 'Invalid plugin id' };
    const pluginDir = path.join(getPluginsDir(), safeId);
    fs.mkdirSync(pluginDir, { recursive: true });
    for (const [filename, url] of Object.entries(files)) {
      const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '');
      if (!safeFilename) continue;
      await downloadFileFromUrl(url, path.join(pluginDir, safeFilename));
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('plugin:uninstall', async (_event, pluginId) => {
  try {
    const safeId = (pluginId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId) return { success: false, error: 'Invalid plugin id' };
    const pluginDir = path.join(getPluginsDir(), safeId);
    if (fs.existsSync(pluginDir)) fs.rmSync(pluginDir, { recursive: true, force: true });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── Plugin System ────────────────────────────────────────────────────────────

function getPluginsDir() {
  const dir = path.join(app.getPath('userData'), 'plugins');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

ipcMain.handle('plugin:get-plugins-dir', () => getPluginsDir());

ipcMain.handle('plugin:list-external', () => {
  const pluginsDir = getPluginsDir();
  try {
    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
    const manifests = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(pluginsDir, entry.name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        manifests.push(manifest);
      } catch (e) {
        console.error(`[Plugin] Failed to read manifest for "${entry.name}":`, e.message);
      }
    }
    return manifests;
  } catch { return []; }
});

ipcMain.handle('plugin:get-renderer', (_event, pluginId) => {
  // Sanitize the id to prevent path traversal
  const safeId = pluginId.replace(/[^a-zA-Z0-9_-]/g, '');
  const rendererPath = path.join(getPluginsDir(), safeId, 'renderer.js');
  if (!fs.existsSync(rendererPath)) return null;
  return fs.readFileSync(rendererPath, 'utf-8');
});

// Load main.js from each external plugin — called once in app.whenReady()
function loadExternalPluginMains() {
  const pluginsDir = getPluginsDir();
  try {
    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const mainFile = path.join(pluginsDir, entry.name, 'main.js');
      if (!fs.existsSync(mainFile)) continue;
      try {
        const pluginMain = require(mainFile);
        if (typeof pluginMain.register === 'function') {
          pluginMain.register({ ipcMain, app, path, fs, dialog });
          console.log(`[Plugin] Loaded main module: ${entry.name}`);
        }
      } catch (e) {
        console.error(`[Plugin] Failed to load main for "${entry.name}":`, e.message);
      }
    }
  } catch (e) {
    console.error('[Plugin] Error scanning plugins directory:', e.message);
  }
}
