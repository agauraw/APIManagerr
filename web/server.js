const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const axios = require('axios');
const jsYaml = require('js-yaml');
const mysql = require('mysql2/promise');
const { Client: PgClient } = require('pg');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

if (isProd) {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// ─── Collections ──────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data', 'collections');
fs.mkdirSync(DATA_DIR, { recursive: true });

app.get('/api/collections', (_req, res) => {
  try {
    const cols = fs.readdirSync(DATA_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); } catch { return null; } })
      .filter(Boolean);
    res.json(cols);
  } catch { res.json([]); }
});

app.post('/api/collections', (req, res) => {
  const col = req.body;
  if (!col?._id) return res.status(400).json({ error: 'Missing _id' });
  fs.writeFileSync(path.join(DATA_DIR, `${col._id}.json`), JSON.stringify(col, null, 2));
  res.json({ success: true });
});

app.delete('/api/collections/:id', (req, res) => {
  const fp = path.join(DATA_DIR, `${req.params.id}.json`);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  res.json({ success: true });
});

// ─── HTTP Proxy ───────────────────────────────────────────────────────────────
app.post('/api/proxy', async (req, res) => {
  const config = req.body;
  const startTime = Date.now();
  try {
    const headers = { ...(config.headers || {}) };
    if (config.auth) {
      const { type } = config.auth;
      if (type === 'bearer' && config.auth.token)
        headers['Authorization'] = `Bearer ${config.auth.token}`;
      else if (type === 'basic' && config.auth.username)
        headers['Authorization'] = `Basic ${Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64')}`;
      else if (type === 'apikey' && config.auth.key && config.auth.in === 'header')
        headers[config.auth.key] = config.auth.value;
    }
    const axCfg = {
      method: config.method,
      url: config.url,
      headers,
      params: config.params || {},
      timeout: 30000,
      validateStatus: () => true,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      responseType: 'arraybuffer',
    };
    if (config.bodyType === 'json' && config.body) {
      axCfg.data = config.body;
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    } else if (config.bodyType === 'form' && config.body) {
      const p = new URLSearchParams();
      (config.body || []).forEach(([k, v]) => k && p.append(k, v));
      axCfg.data = p.toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (config.bodyType === 'raw' && config.body) {
      axCfg.data = config.body;
    }
    const response = await axios(axCfg);
    const elapsed = Date.now() - startTime;
    const buf = Buffer.from(response.data);
    const ct = (response.headers['content-type'] || '').toLowerCase();
    const isText = ['json', 'text', 'xml', 'html', 'javascript'].some((t) => ct.includes(t));
    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: isText ? buf.toString('utf8') : `[Binary data: ${buf.length} bytes]`,
      time: elapsed,
      size: buf.length,
      error: null,
    });
  } catch (err) {
    res.json({ status: 0, statusText: 'Error', headers: {}, data: null, time: Date.now() - startTime, size: 0, error: err.message });
  }
});

// ─── Swagger ──────────────────────────────────────────────────────────────────
app.post('/api/swagger/parse', (req, res) => {
  const { content, ext } = req.body;
  try {
    const spec = (ext === 'yaml' || ext === 'yml') ? jsYaml.load(content) : JSON.parse(content);
    res.json(spec);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── MySQL ────────────────────────────────────────────────────────────────────
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

app.post('/api/db/mysql/test', async (req, res) => {
  let conn;
  try {
    conn = await mysql.createConnection({ host: req.body.host || '127.0.0.1', port: Number(req.body.port) || 3306, user: req.body.user, password: req.body.password, database: req.body.database || undefined, connectTimeout: 8000 });
    await conn.ping();
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
  finally { if (conn) try { await conn.end(); } catch {} }
});

app.post('/api/db/mysql/connect', async (req, res) => {
  const cfg = req.body;
  if (dbPool.has(cfg.id)) { try { await dbPool.get(cfg.id).end(); } catch {} dbPool.delete(cfg.id); }
  try {
    const conn = await mysql.createConnection({ host: cfg.host || '127.0.0.1', port: Number(cfg.port) || 3306, user: cfg.user, password: cfg.password, database: cfg.database || undefined, connectTimeout: 8000 });
    dbPool.set(cfg.id, conn);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/db/mysql/disconnect', async (req, res) => {
  if (dbPool.has(req.body.id)) { try { await dbPool.get(req.body.id).end(); } catch {} dbPool.delete(req.body.id); }
  res.json({ success: true });
});

app.post('/api/db/mysql/list-databases', async (req, res) => {
  const conn = dbPool.get(req.body.id);
  if (!conn) return res.json({ error: 'Not connected' });
  try { const [rows] = await conn.execute('SHOW DATABASES'); res.json(rows.map((r) => r.Database)); }
  catch (e) { res.json({ error: e.message }); }
});

app.post('/api/db/mysql/list-tables', async (req, res) => {
  const conn = dbPool.get(req.body.id);
  if (!conn) return res.json({ error: 'Not connected' });
  try {
    const db = req.body.database.replace(/`/g, '');
    const [rows] = await conn.execute(`SHOW FULL TABLES FROM \`${db}\``);
    res.json(rows.map((r) => ({ name: r[`Tables_in_${db}`], type: r.Table_type === 'VIEW' ? 'view' : 'table' })));
  } catch (e) { res.json({ error: e.message }); }
});

app.post('/api/db/mysql/describe-table', async (req, res) => {
  const conn = dbPool.get(req.body.id);
  if (!conn) return res.json({ error: 'Not connected' });
  try {
    const [rows] = await conn.execute(`DESCRIBE \`${req.body.database.replace(/`/g, '')}\`.\`${req.body.table.replace(/`/g, '')}\``);
    res.json(rows.map(serializeRow));
  } catch (e) { res.json({ error: e.message }); }
});

app.post('/api/db/mysql/query', async (req, res) => {
  const conn = dbPool.get(req.body.id);
  if (!conn) return res.json({ error: 'Not connected', rows: [], fields: [], rowCount: 0, time: 0 });
  const start = Date.now();
  try {
    if (req.body.database) await conn.execute(`USE \`${req.body.database.replace(/`/g, '')}\``);
    const [rows, fields] = await conn.execute(req.body.query);
    const elapsed = Date.now() - start;
    if (Array.isArray(rows)) {
      res.json({ rows: rows.map(serializeRow), fields: (fields || []).map((f) => ({ name: f.name, type: f.type })), rowCount: rows.length, time: elapsed, error: null });
    } else {
      res.json({ rows: [], fields: [], rowCount: rows.affectedRows ?? 0, time: elapsed, message: `Query OK — ${rows.affectedRows ?? 0} row(s) affected`, error: null });
    }
  } catch (e) { res.json({ error: e.message, rows: [], fields: [], rowCount: 0, time: Date.now() - start }); }
});

// ─── PostgreSQL ───────────────────────────────────────────────────────────────
const pgClients = new Map();

const makePgClient = (cfg) => new PgClient({ host: cfg.host || '127.0.0.1', port: Number(cfg.port) || 5432, user: cfg.user || undefined, password: cfg.password || undefined, database: cfg.database || 'postgres', connectionTimeoutMillis: 8000 });

app.post('/api/db/pg/test', async (req, res) => {
  const client = makePgClient(req.body);
  try { await client.connect(); await client.query('SELECT 1'); res.json({ success: true }); }
  catch (e) { res.json({ success: false, error: e.message }); }
  finally { try { await client.end(); } catch {} }
});

app.post('/api/db/pg/connect', async (req, res) => {
  const cfg = req.body;
  if (pgClients.has(cfg.id)) { try { await pgClients.get(cfg.id).end(); } catch {} pgClients.delete(cfg.id); }
  const client = makePgClient(cfg);
  try { await client.connect(); pgClients.set(cfg.id, client); res.json({ success: true }); }
  catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/db/pg/disconnect', async (req, res) => {
  if (pgClients.has(req.body.id)) { try { await pgClients.get(req.body.id).end(); } catch {} pgClients.delete(req.body.id); }
  res.json({ success: true });
});

app.post('/api/db/pg/list-schemas', async (req, res) => {
  const client = pgClients.get(req.body.id);
  if (!client) return res.json({ error: 'Not connected' });
  try {
    const r = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema','pg_catalog','pg_toast') AND schema_name NOT LIKE 'pg_temp%' ORDER BY schema_name`);
    res.json(r.rows.map((r) => r.schema_name));
  } catch (e) { res.json({ error: e.message }); }
});

app.post('/api/db/pg/list-tables', async (req, res) => {
  const client = pgClients.get(req.body.id);
  if (!client) return res.json({ error: 'Not connected' });
  try {
    const r = await client.query(`SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`, [req.body.schema]);
    res.json(r.rows.map((r) => ({ name: r.table_name, type: r.table_type === 'VIEW' ? 'view' : 'table' })));
  } catch (e) { res.json({ error: e.message }); }
});

app.post('/api/db/pg/describe-table', async (req, res) => {
  const client = pgClients.get(req.body.id);
  if (!client) return res.json({ error: 'Not connected' });
  try {
    const r = await client.query(
      `SELECT c.column_name AS "Field", c.data_type AS "Type", c.is_nullable AS "Null",
       CASE WHEN pk.column_name IS NOT NULL THEN 'PRI' ELSE '' END AS "Key"
       FROM information_schema.columns c
       LEFT JOIN (SELECT kcu.column_name FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
         WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema=$1 AND tc.table_name=$2) pk ON c.column_name=pk.column_name
       WHERE c.table_schema=$1 AND c.table_name=$2 ORDER BY c.ordinal_position`,
      [req.body.schema, req.body.table]
    );
    res.json(r.rows);
  } catch (e) { res.json({ error: e.message }); }
});

app.post('/api/db/pg/query', async (req, res) => {
  const client = pgClients.get(req.body.id);
  if (!client) return res.json({ error: 'Not connected', rows: [], fields: [], rowCount: 0, time: 0 });
  const start = Date.now();
  try {
    const r = await client.query(req.body.query);
    const elapsed = Date.now() - start;
    if (r.fields?.length > 0) {
      res.json({
        rows: r.rows.map((row) => { const out = {}; for (const [k, v] of Object.entries(row)) { if (v === null) out[k] = null; else if (v instanceof Date) out[k] = v.toISOString(); else if (typeof v === 'object') out[k] = JSON.stringify(v); else out[k] = String(v); } return out; }),
        fields: r.fields.map((f) => ({ name: f.name, type: String(f.dataTypeID) })),
        rowCount: r.rowCount ?? r.rows.length, time: elapsed, error: null,
      });
    } else {
      res.json({ rows: [], fields: [], rowCount: r.rowCount ?? 0, time: elapsed, message: `Query OK — ${r.rowCount ?? 0} row(s) affected`, error: null });
    }
  } catch (e) { res.json({ error: e.message, rows: [], fields: [], rowCount: 0, time: Date.now() - start }); }
});

// ─── MongoDB ──────────────────────────────────────────────────────────────────
const mongoClients = new Map();

const buildMongoUri = (cfg) => cfg.uri || `mongodb://${cfg.user ? `${encodeURIComponent(cfg.user)}:${encodeURIComponent(cfg.password || '')}@` : ''}${cfg.host || '127.0.0.1'}:${cfg.port || 27017}${cfg.database ? '/' + cfg.database : ''}`;

const serializeMongo = (doc) => {
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v === null || v === undefined) { out[k] = null; continue; }
    if (v?.constructor?.name === 'ObjectId') { out[k] = v.toString(); continue; }
    if (v instanceof Date) { out[k] = v.toISOString(); continue; }
    if (Buffer.isBuffer(v)) { out[k] = v.toString('hex'); continue; }
    if (typeof v === 'object') { out[k] = JSON.stringify(v); continue; }
    out[k] = String(v);
  }
  return out;
};

app.post('/api/db/mongo/test', async (req, res) => {
  const client = new MongoClient(buildMongoUri(req.body), { serverSelectionTimeoutMS: 8000 });
  try { await client.connect(); await client.db('admin').command({ ping: 1 }); res.json({ success: true }); }
  catch (e) { res.json({ success: false, error: e.message }); }
  finally { try { await client.close(); } catch {} }
});

app.post('/api/db/mongo/connect', async (req, res) => {
  const cfg = req.body;
  if (mongoClients.has(cfg.id)) { try { await mongoClients.get(cfg.id).close(); } catch {} mongoClients.delete(cfg.id); }
  const client = new MongoClient(buildMongoUri(cfg), { serverSelectionTimeoutMS: 8000 });
  try { await client.connect(); mongoClients.set(cfg.id, client); res.json({ success: true }); }
  catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/db/mongo/disconnect', async (req, res) => {
  if (mongoClients.has(req.body.id)) { try { await mongoClients.get(req.body.id).close(); } catch {} mongoClients.delete(req.body.id); }
  res.json({ success: true });
});

app.post('/api/db/mongo/list-databases', async (req, res) => {
  const client = mongoClients.get(req.body.id);
  if (!client) return res.json({ error: 'Not connected' });
  try {
    const r = await client.db('admin').command({ listDatabases: 1 });
    res.json(r.databases.map((d) => d.name).filter((n) => !['admin', 'local', 'config'].includes(n)));
  } catch (e) { res.json({ error: e.message }); }
});

app.post('/api/db/mongo/list-collections', async (req, res) => {
  const client = mongoClients.get(req.body.id);
  if (!client) return res.json({ error: 'Not connected' });
  try {
    const cols = await client.db(req.body.database).listCollections().toArray();
    res.json(cols.map((c) => ({ name: c.name, type: c.type || 'collection' })));
  } catch (e) { res.json({ error: e.message }); }
});

app.post('/api/db/mongo/execute', async (req, res) => {
  const { id, database, collection, operation, filter, options } = req.body;
  const client = mongoClients.get(id);
  if (!client) return res.json({ error: 'Not connected', rows: [], fields: [], rowCount: 0, time: 0 });
  const start = Date.now();
  try {
    const coll = client.db(database).collection(collection);
    let filterObj = {}, optionsObj = {};
    try { filterObj = filter ? JSON.parse(filter) : {}; } catch (e) { return res.json({ error: `Invalid JSON: ${e.message}`, rows: [], fields: [], rowCount: 0, time: 0 }); }
    try { optionsObj = options ? JSON.parse(options) : {}; } catch {}
    let docs;
    switch (operation) {
      case 'find': { let cur = coll.find(filterObj).limit(optionsObj.limit || 100); if (optionsObj.sort) cur = cur.sort(optionsObj.sort); docs = await cur.toArray(); break; }
      case 'aggregate': { docs = await coll.aggregate(Array.isArray(filterObj) ? filterObj : [filterObj]).toArray(); break; }
      case 'count': { const c = await coll.countDocuments(filterObj); return res.json({ rows: [{ count: c }], fields: [{ name: 'count', type: 'number' }], rowCount: 1, time: Date.now() - start, error: null }); }
      case 'insertOne': { const r = await coll.insertOne(filterObj); return res.json({ rows: [], fields: [], rowCount: 1, time: Date.now() - start, message: `Inserted — _id: ${r.insertedId}`, error: null }); }
      case 'deleteOne': { const r = await coll.deleteOne(filterObj); return res.json({ rows: [], fields: [], rowCount: r.deletedCount, time: Date.now() - start, message: `Deleted ${r.deletedCount} document(s)`, error: null }); }
      case 'deleteMany': { const r = await coll.deleteMany(filterObj); return res.json({ rows: [], fields: [], rowCount: r.deletedCount, time: Date.now() - start, message: `Deleted ${r.deletedCount} document(s)`, error: null }); }
      default: return res.json({ error: `Unknown operation: ${operation}`, rows: [], fields: [], rowCount: 0, time: 0 });
    }
    const rows = docs.map(serializeMongo);
    const allKeys = [...new Set(rows.flatMap(Object.keys))];
    res.json({ rows, fields: allKeys.map((k) => ({ name: k, type: 'mixed' })), rowCount: rows.length, time: Date.now() - start, error: null });
  } catch (e) { res.json({ error: e.message, rows: [], fields: [], rowCount: 0, time: Date.now() - start }); }
});

// ─── Plugin Catalog Proxy ─────────────────────────────────────────────────────
app.post('/api/plugins/fetch-catalog', (req, res) => {
  const { url } = req.body;
  if (!url?.startsWith('https://raw.githubusercontent.com/')) return res.json({ error: 'Only GitHub raw URLs allowed' });
  const p = new URL(url);
  https.get({ hostname: p.hostname, path: p.pathname + p.search, headers: { 'User-Agent': 'API-Manager-Web/1.0' } }, (response) => {
    let data = '';
    response.on('data', (c) => { data += c; });
    response.on('end', () => {
      if (response.statusCode !== 200) return res.json({ error: `HTTP ${response.statusCode}` });
      try { res.json(JSON.parse(data)); } catch { res.json({ error: 'Invalid JSON' }); }
    });
  }).on('error', (e) => res.json({ error: e.message }));
});

// ─── Catch-all (production) ───────────────────────────────────────────────────
if (isProd) {
  app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
}

process.on('exit', () => {
  for (const c of dbPool.values()) try { c.end(); } catch {}
  for (const c of pgClients.values()) try { c.end(); } catch {}
  for (const c of mongoClients.values()) try { c.close(); } catch {}
});

app.listen(PORT, () => console.log(`\n  API Manager Web  →  http://localhost:${PORT}\n`));
