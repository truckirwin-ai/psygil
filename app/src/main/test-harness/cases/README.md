# Test Case Manifests

Each file defines one forensic psychology case with all supporting data,
pipeline steps, and verification checkpoints.

## Implemented

| ID | Name | Type | Stop Point | Steps |
|----|------|------|------------|-------|
| cst-riggins-001 | DeShawn Riggins | CST | Complete (full run) | 49 |

## Planned

| ID | Name | Type | Stop Point | Purpose |
|----|------|------|------------|---------|
| custody-whitfield-002 | Tanya Whitfield | Custody | Mid-diagnostics | Tests partial completion, custody-specific instruments |
| risk-belliveau-003 | Cory Belliveau | Risk Assessment | Review stage | Tests risk instruments (HCR-20v3, PCL-R), stops before completion |
| ptsd-espinoza-004 | Luz Espinoza-Trujillo | PTSD Dx | Complete | Tests trauma-focused battery (CAPS-5, PCL-5, TSI-2) |
| malingering-neuhaus-005 | Kyle Neuhaus | Malingering | Interview stage | Tests effort testing battery (TOMM, SIRS-2, MMPI-3 validity) |
| capacity-platt-006 | Doreen Platt | Capacity | Complete | Tests geriatric/capacity instruments (MoCA, WAIS-IV, ABAS-3) |

## Adding a New Case

1. Create a new file in this directory (e.g., `tanya-whitfield.ts`)
2. Define a `TestCaseManifest` with all required fields
3. Export the manifest
4. Register it in `../index.ts` in the `MANIFESTS` record
5. Run `npx tsc --noEmit` to verify types
