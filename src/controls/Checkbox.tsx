import type { JSONValue } from '@s-flex/xfw-data';

type CheckboxProps = {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
};

export function Checkbox({ checked, indeterminate, onChange }: CheckboxProps) {
  return (
    <button
      className={`check-dot${checked ? ' checked' : ''}${indeterminate ? ' indeterminate' : ''}`}
      onClick={onChange}
      type="button"
    >
      {checked && (
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
          <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {indeterminate && !checked && (
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
          <path d="M2.5 5H7.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

/** Get checked state for a group of rows using the `checked` property on each row. */
export function useGroupCheck(rows: Record<string, JSONValue>[]) {
  const allChecked = rows.length > 0 && rows.every(r => r.checked);
  const someChecked = rows.some(r => r.checked);
  return { allChecked, someChecked };
}
