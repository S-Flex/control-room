# Control Room

## Project Structure
- `src/` — Application source code (React + TypeScript)
- `packages/` — Internal shared packages (xfw-three, xfw-url, xfw-data, xfw-get-block, xfw-button-group)
- `data/` — JSON data files served by vite dev server

## Rules

### Protected Directories
- **Never edit files in `packages/` without explicit user permission.** These are shared internal packages. Always ask before modifying any file under `packages/`.

### Data & i18n
- All user-facing text must go through `getBlock()` from `xfw-get-block` for localization.
- JSON data files use `content` arrays with `code`, `block` (containing `title`, `i18n`) pattern.
- Supported languages are defined in `packages/xfw-get-block/languages.json`.

### Code Style
- TypeScript strict mode enabled.
- Local packages are aliased via `tsconfig.json` paths and `vite.config.ts` resolve aliases.
- Run `npx tsc --noEmit` to verify compilation after changes.
