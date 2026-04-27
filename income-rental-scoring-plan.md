# Fix Income and Rental Scoring Plan

## Problem Summary
- Income is sometimes shown as `0/30` and `0.0x` even when an income value exists.
- Rental history can remain `Months rented: Unknown` and show `Rental behavior: Bad` after a reference is submitted.
- Rental behavior must be binary per your rule: **Good = 20/20** when reference quality is present/positive, otherwise **None = 0/20** (no partial score).

## Root Causes Confirmed
- Income scoring currently depends on submitted docs containing `proof_of_income` in addition to `weeklyIncome`, so valid income can be ignored in scoring ([`/Users/sahil/TenantLens/src/lib/scoring.ts`](/Users/sahil/TenantLens/src/lib/scoring.ts)).
- Reanalysis currently filters `submitted_documents` to property-required docs only, which can drop `proof_of_income` / `references` from applicant evidence tracking when those docs are not required for that property ([`/Users/sahil/TenantLens/src/app/api/applicant-pdfs/reanalyze-stored/route.ts`](/Users/sahil/TenantLens/src/app/api/applicant-pdfs/reanalyze-stored/route.ts)).
- Rental history scoring today is split into tenure + recommendation (0-20 with partial values), and UI label maps low score to `Bad`; this conflicts with requested binary behavior ([`/Users/sahil/TenantLens/src/lib/scoring.ts`](/Users/sahil/TenantLens/src/lib/scoring.ts), [`/Users/sahil/TenantLens/src/components/ApplicantDrawer.tsx`](/Users/sahil/TenantLens/src/components/ApplicantDrawer.tsx)).

## Phase 1: Income Scoring Reliability
- Update income scoring logic to use `weeklyIncome` + `property.weeklyRent` directly for ratio/score, without hard-gating on `proof_of_income` submission.
- Preserve safety checks for invalid values (`weeklyIncome <= 0`, `weeklyRent <= 0`) and define consistent UI fallback text for these edge cases.
- Ensure ratio shown in applicant details is consistent with score logic across drawer and comparison views.

## Phase 2: Persist/Respect Evidence from Uploaded PDFs
- Adjust reanalysis merge behavior so inferred uploaded doc evidence is not lost due to required-doc filtering.
- Keep required-doc filtering for completeness score only, but maintain a broader evidence set for income/reference scoring signals.
- Verify that uploading payslip/reference updates `weeklyIncome`, `monthsRenting`, and recommendation fields in stored applicant state.

## Phase 3: Rental History to Binary 0/20 Rule
- Refactor rental history scoring to match your requirement:
  - `20/20` when valid positive/acceptable reference behavior is present.
  - `0/20` when reference is missing/unusable (`None`).
- Remove partial tenure/recommendation combination for scoring output.
- Update UI labeling from `Good/Bad` to `Good/None` so it matches scoring semantics.

## Phase 4: Parser/UX Guardrails for "Unknown" Cases
- Improve reference parsing fallback behavior so "reference submitted but not extractable" is surfaced clearly as manual-review-needed (not silently treated as a negative behavior).
- Ensure months display logic distinguishes "not provided / not extracted" vs truly known months.
- Keep manual-review flags aligned with extraction failure states to prevent misleading scores.

## Phase 5: Test Coverage and Regression Safety
- Update/add scoring tests for:
  - income scoring when income exists but proof document key is absent,
  - rental-history binary `0 or 20` behavior,
  - `Good/None` label behavior.
- Add/adjust reanalysis tests for document merge behavior and retained evidence fields.
- Validate affected parser and integration tests under `src/lib/pdf` and `src/lib` before shipping.

## Deliverables
- Logic updates in:
  - [`/Users/sahil/TenantLens/src/lib/scoring.ts`](/Users/sahil/TenantLens/src/lib/scoring.ts)
  - [`/Users/sahil/TenantLens/src/app/api/applicant-pdfs/reanalyze-stored/route.ts`](/Users/sahil/TenantLens/src/app/api/applicant-pdfs/reanalyze-stored/route.ts)
  - [`/Users/sahil/TenantLens/src/components/ApplicantDrawer.tsx`](/Users/sahil/TenantLens/src/components/ApplicantDrawer.tsx)
  - (if needed) [`/Users/sahil/TenantLens/src/components/CompareDialog.tsx`](/Users/sahil/TenantLens/src/components/CompareDialog.tsx)
- Test updates in:
  - [`/Users/sahil/TenantLens/src/lib/scoring.test.ts`](/Users/sahil/TenantLens/src/lib/scoring.test.ts)
  - related PDF/reanalysis tests in `src/lib/pdf/*`.

## Acceptance Criteria
- Applicant with valid income no longer shows `0/30` and `0.0x` unless income/rent truly invalid.
- Reference submission no longer defaults to misleading `Bad` behavior when extraction is missing.
- Rental history score is strictly binary `0/20` or `20/20` as requested.
- Test suite passes for updated scoring + reanalysis paths.
