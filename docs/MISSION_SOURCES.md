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

### 2. CLPS IM-2 (PRIME-1)
- **Mission ID**: `clps-im2-prime1`
- **Mission Name**: NASA CLPS IM-2 (PRIME-1)
- **Operator**: Intuitive Machines / NASA CLPS
- **Candidate Site**: Shackleton Connecting Ridge
- **Target Coordinates**: 89.78°S, 128.80°E
- **Mission Window**: Unverified example scenario (operational date pending official NASA CLPS launch confirmation).
- **Analysis Window**: 2026-11-01T00:00:00Z to 2026-11-15T00:00:00Z (14-day lunar daylight analysis span).
- **Primary Citations**: [PENDING CITATION] NASA CLPS delivery task order / payload description.
- **Verification Status**: `UNSOURCED EXAMPLE` (dates and operational status are illustrative).

### 3. CLPS IM-1 (Odysseus / Nova-C)
- **Mission ID**: `clps-im1-odysseus`
- **Mission Name**: NASA CLPS IM-1 (Odysseus / Nova-C)
- **Operator**: Intuitive Machines / NASA CLPS
- **Candidate Site**: Malapert Mountain region
- **Target Coordinates**: 80.13°S, 1.44°E
- **Mission Window**: Unverified example scenario.
- **Analysis Window**: 2026-11-05T00:00:00Z to 2026-11-20T00:00:00Z.
- **Primary Citations**: [PENDING CITATION] Official landing telemetry / trajectory report.
- **Verification Status**: `UNSOURCED EXAMPLE` (dates and operational status are illustrative).

### 4. VIPER Polar Traverse / Griffin
- **Mission ID**: `viper-griffin`
- **Mission Name**: VIPER Polar Traverse / Griffin
- **Operator**: Astrobotic / NASA CLPS
- **Candidate Site**: Nobile Crater Rim
- **Target Coordinates**: 85.20°S, 31.00°E
- **Mission Window**: Unverified example scenario.
- **Analysis Window**: 2026-11-01T00:00:00Z to 2026-11-15T00:00:00Z.
- **Primary Citations**: [PENDING CITATION] NASA VIPER traverse documentation.
- **Verification Status**: `UNSOURCED EXAMPLE` (dates and operational status are illustrative).
