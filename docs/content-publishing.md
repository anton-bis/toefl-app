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
