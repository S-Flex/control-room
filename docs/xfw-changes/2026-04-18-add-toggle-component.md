# Add `Toggle` base component

## Status

Applied locally via **patch-package** (`patches/@s-flex+xfw-ui+0.2.4.patch`) until the next `@s-flex/xfw-ui` release ships a real `Toggle` export.

## What is missing

`@s-flex/xfw-ui` exposes `Checkbox` but no `Toggle` (a.k.a. switch). Several views currently use `Checkbox` for binary on/off controls where a toggle switch is the correct affordance — e.g. the "Capacity" overlay control in the production-line page header (`src/ProductionLinesPage.tsx`).

## Affected package

- `@s-flex/xfw-ui` (currently `0.2.4`)
- New file (suggested upstream location): `src/components/base/toggle/toggle.tsx`
- Re-export from the package barrel and document under "Base Components" in `README.md`.

## Proposed upstream addition

Add UntitledUI's `Toggle` component (free / public). Install via:

```bash
npx untitledui@latest add toggle --yes --license 3fcef8ff645b70a9ae4f4459eb9d557d
```

Wrap it the same way `Checkbox` is wrapped today (`label` / `hint` / `size` props, `ref` forwarded), so it can be a drop-in replacement at consumer sites:

```ts
interface ToggleProps extends RACSwitchProps {
  ref?: Ref<HTMLLabelElement>;
  size?: 'sm' | 'md';
  label?: ReactNode;
  hint?: ReactNode;
}
declare const Toggle: {
  (props: ToggleProps): JSX.Element;
  displayName: string;
};
```

## Local patch (until upstream release)

`patch-package` applies the change on `npm install` via the `postinstall` script. The patch:

- Adds `dist/toggle-ext.js` and `dist/toggle-ext.d.ts` containing a `Toggle` (and `ToggleBase`) implementation that wraps `Switch` from `react-aria-components` and re-uses the same `cx` helper, `label`/`hint`/`size` shape, and Tailwind tokens as `Checkbox`.
- Appends a single `export { Toggle } from "./toggle-ext.js";` to `dist/index.js`.
- Appends `export { Toggle, type ToggleProps } from "./toggle-ext";` to `dist/index.d.ts`.

### Project changes that were made

- `package.json`: added `patch-package` to `devDependencies` and `"postinstall": "patch-package"` to `scripts`.
- `patches/@s-flex+xfw-ui+0.2.4.patch`: the unified-diff patch.
- `src/ProductionLinesPage.tsx`: replaced `Checkbox` with `Toggle` for the Capacity control.

### How to (re)apply

```bash
npm install            # postinstall hook runs patch-package and applies the patch
```

If `npm install` is unable to authenticate against the GitHub Packages registry, set `GITHUB_TOKEN` first (the `.npmrc` reads `${GITHUB_TOKEN}`):

```bash
export GITHUB_TOKEN=<token-with-read:packages>
npm install
```

### How to remove the patch

When `@s-flex/xfw-ui` releases a version that exports `Toggle` natively:

1. Bump the dependency in `package.json`.
2. Delete `patches/@s-flex+xfw-ui+0.2.4.patch`.
3. Run `npm install` — `patch-package` will exit cleanly with no patches to apply.
4. Delete this doc, or move it to an "applied" archive.

## Before / after — consumer code

**Before** (`src/ProductionLinesPage.tsx:725`):

```tsx
import { Sidebar, Checkbox } from '@s-flex/xfw-ui';

<Checkbox
  isSelected={showCapacity}
  onChange={setShowCapacity}
  label={getBlock(uiLabels, 'capacity', 'title')}
/>
```

**After:**

```tsx
import { Sidebar, Toggle } from '@s-flex/xfw-ui';

<Toggle
  isSelected={showCapacity}
  onChange={setShowCapacity}
  label={getBlock(uiLabels, 'capacity', 'title')}
/>
```

## Why this change is needed

- The "Capacity" header control is a binary overlay-on / overlay-off switch — visually a toggle, not a check item in a multi-select list. Using a checkbox here misrepresents the interaction.
- We expect more such on/off controls (operator overlays, simulation toggles, debug overlays). Centralising the component in `xfw-ui` keeps styling and a11y behaviour consistent.
- Using UntitledUI's existing component avoids hand-rolled CSS and matches the design system already used by `Checkbox`, `Button`, `Badge`, etc.
