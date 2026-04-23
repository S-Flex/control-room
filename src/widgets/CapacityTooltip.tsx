import type { JSONRecord } from '@s-flex/xfw-data';
import { FieldTooltip, type TooltipConfig, type TooltipFieldConfigEntry } from '../controls/FieldTooltip';
import type { OverviewRow } from '../hooks/useProductionLineOverview';

/** Used when the backend hasn't (yet) exposed a tooltip config: pick any
 *  `capacity_*` field present on the overview row, in a sensible order. Keeps
 *  the toggle useful before the data group is fully wired. */
function deriveTooltipConfig(row: Record<string, unknown>): TooltipConfig | undefined {
  const order = ['capacity_sqm_per_day', 'capacity_reserved_sqm', 'capacity_left'];
  const fields: Record<string, TooltipFieldConfigEntry> = {};
  let i = 0;
  for (const key of order) {
    if (row[key] != null && row[key] !== '') {
      fields[key] = { ui: { order: i++ } };
    }
  }
  for (const key of Object.keys(row)) {
    if (key.startsWith('capacity_') && !fields[key] && row[key] != null && row[key] !== '') {
      fields[key] = { ui: { order: i++ } };
    }
  }
  if (Object.keys(fields).length === 0) return undefined;
  return { field_config: fields };
}

type CapacityTooltipProps = {
  /** Object data emitted by the 3D scene's renderLabel callback (carries `name`, `type`). */
  objectData: Record<string, unknown>;
  /** When false the wrapper renders nothing — drives the capacity toggle behaviour. */
  show: boolean;
  /** layout_name → overview row, from useProductionLineOverview(). */
  overviewMap: Map<string, OverviewRow>;
  /** From production_line_overview's `three_d_config.tooltip` — defines fields + hidden_when. */
  tooltipConfig?: TooltipConfig;
  /** From production_line_overview's `field_config` — supplies labels/controls. */
  fieldConfig?: Record<string, TooltipFieldConfigEntry>;
  /** Optional schema field used as the tooltip header. */
  titleField?: string;
};

/** Anchored to a 3D object via the parent's <Html> in xfw-three; renders a generic
 *  FieldTooltip inline so the 3D scene controls placement. Show/hide is purely
 *  driven by the `show` prop and FieldTooltip's own hidden_when / empty-content checks. */
export function CapacityTooltip({
  objectData,
  show,
  overviewMap,
  tooltipConfig,
  fieldConfig,
  titleField,
}: CapacityTooltipProps) {
  if (!show) return null;
  if (objectData.type === 'stock' || objectData.type === 'queue') return null;

  // `objectData` is a `resourceData` entry from ProductionLinesPage — keyed by
  // `layout_name`. (The earlier `name` lookup was a left-over from the popover
  // path, which gets the raw 3D mesh node name.)
  const nameField = objectData.name as string | undefined;
  const layoutFromName = nameField?.includes('_') ? nameField.split('_').slice(1).join('_') : nameField;
  const layoutKey = (objectData.layout_name as string | undefined) ?? layoutFromName;
  const overviewRow = layoutKey ? overviewMap.get(layoutKey) : undefined;
  if (!overviewRow) return null;

  const rowRecord = overviewRow as unknown as Record<string, unknown>;
  const effectiveConfig = tooltipConfig ?? deriveTooltipConfig(rowRecord);
  if (!effectiveConfig) return null;

  return (
    <FieldTooltip
      inline
      row={rowRecord as JSONRecord}
      tooltipConfig={effectiveConfig}
      fieldConfig={fieldConfig}
      titleField={titleField}
      className="capacity-tooltip"
    />
  );
}
