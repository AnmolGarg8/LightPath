#!/usr/bin/env python3
"""Generate third-party licenses documentation for LightPath.

Reads:
- web/package-lock.json (npm direct and transitive dependencies)
- Installed Python packages via importlib.metadata for pyproject.toml dependencies

Outputs:
- docs/THIRD_PARTY_LICENSES.md
- Flags non-OSI or unknown licenses and records them in docs/QUESTIONS.md
"""

from __future__ import annotations

import importlib.metadata as md
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent

# Set of recognized OSI-approved SPDX identifiers
OSI_APPROVED_SPDX: Set[str] = {
    "0BSD",
    "AFL-3.0",
    "AGPL-3.0",
    "Apache-2.0",
    "Artistic-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "BSL-1.0",
    "CC0-1.0",
    "CDDL-1.0",
    "CPL-1.0",
    "EPL-1.0",
    "EPL-2.0",
    "EUPL-1.2",
    "GPL-2.0",
    "GPL-3.0",
    "ISC",
    "LGPL-2.1",
    "LGPL-3.0",
    "MIT",
    "MIT-0",
    "MPL-2.0",
    "MS-PL",
    "MS-RL",
    "MulanPSL-2.0",
    "NASA-1.3",
    "NCSA",
    "OFL-1.1",
    "OSL-3.0",
    "PostgreSQL",
    "PSF-2.0",
    "Python-2.0",
    "UPL-1.0",
    "Unlicense",
    "Vim",
    "W3C",
    "WTFPL",
    "X11",
    "Zlib",
}

# Mapping common non-standard text names to SPDX
SPDX_MAP: Dict[str, str] = {
    "mit": "MIT",
    "mit license": "MIT",
    "apache-2.0": "Apache-2.0",
    "apache 2.0": "Apache-2.0",
    "apache license 2.0": "Apache-2.0",
    "apache software license": "Apache-2.0",
    "bsd-3-clause": "BSD-3-Clause",
    "bsd 3-clause": "BSD-3-Clause",
    "bsd 3-clause license": "BSD-3-Clause",
    "bsd license": "BSD-3-Clause",
    "bsd": "BSD-3-Clause",
    "bsd-2-clause": "BSD-2-Clause",
    "bsd 2-clause": "BSD-2-Clause",
    "isc": "ISC",
    "isc license": "ISC",
    "python-2.0": "Python-2.0",
    "psf": "PSF-2.0",
    "psf-2.0": "PSF-2.0",
    "python software foundation license": "PSF-2.0",
    "mpl-2.0": "MPL-2.0",
    "mozilla public license 2.0 (mpl 2.0)": "MPL-2.0",
    "cc0-1.0": "CC0-1.0",
    "cc0": "CC0-1.0",
    "blueoak-1.0.0": "BlueOak-1.0.0",
    "cc-by-4.0": "CC-BY-4.0",
}


def normalize_license(raw_lic: str | None, classifiers: List[str] | None = None) -> Tuple[str, bool]:
    """Normalize a license string to SPDX identifier and check OSI status."""
    classifiers = classifiers or []
    is_osi_from_classifier = any("License :: OSI Approved" in c for c in classifiers)

    if not raw_lic or raw_lic.strip() in ("", "UNKNOWN", "None"):
        # Check classifiers for license
        for c in classifiers:
            if "License :: OSI Approved ::" in c:
                part = c.split("::")[-1].strip().lower()
                spdx = SPDX_MAP.get(part, part.upper())
                return spdx, True
        return "UNKNOWN", False

    # Extract first line if multi-line text
    clean_raw = raw_lic.strip().split("\n")[0].strip()
    lower_raw = clean_raw.lower()

    # Direct match in SPDX_MAP
    if lower_raw in SPDX_MAP:
        spdx = SPDX_MAP[lower_raw]
        return spdx, (spdx in OSI_APPROVED_SPDX or is_osi_from_classifier)

    # Check known compound like BSD-3-Clause AND MIT
    if "bsd" in lower_raw and "mit" in lower_raw:
        return "BSD-3-Clause AND MIT", True

    if clean_raw in OSI_APPROVED_SPDX:
        return clean_raw, True

    # Check classifiers
    for c in classifiers:
        if "License :: OSI Approved ::" in c:
            part = c.split("::")[-1].strip().lower()
            if part in SPDX_MAP:
                return SPDX_MAP[part], True

    # If classified as OSI Approved but exact SPDX identifier wasn't standard
    if is_osi_from_classifier:
        return clean_raw, True

    return clean_raw, False


def collect_python_dependencies() -> List[Dict[str, Any]]:
    """Trace direct and transitive dependencies from pyproject.toml."""
    pyproject_path = ROOT_DIR / "pyproject.toml"
    direct_packages: List[str] = []

    if pyproject_path.exists():
        import tomllib

        with open(pyproject_path, "rb") as f:
            cfg = tomllib.load(f)
        proj = cfg.get("project", {})
        for d in proj.get("dependencies", []):
            pkg_name = re.split(r"[><=~!;]", d)[0].strip().lower().replace("_", "-")
            if pkg_name:
                direct_packages.append(pkg_name)
        for d in proj.get("optional-dependencies", {}).get("dev", []):
            pkg_name = re.split(r"[><=~!;]", d)[0].strip().lower().replace("_", "-")
            if pkg_name:
                direct_packages.append(pkg_name)

    visited: Set[str] = set()
    queue = list(direct_packages)
    all_packages: List[Dict[str, Any]] = []

    while queue:
        curr = queue.pop(0)
        norm = curr.lower().replace("_", "-")
        if norm in visited:
            continue
        visited.add(norm)

        try:
            dist = md.distribution(curr)
        except Exception:
            continue

        meta = dist.metadata
        v = dist.version
        raw_lic = meta.get("License-Expression") or meta.get("License")
        classifiers = meta.get_all("Classifier") or []
        spdx_lic, is_osi = normalize_license(raw_lic, classifiers)

        # Source address
        proj_urls = meta.get_all("Project-URL") or []
        hp = meta.get("Home-page")
        source = ""
        if proj_urls:
            for p in proj_urls:
                if "," in p:
                    label, url = p.split(",", 1)
                    if any(w in label.lower() for w in ("source", "repository", "homepage", "github")):
                        source = url.strip()
                        break
            if not source and proj_urls:
                source = proj_urls[0].split(",")[-1].strip()
        if not source and hp:
            source = hp.strip()
        if not source:
            source = f"https://pypi.org/project/{norm}/"

        is_direct = norm in direct_packages

        all_packages.append({
            "name": norm,
            "version": v,
            "license": spdx_lic,
            "is_osi": is_osi,
            "is_direct": is_direct,
            "source": source,
            "ecosystem": "Python / PyPI",
        })

        # Add transitive dependencies
        try:
            reqs = md.requires(curr) or []
            for r in reqs:
                if "extra ==" in r:
                    continue  # skip optional extras
                m = re.match(r"^([a-zA-Z0-9_\-\.]+)", r.strip())
                if m:
                    dep = m.group(1).lower().replace("_", "-")
                    if dep not in visited:
                        queue.append(dep)
        except Exception:
            pass

    all_packages.sort(key=lambda p: (not p["is_direct"], p["name"]))
    return all_packages


def collect_npm_dependencies() -> List[Dict[str, Any]]:
    """Read direct and transitive dependencies from web/package-lock.json."""
    lock_path = ROOT_DIR / "web" / "package-lock.json"
    if not lock_path.exists():
        return []

    with open(lock_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    packages = data.get("packages", {})
    root_pkg = packages.get("", {})
    direct_deps = set(root_pkg.get("dependencies", {}).keys()) | set(root_pkg.get("devDependencies", {}).keys())

    all_npm: Dict[str, Dict[str, Any]] = {}

    for path_key, pkg_data in packages.items():
        if not path_key:
            continue
        # Extract clean package name from node_modules path
        parts = path_key.split("node_modules/")
        name = parts[-1]
        version = pkg_data.get("version", "unknown")
        raw_lic = pkg_data.get("license") or "UNKNOWN"
        spdx_lic, is_osi = normalize_license(raw_lic)

        resolved = pkg_data.get("resolved") or f"https://www.npmjs.com/package/{name}"
        is_direct = name in direct_deps

        # Deduplicate multiple nested versions by keeping unique (name, version)
        key = f"{name}@{version}"
        if key not in all_npm:
            all_npm[key] = {
                "name": name,
                "version": version,
                "license": spdx_lic,
                "is_osi": is_osi,
                "is_direct": is_direct,
                "source": resolved,
                "ecosystem": "Node / npm",
            }

    npm_list = list(all_npm.values())
    npm_list.sort(key=lambda p: (not p["is_direct"], p["name"]))
    return npm_list


def generate_markdown(
    py_pkgs: List[Dict[str, Any]], npm_pkgs: List[Dict[str, Any]]
) -> Tuple[str, List[Dict[str, Any]]]:
    """Generate docs/THIRD_PARTY_LICENSES.md content and list of flagged packages."""
    flagged: List[Dict[str, Any]] = []

    for p in py_pkgs + npm_pkgs:
        if not p["is_osi"] or p["license"] == "UNKNOWN":
            flagged.append(p)

    lines: List[str] = [
        "# Third-Party Software Licences",
        "",
        "In compliance with the **NASA Space Apps Challenge Participant Terms** (Section 6: Intellectual Property & Third-Party Licences) and project guidelines ([`docs/PROJECT_RULES.md`](PROJECT_RULES.md)), every direct and transitive third-party software dependency used by LightPath is audited below with its package name, version, declared licence identifier, and canonical source address.",
        "",
        "## Summary Audit Statistics",
        f"- **Python Direct & Transitive Dependencies**: {len(py_pkgs)} audited",
        f"- **npm / Web Direct & Transitive Dependencies**: {len(npm_pkgs)} audited",
        f"- **Total Third-Party Components**: {len(py_pkgs) + len(npm_pkgs)}",
        f"- **Flagged Licences (Non-OSI or Unknown)**: {len(flagged)} (cataloged in [`docs/QUESTIONS.md`](QUESTIONS.md))",
        "",
    ]

    if flagged:
        lines.extend([
            "## ⚠️ Flagged Licences Notice",
            "",
            "The following packages use licences that are either not on the Open Source Initiative (OSI) approved list or require specific human compliance review. These are cross-referenced in [`docs/QUESTIONS.md`](QUESTIONS.md):",
            "",
            "| Ecosystem | Package | Version | Declared Licence | Status | Source Address |",
            "| :--- | :--- | :--- | :--- | :--- | :--- |",
        ])
        for f in flagged:
            status_badge = "UNKNOWN" if f["license"] == "UNKNOWN" else "Non-OSI Approved"
            lines.append(
                f"| {f['ecosystem']} | `{f['name']}` | {f['version']} | {f['license']} | ⚠️ {status_badge} | [{f['source']}]({f['source']}) |"
            )
        lines.append("")

    # Python table
    lines.extend([
        "## Python Dependencies",
        "",
        "| Package | Version | Type | Licence | OSI Approved? | Source Address |",
        "| :--- | :--- | :--- | :--- | :--- | :--- |",
    ])
    for p in py_pkgs:
        dep_type = "Direct" if p["is_direct"] else "Transitive"
        osi_str = "Yes" if p["is_osi"] else "⚠️ No / Review"
        lines.append(
            f"| `{p['name']}` | {p['version']} | {dep_type} | {p['license']} | {osi_str} | [{p['source']}]({p['source']}) |"
        )

    # NPM table
    lines.extend([
        "",
        "## Node.js / TypeScript Dependencies",
        "",
        "| Package | Version | Type | Licence | OSI Approved? | Source Address |",
        "| :--- | :--- | :--- | :--- | :--- | :--- |",
    ])
    for p in npm_pkgs:
        dep_type = "Direct" if p["is_direct"] else "Transitive"
        osi_str = "Yes" if p["is_osi"] else "⚠️ No / Review"
        lines.append(
            f"| `{p['name']}` | {p['version']} | {dep_type} | {p['license']} | {osi_str} | [{p['source']}]({p['source']}) |"
        )

    lines.append("")
    return "\n".join(lines), flagged


def update_questions_md(flagged: List[Dict[str, Any]]) -> None:
    """Document flagged non-OSI / unknown licenses in docs/QUESTIONS.md."""
    questions_path = ROOT_DIR / "docs" / "QUESTIONS.md"
    if not questions_path.exists():
        return

    content = questions_path.read_text(encoding="utf-8")
    section_header = "### 5. Third-Party Dependency Licences (Non-OSI / Unknown Audit)"

    new_section_lines = [
        section_header,
        "- **Status**: Documented Third-Party Audit",
        f"- **Question**: Are all third-party dependencies compliant with NASA Space Apps Challenge open source rules?",
        "- **Audit Findings**: The automated licence audit (`scripts/make_third_party_licenses.py`) flagged the following packages whose declared licence is non-OSI approved or requires clarification:",
        "",
        "| Ecosystem | Package | Version | Declared Licence | Compliance Rationale & Safest Assumption |",
        "| :--- | :--- | :--- | :--- | :--- |",
    ]

    for f in flagged:
        rationale = "Permissive model license (Blue Oak Model License 1.0.0); published by open source attorneys to be simpler than MIT. Permissive and commercial-friendly, but not yet formally submitted for OSI cataloging." if f["license"] == "BlueOak-1.0.0" else (
            "Creative Commons Attribution 4.0 International; standard open content/data license for browser support tables, compatible with open source distribution." if f["license"] == "CC-BY-4.0" else (
                "Python Software Foundation License; OSI compliant." if "PSF" in f["license"] or "Python" in f["license"] else (
                    "License text provided in distribution metadata; requires manual human confirmation against OSI license list."
                )
            )
        )
        new_section_lines.append(
            f"| {f['ecosystem']} | `{f['name']}` | {f['version']} | {f['license']} | {rationale} |"
        )

    new_section_lines.append("")
    new_section_text = "\n".join(new_section_lines)

    if section_header in content:
        # Replace existing section
        pattern = re.compile(rf"{re.escape(section_header)}.*?(?=\n### |\Z)", re.DOTALL)
        content = pattern.sub(new_section_text.strip(), content)
    else:
        content = content.rstrip() + "\n\n" + new_section_text

    questions_path.write_text(content, encoding="utf-8")


def main() -> None:
    print("=== Generating Third-Party Licences Audit ===")
    py_pkgs = collect_python_dependencies()
    print(f"Collected {len(py_pkgs)} Python direct and transitive dependencies.")

    npm_pkgs = collect_npm_dependencies()
    print(f"Collected {len(npm_pkgs)} npm direct and transitive dependencies.")

    md_content, flagged = generate_markdown(py_pkgs, npm_pkgs)
    out_path = ROOT_DIR / "docs" / "THIRD_PARTY_LICENSES.md"
    out_path.write_text(md_content, encoding="utf-8")
    print(f"Wrote {len(md_content.splitlines())} lines to {out_path}.")

    if flagged:
        print(f"Flagged {len(flagged)} non-OSI / unknown licences. Updating docs/QUESTIONS.md...")
        update_questions_md(flagged)
        print("Updated docs/QUESTIONS.md successfully.")
    else:
        print("All dependencies have recognized OSI-approved licences.")


if __name__ == "__main__":
    main()
