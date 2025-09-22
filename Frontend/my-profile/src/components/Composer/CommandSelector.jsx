export default function CommandSelector({ commands = [], value = '', onChange }) {
  if (!commands.length) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className="h-10 bg-white border rounded-md px-2 text-gray-700 max-w-[220px] truncate"
      title={value ? (commands.find(c => c.cmd === value)?.desc || '') : 'Select a command'}
      aria-label="Command selector"
    >
      <option value="">Command…</option>
      {commands.map((c, idx) => (
        <option key={`${c.cmd}-${idx}`} value={c.cmd} title={c.desc || ''}>
          {c.cmd}
        </option>
      ))}
    </select>
  );
}

