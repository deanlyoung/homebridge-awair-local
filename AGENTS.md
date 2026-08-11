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

### Release checklist

Before pushing a release:

1. Confirm the proposed version bump and SemVer category (patch / minor / major).
2. Verify no `vX.Y.Z` tag already exists on remote (`git ls-remote --tags origin | grep vX.Y.Z`). If it does, delete it locally and remotely first.
3. Update every authoritative version location:
   - `package.json`: `"version": "X.Y.Z"`
   - `package-lock.json`: top-level `"version": "X.Y.Z"`, nested `"version": "X.Y.Z"`
   - `changelog.md`: rename `## Unreleased` to `## vX.Y.Z (YYYY-MM-DD)`, move applicable entries under it
4. Commit all version files in a single commit with message: `Release vX.Y.Z - <summary>`
5. Push the branch with `--tags` (`git push origin <branch> --tags`)
6. Create and push the annotated tag separately:
   ```sh
   git tag -a vX.Y.Z -m "Release vX.Y.Z - <summary>" HEAD
   git push origin vX.Y.Z
   ```
7. Report the version changed, commit SHA, and tag URL.

### Versioning policy

- Normal PRs: add the canonical change summary to `Unreleased` in `changelog.md`. Do not change the released version number.
- Release PRs only: select the appropriate Semantic Versioning bump, update all authoritative version locations, and move applicable `Unreleased` entries into the new version section.
- Before any release-version bump, state the current version, proposed version, SemVer category (`patch`, `minor`, or `major`), and rationale.
