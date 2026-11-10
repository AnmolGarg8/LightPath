"""Verification test for web/index.html metadata description.

Governed by docs/PROJECT_RULES.md.
Ensures metadata contains 'Prototype' and does NOT contain stale, unverified,
or continuous claims.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
INDEX_HTML = ROOT_DIR / "web" / "index.html"

DISALLOWED_PHRASES = [
    "continuous",
    "across lunar south-pole clps landing sites",
]

FORBIDDEN_MISSION_NAMES = [
    "viper",
    "artemis",
    "chang'e",
    "chandrayaan",
    "apollo",
    "blue ghost",
    "griffin",
    "im-1",
    "im-2",
    "im-3",
]


def test_index_html_meta_description():
    """Reads web/index.html and asserts:

    1. <meta name="description" content="..."> exists.
    2. Description requires the word 'Prototype'.
    3. Description fails if it contains 'continuous', 'across lunar south-pole CLPS landing sites',
       or specific mission names.
    """
    assert INDEX_HTML.exists(), f"Missing {INDEX_HTML}"
    content = INDEX_HTML.read_text(encoding="utf-8")

    # Match description tag
    match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']', content, re.IGNORECASE)
    assert match is not None, "web/index.html is missing <meta name=\"description\" content=\"...\"> tag"

    description = match.group(1).strip()
    desc_lower = description.lower()

    # 1. Requires the word Prototype
    assert "prototype" in desc_lower, f"Description does not contain 'Prototype': {description}"

    # 2. Must not contain disallowed phrases
    for phrase in DISALLOWED_PHRASES:
        assert phrase not in desc_lower, (
            f"Description contains forbidden phrase '{phrase}':\n  {description}"
        )

    # 3. Must not contain mission names
    for mission in FORBIDDEN_MISSION_NAMES:
        pattern = r"\b" + re.escape(mission) + r"\b"
        assert not re.search(pattern, desc_lower), (
            f"Description contains forbidden mission name '{mission}':\n  {description}"
        )

    # 4. Check Open Graph and Twitter tags exist and match
    assert 'property="og:title"' in content or 'property=\'og:title\'' in content
    assert 'property="og:description"' in content or 'property=\'og:description\'' in content
    assert 'name="twitter:description"' in content or 'name=\'twitter:description\'' in content
