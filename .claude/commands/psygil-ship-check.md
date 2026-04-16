---
description: Run the v1.0 ship-readiness audit for Psygil. Compares production roadmap to current state and reports release blockers.
allowed_tools: ["Read", "Bash", "Grep", "Glob"]
---

# /psygil-ship-check - v1.0 Ship Readiness Audit

Audit the current state of Psygil against the v1.0 production roadmap and report what is blocking ship.

## What This Skill Does

1. **Loads the production roadmap** (`docs/engineering/28_Production_Roadmap.md`)
2. **Loads the platform survey** (`docs/engineering/29_Platform_Survey_and_Gap_Analysis.md`)
3. **Loads the workflow map** (`docs/engineering/30_Workflow_Map_and_Dev_Path.md`)
4. **Loads the gap resolution plan** (`docs/engineering/31_Gap_Resolution_Implementation_Plan.md`)
5. **Loads the latest project decisions** (memory/project_v1_decisions.md)
6. **Verifies current state by inspection:**
   - Sidecar binary exists and smoke-tests
   - Test harness runs (vitest)
   - macOS codesigning script present
   - Console.log cleanup status (grep production source for `console.log`)
   - Schema does NOT contain legacy `gate_reviews` or `gate_decisions` tables
   - Right Column is disabled in v1.0 build
   - Psychometrician agent scoped to scoring report parsing only
7. **Reports back:**
   - GREEN: items confirmed shipping-ready
   - YELLOW: items in progress with current status
   - RED: blockers preventing ship
   - GAPS: items in roadmap but not started

## Hard Rules from v1.0 Decisions (2026-04-10)

These constraints are LOCKED for v1.0 and must be honored by any audit:

1. Right Column disabled. Admin Assistant chat is in Column 1 bottom panel.
2. Psychometrician agent parses scoring reports only (no raw scoring, norms are copyrighted).
3. Legacy `gate_reviews` and `gate_decisions` tables removed from schema.
4. Shared storage (Tier 2 network drive, Tier 3 cloud) deferred to v2.0.
5. Console.log cleanup happens before ship, not deferred.
6. Python 3.11 is the sidecar build target.
7. Target: ship v1.0 ASAP.

If the audit finds work being done OUTSIDE these constraints (e.g., shared storage code being written), flag it as scope drift.

## Output Format

```
PSYGIL v1.0 SHIP READINESS AUDIT
================================
Audit date: <date>
Last commit: <hash> <subject>

GREEN (ship-ready):
  ✓ <item> - <evidence>

YELLOW (in progress):
  ○ <item> - <status>, blocker: <if any>

RED (blockers):
  ✗ <item> - <what is missing>

SCOPE DRIFT (work outside v1.0 constraints):
  ! <item> - <why this is out of scope for v1.0>

NEXT 3 ACTIONS TO UNBLOCK SHIP:
  1. <action>
  2. <action>
  3. <action>
```

## When to Use

- Before any ship-related conversation
- When Truck asks "are we ready?" or "what's blocking ship?"
- After completing a release-blocker task to verify nothing else broke
- Weekly as a heartbeat check during the v1.0 push

## No Em Dashes, No AI Artifacts

Hard rule. Grep before finalizing the report.
