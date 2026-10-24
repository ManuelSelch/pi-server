# Pi Server

Independent local repository for the compiled Pi v2 host, extracted from Pi Chat. Pi Chat consumer cutover remains S4. Do not edit the separate SDK repositories here. Historical extraction attribution is in [SOURCE.json](SOURCE.json); current SDK version and integrity are recorded in package.json and package-lock.json. No Pi Chat license grant existed at the source revision; resolve licensing before publication.

## Build and verify

Requires Node >=22.19 (CI: Node 24).

```sh
npm ci --ignore-scripts
npm test
npm run test:coverage
npm run typecheck
npm run verify:package
npm pack
```

The package uses its own lockfile, not the Chat workspace. `verify:package` installs compiled tarballs in a private temporary consumer, checks SDK initialization/public declarations and runs CLI/restart/fixture scenarios without Chat sources, frontend dependencies or tsx. All test agent/history/metadata storage is private. The SDK is a normal npm dependency pinned to `@manuelselch/pi-sdk@0.1.0`, not bundled or vendored. The isolated consumer installs it transitively from the registry; the lockfile records its resolved URL and integrity.

Pi 1.0.2 uses broad internal ranges. Pinning its working dependency family (agent-core/AI 1.0.2; codemode/MCP/TUI/telemetry/chord 1.0.3) prevents incompatible upgrades in consumers where package overrides would be ignored. Keep these pins until a separately verified Pi update.

## SonarCloud

The Tests workflow scans only after server verification succeeds, reuses its Vitest coverage artifact, and waits up to 300 seconds for the quality gate. Fork pull requests are skipped. Scope is exclusion-based in [sonar-project.properties](sonar-project.properties); production CLI and testing helpers remain included even though compiled package tests do not contribute coverage.

To enable analysis:

1. Import `ManuelSelch/pi-server` into SonarCloud organization `manuelselch` and select CI-based analysis (disable automatic analysis).
2. Set GitHub Actions repository variables `SONAR_ORGANIZATION=manuelselch` and `SONAR_PROJECT_KEY=ManuelSelch_pi-server` (use the actual project key if different).
3. Add an authorized analysis token as the repository secret `SONAR_TOKEN`. Never commit it.
4. Push the workflow and check the scan/quality gate. Variables left unset disable the job; configured variables without a valid token cause analysis to fail. Required merge checks must be configured separately in GitHub branch protection.

## CLI

```sh
pi-server --host 127.0.0.1 --port 8788 --project /path/to/project
pi-server --static-directory /path/to/assets --pid-file /path/to/server.pid --log-directory /path/to/logs
```

Headless by default: `/health` and `/ws`, no session creation or browser launch. Explicit static hosting supplies SPA fallback. Relative flags resolve against the invocation directory; `--project` selects process cwd, while session create/open still use protocol paths and existing default home-folder behavior. Port 0 selects an ephemeral port. `--no-restart` disables restart for external supervisors. Standalone restart re-executes compiled JS without a build; the current waiter uses POSIX `/bin/sh`. SIGINT/SIGTERM dispose listeners/runtimes and flush logs. PID record is `{ pid, port, cwd }`; log filename remains `pi-chat.log` for compatibility. No CLI read of `PI_CHAT_HOST/PORT/CWD/PID_FILE`; the Chat adapter remains responsible for those settings.

This is a private local backend, not an authenticated public service. Keep loopback defaults; auth/TLS belong to a trusted proxy. Existing Origin checks and v2 controller semantics remain unchanged.

## Public API ownership

- Root: `createPiServer(options)`, `createPiRuntimeAdapter(runtime)`, `createRestartService(options)`, `createFileLogger(options)` and their structural contracts.
- Server options: runtime/factory, optional static directory, restart, extensions, structural file-open service, logger and catalogue configuration (lister, session directory, discovery, metadata file, home directory; null suppresses home).
- Handle: `httpServer` for listen/address/error ownership; idempotent async `close()`. Close disposes transport and runtimes; callers flush/close injected loggers. Runtime creation stays lazy.
- `/extensions`: existing registration types and registry functions, retaining `Symbol.for("pi-chat.extension-registry")`. Test reset is not exported here.
- `/testing`: compiled fake runtime, fixture data and registry reset; no test-framework runtime dependency.
- `/testing/loopback`: `runLoopbackFixture()`. A plain-Node launcher imports and awaits it, with no arguments. It creates a private canonical workspace, binds ephemeral loopback, rejects other project paths, prints `PI_FIXTURE_READY { directory, endpoint }`, and on SIGTERM explicitly closes retained runtimes and exclusively writes `cleanup.json`. The test driver removes successful artifacts.
- No exports for concrete transport/application/catalogue/mapping internals. SDK `/protocol` remains authoritative.

## Source and test ownership

This repository owns the server implementation, internal regression tests, compiled fixture, diagnostics and independent CI. Pi Chat retains its existing server and staged package until S4 acceptance; reconcile intervening fixes rather than maintaining two permanent implementations. Its launcher still owns build-before-restart. Generic restart accepts an explicit build callback; failure keeps the old process serving.

See [ownership and rollback](docs/OWNERSHIP.md), [configuration](docs/CONFIGURATION.md), [extension embedding](docs/EXTENSIONS.md) and the [server protocol reference](docs/PROTOCOL.md). TypeScript SDK schemas remain authoritative; no protocol source is copied here. No remote, publication or live-service replacement is implied by local extraction.
