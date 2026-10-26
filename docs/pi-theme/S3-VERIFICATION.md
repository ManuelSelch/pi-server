# Pi theme — S3 verification

## Delivered
- Runtime-owned Pi theme and concrete palette, resolved before browser extension startup and again on runtime replacement. Use `getThemeSetting()` because Pi 1.0.2's `getTheme()` discards fixed light/dark pairs; choose the dark member headlessly.
- Read only runtime-discovered resources or installed Pi built-ins. Pi validates source documents and resolves actual theme tokens in truecolor. No terminal initialization/queries, watcher, global registration or cross-runtime mutation.
- Missing, invalid, unavailable, system and terminal-default themes fall back to deterministic Pi dark with a sanitized stderr diagnostic. Explicit export surface colors take precedence; omitted values follow Pi's HTML surface policy. Export-only variable references and surface math use the approved attributed adapter; see THIRD-PARTY-NOTICES.md.
- RuntimeAdapter now requires `sessionTheme()`. Application service/publisher obtain the cached palette independently of snapshots. Only successful open/create results carry it, including opens that reuse a runtime. Reload retains both the instance and palette.
- SDK source revision `661fecd8b7920d3d8560b625d687f6fa666f15f3` is temporarily pinned/bundled from a verified archive (receipt and SHA-256 in vendor/pi-theme-sdk.json). No package version bump or publication. The package verifier installs only compiled artifacts in an isolated consumer and tests the actual bundled SDK.

## Executed checks
- Red: 12 resolver cases failed before the resolver existed; reload retention failed before `sessionTheme()` existed. Real Pi/socket custom-pair scenario reproduced dark fallback before switching from `getTheme()` to `getThemeSetting()`.
- Green: fresh source export, with no existing node_modules/dist/coverage/git state, `npm ci --ignore-scripts`, Node 26.5.0/npm 11.17.0.
- `npm run typecheck`: passed.
- `npm run test:coverage`: **450 tests / 61 files passed**; total line coverage **86.02%**. Resolver has 100% line coverage. Tests include RGB/indexed/OKLCH/OKHSL/variables, export parity against Pi helpers, derived light/dark surfaces, bounded names, cyclic/missing export variables, trusted-resource list selection, deterministic fallbacks, isolation, reload retention and replacement-before-startup binding.
- `npm run test:package`: **17 passed**. Real Pi resources and an extension emit a custom-colored/bold widget through the public server/socket/SDK; verify required palette on create and existing open, two runtime palettes, cached reload despite changed/invalid source, fallback on successful create, same-server reconnect retention and absence from initialization/snapshots/events.
- `npm run verify:package`: **17 installed-consumer scenarios passed**, plus SDK artifact integrity, bundled SDK loading, TypeScript public declarations and export boundaries. Tests run without sibling source repositories, tsx or frontend dependencies.
- `git diff --check`: passed.

## Scope limits
- Chat production UI/dependencies remain unchanged; Mantine and browser end-to-end integration belong to S4. No Swift or live-model verification is claimed.
- No remote CI/Sonar run, project push/publication or live-server restart was performed. npm reports the existing **5 audit findings (4 moderate, 1 high)**; no unverified audit fix was applied.
- The small Pi internal seam and attributed export adapter must be reverified on Pi upgrades. Do not publish this temporary bundled-SDK checkout as-is; follow docs/RELEASING.md.
