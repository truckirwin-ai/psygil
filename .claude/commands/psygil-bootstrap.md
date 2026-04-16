---
description: Bootstrap a new Psygil session - reads BUILD_MANIFEST, CLAUDE.md, latest decisions, and current state. Confirms next task with Truck.
allowed_tools: ["Read", "Bash", "Grep", "Glob"]
---

# /psygil-bootstrap - Cold-Start a Psygil Session

Solve the number one risk of AI-assisted development: context loss between sessions. Run this at the start of every Psygil session to get from zero to productive in under 60 seconds.

## What This Skill Does

1. **Reads the execution leash** (BUILD_MANIFEST.md if it exists)
2. **Reads the soul document** (CLAUDE.md)
3. **Reads the latest project decisions** (memory/project_v1_decisions.md)
4. **Surveys current state:**
   - Last 10 git commits
   - Current branch
   - Modified/untracked files (git status)
   - Sprint or task currently in progress (from BUILD_MANIFEST)
5. **Reports back to Truck:**
   - What was the last shipped milestone
   - What is the current task
   - What blockers (if any) exist
   - Recommended next action
6. **Waits for Truck to confirm** the next task before touching code.

## Hard Rules

- **Do not start coding until Truck confirms the task.**
- **No em dashes, no AI artifacts** in any output.
- **Honor the BUILD_MANIFEST scope.** If a problem falls outside the current task boundary, log it as a blocker, do not solve it.

## Output Format

```
PSYGIL SESSION BOOTSTRAP
========================

Last commit: <hash> <subject> (<date>)
Branch: <branch>
Working tree: <clean | N modified, M untracked>

Current sprint: <sprint name from BUILD_MANIFEST>
Current task: <task ID and description>
Acceptance criteria: <bullet list>

Active blockers:
  - <blocker 1>
  - <blocker 2>

Recent decisions in effect:
  - <decision 1>
  - <decision 2>

Recommended next action:
  <single sentence>

Awaiting confirmation before proceeding.
```

## Files Always Loaded

- `BUILD_MANIFEST.md` (if exists at project root)
- `CLAUDE.md` (project root)
- `~/.claude/projects/-Users-truckirwin-Desktop-Foundry-SMB-Products-Psygil/memory/MEMORY.md` (and indexed files)
- `~/.claude/memory/method_of_work.md`

## When NOT to Use

If Truck has already given a clear directive that does not require context (e.g., "fix the typo in line 42"), just do it. This skill is for resuming work, not for every message.
