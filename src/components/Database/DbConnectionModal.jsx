import { useState } from 'react';
import { useStore } from '../../store';

const DB_TYPES = [
  { value: 'mysql',    label: 'MySQL',      icon: '🐬', defaultPort: '3306', defaultUser: 'root' },
  { value: 'postgres', label: 'PostgreSQL', icon: '🐘', defaultPort: '5432', defaultUser: 'postgres' },
  { value: 'mongodb',  label: 'MongoDB',    icon: '🍃', defaultPort: '27017', defaultUser: '' },
];

const DEFAULTS = { name: '', type: 'mysql', host: '127.0.0.1', port: '3306', user: 'root', password: '', database: '', uri: '' };

export default function DbConnectionModal({ existing, onClose }) {
  const [form, setForm] = useState(existing ? { uri: '', ...existing } : { ...DEFAULTS });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const { addDbConnection, updateDbConnection } = useStore();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function handleTypeChange(newType) {
    const meta = DB_TYPES.find((t) => t.value === newType);
    setForm((f) => ({
      ...f,
      type: newType,
      port: meta?.defaultPort ?? f.port,
      user: f.user === '' || DB_TYPES.some((t) => t.defaultUser === f.user) ? (meta?.defaultUser ?? '') : f.user,
    }));
    setTestResult(null);
  }

  function getIpc() {
    if (form.type === 'postgres') return window.electronAPI?.pg;
    if (form.type === 'mongodb') return window.electronAPI?.mongo;
    return window.electronAPI?.db;
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const res = await getIpc()?.testConnection(form);
    setTestResult(res ?? { success: false, error: 'Electron API not available' });
    setTesting(false);
  }

  function handleSave() {
    const isValid = form.name.trim() && (
      form.type === 'mongodb'
        ? (form.uri.trim() || form.host.trim())
        : (form.host.trim() && form.user.trim())
    );
    if (!isValid) return;
    if (existing) {
      updateDbConnection(existing.id, form);
    } else {
      addDbConnection(form);
    }
    onClose();
  }

  const isMongo = form.type === 'mongodb';
  const typeMeta = DB_TYPES.find((t) => t.value === form.type) ?? DB_TYPES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-pm-panel border border-pm-border rounded-lg shadow-2xl w-[460px] z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-pm-border">
          <div className="flex items-center gap-2">
            <span className="text-lg">{typeMeta.icon}</span>
            <h2 className="text-sm font-semibold text-gray-200">
              {existing ? 'Edit Connection' : 'New Database Connection'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Form */}
        <div className="p-5 flex flex-col gap-3">
          {/* Database type selector */}
          <div className="flex gap-1.5">
            {DB_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => handleTypeChange(t.value)}
                disabled={!!existing}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded border transition-fast ${
                  form.type === t.value
                    ? 'bg-pm-accent/20 border-pm-accent text-pm-accent'
                    : 'bg-pm-hover border-pm-border text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>

          <Field label="Connection Name" required>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={`My ${typeMeta.label}`}
              className={inputCls}
            />
          </Field>

          {/* MongoDB: optional URI shortcut */}
          {isMongo && (
            <Field label="Connection URI" hint="optional — overrides fields below">
              <input
                value={form.uri}
                onChange={(e) => set('uri', e.target.value)}
                placeholder="mongodb://user:pass@host:27017/database"
                className={inputCls}
              />
            </Field>
          )}

          <div className="flex gap-3">
            <Field label="Host" className="flex-1" required={!isMongo}>
              <input
                value={form.host}
                onChange={(e) => set('host', e.target.value)}
                placeholder="127.0.0.1"
                className={inputCls}
              />
            </Field>
            <Field label="Port" className="w-24">
              <input
                value={form.port}
                onChange={(e) => set('port', e.target.value)}
                placeholder={typeMeta.defaultPort}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="flex gap-3">
            <Field label="Username" className="flex-1" required={!isMongo}>
              <input
                value={form.user}
                onChange={(e) => set('user', e.target.value)}
                placeholder={typeMeta.defaultUser || 'username'}
                className={inputCls}
              />
            </Field>
            <Field label="Password" className="flex-1">
              <input
                type="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="••••••••"
                className={inputCls}
              />
            </Field>
          </div>

          <Field
            label={isMongo ? 'Auth Database' : form.type === 'postgres' ? 'Database' : 'Default Database'}
            hint={form.type === 'postgres' ? 'required' : 'optional'}
            required={form.type === 'postgres'}
          >
            <input
              value={form.database}
              onChange={(e) => set('database', e.target.value)}
              placeholder={form.type === 'postgres' ? 'postgres' : form.type === 'mongodb' ? 'admin' : 'my_database'}
              className={inputCls}
            />
          </Field>

          {/* Test result */}
          {testResult && (
            <div className={`text-xs rounded px-3 py-2 ${
              testResult.success
                ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}>
              {testResult.success ? `✓ Connected to ${typeMeta.label} successfully` : `✗ ${testResult.error}`}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-pm-border">
          <button
            onClick={handleTest}
            disabled={testing}
            className="text-xs px-4 py-1.5 bg-pm-hover border border-pm-border text-gray-300 hover:text-white rounded transition-fast disabled:opacity-40"
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs px-4 py-1.5 text-gray-400 hover:text-white transition-fast">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="text-xs px-5 py-1.5 bg-pm-accent hover:bg-green-500 text-white rounded font-medium transition-fast"
            >
              {existing ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-pm-input border border-pm-border rounded px-2 py-1.5 text-xs text-gray-300 font-mono outline-none focus:border-pm-accent';

function Field({ label, children, className = '', required, hint }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs text-gray-400 font-medium">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="text-gray-600 ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
