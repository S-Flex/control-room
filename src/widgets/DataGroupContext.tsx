import { createContext, useContext } from 'react';
import type { FieldConfig } from '@s-flex/xfw-ui';

/** Per-DataGroup ambient context.
 *
 *  - `primaryKeys`: so generic descendants (e.g. `Field` invoking
 *    `useNavItemAction` via `nav_field`) can merge those keys into the URL
 *    on navigation — same behavior as the row-level navs in Cards /
 *    FlowBoard / Item, without each caller having to thread
 *    `extraParamKeys` through.
 *  - `fieldConfig`: the data group's flat field_config map. Lets a Field
 *    look up its own sub-fields via dot-prefix (e.g. `<key>.col1`) without
 *    having to be passed the whole config — used by the `table` control to
 *    resolve its column definitions. */
export type DataGroupContextValue = {
  primaryKeys: string[];
  fieldConfig?: Record<string, FieldConfig>;
};

const DataGroupContext = createContext<DataGroupContextValue>({ primaryKeys: [] });

export const DataGroupProvider = DataGroupContext.Provider;

export function useDataGroupContext(): DataGroupContextValue {
  return useContext(DataGroupContext);
}
