# Changelog

## [Unreleased]

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

[Unreleased]: https://github.com/anton-bis/toefl-app/compare/v1.4.2...HEAD
[1.4.2]: https://github.com/anton-bis/toefl-app/compare/v1.4.1...v1.4.2
