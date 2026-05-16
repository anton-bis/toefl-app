# Fix Main Index to Show All TPOs and Verify Navigation

## TL;DR
> **Summary**: Update generation script to include all available TPOs in main index, regenerate pages, and verify end-to-end navigation flow for both TPO-01 and TPO-02.
> **Deliverables**: Updated main index listing all TPOs, functional navigation between TPOs, verified question flow within each TPO
> **Effort**: Short
> **Parallel**: NO
> **Critical Path**: Update script → Regenerate → Verify TPO-01 → Verify TPO-02

## Context
### Original Request
Fix TPO index page generation, navigation flow, CSS/path issues, and JavaScript structure to ensure proper TOEFL practice test navigation from Main Index through all modules to results.

### Interview Summary
- Fixed TPO index page generation by moving code before return statement in generateTPO()
- Corrected CSS paths in 6 templates from `../../styles.css` to `../../../styles.css`
- Added support for both `{{BACK_PAGE}}/{{NEXT_PAGE}}` and `{{BACK_PAGE_URL}}/{{NEXT_PAGE_URL}}` placeholders
- Rewrote email template JavaScript to use single DOMContentLoaded listener
- Fixed hardcoded filenames in module intro pages to use dynamic first question filenames
- Regenerated TPO 01 pages with all fixes applied
- Removed old format files (reading_question*.html) from root directory
- User confirmed they want main index to show all available TPOs (TPO-01 and TPO-02)

### Metis Review (gaps addressed)
- Ensured generation script handles multiple TPOs dynamically
- Verified template placeholders work consistently across all question types
- Confirmed CSS paths resolve correctly from nested directories
- Validated navigation flow doesn't skip required steps (module intros, etc.)

## Work Objectives
### Core Objective
Generate main index that lists all available TPOs and ensure navigation works correctly for each TPO's complete flow.

### Deliverables
- Main index (`index.html`) listing TPO-01 and TPO-02 with links to their respective index pages
- TPO index pages (`tpo/01/index.html`, `tpo/02/index.html`) with working UI and module navigation
- All question pages within each TPO with functional Back/Next navigation
- Correct CSS loading on all pages
- Working timer and answer persistence

### Definition of Done (verifiable conditions with commands)
- Main index contains links to both `tpo/01/index.html` and `tpo/02/index.html`
- Clicking TPO-02 in main index navigates to `tpo/02/index.html`
- From TPO-02 index, clicking "Start" navigates to start page
- From start page, clicking nav items progresses through modules in order
- Back/Next buttons work correctly between all question types
- No JavaScript errors in console during full navigation cycle
- CSS loads properly on all pages (no unstyled content)

### Must Have
- Main index generated dynamically to include all TPOs found in `tpo/` directory
- Navigation flow: Main Index → TPO Index → Start Page → Module Intro → Questions → Module Intro → Questions → Results
- Functional Back/Next navigation at every step
- Correct CSS paths (`../../../styles.css`) for all question pages
- Single DOMContentLoaded listener in email template

### Must NOT Have
- Hardcoded TPO references in generation script (should scan directory)
- Dead code preventing TPO index generation
- CSS paths using `../../styles.css` (incorrect for nested directories)
- Multiple DOMContentLoaded listeners causing conflicts
- Hardcoded filenames in module intro pages
- Legacy format files in root directory causing navigation confusion

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + manual verification via Playwright
- QA policy: Every task has agent-executed scenarios
- Evidence: .sisyphus/evidence/task-{N}-{slug}.{ext}

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.

Wave 1: [foundation tasks with categories]
Wave 2: [dependent tasks with categories]

### Dependency Matrix (full, all tasks)
### Agent Dispatch Summary (wave → task count → categories)

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Update generation script to list all TPOs in main index

  **What to do**: Modify `generate_toefl_pages.js` to scan `tpo/` directory and generate index entries for each TPO found, instead of hardcoding only TPO-01
  
  **Must NOT do**: Hardcode TPO-01 or TPO-02; assume specific TPO numbering; break existing TPO-01 functionality

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Simple script modification to add directory scanning and loop
  - Skills: [`file-system`] - [needed to read tpo directory]
  - Omitted: [`ui-ux`] - [not needed for backend script change]

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2, 3, 4, 5] | Blocked By: []

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `src/generate_toefl_pages.js:680-720` - [current generateTPO function to modify]
  - Pattern: `src/generate_toefl_pages.js