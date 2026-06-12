// Reusable key-value table editor (params, headers, form body)

export default function KeyValueEditor({ rows, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }) {
  function update(index, field, value) {
    const next = rows.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    // Auto-add empty row at end
    const last = next[next.length - 1];
    if (last && (last.key || last.value)) {
      next.push({ key: '', value: '', enabled: true });
    }
    onChange(next);
  }

  function remove(index) {
    const next = rows.filter((_, i) => i !== index);
    if (!next.length) next.push({ key: '', value: '', enabled: true });
    onChange(next);
  }

  return (
    <div className="flex flex-col text-xs">
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-pm-border text-gray-500 font-medium">
        <div className="w-5 flex-shrink-0" />
        <div className="flex-1">{keyPlaceholder}</div>
        <div className="flex-1">{valuePlaceholder}</div>
        <div className="w-6 flex-shrink-0" />
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div
          key={i}
          className={`flex items-center gap-1 px-2 py-0.5 border-b border-pm-border/30 hover:bg-pm-hover/50 group ${
            !row.enabled ? 'opacity-50' : ''
          }`}
        >
          {/* Enable checkbox */}
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => update(i, 'enabled', e.target.checked)}
            className="w-4 h-4 accent-pm-accent flex-shrink-0 cursor-pointer"
          />

          {/* Key */}
          <input
            type="text"
            value={row.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            className="flex-1 bg-transparent text-gray-300 placeholder-gray-600 outline-none py-1 font-mono text-xs"
          />

          {/* Value */}
          <input
            type="text"
            value={row.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            className="flex-1 bg-transparent text-gray-300 placeholder-gray-600 outline-none py-1 font-mono text-xs"
          />

          {/* Delete */}
          <button
            onClick={() => remove(i)}
            className="w-6 h-6 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 flex-shrink-0 transition-fast flex items-center justify-center rounded"
            title="Remove row"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
