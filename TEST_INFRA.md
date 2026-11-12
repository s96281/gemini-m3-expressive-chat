# E2E Test Infra: Material 3 Expressive AI Chat Web Application

## Test Philosophy
- Opaque-box, requirement-driven verification derived from `ORIGINAL_REQUEST.md` and `PROJECT.md`.
- No reliance on internal module implementation details — tests exercise the UI via real DOM interactions, keyboard shortcuts, and state events.
- Progressive testability: Tier 1 tests verify basic visibility, navigation, and theme switches even before full streaming is enabled.

## Feature Inventory Coverage Matrix
| # | Feature ID | Feature Name | Tier 1 (Coverage >=5) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Scenario) |
|---|:---|:---|:---:|:---:|:---:|:---:|
| 1 | NAV-01 | New Chat Creation | 5 | ✓ | ✓ | ✓ |
| 2 | NAV-02 | Chronological Session Grouping | 5 | ✓ | ✓ | |
| 3 | NAV-03 | Real-Time Session Search & Filter | 5 | ✓ | | |
| 4 | NAV-04 | Pin / Star Chat Sessions | 5 | ✓ | ✓ | |
| 5 | NAV-05 | Auto-Title & Inline Session Rename | 5 | ✓ | | |
| 6 | NAV-06 | Session Deletion (Single & Bulk) | 5 | ✓ | | |
| 7 | NAV-07 | Multi-Format Session Export | 5 | ✓ | ✓ | ✓ |
| 8 | NAV-08 | Expressive Navigation Drawer & Rail | 5 | ✓ | | |
| 9 | CONV-01 | Zero-State Greeting & Starter Chips | 5 | ✓ | | ✓ |
| 10 | CONV-02 | M3 Expressive Message Bubbles | 5 | ✓ | ✓ | ✓ |
| 11 | CONV-03 | Token-by-Token Streaming Engine | 5 | ✓ | ✓ | ✓ |
| 12 | CONV-04 | "Thinking..." Reasoning Accordion | 5 | ✓ | ✓ | ✓ |
| 13 | CONV-05 | Stop Generation Control | 5 | ✓ | ✓ | |
| 14 | CONV-06 | Regenerate Response | 5 | ✓ | ✓ | |
| 15 | CONV-07 | Conversation Branching & Stepper | 5 | ✓ | ✓ | ✓ |
| 16 | CONV-08 | Message Action Toolbar | 5 | ✓ | | |
| 17 | CONV-09 | Auto-Scroll & Scroll-to-Bottom FAB | 5 | ✓ | | |
| 18 | DOCK-01 | Floating M3 Pill Input Dock | 5 | ✓ | | |
| 19 | DOCK-02 | Auto-Expanding Textarea | 5 | ✓ | | |
| 20 | DOCK-03 | Morphing Send / Stop Button | 5 | ✓ | | |
| 21 | DOCK-04 | Model Selector Pill & Menu | 5 | ✓ | ✓ | |
| 22 | DOCK-05 | File & Image Attachment Chips | 5 | ✓ | ✓ | ✓ |
| 23 | DOCK-06 | Voice Input / Speech-to-Text | 5 | ✓ | | |
| 24 | DOCK-07 | Keyboard Shortcuts System | 5 | ✓ | ✓ | |
| 25 | RICH-01 | Comprehensive Markdown Engine | 5 | ✓ | ✓ | ✓ |
| 26 | RICH-02 | Syntax-Highlighted Code Blocks | 5 | ✓ | ✓ | ✓ |
| 27 | RICH-03 | Interactive Code Artifact Sandbox | 5 | ✓ | ✓ | ✓ |
| 28 | RICH-04 | KaTeX Mathematical Equations | 5 | ✓ | | |
| 29 | RICH-05 | Interactive Data Tables | 5 | ✓ | | ✓ |
| 30 | SET-01 | M3 Expressive Settings Dialog | 5 | ✓ | | |
| 31 | SET-02 | AI Personas & System Prompt | 5 | ✓ | ✓ | ✓ |
| 32 | SET-03 | Engine Mode & API Configuration | 5 | ✓ | | |
| 33 | SET-04 | Generation Hyperparameters | 5 | ✓ | | |
| 34 | SET-05 | Data Backup, Import & Clear Storage | 5 | ✓ | ✓ | |
| 35 | THEME-01 | Dynamic M3 Theme Palette | 5 | ✓ | | |
| 36 | THEME-02 | Tonal Container Elevation System | 5 | ✓ | | |
| 37 | THEME-03 | Adaptive Multi-Device Breakpoints | 5 | ✓ | | |
| 38 | THEME-04 | Accessibility & Focus Tokens | 5 | ✓ | | |

---

## Test Architecture
- **Runner**: Playwright E2E runner (configured to use `/usr/bin/google-chrome` with `--no-sandbox`) + Vitest for component tests.
- **Base URL**: `http://localhost:5173`
- **Output Artifact**: Publishes `TEST_READY.md` once the test suite is ready and validated.
- **Pass Semantics**: All test suites execute with exit code 0 and 0 failures.

---

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|:---|:---|:---|
| 1 | Full-Stack Coding & Sandbox Execution | DOCK-01..05, CONV-02..04, RICH-01..03, NAV-05 | High |
| 2 | Multimodal Research & Math Analysis | DOCK-05, CONV-04, RICH-04, RICH-05, NAV-07 | High |
| 3 | Deep Tree Branching & Multi-Turn Exploration | CONV-06, CONV-07, NAV-02, NAV-04, SET-02 | High |
| 4 | Offline Backup, Wipe & Restore Lifecycle | SET-01, SET-05, NAV-01..07, THEME-01 | Medium |
| 5 | Live Persona Shift & Responsive Workflow | THEME-01..04, SET-02, DOCK-04, CONV-01 | Medium |
