import { useEffect, useState } from 'react';
import type { JSONRecord, JSONValue } from '@s-flex/xfw-data';
import type { ResolvedField } from '@s-flex/xfw-ui';
import { useQueryParams } from '@s-flex/xfw-url';
import { Field } from '../controls/Field';
import { resolve } from './resolve';
import { localizeI18n } from './flow/utils';
import { syncQueryParams } from '../lib/urlSync';
import { DropdownMenu } from './DropdownMenu';
import type { MenuConfig } from '../types';

type MenuProps = {
  menu: JSONRecord[];
  menu_config: MenuConfig;
};

function findItem(items: JSONRecord[], valueField: string, value: unknown): JSONRecord | undefined {
  if (value == null) return undefined;
  return items.find(i => String(resolve(i, valueField)) === String(value));
}

function triggerLabelOf(value: JSONValue, fallback: string): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return localizeI18n(value) ?? fallback;
  }
  return value != null ? String(value) : fallback;
}

function getChildItems(item: JSONRecord, config: MenuConfig): JSONRecord[] {
  if (!config.menu_config || !config.items_field) return [];
  const v = resolve(item, config.items_field);
  return Array.isArray(v) ? (v as JSONRecord[]) : [];
}

function fieldFor(config: MenuConfig): ResolvedField & { no_label?: boolean } {
  return {
    key: config.text_field,
    control: config.control,
    no_label: true,
  };
}

function ChevronRight() {
  return (
    <svg className="menu-cascade-arrow" width="10" height="10" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Menu({ menu, menu_config }: MenuProps) {
  const [open, setOpen] = useState(false);
  const subConfig = menu_config.menu_config;

  // Pull both levels' URL values up-front so hooks order stays stable.
  const params = useQueryParams([
    { key: menu_config.query_param_field, is_query_param: true, is_optional: true },
    ...(subConfig
      ? [{ key: subConfig.query_param_field, is_query_param: true, is_optional: true }]
      : []),
  ]);
  const topUrlVal = params.find(p => p.key === menu_config.query_param_field)?.val;
  const subUrlVal = subConfig
    ? params.find(p => p.key === subConfig.query_param_field)?.val
    : undefined;

  const topSelected = findItem(menu, menu_config.value_field, topUrlVal) ?? menu[0];
  const topSelectedValue = topSelected ? resolve(topSelected, menu_config.value_field) : null;

  const subItems = topSelected ? getChildItems(topSelected, menu_config) : [];
  const subSelected = subConfig
    ? (findItem(subItems, subConfig.value_field, subUrlVal) ?? subItems[0])
    : undefined;
  const subSelectedValue = subSelected && subConfig
    ? resolve(subSelected, subConfig.value_field)
    : null;

  // Canonicalize the URL: write the resolved selection if missing/stale, and
  // clear a stale child param when the parent has no children at all.
  useEffect(() => {
    const updates: Record<string, JSONValue | null> = {};
    if (topSelectedValue != null && (topUrlVal == null || String(topUrlVal) !== String(topSelectedValue))) {
      updates[menu_config.query_param_field] = topSelectedValue;
    }
    if (subConfig) {
      if (subSelectedValue != null && (subUrlVal == null || String(subUrlVal) !== String(subSelectedValue))) {
        updates[subConfig.query_param_field] = subSelectedValue;
      } else if (subSelectedValue == null && subUrlVal != null) {
        updates[subConfig.query_param_field] = null;
      }
    }
    if (Object.keys(updates).length > 0) {
      syncQueryParams(updates as Parameters<typeof syncQueryParams>[0]);
    }
  }, [topSelectedValue, subSelectedValue, topUrlVal, subUrlVal, menu_config.query_param_field, subConfig?.query_param_field]);

  // Default the cascade hover to the currently-selected top item, so the
  // active sub-panel is open the moment the menu pops up.
  const [hoveredTopValue, setHoveredTopValue] = useState<unknown>(topSelectedValue);
  useEffect(() => {
    if (open) setHoveredTopValue(topSelectedValue);
  }, [open, topSelectedValue]);

  // Trigger label = deepest selected text. When the sub-menu has only the
  //  one (collapsed) item, fall back to the top-level title so the trigger
  //  matches what the user can actually choose.
  const useSubInTrigger = !!(subConfig && subSelected && subItems.length > 1);
  const triggerSrc = useSubInTrigger ? subSelected! : topSelected;
  const triggerCfg = useSubInTrigger ? subConfig! : menu_config;
  const triggerVal = triggerSrc ? resolve(triggerSrc, triggerCfg.text_field) : null;
  const triggerLabel = triggerLabelOf(triggerVal, String(subSelectedValue ?? topSelectedValue ?? ''));

  if (!menu || menu.length === 0) return null;

  const handleTopClick = (item: JSONRecord) => {
    setOpen(false);
    const newVal = resolve(item, menu_config.value_field);
    const updates: Record<string, JSONValue | null> = {
      [menu_config.query_param_field]: newVal,
    };
    if (subConfig) {
      const children = getChildItems(item, menu_config);
      const firstChild = children[0];
      updates[subConfig.query_param_field] = firstChild
        ? resolve(firstChild, subConfig.value_field)
        : null;
    }
    syncQueryParams(updates as Parameters<typeof syncQueryParams>[0]);
  };

  const handleSubClick = (parentItem: JSONRecord, childItem: JSONRecord) => {
    if (!subConfig) return;
    setOpen(false);
    syncQueryParams({
      [menu_config.query_param_field]: resolve(parentItem, menu_config.value_field),
      [subConfig.query_param_field]: resolve(childItem, subConfig.value_field),
    } as Parameters<typeof syncQueryParams>[0]);
  };

  return (
    <DropdownMenu
      label={triggerLabel}
      open={open}
      onToggle={() => setOpen(o => !o)}
      onClose={() => setOpen(false)}
      fullWidth={false}
    >
      <div className="dropdown-menu-list menu-cascade">
        {menu.map((item, idx) => {
          const itemVal = resolve(item, menu_config.value_field);
          const isSelected = String(itemVal) === String(topSelectedValue);
          const isHovered = String(itemVal) === String(hoveredTopValue);
          const childItems = getChildItems(item, menu_config);
          // Show the sub-panel only when there are 2+ children: a single child
          //  collapses into the parent click (matches "submenu length 1 → hide").
          const hasSubmenu = !!subConfig && childItems.length > 1;
          return (
            <div
              key={String(itemVal ?? idx)}
              className="menu-cascade-item"
              onMouseEnter={() => setHoveredTopValue(itemVal)}
            >
              <button
                className={`dropdown-menu-item${isSelected ? ' active' : ''}`}
                onClick={() => handleTopClick(item)}
              >
                <span className="menu-cascade-text">
                  <Field
                    field={fieldFor(menu_config)}
                    value={resolve(item, menu_config.text_field)}
                    row={item}
                  />
                </span>
                {hasSubmenu && <ChevronRight />}
              </button>
              {isHovered && hasSubmenu && subConfig && (
                <div className="menu-cascade-panel">
                  <div className="dropdown-menu-list">
                    {childItems.map((child, cidx) => {
                      const childVal = resolve(child, subConfig.value_field);
                      const isChildActive = String(childVal) === String(subSelectedValue);
                      return (
                        <button
                          key={String(childVal ?? cidx)}
                          className={`dropdown-menu-item${isChildActive ? ' active' : ''}`}
                          onClick={() => handleSubClick(item, child)}
                        >
                          <span className="menu-cascade-text">
                            <Field
                              field={fieldFor(subConfig)}
                              value={resolve(child, subConfig.text_field)}
                              row={child}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DropdownMenu>
  );
}
