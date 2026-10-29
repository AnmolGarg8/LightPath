#!/usr/bin/env python3
"""Fetch SPICE kernels defined in kernels/kernels.json.

Rules:
- Never overwrite existing files silently.
- Verify SHA-256 checksums when present in manifest.
- Print clear summary of actions taken.
- Detect and report TODO placeholders requiring human verification.
"""

import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT_DIR / "kernels" / "kernels.json"


def compute_sha256(file_path: Path) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest().lower()


def fetch_kernels(dry_run: bool = False, force: bool = False) -> int:
    if not MANIFEST_PATH.exists():
        print(f"Error: Manifest not found at {MANIFEST_PATH}", file=sys.stderr)
        return 1

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        try:
            kernels = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Error parsing {MANIFEST_PATH}: {e}", file=sys.stderr)
            return 1

    print("=== LightPath SPICE Kernel Fetcher ===")
    print(f"Manifest: {MANIFEST_PATH}")
    print(f"Found {len(kernels)} kernel definition(s).\n")

    summary = {
        "downloaded": 0,
        "already_exists": 0,
        "skipped_todo": 0,
        "checksum_verified": 0,
        "failed": 0,
    }

    for item in kernels:
        name = item.get("name", "Unnamed")
        url = item.get("url", "")
        expected_sha256 = item.get("sha256", "").strip().lower()
        rel_local_path = item.get("local_path", "")

        if not rel_local_path:
            print(f"[-] {name}: Missing 'local_path' in manifest. Skipping.")
            summary["failed"] += 1
            continue

        target_path = ROOT_DIR / rel_local_path

        # Check for placeholder
        if url.startswith("TODO_") or not url.startswith("http"):
            print(f"[!] {name}: Manifest entry has placeholder URL ('{url}').")
            print("    Action required: Human operator must fill verified NAIF URL in kernels/kernels.json.")
            summary["skipped_todo"] += 1
            continue

        # Check existing file
        if target_path.exists() and not force:
            print(f"[=] {name}: File already exists at {rel_local_path}. Never overwriting silently.")
            if expected_sha256 and not expected_sha256.startswith("todo_"):
                actual_sha = compute_sha256(target_path)
                if actual_sha == expected_sha256:
                    print("    Checksum verified: SHA256 matches.")
                    summary["checksum_verified"] += 1
                else:
                    print(f"    [WARNING] Checksum MISMATCH! Expected {expected_sha256}, got {actual_sha}.")
                    summary["failed"] += 1
            summary["already_exists"] += 1
            continue

        if dry_run:
            print(f"[*] [DRY-RUN] Would download: {url} -> {rel_local_path}")
            summary["downloaded"] += 1
            continue

        # Download
        target_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"[+] Downloading {name} from {url}...")
        try:
            urllib.request.urlretrieve(url, target_path)
            print(f"    Saved to {rel_local_path}")
            summary["downloaded"] += 1

            if expected_sha256 and not expected_sha256.startswith("todo_"):
                actual_sha = compute_sha256(target_path)
                if actual_sha == expected_sha256:
                    print("    Checksum verified: SHA256 matches.")
                    summary["checksum_verified"] += 1
                else:
                    print(f"    [ERROR] Checksum MISMATCH! Expected {expected_sha256}, got {actual_sha}.")
                    summary["failed"] += 1
        except Exception as e:
            print(f"    [ERROR] Download failed: {e}", file=sys.stderr)
            summary["failed"] += 1

    print("\n=== Fetch Summary ===")
    print(f"  Downloaded:         {summary['downloaded']}")
    print(f"  Already exists:     {summary['already_exists']}")
    print(f"  Skipped (TODO):     {summary['skipped_todo']}")
    print(f"  Verified Checksums: {summary['checksum_verified']}")
    print(f"  Failed:             {summary['failed']}")

    return 0 if summary["failed"] == 0 else 1


def main():
    parser = argparse.ArgumentParser(description="Fetch and verify SPICE kernels for LightPath")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without downloading")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files if already downloaded")
    args = parser.parse_args()

    sys.exit(fetch_kernels(dry_run=args.dry_run, force=args.force))


if __name__ == "__main__":
    main()
