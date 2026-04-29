import { useNavItemAction, type DataGroup, type NavItem } from '@s-flex/xfw-ui';
import type { DataTable, JSONRecord } from '@s-flex/xfw-data';
import { getLanguage } from 'xfw-get-block';
import { resolve } from './resolve';
import { Badge } from '../controls/Badge';

/** `status_bar_config` shape — every key is optional, defaults match the
 *  documented `status_json` shape (groups → items). Overrideable so the
 *  component never hardcodes column names. */
type StatusBarConfig = {
  /** Column on the row that holds the array of groups. Default `status_json`. */
  data_field?: string;
  /** Key on each group that holds the i18n title object. Default `i18n`. */
  group_label?: string;
  /** Key on each group that holds the NavItem opened by clicking the label.
   *  Default `nav`. */
  group_nav?: string;
  items?: {
    /** Key on each group that holds the array of items. Default `data`. */
    data_field?: string;
    /** Key on each item that holds the i18n title object. Default `i18n`. */
    label_field?: string;
    /** Key on each item that holds the displayed value. Default `value`. */
    value_field?: string;
    /** Key on each item that, when present, supplies the badge background
     *  color. Default `color`. */
    color_field?: string;
  };
};

/** Resolve `{ nl: { title }, en: { title }, … }` to a single string for the
 *  active language, falling back to the first locale present. */
function localize(i18n: unknown, lang: string): string {
  if (!i18n || typeof i18n !== 'object') return '';
  const map = i18n as Record<string, Record<string, string> | undefined>;
  const entry = map[lang] ?? map[Object.keys(map)[0]];
  return entry?.title ?? entry?.text ?? '';
}

export function StatusBar({ widgetConfig, dataGroup, data }: {
  widgetConfig: Record<string, unknown>;
  dataGroup: DataGroup;
  data: JSONRecord[];
  /** Reserved for caller compatibility — not used (data is parsed from the row). */
  dataTable?: DataTable;
}) {
  const navAction = useNavItemAction();
  if (!data || data.length === 0) return null;

  const cfg = (
    widgetConfig.status_bar_config ??
    (dataGroup as unknown as Record<string, unknown>).status_bar_config ??
    widgetConfig
  ) as StatusBarConfig;

  const dataField     = cfg.data_field          ?? 'status_json';
  const groupLabelKey = cfg.group_label         ?? 'i18n';
  const groupNavKey   = cfg.group_nav           ?? 'nav';
  const itemsField    = cfg.items?.data_field   ?? 'data';
  const itemLabelKey  = cfg.items?.label_field  ?? 'i18n';
  const itemValueKey  = cfg.items?.value_field  ?? 'value';
  const itemColorKey  = cfg.items?.color_field  ?? 'color';

  const row = data[0];
  const groups = resolve(row, dataField);
  if (!Array.isArray(groups) || groups.length === 0) return null;

  const lang = getLanguage();

  // Per-item label visibility and ordering come from the data group's root
  // `field_config`, keyed by `item.code`. Same shape as Cards/Item:
  //   field_config.no_label                — group-level default
  //   field_config[code].ui.no_label       — per-item override
  //   field_config[code].ui.order          — per-item sort order
  const fieldConfig = (dataGroup as unknown as {
    field_config?: Record<string, { ui?: { no_label?: boolean; order?: number } } | boolean | undefined>;
  }).field_config;
  const groupNoLabel = (fieldConfig as Record<string, unknown> | undefined)?.no_label as boolean | undefined;
  const fieldEntry = (code: string | undefined) =>
    code ? (fieldConfig?.[code] as { ui?: { no_label?: boolean; order?: number } } | undefined) : undefined;
  const showLabelFor = (code: string | undefined): boolean => {
    const fieldNoLabel = fieldEntry(code)?.ui?.no_label;
    return !(fieldNoLabel ?? groupNoLabel);
  };
  const orderFor = (code: string | undefined): number =>
    fieldEntry(code)?.ui?.order ?? 999;

  return (
    <div className="statusbar">
      {groups.map((group, gi) => {
        const g = (group ?? {}) as JSONRecord;
        const label = localize(g[groupLabelKey], lang);
        const nav = g[groupNavKey] as NavItem | undefined;
        const itemsRaw = g[itemsField];
        const itemsAll = (Array.isArray(itemsRaw) ? itemsRaw : []) as JSONRecord[];
        const items = itemsAll
          .map((item, idx) => ({ item, idx }))
          .sort((a, b) => {
            const ao = orderFor(a.item?.code as string | undefined);
            const bo = orderFor(b.item?.code as string | undefined);
            return ao !== bo ? ao - bo : a.idx - b.idx;
          })
          .map(e => e.item);
        const groupKey = (g.code as string | undefined) ?? `g-${gi}`;

        const labelEl = label
          ? nav
            ? <button type="button" className="statusbar-label" onClick={() => navAction(row, nav, true)}>{label}</button>
            : <span className="statusbar-label">{label}</span>
          : null;

        return (
          <div key={groupKey} className="statusbar-group">
            {labelEl}
            <div className="statusbar-items">
              {items.map((item, ii) => {
                const it = (item ?? {}) as JSONRecord;
                const itLabel = localize(it[itemLabelKey], lang);
                const value = it[itemValueKey];
                const color = it[itemColorKey] as string | undefined;
                const code = it.code as string | undefined;
                const itemKey = code ?? `i-${ii}`;
                return (
                  <Badge
                    key={itemKey}
                    value={value ?? ''}
                    label={itLabel || undefined}
                    showLabel={showLabelFor(code)}
                    color={color}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
