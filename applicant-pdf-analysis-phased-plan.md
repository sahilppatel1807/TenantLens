# Applicant PDF Extraction and Save-Flow Plan

## Phase 1: Stabilize Reference Extraction Signal and Warning Logic

- Audit and tighten the condition that triggers the warning text so it reflects true extraction failures (not just missing tenure values).
- Replace the current broad heuristic in the add/edit UI with a single normalized rule derived from parser output (`extractionStatus`, parser confidence, and parsed reference fields).
- Preserve manual-review behavior for true failures while avoiding false positives for valid but partially structured reference letters.

Primary files:
- `/Users/sahil/TenantLens/src/components/AddApplicantDialog.tsx`
- `/Users/sahil/TenantLens/src/components/ApplicantDrawer.tsx`
- `/Users/sahil/TenantLens/src/lib/pdf/process-applicant-pdf-buffer.ts`
- `/Users/sahil/TenantLens/src/app/api/applicant-pdfs/reanalyze-stored/route.ts`

## Phase 2: Improve Reference Parsing Coverage for Good PDFs

- Expand reference-date/tenure extraction patterns to handle additional real-world formats likely present in your PDFs (e.g., month-year variants, tenancy wording variants, combined period statements).
- Add focused tests for the missed format(s) so the parser consistently returns `monthsRenting` when text is present.
- Keep `extractPdfText` constraints explicit (text-layer only) and distinguish “text extracted but no tenure pattern” from “text extraction failed”.

Primary files:
- `/Users/sahil/TenantLens/src/lib/pdf/parse-reference-letter.ts`
- `/Users/sahil/TenantLens/src/lib/pdf/process-applicant-pdf-buffer.ts`
- Related tests in `/Users/sahil/TenantLens/src/lib/pdf/*.test.ts`

## Phase 3: Unify Add/Edit Save Pipeline (Analyze on Save)

- Move edit flow to the same staged pipeline already used in add flow:
  1. analyze selected PDFs,
  2. save applicant data,
  3. upload PDFs,
  4. reanalyze stored docs,
  5. refresh UI.
- Ensure `Save applicant` is enabled when only PDF selection changed.
- Remove the separate `Upload & analyze PDFs` button in edit mode; keep only file selection + save action.
- Align save button progress states/messages with current analysis/upload/reanalysis stages.

Primary files:
- `/Users/sahil/TenantLens/src/components/ApplicantDrawer.tsx`
- `/Users/sahil/TenantLens/src/components/AddApplicantDialog.tsx`
- `/Users/sahil/TenantLens/src/lib/pdf/analyze-applicant-pdfs-client.ts`
- `/Users/sahil/TenantLens/src/lib/applicant-intake-storage.ts`

## Phase 4: Shared Helper and Regression Safety

- Extract duplicated client workflow (`analyze -> upload -> reanalyze`) into a shared helper used by both add and edit.
- Add/adjust tests for:
  - successful reference extraction,
  - partial extraction without false failure warning,
  - edit-save with selected PDFs triggering automatic analysis,
  - save button enabled when PDFs are selected.
- Run lint/tests for touched files and verify no UX regressions in applicant add/edit screens.

Primary files:
- `/Users/sahil/TenantLens/src/components/AddApplicantDialog.tsx`
- `/Users/sahil/TenantLens/src/components/ApplicantDrawer.tsx`
- Potential new helper under `/Users/sahil/TenantLens/src/lib/pdf/` (client workflow utility)

## Rollout Notes

- Keep API contracts unchanged unless strictly needed; prefer front-end flow and parser improvements first.
- If a specific sample PDF still fails after parser expansion, add a targeted parser test using sanitized extracted text fixture to close that gap permanently.
