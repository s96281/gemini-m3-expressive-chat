# E2E Test Suite Ready

## Test Runner
- Command: `npx playwright test`
- Framework: Playwright (with `/usr/bin/google-chrome` headless)
- Expected: All tests pass with exit code 0 against `http://localhost:5173`

## Coverage Summary
| Tier | Count | Description |
|------|------:|-------------|
| 1. Feature Coverage | 190 | >=5 tests per feature across all 38 features (NAV, CONV, DOCK, RICH, SET, THEME) |
| 2. Boundary & Corner | 12 | Edge cases: empty prompt, long text, fast stream abort, rapid theme switch |
| 3. Cross-Feature | 8 | Pairwise: edit mid-stream, branch switch + export, code artifact + copy |
| 4. Real-World Application | 5 | End-to-end full workflows: coding sandbox, research math, deep tree, backup/restore |
| **Total** | **215** | Exhaustive coverage across 9 test files |

## Feature Checklist
| Feature Domain | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Spec File |
|---|:---:|:---:|:---:|:---:|---|
| Navigation & Shell (NAV-08, CONV-01, THEME-01..04) | 30 | ✓ | ✓ | ✓ | `tests/e2e/tier1-features/navigation.spec.ts` |
| Session Management (NAV-01..07) | 35 | ✓ | ✓ | ✓ | `tests/e2e/tier1-features/sessions.spec.ts` |
| Conversation & Streaming (CONV-02..09) | 40 | ✓ | ✓ | ✓ | `tests/e2e/tier1-features/conversation.spec.ts` |
| Input Dock & Controls (DOCK-01..07) | 35 | ✓ | ✓ | ✓ | `tests/e2e/tier1-features/input-dock.spec.ts` |
| Rich Content & Code Artifacts (RICH-01..05) | 25 | ✓ | ✓ | ✓ | `tests/e2e/tier1-features/rich-content.spec.ts` |
| Settings & Personas (SET-01..05) | 25 | ✓ | ✓ | ✓ | `tests/e2e/tier1-features/settings.spec.ts` |
| Boundary & Corner Scenarios | — | 12 | — | — | `tests/e2e/tier2-boundary/boundary.spec.ts` |
| Cross-Feature Combinations | — | — | 8 | — | `tests/e2e/tier3-combinations/combinations.spec.ts` |
| Real-World Application Workflows | — | — | — | 5 | `tests/e2e/tier4-scenarios/scenarios.spec.ts` |
