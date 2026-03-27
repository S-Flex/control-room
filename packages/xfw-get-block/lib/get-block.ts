import type { ContentLike } from "../types";
import languages from "../languages.json";

let _language = languages[0]

export { languages }
export function setLanguage(lang: string) { _language = lang }
export function getLanguage() { return _language }

/** Look up a localized field from a content block. Returns the field value or the code. */
export function getBlock<T extends ContentLike>(
    content: T[] | Map<string, T>, code: string, field: string,
): string {
    const entry = content instanceof Map ? content.get(code) : content.find(c => c.code === code)
    if (!entry) return code
    const i18n = entry.block.i18n as Record<string, Record<string, string>> | undefined
    const block = i18n?.[_language] ? { ...entry.block, ...i18n[_language] } : entry.block
    const v = block[field]
    return (typeof v === 'string' && v) ? v : code
}

/** Return a field value for all languages except the current one. */
export function getLanguageFields<T extends ContentLike>(
    content: T[] | Map<string, T>, code: string, field: string,
): Record<string, string> {
    const saved = _language
    const result: Record<string, string> = {}
    for (const lang of languages) {
        if (lang === saved) continue
        _language = lang
        result[lang] = getBlock(content, code, field)
    }
    _language = saved
    return result
}
