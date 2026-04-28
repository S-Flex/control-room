#!/usr/bin/env node
/**
 * Aux-route lint — keeps the `(a:1//b:2)` separator rule enforced at commit
 * time, so the runtime guard (src/lib/auxRouteGuard.ts) only ever has to
 * forgive bugs in node_modules, not in our own code.
 *
 * Three checks:
 *   1. Forbidden `history.pushState` / `history.replaceState` calls outside
 *      `src/lib/auxRouteGuard.ts` and `src/lib/urlSync.ts`.
 *   2. Forbidden URL-composition pattern using `${window.location.pathname}?`
 *      anywhere in `src/`.
 *   3. Aux-outlet expressions `(...)` in `data/` JSON and `src/` strings whose
 *      adjacent `key:val` pairs are joined by a single `/` instead of `//`.
 *
 * Exit codes: 0 = clean, 1 = violations found, 2 = script error.
 *
 * Run: `npm run check:aux-routes`
 * Wired into `.githooks/pre-commit`.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/(\w):/, '$1:'));
const GREEN = '\x1b[32m'; const RED = '\x1b[31m'; const YELLOW = '\x1b[33m'; const RESET = '\x1b[0m';

/** Files allowed to use the otherwise-forbidden patterns directly (the
 *  guards/helpers themselves and the test/doc files that describe them). */
const ALLOWLIST = new Set([
  ['src', 'lib', 'auxRouteGuard.ts'].join(sep),
  ['src', 'lib', 'urlSync.ts'].join(sep),
  ['scripts', 'check-aux-routes.mjs'].join(sep),
]);

/** Per-line escape hatch: append `// aux-routes-allow` (or `/* … *​/` form)
 *  to silence the linter for that specific line. Use sparingly and explain
 *  why in a comment immediately above. */
const ALLOW_LINE_RE = /aux-routes-allow/;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.vite']);

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function findHistoryViolations(text, relPath) {
  if (ALLOWLIST.has(relPath)) return [];
  const violations = [];
  const lines = text.split(/\r?\n/);
  const re = /\b(?:window\.)?history\.(pushState|replaceState)\b/;
  for (let i = 0; i < lines.length; i++) {
    if (ALLOW_LINE_RE.test(lines[i])) continue;
    if (re.test(lines[i])) {
      violations.push({ line: i + 1, col: lines[i].search(re) + 1, match: lines[i].trim() });
    }
  }
  return violations;
}

function findPathnameComposition(text, relPath) {
  if (ALLOWLIST.has(relPath)) return [];
  const violations = [];
  const lines = text.split(/\r?\n/);
  const re = /\$\{\s*window\.location\.pathname\s*\}\s*\??/;
  for (let i = 0; i < lines.length; i++) {
    if (ALLOW_LINE_RE.test(lines[i])) continue;
    if (re.test(lines[i])) {
      violations.push({ line: i + 1, col: lines[i].search(re) + 1, match: lines[i].trim() });
    }
  }
  return violations;
}

/** Inspect every `(...)` group in `text`; report any single-slash separator
 *  between two adjacent `<key>:` aux outlets. xfw-url's parser uses
 *  `split(/\/+(?=[A-Za-z_][A-Za-z0-9_-]*:)/)`, so the same regex (with capture)
 *  identifies the separator. */
function findCollapsedAuxOutlets(text, relPath) {
  if (ALLOWLIST.has(relPath)) return [];
  const violations = [];
  const lines = text.split(/\r?\n/);
  const groupRe = /\(([^()]+)\)/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (ALLOW_LINE_RE.test(line)) continue;
    let m;
    while ((m = groupRe.exec(line)) !== null) {
      const inner = m[1];
      // Must look like an aux-outlet expression (`key:val[/key:val…]`).
      // Skip parens unrelated to routing (e.g. function calls, JSX expr).
      if (!/^[A-Za-z_][A-Za-z0-9_-]*:/.test(inner)) continue;
      // Split with capture on the separator regex.
      const parts = inner.split(/(\/+)(?=[A-Za-z_][A-Za-z0-9_-]*:)/);
      // parts: ['key1:val', sep1, 'key2:val', sep2, ...]
      for (let j = 1; j < parts.length; j += 2) {
        if (parts[j] !== '//') {
          violations.push({
            line: i + 1,
            col: m.index + 1,
            match: line.trim(),
            detail: `single "/" between outlets: "${inner}"`,
          });
          break;
        }
      }
    }
  }
  return violations;
}

function shouldScan(relPath) {
  return relPath.startsWith('src' + sep) || relPath.startsWith('data' + sep);
}

function isCodeFile(relPath) {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(relPath);
}

function isJsonFile(relPath) {
  return relPath.endsWith('.json');
}

function format(file, v) {
  return `  ${YELLOW}${file}${RESET}:${v.line}:${v.col}  ${v.detail ?? v.match}`;
}

async function main() {
  const buckets = {
    history: [],
    pathnameComposition: [],
    collapsedAux: [],
  };

  for await (const p of walk(ROOT)) {
    const relPath = relative(ROOT, p);
    if (!shouldScan(relPath)) continue;

    const s = await stat(p);
    if (!s.isFile()) continue;

    const text = await readFile(p, 'utf8');

    if (isCodeFile(relPath)) {
      for (const v of findHistoryViolations(text, relPath))   buckets.history.push({ file: relPath, ...v });
      for (const v of findPathnameComposition(text, relPath)) buckets.pathnameComposition.push({ file: relPath, ...v });
      for (const v of findCollapsedAuxOutlets(text, relPath)) buckets.collapsedAux.push({ file: relPath, ...v });
    } else if (isJsonFile(relPath)) {
      for (const v of findCollapsedAuxOutlets(text, relPath)) buckets.collapsedAux.push({ file: relPath, ...v });
    }
  }

  let total = 0;
  if (buckets.history.length) {
    total += buckets.history.length;
    console.error(`${RED}✖ Direct history.{push,replace}State outside src/lib/{auxRouteGuard,urlSync}.ts${RESET}`);
    console.error(`  These calls bypass the URL canonicaliser and silently collapse aux-route "//" separators.`);
    console.error(`  Use syncQueryParams / rewriteUrl from src/lib/urlSync.ts instead.\n`);
    for (const v of buckets.history) console.error(format(v.file, v));
    console.error('');
  }
  if (buckets.pathnameComposition.length) {
    total += buckets.pathnameComposition.length;
    console.error(`${RED}✖ Composing URLs from \${window.location.pathname}${RESET}`);
    console.error(`  This pattern reads the (already-collapsed) pathname back into the URL bar.`);
    console.error(`  Use syncQueryParams / rewriteUrl from src/lib/urlSync.ts instead.\n`);
    for (const v of buckets.pathnameComposition) console.error(format(v.file, v));
    console.error('');
  }
  if (buckets.collapsedAux.length) {
    total += buckets.collapsedAux.length;
    console.error(`${RED}✖ Aux-outlet expressions joined by a single "/" instead of "//"${RESET}`);
    console.error(`  Two outlets in one URL must be separated by "//", e.g. (sidebar:oee//detail:batch).\n`);
    for (const v of buckets.collapsedAux) console.error(format(v.file, v));
    console.error('');
  }

  if (total === 0) {
    console.log(`${GREEN}✓ aux-route rules clean${RESET}`);
    process.exit(0);
  }
  console.error(`${RED}${total} violation(s).${RESET} See CLAUDE.md → "Aux-route separator" for the rules.`);
  process.exit(1);
}

main().catch((err) => {
  console.error('check-aux-routes: script error', err);
  process.exit(2);
});
