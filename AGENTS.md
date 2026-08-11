# AGENTS.md

## Project

`homebridge-awair-local` is a JavaScript Homebridge v2 dynamic-platform plugin.
Use npm and support Node.js 22 through 24.

## Layout

- `src/`: platform, accessory, and device-discovery logic.
- `homebridge-ui/`: Homebridge UI X configuration UI.
- `test/`: tests run with Node's built-in test runner.
- `config.schema.json` and `config-sample.json`: the user configuration contract.
- `changelog.md`: the canonical change history and pending-release notes.

## Development

Install dependencies with `npm ci`. Before considering a change complete, run:

```sh
npm run lint
npm test
```

## Change rules

- Keep changes focused and preserve public configuration behavior unless the task explicitly changes it.
- For configuration changes, update `config.schema.json`, `config-sample.json`, and `README.md` together.
- Add or update tests for behavior changes in `src/`.
- Do not add secrets, real device addresses, tokens, personally identifying API responses, or samples captured from an actual network. Fixtures and example payloads must be generic, anonymized, and safe to share publicly.
- Do not alter publishing, tags, or release automation unless explicitly requested.

## Pull requests, changelog, and releases

### Canonical change summary

- For every user-visible change, first draft the final changelog entry.
- Use that entry as the canonical PR description: the PR description must match it verbatim, except for optional PR-only metadata such as test notes or issue links.
- Before opening or updating a PR, add the canonical entry under `Unreleased` in `changelog.md`.
- Do not create duplicate entries for the same change.

### Semantic versioning

- At PR time, state the recommended SemVer impact in the PR description:
  - `patch`: backward-compatible bug fix, documentation-only release note, or internal fix with a user-visible correction.
  - `minor`: backward-compatible new feature.
  - `major`: any breaking change to a public API, configuration, CLI behavior, supported platform, or documented contract.
- Clearly call out breaking changes and migration steps.
- Do not bump the released version for every merged PR. Keep changes under `Unreleased` until preparing a release.
- When asked to prepare or merge a release:
  1. Confirm the proposed next version from the current released version.
  2. Update every authoritative version location in the repository.
  3. Rename or move `Unreleased` entries into a dated version heading.
  4. Use the same release-summary text for the release PR description.
  5. Run the documented tests and report the exact version changed.

### PR completion checklist

Before creating a PR, report:

- The canonical changelog/PR description text.
- Recommended SemVer impact and why.
- Whether this is a normal PR (`Unreleased`) or a release PR (version bump).
- Version files changed, if this is a release PR.

### Versioning policy

- Normal PRs: add the canonical change summary to `Unreleased` in `changelog.md`. Do not change the released version number.
- Release PRs only: select the appropriate Semantic Versioning bump, update all authoritative version locations, and move applicable `Unreleased` entries into the new version section.
- Before any release-version bump, state the current version, proposed version, SemVer category (`patch`, `minor`, or `major`), and rationale.
