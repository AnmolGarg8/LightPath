# Lunar Mission Sources and Operational Windows

Governed by `docs/PROJECT_RULES.md` (Rule 2: Never invent facts, coordinates, file names, checksums, or citations).

This document serves as the primary citation register for lunar missions referenced in LightPath.

> [!IMPORTANT]
> **Source Verification Status:**
> Any mission whose primary source citations, landing coordinates, and operational timeline lack formal source records must be labelled as **Example entries (not sourced)**.
> Unverified missions must not present operational dates as established facts, nor claim completed/planned status without cited evidence.

---

## Mission Registry Template

### Entry Schema
- **Mission ID**: Machine-readable identifier matching `data/missions.json`.
- **Mission Name**: Full formal mission name.
- **Operator / Agency**: Responsible commercial or national entity.
- **Candidate Landing Site**: Target crater rim, ridge, or massif.
- **Target Coordinates**: Latitude and longitude with referenced datum.
- **Mission Window**: Cited operational launch/landing window from primary document.
- **Analysis Window**: Standardised epoch span simulated in LightPath for environmental modeling.
- **Primary Citations**: Formal publications, NASA CLPS contracts, PDS metadata, or DOIs.
- **Verification Status**: `VERIFIED` (with primary citation) or `UNSOURCED EXAMPLE`.

---

## Registered Entries

### 1. Synthetic Proving Ground Demonstration Lander
- **Mission ID**: `synthetic-proving-lander`
- **Mission Name**: Synthetic Proving Ground Demonstration Lander
- **Operator**: LightPath Automated Test Harness
- **Candidate Site**: Synthetic Proving Ground
- **Target Coordinates**: 89.90°S, 0.00°E
- **Mission Window**: Illustrative synthetic test scenario.
- **Analysis Window**: 2026-11-01T00:00:00Z to 2026-11-05T00:00:00Z (96-hour synthetic proving-ground span).
- **Primary Citations**: Internal algorithm test harness fixture (`configs/synthetic.yaml`).
- **Verification Status**: `UNSOURCED EXAMPLE` (synthetic test scenario).

### 2. Example lander A
- **Mission ID**: `example-lander-a`
- **Mission Name**: Example lander A
- **Operator**: Example Operator A
- **Candidate Site**: Unassigned / Candidate Site A
- **Target Coordinates**: 89.78°S, 128.80°E
- **Mission Window**: Unverified example scenario (operational timeline pending confirmation).
- **Analysis Window**: 2026-11-01T00:00:00Z to 2026-11-15T00:00:00Z (14-day lunar daylight analysis span).
- **Primary Citations**: [PENDING CITATION] Example manifest entry (`data/missions.json`).
- **Verification Status**: `UNSOURCED EXAMPLE` (illustrative scenario).

### 3. Example lander B
- **Mission ID**: `example-lander-b`
- **Mission Name**: Example lander B
- **Operator**: Example Operator B
- **Candidate Site**: Unassigned / Candidate Site B
- **Target Coordinates**: 80.13°S, 1.44°E
- **Mission Window**: Unverified example scenario.
- **Analysis Window**: 2026-11-05T00:00:00Z to 2026-11-20T00:00:00Z.
- **Primary Citations**: [PENDING CITATION] Example manifest entry (`data/missions.json`).
- **Verification Status**: `UNSOURCED EXAMPLE` (illustrative scenario).

### 4. Example lander C
- **Mission ID**: `example-lander-c`
- **Mission Name**: Example lander C
- **Operator**: Example Operator C
- **Candidate Site**: Unassigned / Candidate Site C
- **Target Coordinates**: 85.20°S, 31.00°E
- **Mission Window**: Unverified example scenario.
- **Analysis Window**: 2026-11-01T00:00:00Z to 2026-11-15T00:00:00Z.
- **Primary Citations**: [PENDING CITATION] Example manifest entry (`data/missions.json`).
- **Verification Status**: `UNSOURCED EXAMPLE` (illustrative scenario).
