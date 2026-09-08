# Question-bank publishing

Runtime question-bank binaries are independent from the Electron application. They are not
committed to Git and they are not included in installers. GitHub Releases stores immutable ZIP
packs; the generated `content` branch contains only `manifest.json`.

## Developer setup

Install the GitHub CLI and authenticate it once:

```bash
gh auth login
npm ci
npm run content:pull
```

`content:pull` downloads the current, hash-verified packs and restores media into their normal
locations under `assets/`. Those media paths are ignored by Git. Markdown and JSON remain normal
tracked source files. Subsequent pulls skip packs already recorded in the ignored local media state;
use `npm run content:pull -- --force` to restore every published media file again.

The default repository is `anton-bis/toefl-app`. A fork can override it:

```bash
TOEFL_CONTENT_REPOSITORY=owner/repository npm run content:pull
```

## Publishing content

Commit the tracked Markdown and JSON changes normally, then run:

```bash
npm run content:publish
```

No content version is entered manually. The publisher:

1. compiles and validates every question document;
2. discovers referenced media and fails if any file is missing;
3. hashes the logical contents of the catalog, every TPO, vocabulary, and typing pack;
4. reuses the existing Release URL for every unchanged pack;
5. creates deterministic ZIP files only for changed packs;
6. creates or repairs a `content-<manifest-hash>` pre-release;
7. uploads the changed archives and their mandatory SHA-256 metadata; and
8. pushes a generated, manifest-only commit to the `content` branch.

The minimum compatible application version belongs to the content schema, not to each publication.
Publishing content from a newer desktop-app checkout therefore does not make users reinstall the app
unless the content schema itself has changed.

Publishing identical content is a no-op. A failed `content` branch push does not expose a partial
release to clients; rerunning the command repairs/reuses the hash-addressed Release and retries the
manifest publication.

Do not manually edit the generated `content` branch, Release tags, pack names, hashes, or URLs.

## Lessons learned

### Pack ids must be GitHub-safe (spaces/parentheses break downloads)

Archive filenames are derived from the content pack id: `<pack-id>-<hash>.zip`. GitHub
**normalizes** special characters in uploaded release-asset names, e.g. `tpo-2026-02-01 (2)`
becomes `tpo-2026-02-01.2.`. If the manifest URL records the original (unsanitized) filename,
the download returns `HTTP 404` even though the release exists.

- Symptom: "Question bank unavailable — HTTP 404" on a `releases/download/content-<hash>/<pack>-<hash>.zip`
  URL whose filename contains a space or parentheses (e.g. same-day multi-session folders
  `2026-02-01 (2)`).
- Root cause: the `(N)` same-day-session suffix introduced spaces and parentheses into the pack
  id `tpo-2026-02-01 (2)`, which GitHub renamed to `.2.` on upload while the manifest kept the
  original name.
- Fix (already applied): `src/content/packs.js` sanitizes every pack id to `[a-z0-9-]`
  (`tpo-2026-02-01 (2)` -> `tpo-2026-02-01-2`) via `sanitizePackId`. Keep all pack ids in this
  safe charset; the app treats pack ids as opaque keys, so sanitizing them is safe.
- The published content itself was always valid; only the distribution URL was wrong. Fixing the
  pipeline and re-running `npm run content:publish` (pack id changed -> new manifest id -> forced
  re-publish) repairs the manifest without needing a new application release.
- After any content publish, verify the manifest URLs resolve (e.g. `curl -sI <pack.url>`
  returns 200) before announcing the update.

## User update behavior

Packaged applications initialize the question bank on first launch. Later launches use valid local
content immediately and check for changes in the background. Downloads are streamed to partial
files, SHA-256 verified, safely extracted, fully validated, and then activated through an atomic
manifest switch.

If an exam route is active, a completed update remains pending until that route closes. Network
failures never replace valid installed content. A first launch without usable local content shows
download progress and a retry action inside the application.

Application releases continue to use normal `v*` tags and `.github/workflows/release.yml`. Content
publishing does not build or release an Electron installer.

## Aliyun OSS mirror (content downloads for mainland users)

GitHub and its `v6.gh-proxy.org` proxy are slow or unreachable for many mainland users. The app
downloads content with **OSS first, GitHub fallback** so that mainland users fetch manifests and
pack archives from Aliyun OSS directly. GitHub remains the single source of truth; OSS is a
mirror/acceleration layer.

### Publishing

`npm run content:publish` keeps uploading changed packs to the GitHub `content-<hash>` pre-release and
pushing the manifest to the `content` branch (unchanged). It additionally mirrors content to OSS:

```
oss://justtofu-downloads/releases/content/<manifest-id-short-hash>/   (changed archives + manifest.json)
oss://justtofu-downloads/releases/content/manifest.json               (latest pointer, overwritten)
```

- Stable pointer: a client must fetch the manifest before it can know any content hash, so every
  publish also overwrites the single object `releases/content/manifest.json` with the current
  manifest. It is the **only** object that is ever overwritten.
- Hash-addressed directories stay immutable: one directory per publish that added archives
  (`<manifestId>` first 12 chars), **never overwritten**. Content is hash-addressed: a client
  manifest may reference any historical hash (rollback / multi-version coexistence), so unlike the
  app's `releases/latest/` overwrite pattern, content directories must persist.
- Granularity: a publish mirrors only the archives it actually changes (the same set uploaded to the
  GitHub release). Unchanged packs **reuse their existing `ossUrl`** from the previous manifest,
  exactly like `pack.url` reuse on GitHub. On the first OSS-enabled publish, or to heal a failed
  mirror, packs without an `ossUrl` are downloaded from GitHub, verified by size + SHA-256, uploaded,
  and the `content` branch manifest is re-pushed with the same `manifestId` now carrying `ossUrl`.
- Files mirrored per directory: the `.zip` archives + `manifest.json`, all uploaded with
  `--acl public-read`. The mirror step is idempotent and can be re-run.
- Credentials: publishing talks to GitHub (existing `gh` auth) and to OSS through `ossutil`, using
  the same environment contract as the app-update mirror (`OSS_ENDPOINT` / `OSS_BUCKET` /
  `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`, or a pre-configured ossutil profile). The object
  storage endpoint host must be the production bucket hostname so that generated `ossUrl` values
  match the objects that were uploaded.
- OSS mirror failure never blocks the GitHub publish (content remains reachable via GitHub); any
  archives whose upload failed are simply left without an `ossUrl` in that manifest. Rerunning
  `npm run content:publish` heals the mirror as described above.
- When a publish cannot reach OSS (for example no local ossutil credentials), run the dispatchable
  `content-oss-mirror` GitHub Actions workflow after the publish: it mirrors every pack that still
  lacks an `ossUrl` (downloading the archives from GitHub, verifying size + SHA-256) and updates the
  directory + pointer manifests. It is idempotent and safe to re-run at any time.

### Manifest shape

- `pack.url` stays the GitHub (proxied) URL -> fallback source + compatibility with old clients.
- Every pack gains an explicit `ossUrl` field:
  `ossUrl = <CONTENT_OSS_BASE>/<manifest-id-short-hash>/<fileName>`
  where `CONTENT_OSS_BASE = https://justtofu-downloads.oss-cn-hangzhou.aliyuncs.com/releases/content/`
  (the desktop client reads it from `TOEFL_CONTENT_OSS_BASE`; trailing slash optional) and `fileName`
  matches the archive name produced by `writePackArchive`
  (`sanitizePackId(id)-<contentHash first 12>.zip`). An unchanged pack reuses the `ossUrl` from the
  manifest that last changed it, so its hash-addressed directory always contains the referenced file.
- `manifestId` is unchanged: `canonicalContentPacks` hashes only `[id, contentHash]`, so adding
  `ossUrl` does not alter the manifest id or break installed-content validation.
- Old clients ignore the extra `ossUrl` field and keep using `pack.url` (GitHub proxy): behaviour
  is unchanged until they upgrade to a build with OSS-first logic.

### Client resolution order

- Manifest: try the OSS pointer copy first, fall back to the GitHub `content` branch URL. Any source
  failure (timeout / network error / non-200 / truncated or invalid content) is retried up to twice
  before moving to the next source, because transient OSS failures often succeed on a retry.
- Pack archive: try `pack.ossUrl` first, fall back to `pack.url`; same retry-then-fallback policy.
- Trusted download hosts are a hard-coded allow-list: GitHub hosts plus the Aliyun OSS family
  (`*.aliyuncs.com`, which includes `justtofu-downloads.oss-cn-hangzhou.aliyuncs.com` and any OSS
  302 redirect target). Arbitrary URLs remain rejected. Pack bytes are always SHA-256-verified after
  download, so the widened host set does not weaken content integrity.

### Scope notes

- The desktop app update feed is OSS-only (no GitHub fallback): `electron-updater` uses a single
  generic feed URL. macOS manual DMG downloads (`electron/services/manual-mac-update.js`) move to
  OSS-first with a GitHub fallback, reading the DMG from the OSS update base
  (`OSS_UPDATE_BASE_URL`, default the production `releases/latest/` base).
- Version plan: client OSS-fallback logic ships with `v1.9.0`; content OSS mirroring can ship
  earlier because `ossUrl` is additive. The OSS pointer and a manifest with `ossUrl` must be
  published before the first `v1.9.0` client rolls out (otherwise the OSS-first fetch 404s and
  falls back to GitHub, which is graceful but slower).

## One-time 1.5 migration order

The media files removed from Git tracking remain in the maintainer's working tree. Preserve that
working tree until the first content publication is complete:

1. commit and push the 1.5 implementation and media removals;
2. run `npm run content:publish` from that same checkout;
3. confirm that the generated `content` branch and `content-<hash>` pre-release exist; and
4. only then create and push the normal `v1.5.0` application tag.

Do not clone a fresh checkout between steps 1 and 2: the ignored media is intentionally no longer
available from Git. Existing 1.4 installations keep their legacy local content until the first
pack update is downloaded and activated successfully.
