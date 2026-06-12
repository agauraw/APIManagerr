import { useState } from 'react';
import { useStore } from '../store';

export default function EnvironmentManager({ onClose }) {
  const { environments, activeEnvId, addEnvironment, updateEnvironment, removeEnvironment, setActiveEnv } = useStore();
  const [selectedId, setSelectedId] = useState(activeEnvId ?? environments[0]?.id ?? null);
  const [newName, setNewName] = useState('');

  const selected = environments.find((e) => e.id === selectedId);

  function handleAddEnv() {
    if (!newName.trim()) return;
    const id = addEnvironment(newName.trim());
    setSelectedId(id);
    setNewName('');
  }

  function updateVar(index, field, value) {
    if (!selected) return;
    const variables = (selected.variables || []).map((v, i) => (i === index ? { ...v, [field]: value } : v));
    const last = variables[variables.length - 1];
    if (last?.key || last?.value) variables.push({ key: '', value: '' });
    updateEnvironment(selected.id, { variables });
  }

  function removeVar(index) {
    if (!selected) return;
    const variables = (selected.variables || []).filter((_, i) => i !== index);
    if (!variables.length) variables.push({ key: '', value: '' });
    updateEnvironment(selected.id, { variables });
  }

  const variables = selected?.variables?.length ? selected.variables : [{ key: '', value: '' }];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-pm-panel border border-pm-border rounded-lg shadow-2xl w-[700px] max-h-[80vh] flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-pm-border">
          <h2 className="text-sm font-semibold text-gray-200">Manage Environments</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar list */}
          <div className="w-48 border-r border-pm-border flex flex-col">
            <div className="p-2 border-b border-pm-border">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddEnv()}
                placeholder="New environment…"
                className="w-full bg-pm-input border border-pm-border rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-pm-accent"
              />
              <button
                onClick={handleAddEnv}
                className="mt-1.5 w-full text-xs bg-pm-accent hover:bg-green-500 text-white rounded py-1 font-medium transition-fast"
              >
                + Add
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {environments.map((env) => (
                <div
                  key={env.id}
                  onClick={() => setSelectedId(env.id)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer group ${
                    selectedId === env.id ? 'bg-pm-hover text-gray-200' : 'text-gray-400 hover:bg-pm-hover/50'
                  }`}
                >
                  <span className="text-xs truncate">{env.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeEnvironment(env.id);
                      if (selectedId === env.id) setSelectedId(null);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {environments.length === 0 && (
                <div className="text-center text-gray-600 text-xs mt-4">No environments</div>
              )}
            </div>
          </div>

          {/* Variable editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selected ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-pm-border">
                  <span className="text-xs font-medium text-gray-300">{selected.name}</span>
                  <button
                    onClick={() => {
                      setActiveEnv(activeEnvId === selected.id ? null : selected.id);
                    }}
                    className={`text-xs px-3 py-1 rounded transition-fast ${
                      activeEnvId === selected.id
                        ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400'
                        : 'bg-pm-accent/20 text-pm-accent hover:bg-pm-accent/30'
                    }`}
                  >
                    {activeEnvId === selected.id ? 'Active (click to deactivate)' : 'Set Active'}
                  </button>
                </div>

                {/* Variable table */}
                <div className="flex-1 overflow-y-auto">
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-pm-border text-xs text-gray-500 font-medium">
                    <div className="flex-1">Variable</div>
                    <div className="flex-1">Value</div>
                    <div className="w-6" />
                  </div>
                  {variables.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-1 border-b border-pm-border/30 group hover:bg-pm-hover/30">
                      <input
                        type="text"
                        value={v.key}
                        onChange={(e) => updateVar(i, 'key', e.target.value)}
                        placeholder="variable_name"
                        className="flex-1 bg-transparent text-xs text-gray-300 font-mono outline-none placeholder-gray-600"
                      />
                      <input
                        type="text"
                        value={v.value}
                        onChange={(e) => updateVar(i, 'value', e.target.value)}
                        placeholder="value"
                        className="flex-1 bg-transparent text-xs text-gray-300 font-mono outline-none placeholder-gray-600"
                      />
                      <button
                        onClick={() => removeVar(i)}
                        className="w-6 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs transition-fast"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                Select or create an environment
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-pm-border">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-300 hover:text-white transition-fast">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
