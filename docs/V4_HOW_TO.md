# How to Supply Benchmark V4: Comparison with Published NASA Result

Governed by `docs/PROJECT_RULES.md`:
- **Rule 1 (Correctness before features)**: All claims must be verified with reproducible, deterministic tests.
- **Rule 2 (Never invent facts or citations)**: If an external scientific benchmark is absent, the system displays `NOT RUN`. Only a human operator may supply real published scientific baseline data.

---

## 1. Purpose of Benchmark V4

Benchmark **V4** compares LightPath's calculated solar illumination, Earth line-of-sight, or terrain horizon elevations against external published scientific literature (such as papers published by the NASA LRO/LOLA science team, e.g. Mazarico et al. 2011, Gläser et al. 2014, or Barker et al. 2021).

When no fixture is present at `tests/fixtures/published_*.json`, LightPath treats Benchmark V4 as **`NOT RUN`** across all test suites, CI checks, and the browser Trust dashboard (`#/trust`).

---

## 2. Requirements: What a Human Operator Must Supply

To run Benchmark V4, a human operator must supply an external baseline JSON file matching the pattern:
```
tests/fixtures/published_<identifier>.json
```
(for example, `tests/fixtures/published_barker2021.json` or `tests/fixtures/published_mazarico2011.json`).

The file must contain the following five sections:

### 1. Published Reference (`reference`)
- Full academic citation.
- Title, Authors, Journal / Source, Year, Volume, Pages.
- Permanent DOI and verifiable URL (e.g. NASA ADS, arXiv, publisher DOI).

### 2. Exploration Site (`site`)
- Site identifier (e.g. `shackleton-connecting-ridge`, `test-location`).
- Lunar latitude in degrees (`lat_deg`, $[-90.0, +90.0]$).
- Lunar longitude in degrees (`lon_deg`, $[-180.0, +360.0]$).
- Ground elevation in meters (`ground_elev_m`) relative to the standard $1,737,400.0\text{ m}$ lunar sphere.
- Observer mast height above local ground in meters (`mast_height_m`, typically $2.0\text{ m}$).

### 3. Analysis Period (`period`)
- Start time in ISO 8601 UTC format (`start_utc`, e.g. `"2026-11-01T00:00:00Z"`).
- End time in ISO 8601 UTC format (`end_utc`, e.g. `"2026-12-01T00:00:00Z"`).
- Simulation step in minutes (`step_minutes`, e.g. `30` or `60`).

### 4. Reported Scientific Values (`reported_values`)
- `reported_illumination_pct`: Published total solar illumination percentage reported in the paper for the given site and period.
- `computed_illumination_pct`: Value computed by LightPath for the identical site, period, and threshold.

### 5. Declared Tolerance (`tolerance`)
- `tolerance_pct`: Declared tolerance band in percentage points (typically $\pm 2.0\%$).
- The test asserts: `abs(computed_illumination_pct - reported_illumination_pct) <= tolerance_pct`.

---

## 3. Fixture JSON Template

Save your file as `tests/fixtures/published_<identifier>.json` with the following structure:

```json
{
  "$schema": "https://lightpath.nasa.spaceapps/schemas/published_benchmark.schema.json",
  "reference": {
    "citation": "Barker, M. K., et al. (2021). Lunar South Pole Illumination and Topography from LOLA. Planetary Science Journal, 2(3), 112.",
    "doi": "10.3847/PSJ/abf6cd",
    "url": "https://doi.org/10.3847/PSJ/abf6cd",
    "year": 2021,
    "human_verifier": "Jane Doe, Mission Analyst (jane.doe@example.org)",
    "verification_date": "2026-11-10"
  },
  "site": {
    "site_id": "test-location",
    "lat_deg": -89.50,
    "lon_deg": 0.00,
    "ground_elev_m": -721.96,
    "mast_height_m": 2.0
  },
  "period": {
    "start_utc": "2026-11-01T00:00:00Z",
    "end_utc": "2026-12-01T00:00:00Z",
    "step_minutes": 30
  },
  "reported_illumination_pct": 52.4,
  "computed_illumination_pct": 52.1,
  "tolerance_pct": 2.0,
  "notes": "Evaluated on Table 2, site SP-01, 30-day simulation window."
}
```

---

## 4. Execution & Automated Verification

Once the fixture file is placed in `tests/fixtures/`, execute:

```powershell
pytest tests/test_verification.py -k test_v4 -v
```

1. **Test Execution**: The test reads all matching `published_*.json` fixtures, executes the tolerance assertion, and records the measured delta.
2. **Result Commitment**: Run:
   ```powershell
   python scripts/update_committed_results.py
   ```
3. **UI Display**: The Trust page (`#/trust`) automatically transitions the **V4** card from `NOT RUN` to `PASS`, showing the measured difference against the published NASA baseline.
