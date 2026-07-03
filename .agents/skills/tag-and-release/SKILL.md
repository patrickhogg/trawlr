---
name: tag-and-release
description: Bump the version in package.json, create an annotated git tag, commit the version bump, and push everything (commit + tags) to the remote. Use when the user says "tag and release", "bump and release", "release", or "cut a release".
---

# Tag and Release

Automates the version bump → tag → push workflow for Trawlr.

## Steps

1. **Read** the current version from `package.json`.
2. **Bump** the patch version (e.g. `1.1.2` → `1.1.3`). If the user specifies a version or bump type (major/minor/patch), use that instead.
3. **Update** `package.json` with the new version.
4. **Stage and commit** the change: `git add package.json && git commit -m "chore: bump version to vX.Y.Z"`
5. **Create an annotated tag**: `git tag -a vX.Y.Z -m "vX.Y.Z"`
6. **Push** the commit and tag: `git push origin && git push origin vX.Y.Z`
7. **Report** the new version and confirm the push succeeded.
