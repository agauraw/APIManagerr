import { useState } from 'react';
import { useStore } from '../../store';

export default function DbExplorer({ connection, connected }) {
  if (!connected) return <div className="text-xs text-gray-600 px-3 py-2">Not connected</div>;
  if (connection.type === 'postgres') return <PgExplorer connection={connection} />;
  if (connection.type === 'mongodb') return <MongoExplorer connection={connection} />;
  return <MySqlExplorer connection={connection} />;
}

// ─── MySQL Explorer ───────────────────────────────────────────────────────────

function MySqlExplorer({ connection }) {
  const [databases, setDatabases] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [tables, setTables] = useState({});
  const [columns, setColumns] = useState({});
  const [loading, setLoading] = useState({});
  const { addDbTab } = useStore();

  if (databases === null) {
    loadDatabasesMysql(connection.id, setDatabases, setLoading);
  }

  if (databases === null || loading._dbs) {
    return <div className="text-xs text-gray-500 px-3 py-2 animate-pulse">Loading databases…</div>;
  }

  async function toggleDb(db) {
    const key = `db_${db}`;
    const next = !expanded[key];
    setExpanded((e) => ({ ...e, [key]: next }));
    if (next && !tables[db]) {
      setLoading((l) => ({ ...l, [key]: true }));
      const res = await window.electronAPI.db.listTables(connection.id, db);
      setLoading((l) => ({ ...l, [key]: false }));
      if (Array.isArray(res)) setTables((t) => ({ ...t, [db]: res }));
    }
  }

  async function toggleTable(db, table) {
    const key = `${db}.${table}`;
    const next = !expanded[key];
    setExpanded((e) => ({ ...e, [key]: next }));
    if (next && !columns[key]) {
      setLoading((l) => ({ ...l, [key]: true }));
      const res = await window.electronAPI.db.describeTable(connection.id, db, table);
      setLoading((l) => ({ ...l, [key]: false }));
      if (Array.isArray(res)) setColumns((c) => ({ ...c, [key]: res }));
    }
  }

  return (
    <div className="text-xs">
      {databases.map((db) => {
        const dbKey = `db_${db}`;
        const isOpen = !!expanded[dbKey];
        const dbTables = tables[db] || [];

        return (
          <div key={db}>
            <div className="flex items-center gap-1 px-2 py-1 hover:bg-pm-hover cursor-pointer group" onClick={() => toggleDb(db)}>
              <span className="text-gray-500 w-3 flex-shrink-0">{isOpen ? '▾' : '▸'}</span>
              <span className="mr-1">🗄</span>
              <span className="text-gray-300 flex-1 truncate font-mono">{db}</span>
            </div>
            {isOpen && (
              <div className="ml-4">
                {loading[dbKey] && <div className="text-gray-600 py-1 px-2 animate-pulse">Loading…</div>}
                {dbTables.map((t) => {
                  const tKey = `${db}.${t.name}`;
                  const isTblOpen = !!expanded[tKey];
                  const cols = columns[tKey] || [];
                  return (
                    <div key={t.name}>
                      <div className="flex items-center gap-1 py-0.5 px-1 hover:bg-pm-hover cursor-pointer group rounded">
                        <span className="text-gray-600 w-3 flex-shrink-0" onClick={() => toggleTable(db, t.name)}>
                          {isTblOpen ? '▾' : '▸'}
                        </span>
                        <span className="text-xs">{t.type === 'view' ? '👁' : '📋'}</span>
                        <span className="text-gray-300 flex-1 truncate font-mono" onClick={() => toggleTable(db, t.name)}>{t.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addDbTab({ connectionId: connection.id, database: db, query: `SELECT * FROM \`${t.name}\` LIMIT 100;`, name: `${t.name} — ${db}` });
                          }}
                          title="Open SELECT"
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-pm-accent px-1 transition-fast"
                        >▶</button>
                      </div>
                      {isTblOpen && (
                        <div className="ml-5 border-l border-pm-border/50 pl-2">
                          {loading[tKey] && <div className="text-gray-600 py-1 animate-pulse">Loading…</div>}
                          {cols.map((col) => (
                            <ColumnRow key={col.Field} col={col} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

async function loadDatabasesMysql(id, setDatabases, setLoading) {
  setLoading((l) => ({ ...l, _dbs: true }));
  const res = await window.electronAPI.db.listDatabases(id);
  setLoading((l) => ({ ...l, _dbs: false }));
  if (Array.isArray(res)) setDatabases(res);
}

// ─── PostgreSQL Explorer ──────────────────────────────────────────────────────

function PgExplorer({ connection }) {
  const [schemas, setSchemas] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [tables, setTables] = useState({});
  const [columns, setColumns] = useState({});
  const [loading, setLoading] = useState({});
  const { addDbTab } = useStore();

  if (schemas === null && !loading._schemas) {
    setLoading((l) => ({ ...l, _schemas: true }));
    window.electronAPI.pg.listSchemas(connection.id).then((res) => {
      setLoading((l) => ({ ...l, _schemas: false }));
      if (Array.isArray(res)) setSchemas(res);
    });
  }

  if (schemas === null || loading._schemas) {
    return <div className="text-xs text-gray-500 px-3 py-2 animate-pulse">Loading schemas…</div>;
  }

  async function toggleSchema(schema) {
    const key = `s_${schema}`;
    const next = !expanded[key];
    setExpanded((e) => ({ ...e, [key]: next }));
    if (next && !tables[schema]) {
      setLoading((l) => ({ ...l, [key]: true }));
      const res = await window.electronAPI.pg.listTables(connection.id, schema);
      setLoading((l) => ({ ...l, [key]: false }));
      if (Array.isArray(res)) setTables((t) => ({ ...t, [schema]: res }));
    }
  }

  async function toggleTable(schema, table) {
    const key = `${schema}.${table}`;
    const next = !expanded[key];
    setExpanded((e) => ({ ...e, [key]: next }));
    if (next && !columns[key]) {
      setLoading((l) => ({ ...l, [key]: true }));
      const res = await window.electronAPI.pg.describeTable(connection.id, schema, table);
      setLoading((l) => ({ ...l, [key]: false }));
      if (Array.isArray(res)) setColumns((c) => ({ ...c, [key]: res }));
    }
  }

  return (
    <div className="text-xs">
      {schemas.length === 0 && <div className="text-gray-600 px-2 py-1">No schemas found</div>}
      {schemas.map((schema) => {
        const sKey = `s_${schema}`;
        const isOpen = !!expanded[sKey];
        const schemaTables = tables[schema] || [];

        return (
          <div key={schema}>
            <div className="flex items-center gap-1 px-2 py-1 hover:bg-pm-hover cursor-pointer group" onClick={() => toggleSchema(schema)}>
              <span className="text-gray-500 w-3 flex-shrink-0">{isOpen ? '▾' : '▸'}</span>
              <span className="mr-1">📁</span>
              <span className="text-gray-300 flex-1 truncate font-mono">{schema}</span>
              <span className="text-gray-600 text-xs opacity-0 group-hover:opacity-100">schema</span>
            </div>
            {isOpen && (
              <div className="ml-4">
                {loading[sKey] && <div className="text-gray-600 py-1 px-2 animate-pulse">Loading…</div>}
                {schemaTables.map((t) => {
                  const tKey = `${schema}.${t.name}`;
                  const isTblOpen = !!expanded[tKey];
                  const cols = columns[tKey] || [];
                  return (
                    <div key={t.name}>
                      <div className="flex items-center gap-1 py-0.5 px-1 hover:bg-pm-hover cursor-pointer group rounded">
                        <span className="text-gray-600 w-3 flex-shrink-0" onClick={() => toggleTable(schema, t.name)}>
                          {isTblOpen ? '▾' : '▸'}
                        </span>
                        <span className="text-xs">{t.type === 'view' ? '👁' : '📋'}</span>
                        <span className="text-gray-300 flex-1 truncate font-mono" onClick={() => toggleTable(schema, t.name)}>{t.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addDbTab({
                              connectionId: connection.id,
                              database: connection.database,
                              query: `SELECT * FROM "${schema}"."${t.name}" LIMIT 100;`,
                              name: `${t.name} — ${schema}`,
                            });
                          }}
                          title="Open SELECT"
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-pm-accent px-1 transition-fast"
                        >▶</button>
                      </div>
                      {isTblOpen && (
                        <div className="ml-5 border-l border-pm-border/50 pl-2">
                          {loading[tKey] && <div className="text-gray-600 py-1 animate-pulse">Loading…</div>}
                          {cols.map((col) => <ColumnRow key={col.Field} col={col} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MongoDB Explorer ─────────────────────────────────────────────────────────

function MongoExplorer({ connection }) {
  const [databases, setDatabases] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [collections, setCollections] = useState({});
  const [loading, setLoading] = useState({});
  const { addDbTab } = useStore();

  if (databases === null && !loading._dbs) {
    setLoading((l) => ({ ...l, _dbs: true }));
    window.electronAPI.mongo.listDatabases(connection.id).then((res) => {
      setLoading((l) => ({ ...l, _dbs: false }));
      if (Array.isArray(res)) setDatabases(res);
    });
  }

  if (databases === null || loading._dbs) {
    return <div className="text-xs text-gray-500 px-3 py-2 animate-pulse">Loading databases…</div>;
  }

  async function toggleDb(db) {
    const key = `db_${db}`;
    const next = !expanded[key];
    setExpanded((e) => ({ ...e, [key]: next }));
    if (next && !collections[db]) {
      setLoading((l) => ({ ...l, [key]: true }));
      const res = await window.electronAPI.mongo.listCollections(connection.id, db);
      setLoading((l) => ({ ...l, [key]: false }));
      if (Array.isArray(res)) setCollections((c) => ({ ...c, [db]: res }));
    }
  }

  return (
    <div className="text-xs">
      {databases.length === 0 && (
        <div className="text-gray-600 px-2 py-1">No user databases found</div>
      )}
      {databases.map((db) => {
        const dbKey = `db_${db}`;
        const isOpen = !!expanded[dbKey];
        const dbCols = collections[db] || [];

        return (
          <div key={db}>
            <div className="flex items-center gap-1 px-2 py-1 hover:bg-pm-hover cursor-pointer group" onClick={() => toggleDb(db)}>
              <span className="text-gray-500 w-3 flex-shrink-0">{isOpen ? '▾' : '▸'}</span>
              <span className="mr-1">🗄</span>
              <span className="text-gray-300 flex-1 truncate font-mono">{db}</span>
            </div>
            {isOpen && (
              <div className="ml-4">
                {loading[dbKey] && <div className="text-gray-600 py-1 px-2 animate-pulse">Loading…</div>}
                {dbCols.map((col) => (
                  <div key={col.name} className="flex items-center gap-1 py-0.5 px-1 hover:bg-pm-hover rounded group">
                    <span className="text-gray-600 w-3 flex-shrink-0">·</span>
                    <span className="text-xs">📄</span>
                    <span className="text-gray-300 flex-1 truncate font-mono">{col.name}</span>
                    <button
                      onClick={() => addDbTab({
                        connectionId: connection.id,
                        database: db,
                        collection: col.name,
                        operation: 'find',
                        filter: '{}',
                        name: `${col.name} — ${db}`,
                      })}
                      title="Open find query"
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-pm-accent px-1 transition-fast"
                    >▶</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function ColumnRow({ col }) {
  return (
    <div className="flex items-center gap-1.5 py-0.5 group/col">
      <span className="text-gray-600 text-xs">{col.Key === 'PRI' ? '🔑' : '·'}</span>
      <span className="text-gray-400 font-mono truncate flex-1">{col.Field}</span>
      <span className="text-gray-600 font-mono text-xs opacity-0 group-hover/col:opacity-100">{col.Type}</span>
      {col.Null === 'NO' && (
        <span className="text-red-500 text-xs opacity-0 group-hover/col:opacity-100" title="NOT NULL">!</span>
      )}
    </div>
  );
}
