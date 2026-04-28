import { createContext, useContext } from 'react';

export type FlowSearchInfo = {
  /** `track_by` ids of rows that match the active query. `track_by` is
   *  stamped once at fetch time (DataGroupContent) so the id survives row
   *  spreads (e.g. `toggleChecked`'s `{ ...r }`) that would break object
   *  identity. */
  matchedTracks: Set<number>;
  /** `track_by` of the prev/next-focused leaf card, or null. */
  focusedTrack: number | null;
  /** When true, leaf cards add `included-in-search`. In filter mode the row
   *  is either visible or pruned, so the highlight class would be redundant
   *  and the SearchBox hides prev/next. */
  highlight: boolean;
};

const noop: FlowSearchInfo = {
  matchedTracks: new Set(),
  focusedTrack: null,
  highlight: false,
};

const FlowSearchContext = createContext<FlowSearchInfo>(noop);

export const FlowSearchProvider = FlowSearchContext.Provider;

export function useFlowSearch(): FlowSearchInfo {
  return useContext(FlowSearchContext);
}
