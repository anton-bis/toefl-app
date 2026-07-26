# Changelog

## [Unreleased]

### Fixed

- Allowed packaged renderer requests to load installed question-bank files through the secure custom content protocol.
- Kept question-catalog loading failures recoverable without reloading the app or downloading valid content again.
- Kept update metadata filenames stable for automatically versioned prerelease builds.

### Changed

- Routed GitHub-hosted application updates and question-bank downloads through the configured HTTPS proxy.
- Replaced the unstyled first-run question-bank status text with a responsive download, preparation, and retry experience.
- Added automatic, uniquely versioned develop-branch prereleases without affecting stable releases or automatic updates.

## [1.5.1] - 2026-07-26

### Highlights

- Reduced desktop download and build sizes without removing learning features or Chinese content support.

### Fixes

- Selected the correct Intel or Apple Silicon DMG when downloading a manual macOS update.

### Build and Packaging Improvements

- Stopped copying independently published question-bank media into Electron's intermediate `dist` directory.
- Kept only the actively used `en-US` Chromium locale; Chinese text, filenames, input methods, and native system dialogs remain provided by the operating system.
- Replaced the universal macOS package with smaller x64 and arm64 downloads and generated architecture-aware SHA-512 update metadata.
- Streamed release hashing instead of loading complete installers into memory and removed redundant generated GitHub release notes.

## [1.5.0] - 2026-07-26

### Highlights

- Separated the question bank from desktop installers into content-addressed GitHub Release packs.
- Added automatic first-launch installation and background question-bank updates with no user commands or manual content versions.
- Added one-command maintainer publishing and restoration while keeping question-bank media out of future Git history.
- Reworked desktop application updates around a persistent, retryable state model with automatic recovery after connectivity and power-state changes.

### Fixes

- Fixed compiled question metadata validation when opening exams from the home catalog.
- Kept the desktop header and navigation stable while scrolling the TPO content pane.
- Deferred validated content activation until an active exam closes and preserved usable local content across network failures.
- Made desktop update checks recover promptly after offline, minimized, and system-sleep periods without creating duplicate timers.
- Preserved update state across renderer reloads, added actionable retries, and saved current practice data before installing an app update.
- Prevented application installation while an exam is active, kept update notices out of exam screens, and bounded release-note content shown in the app.
- Coalesced overlapping checks, preserved downloaded-update state, and prevented update events from targeting a closed renderer.

### Build and Packaging Improvements

- Kept macOS releases available without a paid Apple account by downloading the DMG inside the app, verifying its SHA-512 hash, and opening it for prompted manual installation.
- Removed browser-facing repository links and packaged repository metadata while retaining GitHub-backed application and question-bank delivery.
- Added automatic macOS installation guidance to release notes and made unsigned builds explicit when no Apple credentials are configured.
- Removed obsolete update IPC, duplicate scheduling paths, unused update-store code, and the release workflow's non-publishing manual trigger.
- Updated vulnerable transitive build dependencies to patched versions without changing production runtime dependencies.

## [1.4.2] - 2026-07-18

### Highlights

- Refined exam and practice navigation, layouts, instructions, and results across the reading, listening, speaking, and writing sections.
- Added an extensible AI scoring foundation for speaking and writing while preserving the TOEFL scoring references.
- Made question content faster and safer to load and update, moved desktop learning data to SQLite, and reduced unnecessary renderer and background work.

### Fixes

- Corrected reading question numbering and kept passages stable while moving between questions.
- Updated CI and Electron preparation to use the supported Node.js toolchain and a reproducible staging flow.

### Build and Packaging Improvements

- Rebuilt release packaging for consistent Windows, Linux, and universal macOS artifacts, automatic updates, and SHA-256 verification.
- Moved bundled content outside the ASAR and made optional signing safe for universal macOS packaging.
- Simplified the application architecture, removed obsolete code and assets, and expanded automated coverage for the main runtime and release paths.

[Unreleased]: https://github.com/anton-bis/toefl-app/compare/v1.5.1...HEAD
[1.5.1]: https://github.com/anton-bis/toefl-app/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/anton-bis/toefl-app/compare/v1.4.2...v1.5.0
[1.4.2]: https://github.com/anton-bis/toefl-app/compare/v1.4.1...v1.4.2
