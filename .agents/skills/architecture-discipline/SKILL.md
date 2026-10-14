---
name: architecture-discipline
description: "Mandatory governance meta-skill for the entire Hermes architecture — use BEFORE designing or changing any system, loop, KB, cron job, MCP integration, or infra. Four groups route every task: WRITING (AD/RG creation), LIFECYCLE (create/initialize/migrate pools, CLIs, cron jobs), AUDITING (ledger integrity, system efficacy, integration mapping, red-teaming, monthly review), REFINING (objective-aligned refactors, low-maintenance design, self-healing gates). Triggers: create/new/design a system, add/remove/migrate/refactor a system, initialize system, make native, genomic template, pool template, write AD, write RG, audit systems, audit AD/RGs, red-team architecture, check governance integrity, increase integration, map services, make self-healing, add health gate, monthly review, low maintenance, validate, integrity check, add cron, where does X live. Use BEFORE building, not after."
version: 5.0.0
category: devops
---

# Architecture Discipline — System Governance Meta-Skill

This is the baseline standard for all work within the Hermes Agent infrastructure. Every system, script, skill, and data store lives inside a **pool directory** under `~/.hermes/systems/`. No component exists outside its system pool. This meta-skill governs how systems are created, expanded, contracted, migrated, and removed, and how architectural decisions (ADs) and regression guards (RGs) are logged and maintained.

**The ONLY write path for ADs/RGs is the `arch` CLI (AD-051, AD-052).** Agents must NOT manually create or edit AD/RG markdown files. The CLI embeds the full management rubric — run `arch guide` (topics: `ad`, `rg`, `lifecycle`) to surface it. The CLI and this skill are two surfaces of one system; when they disagree, the CLI is canonical (AD-052).

## Core Principles (AD-057 + AXE-AD-010)

Three principles govern every architectural implementation in this system (AD-057, AXE-AD-010):

1. **Non-redundancy.** One canonical doc per concept — **AGENTS.md is THE single canonical router+grounding doc per directory (AD-050, AD-059)**; governance README.md files are legacy duplicates and are removed (the linter flags any that remain). One AD per decision, one RG per regression class (RG-010). Orphan docs (TODO templates, unreferenced references, legacy manifests) are drift: `arch validate` flags them (AD-057 doc-hygiene check) and they are filled or removed — never left as traps.
2. **Negligible management overhead.** Anything automatable is automated: arch is the only write path, indexes regenerate from frontmatter (AD-050, emitted via `arch emit`), CLIs integrate via one registry + one command (`arch cli sync`, AD-056). If a workflow needs manual bookkeeping, that workflow is a defect to automate, not a procedure to document.
3. **Anti-fragility via fail-closed operational baselines (AXE-AD-010).** The system must not just run — it must **know** it is running correctly before it acts. Every pool with a CLI surface declares a `smoke.yaml`; the AXE tick runs the gate (`axe smoke`) before spawning ANY agent, and a failed critical check **blocks the tick** (fail-closed) while auto-creating a kanban fix task — so breakage is discovered pre-execution, the fix task is the learning step, and the new baseline is the new normal. A system without a smoke manifest is operationally invisible: `arch validate` flags it, and the auditing group (system-efficacy) must verify the gate is green. Robustness is a **primary priority**, not a maintenance afterthought — the smoke gate is the enforcement mechanism.
4. **Self-healing bootstrappability (AD-069, HI-AD-071).** Infrastructure works from scratch, all the time, without manual debugging: CLIs owning background processes self-provision their systemd units on first invocation (`core/service.py`, units-as-code), silently self-heal on every invocation (re-install missing units, revive inactive/failed timers), fire an immediate first run, and degrade gracefully on hosts without systemd. Manual service setup steps in docs are design defects. See `low-maintenance-design` P7 for the full contract and test protocol.

**`_org.yaml` is the programmatic map.** Every pool/sub-system declares its directory structure in `_org.yaml`; it is the single source for routing, validation, and generation. Navigate programmatically: `arch route <path>` resolves any directory to its owning pool (identity, canonical docs, AD/RG surface, declared structure) — never spelunk the filesystem to answer "what system owns this?" (AD-057).

## Request Dispatch: Forge Task vs Cron Job vs One-Shot (AD-037)

Every clean-start request is routed to one of three dispatch paths BEFORE any skill is loaded:

| User says | Dispatch to | How |
|---|---|---|
| "add a task", "track this", "I need to do X" | **Forge task** | `forge add '<title>' --phase ideation --priority P2` |
| "automate X every Y", "monitor on schedule", "create cron for X" | **Cron job** | Load `cron-job-lifecycle` skill, write .md, `--sync-cron` |
| "check X now", "report on X", "show me", "do X" | **One-shot action** | Execute in current session, no persistence |
| "make X a(n) (native) system", "initialize X", "apply the genomic template to X" | **System init** | Load `system-design` leaf → "Initializing an EXISTING External Project as a Native System"; `arch pool create` FIRST, then its AD/RGs go there |
| "audit all AD/RGs", "integrity audit of the ledger", "check governance integrity" | **Ledger audit** | `arch validate` + record-integrity pass (dangling/shell/parked); burn findings per RG-055 remediation pattern |
| "manage X" (ambiguous) | **Ask** | `clarify` tool: "Forge task or recurring cron job?" |

Signal words: **Forge** = task/track/backlog/board. **Cron** = every/schedule/recurring/monitor. **One-shot** = check/report/show/run/now. Default ambiguous "task" phrasing to **Forge**, never auto-convert to cron without explicit scheduling language. Full spec: AD-037.

## Group Routing

| Group | Covers | Route when the task is about… |
|---|---|---|
| **`writing/SKILL.md`** | decision-logging · regression-logging | creating/amending AD/RG records |
| **`lifecycle/SKILL.md`** | system-design · system-lifecycle · cli-development · cron-job-lifecycle | scaffolding, initializing external projects as native systems, expanding/contracting/migrating pools, CLIs, cron jobs |
| **`auditing/SKILL.md`** | record-integrity · system-efficacy · integration-mapping · red-teaming · monthly-review | ledger integrity audits, deep system efficacy audits, service-graph mapping, adversarial gate-testing, the monthly cycle |
| **`refining/SKILL.md`** | refactor-alignment · low-maintenance-design · self-healing | objective-aligned refactors/transmutations, eliminating upkeep, installing fail-closed health gates |

Cross-cutting, top-level: **`integrity-validation/SKILL.md`** — run `arch validate`
after EVERY CRUD workflow regardless of group.

Each child skill is governed by specific ADs/RGs (full index in
`~/.hermes/systems/architecture/core/{decisions,regressions}/`, auto-aggregated in
pool AGENTS.md auto-zones via `arch emit --agents`). For any write: `arch recon`
first; pass the Recon ID with `--recon`.

## Pool Grounding Snapshots (AD-065 / RG-047)

Every publishing pool's `AGENTS.md` carries a GROUNDING-ZONE (yaml: status, metrics,
narrative, updated_at) refreshed automatically by **`arch validate`** via
`architecture/lib/grounding.py`. Consumers (compass Gate 1) read zones through
`sub-systems/` pooled symlinks and treat zones stale >7d as error-status.

- Publishing a new pool's state: add one reader function to `lib/grounding.py` READERS.
- Never hand-edit the zone; it is regenerated. Never create parallel snapshot files
  (AD-050/057 — AGENTS.md is the single canonical doc).
- After any state-mutating workflow, `arch validate` refreshes zones before reporting.

## Related Skills (Cross-References)


## Skill Maintenance

The meta-skill governs system architecture (pools, ADs, RGs, sub-systems) but not skill creation/refinement. For skill lifecycle operations:

- **`skill-creator`** — Create new skills, run evals, optimize descriptions, package for distribution.
- **`holonic-skill-refinement`** — Diagnose and refine existing skills via metabolic shadows (Dark-Addiction, Dark-Allergy, Golden-Addiction, Golden-Allergy, Sinkhole of Indifference) and dialectical downward rewrites. Use when a skill "works but not well", loops, hallucinates, or produces generic output.
- **`skill-lifecycle-management`** — Rename, rebrand, merge, and prune skills in the library.

## Quick Reference: AD IDs for Discipline Checklist

| Checklist Step | Key ADs | Key RGs |
|---|---|---|
| Pre-Design — scan existing ADs/RGs | AD-022 (pool linter + directories), AD-028 (umbrella), AD-034 (numbering) | RG-010 (update-before-create), RG-016 (token budget) |
| Pre-Design — frozen dirs check | AD-014 (pool principle) | RG-013 (frozen-dirs discipline) |
| Pre-Design — AXI compliance for CLIs | AD-008 (AXI design standard) | RG-008 (false compliance claims) |
| Pre-Design — --reason flag for scripts | AD-032 (universal --reason mandate) | RG-004 (prompt caching breakage) |
| Pre-Design — skill resolution validation | AD-034 (cron auto-sync + skill resolution) | **RG-017**, **RG-019** (mirror runtime resolver) |
| Pre-Design — external dependency approval | — | RG-020 (external dependency without approval) |
| Pre-Design — git tracking verification | — | RG-021 (no git backup for systems) |
| Pre-Design — pool directory file-format linters | AD-022 (pool linter + directories) | RG-027 (file-format linter mandatory per directory) |
| Any AD/RG write — use arch CLI only | AD-051 (arch CLI), AD-052 (recon-first protocol) | — |
| Post-Decision — register AD/RG | AD-001 (decision records), AD-022 (directories) | RG-010 (before-create), RG-016 (token efficiency) |
| Post-Decision — integrity validation | AD-029 (validation engine), AD-059 (arch = unified surface) | RG-017 (AD/RG integrity during mods) |
| Any new system CLI — declare in registry | **AD-056** (unified CLI registry), AD-051 (arch) | **RG-045** (CLI registry drift) |
| Any new system CLI — integrate | **AD-056**: `arch cli sync` (only path) | RG-045 (never hand-edit ~/bin links) |
| CLI design & AXI compliance | AD-008 (AXI standard), cli-development leaf | RG-008 (false compliance claims) |

**Skill patching constraint (operational note):** The `skill_manage` tool CANNOT patch category-scoped skills (e.g. `architecture/*`, `hermes-agent-infra/*`, `revenue-engine/*`, `compass/*`). Attempts to patch these skills fail with 'not found in active profile'. The workaround is to save notes to memory and flag for foreground patching via `hermes curator adopt <name>`. This is a tooling limitation, not a design rule — future sessions should detect this failure pattern early and fall back to memory notes + manual patching.

## Unified CLI Registry Mandate (AD-056 / RG-045) — programmatic CLI integration

**No manual CLI management. Ever.** Every hermes-owned system CLI is declared in `systems/hermes-agent-infra/cli-version-registry.yaml` (`system_clis:`) and integrated EXCLUSIVELY through `arch cli` (the unified surface, AD-059):

```bash
arch cli sync      # creates ~/bin symlinks + smoke-tests (wraps system-integrity --sync-clis)
arch cli check     # verify-only; exit 1 on any drift (wraps --cli-check)
```

- **Never** hand-edit `~/bin` links, `tool-index.md`, or `MANIFEST.md` CLI lists.
- A CLI declared in an AD but missing from the registry is drift — `arch cli check` makes it visible instead of silently forgotten.
- Fresh clones get the full CLI surface automatically: `setup-hermes.sh` delegates its CLI section to `arch cli sync`.
- **`system-integrity` is the legacy shim** — its flags still work, but the unified surface is `arch` (AD-059). Route through `arch`.

## Dynamic AD/RG Discovery

Query the pool `AGENTS.md` auto-zone (AD-050 — the canonical, machine-readable index):

```bash
# List all ADs by topic (frontmatter YAML inside AGENTS.md)
yq '.decisions[] | {id, title, status}' <(awk '/^---/{c++; next} c==1' ~/.hermes/systems/architecture/AGENTS.md)
# Check if an AD exists for your topic
yq '.decisions[] | select(.title | test("cron|cronjob|flywheel"; "i"))' <(awk '/^---/{c++; next} c==1' ~/.hermes/systems/architecture/AGENTS.md)
```

Or query the CLI directly: `arch search <kw>` · `arch list --pool <pool>` · `arch related <ID>` · `arch stats` · `arch gaps`. The `AGENTS.md` auto-zone is generated by `arch emit --agents` (AD-050) — never hand-edit it.

**Sub-system docs are CLI-visible (HI-AD-042):** `arch` scans each pool's `sub-systems/*/core/{decisions,regressions}/` too — sub-system AD/RGs appear in `arch list/stats/gaps/related/update`, attributed to their parent pool with the parent pool's prefix (AD-033). Route AD/RG reads and audits through `arch`, never raw paths.

## Shared Conventions & Checklists

The deep convention bodies (pool layout, symlink topology, filesystem governance, AD/RG rules, system registry, discipline rule, pre-design + post-decision checklists, v1 preserved rules) live in **`references/conventions.md`** — the shared surface every leaf depends on. Load it when a task needs pool structure, skill symlinks, filesystem rules, or the discipline gate checklists. Every leaf in this meta-skill points to it; do not duplicate that content into leaves.

## Navigation

- Know what you need? Read `_map.md` and jump straight to the relevant leaf.
- Not sure? Walk: descend one router at a time, reading only the decision guides above.
- State which leaf you are operating under; when the task shifts, return to `_map.md` and re-route instead of improvising from a stale leaf.
- Task spans branches? Delegate: one subagent per branch, give it the branch path plus its slice of the task; it loads only that subtree.
- Load ceiling: active leaf + its ancestor routers + at most one reference file (conventions.md or a leaf's own reference). If the task seems to need more than that at once, that is a delegation or re-routing signal.

## Key Files

- Global ADs: `~/.hermes/systems/architecture/core/decisions/`
- Global RGs: `~/.hermes/systems/architecture/core/regressions/`
- System ADs: `~/.hermes/systems/{system}/core/decisions/` · System RGs: `~/.hermes/systems/{system}/core/regressions/`
- Sub-system AD/RGs: `~/.hermes/systems/{system}/sub-systems/{sub}/core/{decisions,regressions}/` — CLI-visible via `arch` (HI-AD-042), parent-pool prefix (AD-033)
- System pools: `~/.hermes/systems/`
- Pool layout spec: `~/.hermes/systems/architecture/references/pool-layout.md`
- System manifest template: `~/.hermes/systems/architecture/references/system-template.md`
- Pool linter: `~/.hermes/systems/architecture/scripts/pool_lint.py`
- Skill tree validator: `~/.hermes/systems/architecture/scripts/registry.py`
- **arch CLI**: `~/.hermes/systems/architecture/bin/arch` (run `arch guide` for embedded rubric)

## References

- `references/doctrine-of-record.md` — topic → governing-AD map; cite THIS when pointing at authority, never a superseded ID
- `references/conventions.md` — Full conventions, checklists, shared patterns (the deep reference every leaf points to)
- `references/foundational-system-patterns.md` — Patterns for scaffolding foundational/shared-infrastructure system pools (sub-systems sharing parent data, per-consumer cron model, prefix registration)

## Compass-Graduate Sub-System Pooling (AD-060)

A compass-graduate pool is the **strategic base** for its function: its `sub-systems/` directory contains the complete operational genome, including **pooled sub-systems** — relative symlinks to foundational systems the graduate extends (e.g. `sub-systems/campaigns → ../../campaigns`, `sub-systems/research → ../../research-engine`, `sub-systems/website-development → ../../webdev`, `sub-systems/strategy → ../../compass/sub-systems/strategy`).

- **Pooling = the graduate extends a foundation; the foundation stays canonical** (RG-028: never copy foundation data into the graduate).
- **Create pooled sub-systems with the arch CLI only**: `arch sub pool {role} --pool {graduate} --source ../../{foundation} --recon {id}` (AD-060).
- **One mechanism per relationship**: pooled as a sub-system → NOT in `services_consumed`; only called but not pooled → `services_consumed`. Never both (P3).
- **Linter behavior**: `arch validate` skips symlinks in `sub-systems/` (AD-042) — pooled sub-systems pass without being linted as native sub-pools. Declare `sub-systems/` in `_org.yaml` with `allow_any: true`.
- **Ownership**: a pooled sub-system's AD/RG docs belong to the FOUNDATION's prefix. `arch route <path>` resolves true ownership.
- Full decision: `AD-060` (`arch show AD-060`).

## Changelog

- **4.4.0** (2026-08-23) — integrity-audit upgrades: supersede-cascade rule (both write leaves), record-integrity validation pass (dangling refs / shell bodies / parked records), tombstone policy for retired pools, doctrine-of-record table mandate, dispatch routing for full-ledger audits, zombie-pool auto-task rule. v4.3.x added POOL-OWNERSHIP TEST + external-project initialization route (RG-055).
- **4.2.0** — grounding snapshots (AD-065/RG-047), CLI registry mandate refinements.
