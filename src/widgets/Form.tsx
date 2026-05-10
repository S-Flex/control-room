import { useQueryParams } from '@s-flex/xfw-url';
import type { JSONValue, ParamDefinition } from '@s-flex/xfw-data';
import type { DataGroup, FieldConfig, ResolvedField } from '@s-flex/xfw-ui';
import { Field } from '../controls/Field';
import { syncQueryParams } from '../lib/urlSync';

/** Form / filter widget. The data_group's `layout` of `form` or `filter`
 *  routes here (they're aliases). The widget is purely a layout
 *  container: each visible entry in `field_config` becomes a
 *  `<Field mode="edit">`. Per-control rendering (dropdown-list, text,
 *  date, …) lives in the matching control file under `src/controls/`. */
export function Form({ dataGroup }: { dataGroup: DataGroup }) {
  const fc = dataGroup.field_config as Record<string, FieldConfig> | undefined;
  if (!fc) return null;
  const params = ((dataGroup as { params?: ParamDefinition[] }).params ?? []) as ParamDefinition[];

  const visible = Object.entries(fc)
    .map(([key, cfg]) => [key, cfg.ui as Record<string, unknown> | undefined] as const)
    .filter(([, ui]) => !ui?.hidden)
    .sort(([, a], [, b]) =>
      ((a?.order as number | undefined) ?? 999) - ((b?.order as number | undefined) ?? 999),
    );

  return (
    <div className="form-widget">
      {visible.map(([key, ui]) => (
        <FormFieldEntry key={key} fieldKey={key} ui={ui ?? {}} dataGroupParams={params} />
      ))}
    </div>
  );
}

/** Resolve which URL query-param a form field writes to:
 *  - explicit `ui.query_param_field` wins;
 *  - otherwise, if the data_group's `params` list declares a param
 *    matching `input_data.value_field`, that name is used;
 *  - otherwise the field has no URL binding (`null`). */
function resolveQueryKey(
  ui: Record<string, unknown>,
  dataGroupParams: ParamDefinition[],
): string | null {
  const explicit = ui.query_param_field;
  if (typeof explicit === 'string' && explicit) return explicit;
  const valueField = (ui.input_data as { value_field?: string } | undefined)?.value_field;
  const candidate = (typeof valueField === 'string' && valueField) || null;
  if (candidate && dataGroupParams.some(p => p.key === candidate)) {
    return candidate;
  }
  return null;
}

function FormFieldEntry({
  fieldKey,
  ui,
  dataGroupParams,
}: {
  fieldKey: string;
  ui: Record<string, unknown>;
  dataGroupParams: ParamDefinition[];
}) {
  const queryKey = resolveQueryKey(ui, dataGroupParams);
  const queryParams = useQueryParams(
    queryKey ? [{ key: queryKey, is_query_param: true, is_optional: true }] : [],
  );
  const value = queryKey
    ? (queryParams.find(p => p.key === queryKey)?.val ?? null) as JSONValue
    : null;

  const handleChange = queryKey
    ? (v: JSONValue) => syncQueryParams({ [queryKey]: v == null ? null : String(v) })
    : undefined;

  // Field expects a ResolvedField — synthesise one from the field-config UI.
  // `value_field` / `text_field` live inside `input_data` and are read
  // by the dropdown-list dispatcher in <Field>.
  const field = {
    key: fieldKey,
    control: ui.control as string | undefined,
    i18n: ui.i18n,
    input_data: ui.input_data,
    no_label: ui.no_label,
  } as ResolvedField & { no_label?: boolean };

  return <Field field={field} value={value} mode="edit" onChange={handleChange} />;
}
