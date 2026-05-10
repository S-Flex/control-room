import { useDataRows, useDatatable, type JSONRecord, type JSONValue, type ParamDefinition } from '@s-flex/xfw-data';
import { useQueryParams } from '@s-flex/xfw-url';
import { Select } from '@s-flex/xfw-ui';
import type { Key } from 'react-aria-components';

export type FieldMode = 'edit' | 'readonly';

type InputData = {
  src: string;
  params?: ParamDefinition[];
};

type DropdownListProps = {
  inputData: InputData;
  /** Row field whose value becomes the option's value (e.g. `nest_id`). */
  valueField: string;
  /** Row field whose value becomes the option's display label (e.g. `nest_name`). */
  textField: string;
  value: JSONValue;
  label: string;
  subtitle?: string;
  showLabel?: boolean;
  mode?: FieldMode;
  onChange?: (value: JSONValue) => void;
};

/** Single-select control bound to a remote option list. Two modes:
 *  - **`readonly`** — renders the value as plain text (no fetch).
 *  - **`edit`**     — fetches options from `inputData.src` (with
 *    `useQueryParams`-resolved params) and renders xfw-ui's Select.
 *
 *  URL binding is the caller's job: this control just emits `onChange`
 *  with the option's `valueField` value. */
export function DropdownList({
  inputData,
  valueField,
  textField,
  value,
  label,
  subtitle,
  showLabel = true,
  mode = 'readonly',
  onChange,
}: DropdownListProps) {
  if (mode === 'readonly') {
    const text = value == null ? '—' : String(value);
    if (showLabel && (label || subtitle)) {
      return (
        <div className="field-with-label">
          <span className="field-label">{label}</span>
          <span className="field-value">{text}</span>
        </div>
      );
    }
    return <span className="field-value">{text}</span>;
  }

  return <DropdownListEdit
    inputData={inputData}
    valueField={valueField}
    textField={textField}
    value={value}
    label={label}
    subtitle={subtitle}
    onChange={onChange}
  />;
}

function DropdownListEdit({
  inputData,
  valueField,
  textField,
  value,
  label,
  subtitle,
  onChange,
}: Omit<DropdownListProps, 'mode' | 'showLabel'>) {
  // Resolve the option list's input params from the URL — re-fetches
  // automatically when a relevant URL param changes (e.g. options
  // narrowed by `production_line_id`).
  const inputParams = useQueryParams(inputData.params ?? []);
  const { data: dataTable } = useDatatable(inputData.src);
  const { data: rows } = useDataRows<JSONRecord>(inputData.src, inputParams, {
    enabled: !!dataTable,
  });

  const selectedKey = value == null ? null : String(value);
  const handleSelectionChange = (key: Key | null) => {
    onChange?.(key == null ? null : (key as JSONValue));
  };

  // Edit mode always shows the label (and subtitle when present).
  // The card-/table-style `no_label` flag suppresses the visible label
  // when reading data, but a form/filter input without a label is
  // unusable, so we ignore it here.
  return (
    <div className="form-field">
      {(label || subtitle) && (
        <div className="form-field-label">
          {label && <span className="form-field-label-title">{label}</span>}
          {subtitle && <span className="form-field-label-subtitle">{subtitle}</span>}
        </div>
      )}
      <Select
        size="sm"
        placeholder="—"
        items={rows ?? []}
        idKey={valueField as keyof JSONRecord}
        labelKey={textField as keyof JSONRecord}
        selectedKey={selectedKey}
        onSelectionChange={handleSelectionChange}
        aria-label={label}
      >
        {(item) => (
          <Select.Item
            id={String(item[valueField] ?? '')}
            label={String(item[textField] ?? '')}
          />
        )}
      </Select>
    </div>
  );
}
