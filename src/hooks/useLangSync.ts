import { useQueryParams } from '@s-flex/xfw-url';

/** Subscribe the calling component to `?lang=` changes so it re-renders
 *  when AppHeader sets a new UI language. AppHeader applies the language
 *  globally via `setLanguage`; this hook is just the re-render trigger so
 *  page content that reads `getLanguage()` / `localizeI18n(...)` /
 *  `getBlock(...)` at render time picks up the new locale. */
export function useLangSync(): void {
  useQueryParams([{ key: 'lang', is_query_param: true, is_optional: true }]);
}
