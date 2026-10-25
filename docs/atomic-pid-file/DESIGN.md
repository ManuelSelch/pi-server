# Atomic PID File — Design

## Proposed Design
- Confirmed cause: the CLI overwrites its PID file with `writeFile`, exposing an empty file between truncation and completion. The restart driver can read that empty file and fail at `JSON.parse`.
- Publish the unchanged PID record through a temporary file in the target directory, followed by an atomic rename over the target.
- Keep publication awaited before logging readiness. Remove the temporary file on failure and retain the CLI's existing startup-error behavior.
- Keep the change internal to CLI startup; no public exports or new dependencies.

## Decisions & Trade-offs
- Same-directory rename ensures readers see either the complete previous record or the complete successor record on the Ubuntu/macOS environments used by this project.
- Preserve PID JSON fields, path resolution, restart arguments and health checks.
- Do not hide malformed records by broadly swallowing parse errors in the test driver or increase timeouts.
- Atomic visibility, not power-loss durability or coordination between independently launched servers sharing one PID path, is the scope.

## Verification
- Add deterministic regression coverage that pauses publication before rename and verifies the old record remains readable, then verifies the complete replacement after rename.
- Cover temporary-file cleanup and preservation of the previous record if publication fails.
- Run typecheck, unit tests, compiled CLI/package scenarios and isolated packed-consumer verification, including existing relative-path restart scenarios.

## Open Questions
None.
