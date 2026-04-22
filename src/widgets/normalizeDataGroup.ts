import type { DataGroup } from '@s-flex/xfw-ui';

type AnyRecord = Record<string, unknown>;

/** Shallow-merge two field_config entries: top-level properties from
 *  `override` win; `ui` is union-merged with override keys winning. */
function mergeEntry(base: AnyRecord, override: AnyRecord): AnyRecord {
  const baseUi = (base.ui ?? {}) as AnyRecord;
  const overUi = (override.ui ?? {}) as AnyRecord;
  return { ...base, ...override, ui: { ...baseUi, ...overUi } };
}

/** For every key in a local field_config, merge it with the matching entry
 *  from the root field_config (root supplies defaults; local overrides). */
function mergeWithRoot(local: AnyRecord, root: AnyRecord): AnyRecord {
  const merged: AnyRecord = {};
  for (const [key, val] of Object.entries(local)) {
    const rootEntry = root[key];
    const localIsObj = val != null && typeof val === 'object' && !Array.isArray(val);
    const rootIsObj = rootEntry != null && typeof rootEntry === 'object' && !Array.isArray(rootEntry);
    if (localIsObj && rootIsObj) {
      merged[key] = mergeEntry(rootEntry as AnyRecord, val as AnyRecord);
    } else {
      merged[key] = val ?? rootEntry;
    }
  }
  return merged;
}

/** Recursively walk `node`; whenever we hit a `field_config` object, merge
 *  every entry with the root. The root itself is not touched. */
function walkAndMerge(node: unknown, root: AnyRecord): unknown {
  if (node == null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(item => walkAndMerge(item, root));
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(node as AnyRecord)) {
    if (k === 'field_config' && v != null && typeof v === 'object' && !Array.isArray(v)) {
      const mergedFc = mergeWithRoot(v as AnyRecord, root);
      // Still walk inside (sub-entries may have further `field_config` in
      // groups/sections/tooltips) — use the merged result as the new tree.
      out[k] = walkAndMerge(mergedFc, root);
    } else {
      out[k] = walkAndMerge(v, root);
    }
  }
  return out;
}

/**
 * Normalize a `dataGroup` by pre-merging every nested `field_config` (tooltip
 * sections, group sub-fields, widget configs, …) with the root
 * `dataGroup.field_config`. Downstream widgets can then consume any nested
 * `field_config` as-is — label/i18n/order/control/scale inherited from the
 * root are already baked in.
 *
 * The root `field_config` itself is returned unchanged.
 */
export function normalizeDataGroup(dataGroup: DataGroup): DataGroup {
  const dg = dataGroup as unknown as AnyRecord;
  const root = (dg.field_config ?? {}) as AnyRecord;
  const result: AnyRecord = {};
  for (const [k, v] of Object.entries(dg)) {
    result[k] = k === 'field_config' ? v : walkAndMerge(v, root);
  }
  return result as unknown as DataGroup;
}
