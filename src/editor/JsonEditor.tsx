import { useEffect, useState } from 'react';

export function JsonEditor<T>({ value, onChange, label }: {
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  // External updates (e.g. visual editor changes) — re-sync the textarea, but
  // only if the parsed text doesn't already match (avoids stomping while user types).
  useEffect(() => {
    try {
      if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(value)) {
        setText(JSON.stringify(value, null, 2));
        setError(null);
      }
    } catch {
      // current text is invalid; do nothing — user will fix or re-format
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(next: string) {
    setText(next);
    try {
      const parsed = JSON.parse(next);
      setError(null);
      onChange(parsed as T);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(text);
      setText(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="dge-section">
      <div className="dge-section-header">
        <h3 className="dge-section-title">{label}</h3>
        <div className="dge-json-actions">
          <button type="button" onClick={handleFormat}>Format</button>
          <button type="button" onClick={handleCopy}>Copy</button>
        </div>
      </div>
      <textarea
        className="dge-json-textarea"
        value={text}
        onChange={e => handleChange(e.target.value)}
        spellCheck={false}
      />
      {error && <p className="dge-json-error">{error}</p>}
    </div>
  );
}
