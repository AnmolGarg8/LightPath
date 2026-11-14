# NASA Space Apps Challenge 2026 — Final Submission Checklist

This document is the official pre-submission compliance checklist for LightPath. It provides an automated verification protocol ensuring all project rules, citation mandates, open source licensing terms, and AI disclosures are met before final submission to the NASA Space Apps Challenge portal.

---

## 1. Verified Release Documents (Enforced Zero-Placeholder)

The following files have been verified by automated tests to ensure they contain **zero unresolved placeholders** (e.g. `TODO`, `FIXME`, `TBD`, `PLACEHOLDER`, untracked bracketed tokens). `tests/test_final_checklist.py` audits these files directly and fails if any placeholder remains:

- `docs/CREDITS.md`
- `docs/REFERENCES_FOR_FORM.md`
- `docs/THIRD_PARTY_LICENSES.md`
- `configs/pipeline.yaml`
- `configs/terrain_windows.yaml`

---

## 2. Pre-Submission Human Completion Items

In accordance with Rule 2 (*Never invent facts or identities*) and NASA Space Apps Participant Terms, the following files intentionally contain human placeholders that **must be completed by team members** before final project submission:

1. **`LICENSE`**:
   - **Current State**: Contains `[Human Contributors to be filled by team]`.
   - **Action Required**: Replace the placeholder with the real names or team moniker of the human participants.
2. **`docs/AI_DISCLOSURE.md`**:
   - **Current State**: Contains bracketed placeholders for human reviewer names, roles, and dates.
   - **Action Required**: Each team member must fill in their review statement confirming what pipeline code, web UI, or citations they personally verified.
3. **`docs/CHALLENGE_STATEMENT.md`**:
   - **Current State**: Contains `<!-- [PLACEHOLDER: Paste official NASA Space Apps Challenge text here] -->`.
   - **Action Required**: Paste the challenge statement text and designated category directly from the official NASA portal.

---

## 3. Pre-Submission Verification Gate

Once the human team members have completed the items above, run the full submission gate to verify that **zero placeholders remain across the entire checklist**:

```bash
# Set environment flag to enforce full submission audit
CHECK_SUBMISSION_READY=1 pytest tests/test_final_checklist.py -v
```

If any placeholder remains in any checklist file, `tests/test_final_checklist.py` will fail and print the exact file name, line number, and offending placeholder.

---

## 4. Final Submission Readiness Checklist

The following tick boxes must all be confirmed green prior to project submission on the NASA Space Apps Challenge portal:

- [ ] **Tests and smoke tests green**: All 203 Python tests (`pytest`) and 116 web tests (`vitest`), plus Playwright E2E smoke tests (`npm --prefix web run test:e2e`), pass with zero failures.
- [ ] **claims_guard green**: Automated scanner (`python scripts/claims_guard.py`) confirms 0 forbidden phrases or unsupported claims across all 569 repository files.
- [ ] **Live site opens on a phone**: GitHub Pages production deployment (`https://AnmolGarg8.github.io/Lunar/`) loads and renders responsively on mobile device viewports.
- [ ] **Video plays and has no music, minors or unreleased third-party material**: The 90-second headless demonstration video (`docs/demo.webm`) plays cleanly with legible caption overlays, containing no music, no voice track, no minors, and no unreleased third-party media.
- [ ] **Every cited source is listed in REFERENCES_FOR_FORM.md**: All external authorities, papers, DOIs, and ephemeris kernels match line-for-line between `docs/CREDITS.md` and `docs/REFERENCES_FOR_FORM.md`.
- [ ] **Licences listed**: Third-party dependencies (336 packages) are fully audited in `docs/THIRD_PARTY_LICENSES.md` and accessible via `#/licenses`.
- [ ] **Names, credits and disclosure completed by humans**: Human participant names are filled in `LICENSE`, `docs/CREDITS.md`, and reviewer statements in `docs/AI_DISCLOSURE.md`.
- [ ] **Submission form drafted before 15 Nov 18:00 local time**: All submission text from `docs/SUBMISSION.md` and references from `docs/REFERENCES_FOR_FORM.md` are copied into the NASA portal draft before the official deadline (15 Nov 18:00 local time).
