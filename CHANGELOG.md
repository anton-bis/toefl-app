# Changelog

## [Unreleased]

### Highlights

- Rebuilt all four section results pages around concise, in-page answer review cards.
- Extended question-status visibility across reading, listening, speaking, and writing without weakening sequential test rules.

### Added

- Folded Module / Task answer cards showing the submitted answer and the correct answer where applicable.
- Results-page playback and transcripts for listening and speaking prompts, plus on-demand playback of recorded speaking responses.
- Status-only Questions panels for listening, speaking, Write Email, and Academic Discussion; these panels cannot navigate or mark questions.

### Changed

- Reading and Build a Sentence retain Questions-panel navigation within their valid Module / Task scope.
- Non-fill question prompts, answer choices, passages, and writing context use larger responsive type; Complete Words sizing remains unchanged.
- Results review uses compact typography and answer rows, keeps prompts and transcripts in the expandable summary instead of repeating them in the body, and balances Module, Task, question, and option spacing.
- Results expose only the 6-point display score while retaining question counts and accuracy.
- Segment audio can be paused and replayed from its exact start without playing beyond its configured end.

### Removed

- Removed result-page question grids, the separate Review Answers / Detailed Review flow, and completed-attempt question-page navigation.
- Removed obsolete completed-page compatibility branches, read-only question props, answer-reveal styling, and related header actions.

## [1.7.0] - 2026-08-18

### Highlights

- Added the 2026-01-28 real-exam question bank (reading, listening, speaking, writing) with enhanced audio.
- Root-cause fixes for reading daily-life rendering: subtype-aware parsing and automatic title extraction.

### Added

- 2026-01-28 real exam four-section question bank (Official Tests panel).
- Reading parser now rejects unknown daily-life subtypes at parse time instead of silently mis-rendering them.
- Label / Receipt / Advertisement cards automatically use the first content line as their title; receipt keeps its date line in the body.
- Advertisement gets an explicit rendering branch with a grey header (matches label style).
- Social-media posts render inside the phone container (consistent with text-chain).

### Changed

- Listening and speaking audio are loudness-normalized and presence-enhanced (EQ + soft limit), keeping original durations and timestamps.
- Listening M2 Q6-7 conversation uses an AI-narrated audio track.

### Fixed

- Reading page instruction now shows "Read a label" / "Read a receipt" instead of falling back to "Read a passage".
- Electron production bundle is built with a relative asset base so the app no longer opens a blank window.

## [1.6.0] - 2026-08-16

### Highlights

- Added the 2026-01-27 real-exam question bank with AI-narrated per-question audio.
- Split the home catalog into Practice Tests and Official Tests panels.
- Restored missing listening/speaking audio for TPO-05/06/07.

### Added

- Official real-exam questions (TPO 01-27) with per-question AI audio (Edge TTS).
- Official Tests catalog panel; date-based exam folders are indexed alongside TPO folders.
- docs/question-submission-workflow.md and avatar-library conventions.

### Changed

- Speaking/listening parsers support per-question audio (whole-file + timestamps, or per-question files).
- Academic-discussion layout: professor avatar and student avatars rendered as images.
- Reading fixes: announcement passage no longer truncated by numbered lists; title metadata; paragraph-scoped phrase highlighting; complete-words blank counts follow answers.
- Results page navigation for grouped complete-words questions.

### Fixed

- Speaking exit/restart: recordingRepository.removeAttempt replaces the missing removeSession call.
- Listening and speaking section media referenced by markdown is now restored and packaged.

## [1.5.2] - 2026-07-27

### Fixed

- Restored finite audio durations and seeking for question prompts and recorded responses in packaged desktop builds.
- Allowed packaged renderer requests to load installed question-bank files through the secure custom content protocol.
- Kept question-catalog loading failures recoverable without reloading the app or downloading valid content again.

### Changed

- Renamed the reading completion task to “Fill in the missing letters,” removed its repeated passage introduction, and enlarged its desktop reading layout.
- Replaced the unstyled first-run question-bank status text with a responsive download, preparation, and retry experience.
- Refined question-bank wording and balanced the update notification's action and dismiss controls.

## [1.5.1] - 2026-07-26

### Highlights

- Reduced desktop download and build sizes without removing learning features or Chinese content support.

### Fixes

- Selected the correct Intel or Apple Silicon DMG when downloading a manual macOS update.

### Build and Packaging Improvements

- Stopped copying independently published question-bank media into Electron's intermediate `dist` directory.
- Kept only the actively used `en-US` Chromium locale; Chinese text, filenames, input methods, and native system dialogs remain provided by the operating system.
- Replaced the universal macOS package with smaller x64 and arm64 downloads and generated architecture-aware SHA-512 update metadata.

## [1.5.0] - 2026-07-26

### Highlights

- Separated the question bank from desktop installers into content-addressed GitHub Release packs.
- Added automatic first-launch installation and background question-bank updates with no user commands or manual content versions.
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
- Updated vulnerable transitive build dependencies to patched versions without changing production runtime dependencies.

## [1.4.2] - 2026-07-18

### Highlights

- Refined exam and practice navigation, layouts, instructions, and results across the reading, listening, speaking, and writing sections.
- Added an extensible AI scoring foundation for speaking and writing while preserving the TOEFL scoring references.
- Made question content faster and safer to load and update, moved desktop learning data to SQLite, and reduced unnecessary renderer and background work.

### Fixes

- Corrected reading question numbering and kept passages stable while moving between questions.

### Build and Packaging Improvements

- Rebuilt release packaging for consistent Windows, Linux, and universal macOS artifacts, automatic updates, and SHA-256 verification.
- Moved bundled content outside the ASAR and made optional signing safe for universal macOS packaging.
- Simplified the application architecture, removed obsolete code and assets, and expanded automated coverage for the main runtime and release paths.

[Unreleased]: https://github.com/anton-bis/toefl-app/compare/v1.5.2...HEAD
[1.5.2]: https://github.com/anton-bis/toefl-app/compare/v1.5.1...v1.5.2
[1.5.1]: https://github.com/anton-bis/toefl-app/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/anton-bis/toefl-app/compare/v1.4.2...v1.5.0
[1.4.2]: https://github.com/anton-bis/toefl-app/compare/v1.4.1...v1.4.2
