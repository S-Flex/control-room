import type { ChangeEvent } from 'react';
import { useDataRows, useDatatable, type JSONRecord } from '@s-flex/xfw-data';
import { useQueryParams } from '@s-flex/xfw-url';
import type { DataGroup, FieldConfig } from '@s-flex/xfw-ui';
import { getLanguage } from 'xfw-get-block';
import { syncQueryParams } from '../lib/urlSync';

/** Form / filter widget. The data_group's `layout` of `form` or `filter`
 *  routes here (they're aliases — same component). Each entry in
 *  `field_config` becomes a labelled input. The widget itself doesn't
 *  consume the data_group's row data; each input fetches its own
 *  options if the field declares `ui.input_data`. */

type InputData = {
  src: string;
  label_key: string;
  value_key: string;
};

type FormFieldUi = {
  i18n?: Record<string, { title?: string }>;
  order?: number;
  control?: string;
  no_label?: boolean;
  hidden?: boolean;
  input_data?: InputData;
};

function getLabel(ui: FormFieldUi | undefined, key: string, lang: string): string {
  const i18n = ui?.i18n;
  return i18n?.[lang]?.title
    ?? i18n?.[Object.keys(i18n ?? {})[0] ?? '']?.title
    ?? key.replace(/_/g, ' ');
}

function DropdownListField({
  fieldKey,
  ui,
  lang,
}: {
  fieldKey: string;
  ui: FormFieldUi;
  lang: string;
}) {
  const input = ui.input_data!;
  // Fetch the option list. `useDatatable` gates the row fetch — the
  // schema must arrive first so xfw-data knows what params (if any) are
  // mandatory. With no params declared, we fetch immediately.
  const { data: dataTable } = useDatatable(input.src);
  const { data: rows } = useDataRows<JSONRecord>(input.src, [], {
    enabled: !!dataTable,
  });

  const params = useQueryParams([
    { key: input.value_key, is_query_param: true, is_optional: true },
  ]);
  const currentVal = params.find(p => p.key === input.value_key)?.val;
  const currentStr = currentVal == null ? '' : String(currentVal);

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    syncQueryParams({ [input.value_key]: v === '' ? null : v });
  };

  const label = getLabel(ui, fieldKey, lang);

  return (
    <div className="form-field">
      {!ui.no_label && <label className="form-field-label">{label}</label>}
      <select
        className="form-field-select"
        value={currentStr}
        onChange={handleChange}
        aria-label={label}
      >
        <option value="">—</option>
        {(rows ?? []).map((row, i) => {
          const v = row[input.value_key];
          const t = row[input.label_key];
          return (
            <option key={`${String(v)}-${i}`} value={String(v ?? '')}>
              {String(t ?? '')}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export function Form({ dataGroup }: { dataGroup: DataGroup }) {
  const lang = getLanguage();
  const fieldConfig = dataGroup.field_config as Record<string, FieldConfig> | undefined;
  if (!fieldConfig) return null;

  const entries = Object.entries(fieldConfig)
    .map(([key, fc]) => [key, fc.ui as FormFieldUi | undefined] as const)
    .filter(([, ui]) => !ui?.hidden)
    .sort(([, a], [, b]) => (a?.order ?? 999) - (b?.order ?? 999));

  return (
    <div className="form-widget">
      {entries.map(([key, ui]) => {
        if (!ui) return null;
        if (ui.control === 'dropdown-list' && ui.input_data) {
          return <DropdownListField key={key} fieldKey={key} ui={ui} lang={lang} />;
        }
        // Other field controls (text, date, checkbox, …) plug in here
        // as they're added.
        return null;
      })}
    </div>
  );
}
