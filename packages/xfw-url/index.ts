// Types
export type { JSONValue, JSONRecord, ParamDefinition, ParamValue } from "./types";

// URL utilities
export {
    parseFullPath,
    composeFullPath,
    recombineFullPath,
    recombineFullPathFromPartialPath,
    fullPathIncludes,
} from "./lib/url";
export type { KeyValue, ParsedFullPath } from "./lib/url";

// Hooks
export { useAuxRoutes } from "./hooks/use-aux-routes";
export { useQueryParams } from "./hooks/use-query-params";
export { useNavigate } from "./hooks/use-navigate";
export type { NavigateParams } from "./hooks/use-navigate";
export { useHref } from "./hooks/use-href";

// Providers
export { AuxRouteProvider, AuxRoutes, MainRoutes, useAuxOutlet, useMainRoute } from "./providers/aux-route-provider";
export { QueryParamProvider, useQueryParamManager } from "./providers/query-param-provider";
export { OverrideParamsProvider, useOverrideParams } from "./providers/override-params-provider";
export { NavigationProvider, useStableNavigate, NavigationContext } from "./providers/navigation-provider";
export type { StableNavigateFunction } from "./providers/navigation-provider";
export { AriaRouterProvider } from "./providers/aria-router-provider";
