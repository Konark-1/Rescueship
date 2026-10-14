---
name: monthly-review
description: "Monthly architecture review — the cadence wrapper that SEQUENCES the auditing pipeline: record-integrity pass → pool structural sweep → integration-graph spot-check → red-team drill (rotating) → dispositions. Use for 'monthly review', 'architecture health check', 'audit everything'. Deep single-system work belongs to sibling leaves; this leaf owns the calendar and the disposition ledger."
---

# Monthly Architecture Audit

Run this audit monthly, aligned with geometric milestone checks. The goal is to catch drift before it becomes technical debt: undocumented systems, stale ADs, missing RGs, and orphaned components living outside pools.


## Pipeline sequencing (v5)

Run in order; each phase's report feeds the next:

1. **record-integrity** (`arch validate` + manual passes) — the ledger must be
   clean before auditing structure on top of it.
2. **structural sweep** — pools vs canonical layout, orphans outside pools,
   zombie-pool rule (conventions G9), cron frontmatter drift.
3. **integration-mapping spot-check** — registry regenerated? new undeclared
   edges? one-sided contracts introduced since last cycle?
4. **red-teaming drill** — rotate ONE drill (D1–D5) per month so each fires
   quarterly; full battery after any major architecture change.
5. **Dispositions** — every finding FIX/FOLD/TOMBSTONE/CARRY with owner+date;
   carry-forward table opens next month's review.

## When to Use

Triggers: "audit systems", "monthly review", "architecture health", "check ADs", "check RGs", "find orphans", "system check".

- [ ] `axe org check` clean (roster drift AXE-RG-012/013)
- [ ] `axe msg channels` reviewed — unread dept-channel threads answered or archived
- [ ] Utility/dormant pool declarations still accurate (`axe org view`)

## Audit Checklist

### 1. System Pool Inventory

```bash
# List all system pools
ls -d ~/.hermes/systems/*/
```

For each pool:
- Read its `AGENTS.md` auto-zone (AD-050 — formerly SYSTEM.md/README.md). Is it current? Does it list all components accurately?
- Does the pool have an AD reference? Is that AD still Active?
- Does the pool have cron jobs listed? Do those cron job IDs still exist?
- Are there components in the pool that aren't listed in AGENTS.md? (undocumented components)
- Are there AGENTS.md entries with no corresponding files? (phantom entries)

### 1b. Sub-System Doc Routing Check (HI-AD-041 — doc-first mandate)

For every pool with sub-systems, verify the sub-system documentation is the routing surface (docs-before-implementation, AD-052):

```bash
# List sub-systems and check each has an AGENTS.md (AD-050)
arch sub list --pool {system}
find systems/{system}/sub-systems -name AGENTS.md
```

For each sub-system:
- Does `sub-systems/{sub}/AGENTS.md` exist and list its ADs/RGs, components, and cron jobs?
- Are the sub-system's ADs/RGs discoverable via `arch list --pool {system}`? Flag any sub-system with zero AD/RG coverage as a `arch gaps` finding.
- **Doc-first drift check**: if any sub-system's files changed since its AGENTS.md/AD/RG was last updated (compare `git log` on files vs docs), flag it as DRIFT — the docs must be brought current before the next infra change (RG-010, AD-051/052).
- Sub-system ownership must match the parent's `_org.yaml` `sub_systems:` list (AD-023).

### 2. Orphan Detection + Discipline Enforcement (RG-013)

```bash
# RG-013: Check for NEW files created in frozen dirs after pool architecture was established
# (AD-014 was written 2026-07-30)
find ~/.hermes/scripts/ -type f -newer ~/.hermes/systems/architecture/core/decisions/AD-014-system-pool-architecture.md -not -path '*__pycache__*'
find ~/.hermes/data/ -type f -newer ~/.hermes/systems/architecture/core/decisions/AD-014-system-pool-architecture.md
find ~/.hermes/research/ -type f -newer ~/.hermes/systems/architecture/core/decisions/AD-014-system-pool-architecture.md

# Count remaining migration leftovers (scripts that have been copied to pools but originals remain)
ls ~/.hermes/scripts/ | grep -v __pycache__ | grep -v diagnostics | wc -l

# Find data directories outside system pools
ls -d ~/.hermes/data/*/ 2>/dev/null

# Find research KBs outside system pools
ls -d ~/.hermes/research/*/ 2>/dev/null
```

**Discipline violations** (NEW files in frozen dirs created after AD-014): Flag immediately. The file must be moved to the appropriate system pool.

**Migration leftovers** (files in frozen dirs that have already been copied to pools): Safe to delete after verification. These are NOT violations, just cleanup items.

Any file in `~/.hermes/scripts/` that belongs to a system pool but hasn't been migrated is an orphan. Flag it for migration.

### 3. AD Validation

Use the arch CLI to inventory — it is the canonical read surface (AD-051/052):

```bash
arch list --type ad                      # all ADs across all pools
arch stats                               # per-pool AD/RG distribution
arch gaps                                # pools with thin coverage
arch list --status Superseded            # superseded chain review
arch validate                            # structural linter (exit 0 required)
```

For each AD:
- **Status check**: Is it `Active` / `Superseded` / `Proposed` / `Draft` (run `arch guide` for the enum)? If Active, does it still match the system state? Flag any non-enum status (e.g. "Resolved (partial)") — normalize via `arch update <ID> --field Status=<enum>`.
- **Staleness**: `arch show <ID>` — when was it last updated? If >6 months, review whether the decision still holds.
- **Cross-reference**: `arch related <ID>` — does it link to relevant skills and system pools? Are those paths still valid?
- **Contradictions**: Are there two ADs that contradict each other? If so, one should be `arch supersede <ID> --by <other>`.
- **Missing Title/Description**: `arch list` shows blank title → the record needs `arch update <ID> --field Title="..."` (a record invisible to the index might as well not exist).

### 4. RG Compliance

```bash
arch list --type rg                      # all RGs across all pools
arch list --status Open                  # known incidents still unfixed
arch list --status Resolved              # guards in place
```

For each RG in `~/.hermes/systems/architecture/core/regressions/`:
- **Prevention in place**: Are the prevention measures documented in the RG actually implemented?
- **Recurrence check**: Has this failure mode recurred since the RG was written? If yes, the prevention measure needs strengthening.
- **Coverage**: Are there known failure modes that don't have an RG? Flag them for `regression-logging`.

### 5. System-Specific Checks

For each system pool, verify:
- Cron job prompts reference correct pool paths (not old fragmented paths)
- Scripts import from correct pool-relative paths
- Skills in the pool are symlinked correctly from `~/.hermes/skills/{category}/`
- MCP server configs in `config.yaml` reference pool paths
- Data files are within the pool, not in `~/.hermes/data/` or `~/.hermes/research/`

### 6. Registry Validation

Run the meta-skill registry to validate the architecture-discipline tree:

```bash
# Note: arch validate now runs after every CRUD workflow (AD-029, AD-059).
# This step is a "catch any drift that slipped through" sweep.
arch validate
# Also generate fresh indexes (AGENTS.md auto-zones):
arch emit --agents
# Validate skill tree:
python ~/.hermes/systems/architecture/scripts/registry.py ~/.hermes/systems/architecture/skills/architecture-discipline/ --check
```

### 7. Per-Workflow Integrity Sweep

Because `system-integrity` runs after every workflow (per AD-029), drift should be minimal at monthly review. What to look for:

- **Cumulative drift from many small changes**: Even though each change was validated, monthly review catches patterns across the whole system.
- **Jobs not validated in the past month**: Cron jobs created or modified outside the standard workflow (e.g., directly via the cronjob MCP tool without running the integrity check) may have drifted. Flag for re-validation.
- **Stale AGENTS.md auto-generated sections — run `arch emit --agents {pool}` to regenerate** (AD-050). Compare freshly-generated sections against the on-disk AGENTS.md to detect out-of-band changes. Drift here indicates an entry was modified outside the standard workflow.

The integrity check is NOT just for this monthly audit. It's part of every CRUD workflow. This monthly step is the safety net.

## Report Format

Produce a structured report:

```
## Architecture Audit Report — {Date}

### System Pools ({N} found)
| System | AD | Status | Last Updated | Orphans? |
|--------|----|--------|--------------|----------|

### Orphans Detected
- {path}: belongs to {system} but lives outside pool

### AD Staleness
- AD-NNNN: last updated {date}, needs review
- AD-NNNN: contradicts AD-NNNN

### RG Compliance
- RG-NNNN: prevention measure verified
- RG-NNNN: prevention measure missing — ACTION NEEDED

### Action Items
1. {action}
2. {action}
```

## Action Items

After the audit:
1. Write new ADs for undocumented decisions (use `decision-logging`)
2. Write new RGs for undocumented failures (use `regression-logging`)
3. Migrate orphans into their pools (use `system-lifecycle`)
4. Update stale README.md manifests (AD-042 — formerly SYSTEM.md)
5. Supersede contradicted ADs
6. Strengthen RG prevention measures that have recurred

## Registry Copy Divergence Check

`registry.py` exists as copies in multiple skill trees. Canonical source is
`~/.agents/skills/meta-skill-creator/scripts/registry.py`; every copy carries a
stamp line `# registry.py canonical source: ... sha256:<hash>`. Monthly:

1. Compute canonical hash; compare against each copy's stamp.
2. Mismatch → copy canonical over stale version, re-stamp, regenerate that tree's `_registry.yaml`.
3. Run `python registry.py <tree> --check` per tree after any sync.

Added by maintenance refactor P5 (2026-08-23).
