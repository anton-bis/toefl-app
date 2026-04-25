Date: 2026-04-26

- Task: Finalize button/navigation behavior on the Reading Results page.
- What I changed:
  - Removed the Detailed Review button from the DOM when there is no content to review (previously only hidden). This avoids unnecessary UI elements when not applicable.
  - Updated Restart Test workflow to navigate to the canonical Reading start page: reading_start_page.html (instead of start.html).
  - Verified that the Home button navigates to the root Index page (index.html) as expected.
- Rationale (Why): Ensures a consistent and accessible navigation experience, reduces stray UI elements, and aligns with the project’s canonical start page naming.
- Verification plan: manual checks or tests to confirm navigation targets and visibility behavior; HTML syntax verified with lsp_diagnostics after edits.
- Next steps: run a quick regression check across related templates to ensure there are no broken anchors or broken links after removing the review button.
# Learning: Per-question status rendering and navigation (Reading Score v2)
- Implemented a per-question status rendering system driven by localStorage keys:
  toefl_tpo01_reading_M1_Task{N}_correct and toefl_tpo01_reading_M1_Task{N}_total.
- Added a status toolbar at the results page that visually encodes:
  - green for correct, red for wrong, grey for unanswered
  - precise blank indicators for Fill-in-the-blank questions via data attributes
- Created a new JS module: assets/score/test-status.js to read localStorage and render anchors
- Created a new CSS file: assets/score/results.css for status chips and blank indicators
- Updated templates/general/results-page-template.html to load the new assets, render a status bar, and ensure anchors exist (question-idx-N)
- Ensured accessibility: status chips have descriptive aria-labels; blank indicators use ARIA-friendly classes
- Validation plan: verify that clicking on a status dot scrolls to the corresponding question; statuses reflect localStorage data on load; Fill-in-the-blank indices display correctly
- Risks/Notes: CSP nonce handling updated by adding nonce to test-status.js script tag; if CSP blocks, adjust nonce handling per CSP setup
- Unified score counting logic across TOEFL reading templates by introducing a single external renderer (assets/score/render_reading_score.js). The renderer aggregates scores from multiple modules/tasks and updates the results UI via a consistent localStorage key scheme, while also supporting CSP nonce scenarios for safer inline usage.
- Replaced per-template inline score state updates with calls to the external renderer. Updated templates to remove direct DOM score updates and rely on the shared script for totals, accuracy, and progress where appropriate.
- Extended render_reading_score.js to detect multiple possible key patterns (e.g. toefl_reading_M1_TaskX_total, toefl_reading_M2_TaskY_total, and tpo01-prefixed variants) to ensure backward compatibility with existing templates.
- Added CSP nonce support on the external script tag in all affected templates to align with a strict CSP policy (nonce-based inline script policy).
- Next steps: run design-system validations, verify with unit/UI tests, and perform end-to-end verification across all reading tasks (Read a Text Chain, Read Academic Passage, Fill in Missing Letters, Read an Email) to ensure scores render correctly and no double-counting occurs.
