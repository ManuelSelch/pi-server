# Published SDK Dependency — Design

## Proposed Design
- Replace pi-server's local SDK tarball dependency with the exact npm version `@manuelselch/pi-sdk: 0.1.0` and regenerate its lockfile.
- Remove SDK bundling and the obsolete vendored SDK archive. Remove active SDK archive/hash checks from package verification; retain historical source attribution in `SOURCE.json`.
- Update `verify-package.mjs` so an isolated packed-server consumer resolves the SDK from npm. Assert that the packed server declares the registry dependency and does not bundle it. Retain existing public-export, CLI, lifecycle and TypeScript consumer checks.
- Update the server README to describe registry installation. Do not modify Pi Chat's own SDK/server pins, publish pi-server, push commits or restart the live service.

## Decisions & Trade-offs
- Pin `0.1.0` exactly for a deliberate first registry migration. The lockfile replaces custom SDK archive receipts for dependency integrity.
- Normal package installation needs registry access; no local-tarball fallback or direct-tarball URL workaround.
- Registry version/tarball endpoints currently respond, but npm's package metadata endpoint still returns 404. Installation and verification must succeed before claiming completion.

## Verification
- Verify installed SDK version and registry resolution with no local SDK path or bundled SDK remaining.
- Run clean installation, typecheck, full server tests, build and isolated packed-consumer verification. Commit only this migration after successful verification.

## Open Questions
None.
