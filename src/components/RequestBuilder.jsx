import { useState } from 'react';
import { useStore } from '../store';
import { buildRequestConfig } from '../utils/applyEnv';
import KeyValueEditor from './KeyValueEditor';
import SaveRequestModal from './SaveRequestModal';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const METHOD_COLORS = {
  GET: 'text-blue-400',
  POST: 'text-green-400',
  PUT: 'text-yellow-400',
  DELETE: 'text-red-400',
  PATCH: 'text-teal-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-blue-300',
};

const CONFIG_TABS = ['Params', 'Authorization', 'Headers', 'Body'];

export default function RequestBuilder() {
  const [activeConfigTab, setActiveConfigTab] = useState('Params');
  const [showSaveModal, setShowSaveModal] = useState(false);

  const store = useStore();
  const activeTab = store.tabs.find((t) => t.id === (store.activeTabId ?? store.tabs[0]?.id));
  if (!activeTab) return null;

  const { id, name: tabName, request, loading } = activeTab;
  const req = request;

  const update = (patch) => store.updateRequest(id, patch);

  async function sendRequest() {
    if (!req.url.trim()) return;
    store.setLoading(id, true);
    store.updateTab(id, { name: req.url.split('?')[0].split('/').pop() || req.method });

    const env = store.environments.find((e) => e.id === store.activeEnvId) ?? null;
    const config = buildRequestConfig(req, env);

    let response;
    if (window.electronAPI) {
      response = await window.electronAPI.sendRequest(config);
    } else {
      // Fallback for browser dev (limited by CORS)
      response = await browserFetch(config);
    }

    store.setResponse(id, response);
    store.addToHistory({ request: req, response });
  }

  return (
    <div className="flex flex-col border-b border-pm-border bg-pm-panel" style={{ height: '290px', flexShrink: 0 }}>
      {/* URL Bar */}
      <div className="flex items-center gap-2 p-2 border-b border-pm-border">
        {/* Method selector */}
        <select
          value={req.method}
          onChange={(e) => update({ method: e.target.value })}
          className={`bg-pm-input border border-pm-border rounded px-2 py-1.5 text-xs font-mono font-bold outline-none focus:border-pm-accent ${
            METHOD_COLORS[req.method] || 'text-gray-300'
          }`}
        >
          {METHODS.map((m) => (
            <option key={m} value={m} className={METHOD_COLORS[m]}>
              {m}
            </option>
          ))}
        </select>

        {/* URL input */}
        <input
          type="text"
          value={req.url}
          onChange={(e) => update({ url: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && sendRequest()}
          placeholder="Enter request URL..."
          className="flex-1 bg-pm-input border border-pm-border rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-pm-accent font-mono"
        />

        {/* Save button */}
        <button
          onClick={() => setShowSaveModal(true)}
          title="Save request to a collection"
          className="px-3 py-1.5 bg-pm-hover hover:bg-pm-border text-gray-300 hover:text-white text-sm rounded transition-fast flex-shrink-0 border border-pm-border"
        >
          Save
        </button>

        {/* Send button */}
        <button
          onClick={sendRequest}
          disabled={loading || !req.url.trim()}
          className="px-5 py-1.5 bg-pm-accent hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded transition-fast flex-shrink-0"
        >
          {loading ? 'Sending…' : 'Send'}
        </button>
      </div>

      {showSaveModal && (
        <SaveRequestModal
          request={req}
          tabName={tabName}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      {/* Config tab bar */}
      <div className="flex border-b border-pm-border flex-shrink-0">
        {CONFIG_TABS.map((tab) => {
          const badge = getBadgeCount(tab, req);
          return (
            <button
              key={tab}
              onClick={() => setActiveConfigTab(tab)}
              className={`px-4 py-2 text-xs font-medium transition-fast relative ${
                activeConfigTab === tab
                  ? 'text-pm-accent border-b-2 border-pm-accent'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab}
              {badge > 0 && (
                <span className="ml-1 bg-pm-accent text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Config panels */}
      <div className="flex-1 overflow-y-auto">
        {activeConfigTab === 'Params' && (
          <KeyValueEditor
            rows={req.params}
            onChange={(params) => update({ params })}
            keyPlaceholder="Parameter"
          />
        )}

        {activeConfigTab === 'Headers' && (
          <KeyValueEditor
            rows={req.headers}
            onChange={(headers) => update({ headers })}
          />
        )}

        {activeConfigTab === 'Authorization' && (
          <AuthPanel auth={req.auth} onChange={(auth) => update({ auth })} />
        )}

        {activeConfigTab === 'Body' && (
          <BodyPanel req={req} update={update} />
        )}
      </div>
    </div>
  );
}

function getBadgeCount(tab, req) {
  if (tab === 'Params') return req.params?.filter((p) => p.key && p.enabled).length || 0;
  if (tab === 'Headers') return req.headers?.filter((h) => h.key && h.enabled).length || 0;
  if (tab === 'Authorization') return req.auth?.type !== 'none' ? 1 : 0;
  if (tab === 'Body') return req.bodyType !== 'none' ? 1 : 0;
  return 0;
}

function AuthPanel({ auth, onChange }) {
  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 w-16 flex-shrink-0">Type</label>
        <select
          value={auth.type}
          onChange={(e) => onChange({ ...auth, type: e.target.value })}
          className="bg-pm-input border border-pm-border rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-pm-accent"
        >
          <option value="none">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="apikey">API Key</option>
        </select>
      </div>

      {auth.type === 'bearer' && (
        <LabeledInput label="Token" value={auth.token} placeholder="Bearer token" onChange={(v) => onChange({ ...auth, token: v })} />
      )}

      {auth.type === 'basic' && (
        <>
          <LabeledInput label="Username" value={auth.username} onChange={(v) => onChange({ ...auth, username: v })} />
          <LabeledInput label="Password" value={auth.password} type="password" onChange={(v) => onChange({ ...auth, password: v })} />
        </>
      )}

      {auth.type === 'apikey' && (
        <>
          <LabeledInput label="Key" value={auth.key} placeholder="X-API-Key" onChange={(v) => onChange({ ...auth, key: v })} />
          <LabeledInput label="Value" value={auth.value} onChange={(v) => onChange({ ...auth, value: v })} />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-16 flex-shrink-0">Add to</label>
            <select
              value={auth.in}
              onChange={(e) => onChange({ ...auth, in: e.target.value })}
              className="bg-pm-input border border-pm-border rounded px-2 py-1 text-xs text-gray-300 outline-none"
            >
              <option value="header">Header</option>
              <option value="query">Query Param</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-400 w-16 flex-shrink-0">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-pm-input border border-pm-border rounded px-2 py-1 text-xs text-gray-300 font-mono outline-none focus:border-pm-accent"
      />
    </div>
  );
}

function BodyPanel({ req, update }) {
  const BODY_TYPES = [
    { value: 'none', label: 'None' },
    { value: 'json', label: 'JSON' },
    { value: 'raw', label: 'Raw' },
    { value: 'form', label: 'Form URL-encoded' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Body type selector */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-pm-border">
        {BODY_TYPES.map((bt) => (
          <label key={bt.value} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="bodyType"
              value={bt.value}
              checked={req.bodyType === bt.value}
              onChange={() => update({ bodyType: bt.value })}
              className="accent-pm-accent"
            />
            <span className="text-xs text-gray-300">{bt.label}</span>
          </label>
        ))}
      </div>

      {/* Body editor */}
      {req.bodyType === 'none' && (
        <div className="text-center text-gray-500 text-xs mt-6">This request has no body</div>
      )}

      {(req.bodyType === 'json' || req.bodyType === 'raw') && (
        <textarea
          value={req.bodyRaw}
          onChange={(e) => update({ bodyRaw: e.target.value })}
          placeholder={req.bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Request body...'}
          spellCheck={false}
          className="flex-1 bg-transparent text-gray-300 placeholder-gray-600 font-mono text-xs outline-none resize-none p-3"
        />
      )}

      {req.bodyType === 'form' && (
        <KeyValueEditor
          rows={req.bodyForm}
          onChange={(bodyForm) => update({ bodyForm })}
          keyPlaceholder="Key"
          valuePlaceholder="Value"
        />
      )}
    </div>
  );
}

// Browser fallback (CORS-limited)
async function browserFetch(config) {
  const start = Date.now();
  try {
    const url = new URL(config.url);
    Object.entries(config.params || {}).forEach(([k, v]) => url.searchParams.append(k, v));

    const init = { method: config.method, headers: config.headers };
    if (config.body && config.bodyType !== 'none') init.body = config.body;

    const res = await fetch(url.toString(), init);
    const text = await res.text();
    const headers = {};
    res.headers.forEach((v, k) => (headers[k] = v));

    return {
      status: res.status,
      statusText: res.statusText,
      headers,
      data: text,
      time: Date.now() - start,
      size: new TextEncoder().encode(text).length,
      error: null,
    };
  } catch (err) {
    return { status: 0, statusText: 'Error', headers: {}, data: null, time: Date.now() - start, size: 0, error: err.message };
  }
}
