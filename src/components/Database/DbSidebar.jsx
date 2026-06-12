import { useState } from 'react';
import { useStore } from '../../store';
import DbConnectionModal from './DbConnectionModal';
import DbExplorer from './DbExplorer';

const TYPE_META = {
  mysql:    { icon: '🐬', label: 'MySQL' },
  postgres: { icon: '🐘', label: 'PostgreSQL' },
  mongodb:  { icon: '🍃', label: 'MongoDB' },
};

function getIpc(conn) {
  if (conn.type === 'postgres') return window.electronAPI?.pg;
  if (conn.type === 'mongodb') return window.electronAPI?.mongo;
  return window.electronAPI?.db;
}

export default function DbSidebar() {
  const [showModal, setShowModal] = useState(false);
  const [editingConn, setEditingConn] = useState(null);
  const [connectedIds, setConnectedIds] = useState(new Set());
  const [connecting, setConnecting] = useState(null);
  const [expanded, setExpanded] = useState({});

  const { dbConnections, removeDbConnection, addDbTab } = useStore();

  async function handleConnect(conn) {
    const ipc = getIpc(conn);
    if (connectedIds.has(conn.id)) {
      await ipc?.disconnect(conn.id);
      setConnectedIds((s) => { const n = new Set(s); n.delete(conn.id); return n; });
      setExpanded((e) => ({ ...e, [conn.id]: false }));
      return;
    }
    setConnecting(conn.id);
    const res = await ipc?.connect(conn);
    setConnecting(null);
    if (res?.success) {
      setConnectedIds((s) => new Set([...s, conn.id]));
      setExpanded((e) => ({ ...e, [conn.id]: true }));
    } else {
      alert(`Connection failed:\n${res?.error ?? 'Unknown error'}`);
    }
  }

  function openQueryTab(conn) {
    if (conn.type === 'mongodb') {
      addDbTab({
        connectionId: conn.id,
        database: conn.database || '',
        collection: '',
        operation: 'find',
        filter: '',
        name: `Query — ${conn.name}`,
      });
    } else {
      addDbTab({
        connectionId: conn.id,
        database: conn.database || '',
        query: conn.type === 'postgres'
          ? 'SELECT current_database(), current_user, version();'
          : 'SELECT DATABASE();',
        name: `Query — ${conn.name}`,
      });
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-1.5 p-2 border-b border-pm-border flex-shrink-0">
        <button
          onClick={() => { setEditingConn(null); setShowModal(true); }}
          className="flex-1 text-xs bg-pm-accent hover:bg-green-500 text-white rounded px-2 py-1.5 font-medium transition-fast"
        >
          + New Connection
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {dbConnections.length === 0 && (
          <div className="text-center text-gray-600 text-xs mt-10 px-4">
            <div className="text-3xl mb-2">🗄</div>
            <div>Add a MySQL, PostgreSQL, or MongoDB connection to get started</div>
          </div>
        )}

        {dbConnections.map((conn) => {
          const isConnected = connectedIds.has(conn.id);
          const isConnecting = connecting === conn.id;
          const isExpanded = expanded[conn.id];
          const meta = TYPE_META[conn.type] ?? TYPE_META.mysql;

          return (
            <div key={conn.id} className="border-b border-pm-border/50">
              <div className="flex items-center gap-1 px-2 py-2 hover:bg-pm-hover group">
                {/* Status dot */}
                <div
                  onClick={() => handleConnect(conn)}
                  title={isConnected ? 'Click to disconnect' : 'Click to connect'}
                  className={`w-2 h-2 rounded-full flex-shrink-0 cursor-pointer transition-fast ${
                    isConnecting ? 'bg-yellow-400 animate-pulse'
                    : isConnected ? 'bg-green-400'
                    : 'bg-gray-600 hover:bg-gray-400'
                  }`}
                />

                {/* Expand toggle */}
                <span
                  className="text-gray-500 text-xs w-3 cursor-pointer"
                  onClick={() => isConnected && setExpanded((e) => ({ ...e, [conn.id]: !e[conn.id] }))}
                >
                  {isConnected ? (isExpanded ? '▾' : '▸') : ''}
                </span>

                {/* DB type icon */}
                <span className="text-xs flex-shrink-0" title={meta.label}>{meta.icon}</span>

                {/* Name + host */}
                <div className="flex-1 overflow-hidden cursor-pointer" onClick={() => handleConnect(conn)}>
                  <div className="text-xs font-medium text-gray-200 truncate">{conn.name}</div>
                  <div className="text-xs text-gray-500 truncate font-mono">
                    {conn.type === 'mongodb' && conn.uri
                      ? conn.uri.replace(/\/\/.*@/, '//<credentials>@')
                      : `${conn.user ? conn.user + '@' : ''}${conn.host}:${conn.port || (conn.type === 'postgres' ? 5432 : conn.type === 'mongodb' ? 27017 : 3306)}`}
                    {conn.database ? `/${conn.database}` : ''}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                  {isConnected && (
                    <button
                      onClick={() => openQueryTab(conn)}
                      title="New query tab"
                      className="text-xs text-gray-400 hover:text-pm-accent px-1 transition-fast"
                    >
                      ▶
                    </button>
                  )}
                  <button
                    onClick={() => { setEditingConn(conn); setShowModal(true); }}
                    title="Edit"
                    className="text-xs text-gray-400 hover:text-gray-200 px-1 transition-fast"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => removeDbConnection(conn.id)}
                    title="Delete"
                    className="text-xs text-gray-500 hover:text-red-400 px-1 transition-fast"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {isExpanded && isConnected && (
                <div className="ml-2 pb-1">
                  <DbExplorer connection={conn} connected />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <DbConnectionModal
          existing={editingConn}
          onClose={() => { setShowModal(false); setEditingConn(null); }}
        />
      )}
    </div>
  );
}
