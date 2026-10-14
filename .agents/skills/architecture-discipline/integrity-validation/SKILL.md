---
name: integrity-validation
version: 2.1.0
description: "Run arch validation after every CRUD workflow in architecture-discipline. Part of architecture-discipline (umbrella). Use when validating a system pool, cron jobs, workflow graphs, skill tree integrity, script drift, or symlink health. Triggers: 'validate', 'integrity check', 'arch validate', 'check pool', 'check cron', 'verify pool', 'code scan', 'check drift', 'check symlinks'."
parent: architecture-discipline
related_adrs: [AD-029, AD-030, AD-034, AD-039, AD-059, RG-017, RG-019, RG-032]
---

# Integrity Validation

This leaf documents how to run the validation engine after every CRUD workflow that touches the architecture genome. The **unified surface is `arch validate`** (AD-059) — it wraps the validation engine (AD-029). `system-integrity` remains as a legacy shim with all original flags preserved for cron jobs / MCP / scripts; agents call `arch`.

## When to Use This Leaf

Run integrity validation after **every** CRUD workflow in any architecture-discipline leaf:

| Leaf | When to run validation |
|------|-------------------------------|
| `system-design` | After scaffolding a new pool |
| `system-lifecycle` | After every EXPAND, CONTRACT, RENAME, REMOVE, MIGRATE |
| `cron-job-lifecycle` | After every CREATE, UPDATE, DECOMMISSION |
| `decision-logging` | After writing a new AD (to verify indexing) |
| `regression-logging` | After writing a new RG (to verify indexing) |
| `system-design` (CLI-bearing system) | After declaring the CLI in the registry → run `arch cli sync` then `arch cli check` (AD-056/RG-045) |
| `system-lifecycle` (EXPAND/CONTRACT) | If CLIs changed → run `arch cli check` (RG-045 drift) |

The integrity check is **not a monthly audit** — it runs after every workflow step. Drift is caught at the step where it was introduced. `arch cli check` is part of every validation and of the monthly architecture audit (RG-045).

## Quick Start: Run a Validation

```bash
# Validate a single pool (and its cron jobs, if any)
arch validate --pool {pool-name}

# Validate all pools (all tiers: structural + recursive + code + symlinks)
arch validate

# Validate only (no index generation)
arch validate --pool {pool-name}

# Regenerate indexes (AGENTS.md auto-zones)
arch emit --agents

# Tier 2 only: code drift + --reason flag + shebang check
arch code-scan

# Tier 3 only: symlink integrity
python ~/.hermes/systems/architecture/scripts/system-integrity --symlinks

# Tiers 0-1 only: skip code/symlink checks (faster structural validation)
python ~/.hermes/systems/architecture/scripts/system-integrity --structure-only

# Unified CLI Registry (AD-056/RG-045): verify all system CLIs are linked + passing
arch cli check

# Unified CLI Registry: (re)integrate — creates ~/bin symlinks + smoke-tests
arch cli sync
```

**Legacy shim:** flags arch does not wrap (`--symlinks`, `--structure-only`, `--index`, `--cron-only`, `--sync-cron`) remain callable via `python ~/.hermes/systems/architecture/scripts/system-integrity <flag>` — the shim preserves all original flags (AD-059).

**CLI-registry rule (AD-056/RG-045):** never hand-edit `~/bin` links or
`tool-index.md` CLI tables. A new system CLI is declared in
`systems/hermes-agent-infra/cli-version-registry.yaml` (`system_clis:`) and
integrated via `arch cli sync` — that is the only integration path.

**Exit code 0 = clean.** Exit code 1 = drift detected. Fix all ERROR-level findings before considering the workflow complete.

Org-consistency checks (AXE-AD-011): `axe org check` validates roster↔jobs.json↔cron-md coherence; `axe org dedupe` (dry-run) detects live-store duplication. Both are part of full-integrity runs.

## The Integrity Checks

### Structural Checks (AD-022, AD-023)

- Directory structure matches `_org.yaml` spec
- Required files present (AGENTS.md (AD-050) for pools and sub-systems; formerly README.md/SYSTEM.md/SUB-SYSTEM.md)
- Frontmatter required fields for ADs and RGs
- AD/RG cross-references resolve to actual files
- Forbidden patterns absent (__pycache__/, *.pyc)
- Naming conventions (kebab-case)
- AD-023: `decisions/` and `regressions/` must be in `core/`, not at pool root

### Integrity Checks (AD-029)

- **Cron job .md cross-references jobs.json** — every cron job .md has a `cron_id` field that exists in `~/.hermes/cron/jobs.json`
- **Status matches jobs.json** — `.md` `status: active` requires the job to be enabled in `jobs.json`
- **Schedule matches jobs.json** — `.md` `schedule` equals `jobs.json` `schedule_display`
- **Prompt text matches jobs.json** — SHA-256 hash of `.md` Prompt section equals SHA-256 of `jobs.json` prompt
- **Skills referenced exist** — every skill in `frontmatter.skills[]` exists in `~/.hermes/skills/` (resolved via full recursive `os.walk(followlinks=True)` matching by `name:` frontmatter field, per RG-019)
- **Per-system isolation (AD-030)** — `.md` `system` field matches the pool directory name
- **Workflow DAG validation (AD-030)** — `_workflows/*.yaml` files have valid node references, no cycles, resolvable `depends_on` edges

### Rubric Drift (arch guide ↔ skill leaves)

- **STATUS ENUM, AD body sections, RG body sections must agree** between the canonical arch-guide block in `references/conventions.md` (the SINGLE source of truth — the CLI's `arch guide` loads it at runtime, no code copy) and the skill leaves (`decision-logging`, `regression-logging`). A WARN (`rubric-drift`) fires when a canonical fact exists on one surface but not the other, so they never teach conflicting rules. To fix: update the leaf to match the canonical guide block, or edit the guide block itself if the rubric genuinely changed.

### Tier 1: Recursive Sub-System Validation (AD-039)

- **Unlimited depth recursion** — `lint_pool()` recurses into `sub-systems/` directories, validating nested `_org.yaml` and `AGENTS.md` (AD-050 — formerly README.md/SUB-SYSTEM.md) at any depth
- **Cycle protection** — visited-pool set prevents infinite loops from symlink cycles

### Tier 2: Code Drift + Interface Scanner (AD-039)

- **Script drift detection** — MD5 content diff between pool `scripts/` canonical copies and `~/.hermes/scripts/` runtime copies. Mismatch = `WARN` with exact `cp` command to sync
  - **Sync direction protocol (AD-039):** Pool `scripts/` is the canonical source. `~/.hermes/scripts/` is a **deployment artifact** for cron runtime. After editing a pool script, run `cp ~/.hermes/systems/{pool}/scripts/{script}.py ~/.hermes/scripts/{script}.py`. 
  - **Exception:** If a feature was added directly to `~/.hermes/scripts/` (e.g., via cron-run debugging), the cron copy may be newer. Compare timestamps and diff content before syncing. The linter shows both MD5s and paths — manually inspect which side has the correct behavior.
  - **Never edit `~/.hermes/scripts/` directly** for persistent changes. It is overwritten on next sync.
- **`--reason` flag compliance (AD-032)** — AST-parses Python scripts using `argparse` and flags any that lack a `--reason` argument
  - **Mandate:** Every state-modifying CLI (writes to KB, updates status, sends messages, modifies files) MUST accept `--reason` for audit trail. Default: `'Automated cron execution'`. Thread `args.reason` into decision log calls.
  - **Scope:** Tier 2 scripts (cron-invoked agents) and any script with `argparse` that mutates state.
- **Shebang validation** — executable scripts in pool `scripts/` must have valid shebangs (`#!/usr/bin/env python3`, `#!/usr/bin/env bash`, etc.)

### Tier 3: Symlink Integrity (AD-039)

- **Broken symlink detection** — scans `~/.hermes/skills/` and `~/.hermes/plugins/` for symlinks whose targets no longer exist
- **Target validation** — verifies symlink targets resolve inside `systems/` or `plugins/` directories (not orphaned external paths)

## Workflow

### 1. Identify what changed

After every CRUD operation:
- Did you create a new file? (system-design, cron-job-lifecycle CREATE)
- Did you modify an existing file? (system-lifecycle EXPAND, cron-job-lifecycle UPDATE)
- Did you delete a file? (system-lifecycle CONTRACT, cron-job-lifecycle DECOMMISSION)
- Did you rename anything? (system-lifecycle RENAME)
- Did you write an AD or RG? (decision-logging, regression-logging)

If yes to any of the above, integrity validation is required.

### 2. Run arch validate

```bash
arch validate --pool {affected-pool}
```

The validator walks the affected pool and all its cron jobs, cross-referencing every source of truth.

### 3. Read the report

The output is in TOON format:

```
ERROR  {pool}  {description}
WARN   {pool}  {description}
PASS   {pool}  {description}
```

- ERROR: must fix before considering the workflow complete
- WARN: should fix; flag drift
- PASS: validation passed

### 4. Fix any ERROR findings

Common findings and their fixes:

| Error | Fix |
|-------|-----|
| `cron-jobs/{file}: no YAML frontmatter` | Add AD-026-compliant YAML frontmatter |
| `cron-jobs/{file}: cron_id not found in jobs.json` | Either register via `cronjob(action='create')` or set `status: superseded` |
| `cron-jobs/{file}: prompt drift` | Re-copy the prompt from `jobs.json` into the .md file |
| `cron-jobs/{file}: schedule drift` | Update the .md `schedule` field to match `jobs.json` |
| `cron-jobs/{file}: skill 'X' not found` | Either install the skill or remove it from frontmatter |
| `cron-jobs/{file}: system isolation violation` | Fix the `system` field to match the pool name |

### 5. Re-run arch validate until exit 0

After fixing findings, re-run `arch validate --pool {pool}` until exit code 0. This is the workflow gate.

## Integration with MCP Tools

When the validation MCP server is installed (AD-029), every agent session has access to:

- `integrity_check_pool(name)` — validate one pool
- `integrity_check_all()` — validate everything
- `integrity_check_cron_job(pool, job_name)` — drift check on one .md vs jobs.json
- `integrity_check_cron_workflow(pool)` — walk the DAG, verify isolation
- `integrity_generate_index(name)` — regenerate AGENTS.md via `arch emit --agents` (AD-050; _index.yaml generation is disabled)
- `integrity_init_pool(name)` — scaffold new pool

These are first-class tools available natively to every agent.

## Failure Modes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Every cron .md shows "no YAML frontmatter" | Files were created before AD-026 migration | Run the cron prompt migration script (see AD-026) |
| All `cron_id not in jobs.json` errors | Jobs were removed from jobs.json but .md files weren't updated | Set `status: superseded` on those .md files |
| `_workflows/*.yaml: cycle detected` | DAG has a cycle in depends_on | Remove the cycle edge |
| `decisions/ at pool root — must be core/decisions/` | Old pool structure pre-AD-023 | Move `decisions/` into `core/decisions/` |
| `script drift: X differs between...` | Pool script updated but `~/.hermes/scripts/` copy not synced | Run the `cp` command shown in the warning (pool canonical → scripts/) |
| `uses argparse but lacks '--reason' flag` | Script doesn't implement AD-032 mandate | Add `parser.add_argument('--reason', ...)` to the script |
| `missing or invalid shebang` | Python/bash script lacks `#!/usr/bin/env` header | Prepend `#!/usr/bin/env python3` or `#!/usr/bin/env bash` |
| `broken symlink: X → ...` | Skill symlink target deleted or moved | Recreate symlink pointing to canonical pool copy |
| `cross-refs: reference to X but no file found with that ID` | Pool references an AD/RG that lives in another pool's `core/decisions/` or `core/regressions/` directory. The linter checks cross-references only within the target pool's own AD/RG directories, not across pools. | Informational — cross-pool references are valid (CP-AD-007, AD-055, etc. live in the architecture or compass pools). Verify the referenced AD/RG exists in its home pool: `find ~/.hermes/systems/ -name '*{ID}*' -type f`. Do NOT create a duplicate in this pool. |
| `file in decisions/: missing frontmatter field 'Description'` | AD/RG file is missing the `description` field required by _org.yaml's `frontmatter_required` declaration. This is a WARN, not an ERROR. | Add `description: "..."` to the frontmatter of the AD/RG file. All AD/RG frontmatter must include fields declared in their pool's `_org.yaml`. |

## Related

- AD-029: Validation Engine (the validator this leaf documents)
- AD-030: Per-System Cron Job Isolation & Workflow Graph (the DAG schema)
- AD-039: Multi-Tier Governance Compiler (Tiers 1-3)
- AD-059: Unified arch/system-integrity engine (module split — arch is the only surface)
- AD-022: Pool Linter (the precursor to the validation engine)
- AD-026: System-Level Cron Job Architecture (the cron frontmatter schema)
- RG-032: Validation Capability Contract
- `references/integrity-checks-reference.md` — full check reference
- `references/cron-workflow-graph-schema.md` — DAG schema details
- `references/script-sync-and-reason-flag.md` — script sync protocol + --reason flag patterns
