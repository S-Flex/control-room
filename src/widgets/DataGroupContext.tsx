import { createContext, useContext } from 'react';

/** Per-DataGroup ambient context. Currently exposes the active data source's
 *  `primary_keys` so generic descendants (e.g. `Field` invoking
 *  `useNavItemAction` via `nav_field`) can merge those keys into the URL on
 *  navigation — same behavior as the row-level navs in Cards / FlowBoard /
 *  Item, without each caller having to thread `extraParamKeys` through. */
export type DataGroupContextValue = {
  primaryKeys: string[];
};

const DataGroupContext = createContext<DataGroupContextValue>({ primaryKeys: [] });

export const DataGroupProvider = DataGroupContext.Provider;

export function useDataGroupContext(): DataGroupContextValue {
  return useContext(DataGroupContext);
}
