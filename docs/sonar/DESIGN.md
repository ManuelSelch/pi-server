# SonarCloud — Design

## Proposed Design
- Reuse Pi Chat’s SonarCloud CI pattern in this standalone repository.
- Add `sonar-project.properties` with UTF-8 encoding and `coverage/lcov.info` from the existing Vitest coverage command.
- Use exclusion-based scope without explicit `sonar.sources` or `sonar.tests`. Exclude test, vendor, generated, dependency, script, and configuration files from source analysis. Keep production `src/**`, including testing helpers, in scope.
- Add a `sonar` job to the existing Tests workflow, dependent on successful `server` verification. Download the existing `server-coverage` artifact after a full-history checkout, then run the same pinned SonarSource scan action as Pi Chat.
- Read organization/project key from repository variables and the analysis token from `SONAR_TOKEN`. Skip fork pull requests and leave scanning disabled until variables are configured.

## Decisions & Trade-offs
- Target SonarCloud organization `manuelselch`, with expected project key `ManuelSelch_pi-server`; this is separate from Pi’s SonarQube MCP endpoint.
- Wait for the quality gate with a 300-second bound. Gate failure fails the scan job; branch protection is separate and unchanged.
- Reuse the existing coverage artifact rather than reinstalling dependencies or rerunning tests in the scanner job.
- Only Vitest coverage is currently available. Compiled CLI/package tests pass but do not contribute coverage; do not hide those production files from metrics.
- Repository variables and secrets are currently absent. Cloud project import and token provisioning may require user setup; never copy tokens from another project or commit credentials.
- Do not push project commits or trigger remote execution without a separate request.

## Verification
- Validate workflow syntax, dependency/artifact wiring, fork guards, pinned action revision, and exclusion patterns.
- Confirm LCOV references repository source paths and rerun local verification as needed.
- Check repository variable/secret names without exposing values. Remote scan verification remains pending until Cloud setup and a pushed workflow are available.

## Open Questions
None.
