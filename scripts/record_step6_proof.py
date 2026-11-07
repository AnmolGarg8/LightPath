#!/usr/bin/env python3
"""Record pytest V3 test run and output log.

Governed by docs/PROJECT_RULES.md (Rule 2: Never invent facts; Rule 9: Full provenance).
"""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOGS_DIR = ROOT / "logs"
RESULTS_JSON = ROOT / "tests" / "results.json"

def main():
    log_lines = []
    def log(msg=""):
        print(msg, flush=True)
        log_lines.append(msg)

    log("=" * 80)
    log("TASK S0b - STEP 6: DYNAMIC EXECUTION AUDIT OF V3 TEST")
    log("=" * 80)

    cmd = ["pytest", "-v", "tests/test_verification.py", "-k", "test_v3_ephemeris_horizons_cross_check"]
    log(f"Running command: {' '.join(cmd)}\n")

    res = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True)
    log(res.stdout)
    if res.stderr:
        log("STDERR:\n" + res.stderr)

    log("\n--- Verification of tests/results.json V3 Record ---")
    data = json.loads(RESULTS_JSON.read_text(encoding="utf-8"))
    v3_entry = next(c for c in data["checks"] if c["code"] == "V3")

    log(f"Test Run Timestamp: {data['timestamp']}")
    log(f"V3 Check Object:\n{json.dumps(v3_entry, indent=2)}")
    log(f"\nV3 Chart Data Points (first 5 samples):\n{json.dumps(data['charts'].get('v3_ephemeris', [])[:5], indent=2)}")

    log_path = LOGS_DIR / "v3_proof_step6_pytest_v3.log"
    log_path.write_text("\n".join(log_lines), encoding="utf-8")
    log(f"\nWrote pytest verification log to {log_path.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
