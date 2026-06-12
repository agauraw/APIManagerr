import { useState } from 'react';
import { useStore } from '../../store';

export default function DbQueryPanel({ tab }) {
  const { dbConnections } = useStore();
  const conn = dbConnections.find((c) => c.id === tab.db?.connectionId);
  const dbType = conn?.type || 'mysql';

  if (dbType === 'mongodb') return <MongoPanel tab={tab} conn={conn} />;
  return <SqlPanel tab={tab} conn={conn} dbType={dbType} />;
}

// ─── SQL Panel (MySQL + PostgreSQL) ───────────────────────────────────────────

function SqlPanel({ tab, conn, dbType }) {
  const { updateDbTab } = useStore();
  const { id, db = {}, result, loading } = tab;

  function setQuery(q) { updateDbTab(id, { db: { ...db, query: q } }); }
  function setDatabase(database) { updateDbTab(id, { db: { ...db, database } }); }

  async function runQuery() {
    if (!db.query?.trim() || !db.connectionId) return;
    updateDbTab(id, { loading: true, result: null });

    let res;
    if (dbType === 'postgres') {
      res = await window.electronAPI.pg.executeQuery(db.connectionId, db.query);
    } else {
      res = await window.electronAPI.db.executeQuery(db.connectionId, db.database, db.query);
    }
    updateDbTab(id, { loading: false, result: res });
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey && e.key === 'Enter') || e.key === 'F5') { e.preventDefault(); runQuery(); }
  }

  const dbIcon = dbType === 'postgres' ? '🐘' : '🐬';

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-pm-bg">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-pm-border bg-pm-panel flex-shrink-0">
        <span className="text-xs flex-shrink-0">{dbIcon}</span>
        <span className="text-xs text-gray-300 flex-shrink-0 font-medium">{conn?.name || 'Unknown'}</span>
        <span className="text-gray-600 text-xs">/</span>
        {dbType === 'postgres' ? (
          <span className="text-xs text-gray-400 font-mono">{conn?.database || 'postgres'}</span>
        ) : (
          <input
            type="text"
            value={db.database || ''}
            onChange={(e) => setDatabase(e.target.value)}
            placeholder="database"
            className="w-36 bg-pm-input border border-pm-border rounded px-2 py-0.5 text-xs text-gray-300 font-mono outline-none focus:border-pm-accent"
          />
        )}
        <div className="flex-1" />
        <span className="text-xs text-gray-600">Ctrl+Enter to run</span>
        <button
          onClick={runQuery}
          disabled={loading || !db.query?.trim()}
          className="flex items-center gap-1.5 px-4 py-1 bg-pm-accent hover:bg-green-500 disabled:opacity-40 text-white text-xs font-semibold rounded transition-fast"
        >
          {loading
            ? <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Running…</>
            : <>▶ Run</>}
        </button>
      </div>

      <div className="flex-shrink-0 border-b border-pm-border" style={{ height: '160px' }}>
        <textarea
          value={db.query || ''}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`-- Write SQL here\nSELECT * FROM "table" LIMIT 100;`}
          spellCheck={false}
          className="w-full h-full bg-pm-bg text-gray-300 font-mono text-xs p-3 outline-none resize-none leading-5 placeholder-gray-700"
        />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <ResultsView result={result} loading={loading} />
      </div>
    </div>
  );
}

// ─── MongoDB Panel ────────────────────────────────────────────────────────────

const MONGO_OPS = [
  { value: 'find',       label: 'find',       hint: '{ field: value }' },
  { value: 'aggregate',  label: 'aggregate',  hint: '[{ $match: {} }, { $group: {} }]' },
  { value: 'count',      label: 'count',      hint: '{ field: value }' },
  { value: 'insertOne',  label: 'insertOne',  hint: '{ field: "value" }' },
  { value: 'deleteOne',  label: 'deleteOne',  hint: '{ field: value }' },
  { value: 'deleteMany', label: 'deleteMany', hint: '{ field: value }' },
];

function MongoPanel({ tab, conn }) {
  const { updateDbTab } = useStore();
  const { id, db = {}, result, loading } = tab;

  const collection = db.collection || '';
  const operation  = db.operation  || 'find';
  const filter     = db.filter     || '{}';
  const database   = db.database   || conn?.database || '';

  function patch(fields) { updateDbTab(id, { db: { ...db, ...fields } }); }

  async function runQuery() {
    if (!collection.trim() || !db.connectionId) return;
    updateDbTab(id, { loading: true, result: null });
    const res = await window.electronAPI.mongo.execute(
      db.connectionId, database, collection, operation, filter, '{}'
    );
    updateDbTab(id, { loading: false, result: res });
  }

  function handleKeyDown(e) {
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); runQuery(); }
  }

  const opMeta = MONGO_OPS.find((o) => o.value === operation) ?? MONGO_OPS[0];

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-pm-bg">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-pm-border bg-pm-panel flex-shrink-0 flex-wrap">
        <span className="text-xs">🍃</span>
        <span className="text-xs text-gray-300 font-medium flex-shrink-0">{conn?.name || 'MongoDB'}</span>
        <span className="text-gray-600">/</span>
        <input
          value={database}
          onChange={(e) => patch({ database: e.target.value })}
          placeholder="database"
          className="w-28 bg-pm-input border border-pm-border rounded px-2 py-0.5 text-xs text-gray-300 font-mono outline-none focus:border-pm-accent"
        />
        <span className="text-gray-600">·</span>
        <input
          value={collection}
          onChange={(e) => patch({ collection: e.target.value })}
          placeholder="collection"
          className="w-36 bg-pm-input border border-pm-border rounded px-2 py-0.5 text-xs text-gray-300 font-mono outline-none focus:border-pm-accent"
        />
        <select
          value={operation}
          onChange={(e) => patch({ operation: e.target.value })}
          className="bg-pm-input border border-pm-border rounded px-2 py-0.5 text-xs text-gray-300 outline-none focus:border-pm-accent"
        >
          {MONGO_OPS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="flex-1" />
        <span className="text-xs text-gray-600 hidden sm:block">Ctrl+Enter to run</span>
        <button
          onClick={runQuery}
          disabled={loading || !collection.trim()}
          className="flex items-center gap-1.5 px-4 py-1 bg-pm-accent hover:bg-green-500 disabled:opacity-40 text-white text-xs font-semibold rounded transition-fast"
        >
          {loading
            ? <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Running…</>
            : <>▶ Run</>}
        </button>
      </div>

      {/* Filter / Pipeline editor */}
      <div className="flex-shrink-0 border-b border-pm-border" style={{ height: '160px' }}>
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <span className="text-xs text-gray-600">
            {operation === 'aggregate' ? 'Pipeline (JSON array)' : `Filter / Document (JSON)`}
          </span>
          <span className="text-xs text-gray-700 font-mono">{opMeta.hint}</span>
        </div>
        <textarea
          value={filter}
          onChange={(e) => patch({ filter: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder={opMeta.hint}
          spellCheck={false}
          className="w-full bg-pm-bg text-gray-300 font-mono text-xs px-3 pb-3 outline-none resize-none leading-5 placeholder-gray-700"
          style={{ height: 'calc(100% - 28px)' }}
        />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <ResultsView result={result} loading={loading} />
      </div>
    </div>
  );
}

// ─── Shared Results View ──────────────────────────────────────────────────────

function ResultsView({ result, loading }) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 200;

  if (!result && !loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Run a query to see results</div>;
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <div className="w-7 h-7 border-2 border-pm-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Executing…</span>
        </div>
      </div>
    );
  }

  if (result?.error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="text-red-400 text-sm font-semibold mb-1">Error</div>
          <pre className="text-xs text-red-300 font-mono bg-red-500/10 border border-red-500/20 rounded p-3 whitespace-pre-wrap">{result.error}</pre>
        </div>
      </div>
    );
  }

  if (!result?.fields?.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-green-400 text-sm font-semibold mb-1">✓ OK</div>
          <div className="text-xs text-gray-400">{result?.message || `${result?.rowCount ?? 0} row(s) affected · ${result?.time}ms`}</div>
        </div>
      </div>
    );
  }

  const { rows, fields } = result;
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-1.5 border-b border-pm-border bg-pm-panel flex-shrink-0">
        <span className="text-xs text-gray-400"><span className="text-gray-200 font-medium">{rows.length}</span> rows</span>
        <span className="text-xs text-gray-400"><span className="text-gray-200 font-medium">{fields.length}</span> columns</span>
        <span className="text-xs text-gray-400"><span className="text-gray-200 font-medium">{result.time}ms</span></span>
        {totalPages > 1 && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 px-2 py-0.5 rounded hover:bg-pm-hover">← Prev</button>
            <span className="text-xs text-gray-500">Page {page + 1} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 px-2 py-0.5 rounded hover:bg-pm-hover">Next →</button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <table className="text-xs font-mono border-collapse w-max min-w-full">
          <thead className="sticky top-0 z-10 bg-pm-panel">
            <tr>
              <th className="text-right text-gray-600 px-3 py-1.5 border-b border-pm-border font-normal select-none w-10">#</th>
              {fields.map((f) => (
                <th key={f.name} className="text-left text-gray-300 font-semibold px-3 py-1.5 border-b border-pm-border border-r border-r-pm-border/30 whitespace-nowrap">
                  {f.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="hover:bg-pm-hover/40 border-b border-pm-border/30">
                <td className="text-right text-gray-600 px-3 py-1 select-none">{page * PAGE_SIZE + i + 1}</td>
                {fields.map((f) => {
                  const val = row[f.name];
                  const isNull = val === null || val === undefined;
                  return (
                    <td key={f.name}
                      className={`px-3 py-1 border-r border-r-pm-border/20 max-w-xs truncate whitespace-nowrap ${isNull ? 'text-gray-600 italic' : 'text-gray-300'}`}
                      title={isNull ? 'NULL' : String(val)}
                    >
                      {isNull ? 'NULL' : String(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
