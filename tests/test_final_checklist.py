"""Automated pre-submission checklist verification tests.

Governed by docs/PROJECT_RULES.md (Rule 1 & Rule 2):
- docs/FINAL_CHECKLIST.md defines files audited for unresolved placeholders.
- Verified release files MUST be 100% free of unresolved placeholders.
- If any placeholder remains in a checklist file, the test strictly fails.
- Pre-submission gate can be run with CHECK_SUBMISSION_READY=1 to audit all files.
"""

import os
import re
from pathlib import Path
import pytest

ROOT_DIR = Path(__file__).resolve().parent.parent
CHECKLIST_PATH = ROOT_DIR / "docs" / "FINAL_CHECKLIST.md"

# Patterns indicating unresolved placeholders
PLACEHOLDER_PATTERNS = [
    re.compile(r"\bTODO\b", re.IGNORECASE),
    re.compile(r"\bFIXME\b", re.IGNORECASE),
    re.compile(r"\bTBD\b", re.IGNORECASE),
    re.compile(r"\bPLACEHOLDER\b", re.IGNORECASE),
    re.compile(r"\[(?:to be completed|to be filled|insert names?)[^\]]*\]", re.IGNORECASE),
    re.compile(r"\[Human (?:Reviewer|Contributors?)[^\]]*\]", re.IGNORECASE),
]


def find_placeholders_in_file(file_path: Path):
    """Scan a text file for unresolved placeholders and return list of (line_num, match_text)."""
    assert file_path.exists(), f"File does not exist: {file_path}"
    content = file_path.read_text(encoding="utf-8")
    findings = []

    for line_idx, line in enumerate(content.splitlines(), start=1):
        for pattern in PLACEHOLDER_PATTERNS:
            match = pattern.search(line)
            if match:
                findings.append((line_idx, match.group(0), line.strip()))
                break
    return findings


def get_checklist_files_from_section(checklist_text: str, section_header: str) -> list[str]:
    """Extract list of relative file paths under a specific markdown heading."""
    lines = checklist_text.splitlines()
    in_section = False
    files = []

    for line in lines:
        if line.strip().startswith("## ") and section_header.lower() in line.lower():
            in_section = True
            continue
        elif in_section and line.strip().startswith("## "):
            break
        elif in_section:
            # Match lines like "- `docs/CREDITS.md`" or "1. **`LICENSE`**:"
            match = re.search(r"[`']([^`']+)['`]", line)
            if match:
                file_rel = match.group(1).strip()
                if file_rel and (ROOT_DIR / file_rel).exists() or "." in file_rel:
                    files.append(file_rel)
    return files


def test_final_checklist_exists_and_valid():
    """docs/FINAL_CHECKLIST.md must exist and contain verified files and human checklist sections."""
    assert CHECKLIST_PATH.exists(), "docs/FINAL_CHECKLIST.md does not exist!"
    content = CHECKLIST_PATH.read_text(encoding="utf-8")
    assert len(content) > 300, "docs/FINAL_CHECKLIST.md is too short!"
    assert "Verified Release Documents" in content
    assert "Pre-Submission Human Completion Items" in content


def test_verified_checklist_files_have_no_placeholders():
    """All files listed under 'Verified Release Documents' in docs/FINAL_CHECKLIST.md must have zero placeholders."""
    checklist_text = CHECKLIST_PATH.read_text(encoding="utf-8")
    verified_files = get_checklist_files_from_section(checklist_text, "Verified Release Documents")

    assert len(verified_files) >= 4, f"Expected at least 4 verified files in checklist, got {verified_files}"

    all_failures = {}
    for rel_path in verified_files:
        full_path = ROOT_DIR / rel_path
        assert full_path.exists(), f"Checklist file does not exist: {rel_path}"
        findings = find_placeholders_in_file(full_path)
        if findings:
            all_failures[rel_path] = findings

    assert not all_failures, (
        f"Unresolved placeholders found in verified checklist files:\n"
        + "\n".join(
            f"  {f} (Line {line}): {match} -> '{text}'"
            for f, items in all_failures.items()
            for line, match, text in items
        )
    )


def test_placeholder_detector_fails_on_placeholder(tmp_path):
    """Verify that the placeholder detection logic strictly fails when a placeholder is present."""
    test_file = tmp_path / "mock_checklist_item.md"
    test_file.write_text("This is clean text.\nTODO: fix this line\nEnd of file.", encoding="utf-8")

    findings = find_placeholders_in_file(test_file)
    assert len(findings) == 1
    assert findings[0][0] == 2
    assert findings[0][1] == "TODO"

    # Ensure an assertion error is raised when we enforce zero placeholders
    with pytest.raises(AssertionError) as exc_info:
        assert not findings, f"Placeholder detected: {findings}"
    assert "Placeholder detected" in str(exc_info.value)


def test_human_pending_files_contain_required_placeholders():
    """LICENSE and docs/AI_DISCLOSURE.md must contain explicit placeholders awaiting human completion."""
    license_path = ROOT_DIR / "LICENSE"
    ai_disclosure_path = ROOT_DIR / "docs" / "AI_DISCLOSURE.md"

    assert license_path.exists()
    assert ai_disclosure_path.exists()

    license_findings = find_placeholders_in_file(license_path)
    assert len(license_findings) > 0, "LICENSE must retain human contributor placeholder until team completion"

    ai_findings = find_placeholders_in_file(ai_disclosure_path)
    assert len(ai_findings) > 0, "docs/AI_DISCLOSURE.md must retain reviewer placeholders until team completion"


def test_pre_submission_gate():
    """Full submission gate: when CHECK_SUBMISSION_READY=1 is set, all checklist files must have 0 placeholders."""
    is_submission_check = os.environ.get("CHECK_SUBMISSION_READY") == "1"

    if not is_submission_check:
        pytest.skip(
            "Pre-submission gate skipped. Run with CHECK_SUBMISSION_READY=1 prior to final portal submission "
            "after human team members fill in LICENSE and docs/AI_DISCLOSURE.md."
        )

    checklist_text = CHECKLIST_PATH.read_text(encoding="utf-8")
    verified_files = get_checklist_files_from_section(checklist_text, "Verified Release Documents")
    human_files = get_checklist_files_from_section(checklist_text, "Pre-Submission Human Completion Items")

    all_files = list(set(verified_files + human_files))
    all_failures = {}

    for rel_path in all_files:
        full_path = ROOT_DIR / rel_path
        if full_path.exists():
            findings = find_placeholders_in_file(full_path)
            if findings:
                all_failures[rel_path] = findings

    assert not all_failures, (
        f"Pre-submission gate failed. Placeholders remain in submission files:\n"
        + "\n".join(
            f"  {f} (Line {line}): {match}"
            for f, items in all_failures.items()
            for line, match, _ in items
        )
    )
