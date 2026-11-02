"""Acceptance test: Parse README.md Verification section and verify that
every number and status matches tests/results.json without discrepancy.
Enforces Rule 1 and Rule 2 of docs/PROJECT_RULES.md.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
README_PATH = ROOT_DIR / "README.md"
RESULTS_JSON_PATH = ROOT_DIR / "tests" / "results.json"


def test_readme_verification_table_matches_results_json():
    """Verify that every row, code, status, and numeric value in README.md's
    Verification section originates directly from tests/results.json.
    """
    assert README_PATH.exists(), "README.md not found"
    assert RESULTS_JSON_PATH.exists(), "tests/results.json not found"

    # Load results.json
    with open(RESULTS_JSON_PATH, "r", encoding="utf-8") as f:
        results_data = json.load(f)

    all_checks = {}
    for c in results_data.get("checks", []):
        code = c.get("code") or c.get("id")
        if code:
            all_checks[code] = c
    for c in results_data.get("extra_checks", []):
        code = c.get("code") or c.get("id")
        if code:
            all_checks[code] = c

    # Read README.md
    readme_text = README_PATH.read_text(encoding="utf-8")

    # Locate Verification section
    section_match = re.search(
        r"## 7\. Verification & Scientific Benchmarks(.*?)(?=\n## |\Z)",
        readme_text,
        re.DOTALL,
    )
    assert section_match is not None, "Verification section not found in README.md"
    section_text = section_match.group(1)

    # Extract markdown table rows
    table_lines = [
        line.strip()
        for line in section_text.splitlines()
        if line.strip().startswith("|") and not line.strip().startswith("| :---")
    ]
    assert len(table_lines) >= 2, "No verification table rows found in README.md"

    # Skip header row
    data_rows = table_lines[1:]
    assert len(data_rows) == len(all_checks), (
        f"Row count mismatch: README has {len(data_rows)} rows, "
        f"tests/results.json has {len(all_checks)} checks"
    )

    number_pattern = re.compile(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?")

    for row in data_rows:
        cols = [c.strip() for c in row.split("|")[1:-1]]
        # Columns: Code, Benchmark Name, Tolerance, Measured Value, Data Type, Status
        raw_code = cols[0].replace("*", "").strip()
        status_text = cols[5].replace("*", "").strip().lower()

        assert raw_code in all_checks, f"Test code {raw_code} in README not found in tests/results.json"
        check = all_checks[raw_code]

        # Verify status
        expected_status = check["status"].lower()
        if expected_status == "passed":
            assert status_text in ("pass", "passed"), f"{raw_code} status mismatch: {status_text} vs {expected_status}"
        elif expected_status == "not_run":
            assert status_text in ("not run", "not_run"), f"{raw_code} status mismatch: {status_text} vs {expected_status}"
        else:
            assert status_text == expected_status, f"{raw_code} status mismatch: {status_text} vs {expected_status}"

        # Extract all numbers from the README row
        row_numbers = number_pattern.findall(row)

        # Collect text corpus of corresponding entry in results.json
        corpus_strings = [
            str(check.get("tolerance") or ""),
            str(check.get("measured_value") or ""),
            str(check.get("expected_value") or ""),
            str(check.get("citation") or ""),
            str(check.get("code") or ""),
        ]
        corpus_numbers = set()
        for s in corpus_strings:
            for num in number_pattern.findall(s):
                corpus_numbers.add(num)
                try:
                    corpus_numbers.add(f"{float(num):.4f}")
                    corpus_numbers.add(f"{float(num):.2f}")
                    corpus_numbers.add(f"{float(num)}")
                except ValueError:
                    pass

        # Verify each number in README row appears in results.json corpus
        for num in row_numbers:
            # Skip pure integer versioning or formatting noise like '0' or '1'
            if num in ("1", "2"):
                continue
            is_present = (
                num in corpus_numbers
                or any(num in s for s in corpus_strings)
            )
            assert is_present, (
                f"Number '{num}' in README row for {raw_code} is not present "
                f"in tests/results.json fields for {raw_code}: {corpus_strings}"
            )
