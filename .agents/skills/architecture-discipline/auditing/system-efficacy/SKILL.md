---
name: system-efficacy
version: 1.2.0
description: "Deep efficacy audit of a target system: architecture alignment, requirement fulfillment, subsystem topology + operational flows end-to-end, bug detection, optimization plan. Use when asked to 'deep-audit system X', 'does X still fulfill its requirements', 'audit X end-to-end', 'check X for bugs/flow problems'. Phase 4 (requirement fulfillment) is where OBJECTIVE-ALIGNMENT verdicts come from — pair with refining/refactor-alignment when drift demands structural change. Phase 6 covers designing an extension to an already-running mechanism (curator, reflection loop, post-turn hook) when the gap is scope, not breakage."
parent: architecture-discipline
related_adrs: [AD-014, AD-023, AD-028, AD-029, AD-038]
related_rgs: [RG-013, RG-020, RG-021, RG-029]
---

# System Audit — Deep Efficacy Audit & Flow Optimization

Use this leaf to perform a **deep efficacy audit** on any target system. While `integrity-validation` checks file structure and `monthly-review` checks for architectural drift/orphans, `system-audit` tests whether a system actually works, fulfills user requirements, and operates without bugs across its entire subsystem hierarchy.

## When to Use This Leaf

Descend from `architecture-discipline` when:
- Evaluating a target system's end-to-end operational readiness
- Finding hidden bugs, dead ends, or broken integration flows
- Validating that a system meets the user's actual requirements (not just structural compliance)
- Producing an optimization/refactoring plan for a system and its subsystems
- Triggers: "audit system", "system audit", "efficacy audit", "audit flow", "end-to-end audit", "check bugs in <system>", "optimize <system> flow"

Do **not** use for:
- Post-action structural linting → use `integrity-validation`
- Routine monthly drift detection → use `monthly-review`
- Creating/scaffolding a new system → use `system-design`

---

## The 5-Phase Audit Methodology

```
Phase 1: Architecture Alignment & Registry Check
    ↓
Phase 2: Subsystem Topology & Interface Audit
    ↓
Phase 3: End-to-End Operational Flow Test
    ↓
Phase 4: Requirement Fulfillment & Gap Analysis
    ↓
Phase 5: Synthesis & Optimization Plan
```

---

### Phase 0: Sub-System Doc Routing (DOC-FIRST — MANDATORY)

Before ANY infrastructure-level audit or change, route through the sub-system documentation. This is the anti-drift gate: docs are understood and upgraded BEFORE implementation (HI-AD-041, AD-052).

1. **Identify the target sub-system(s)**: For the system under audit, list its recursive sub-systems (AD-023):
   ```bash
   arch sub list --pool {system} 2>/dev/null || find systems/{system}/sub-systems -maxdepth 1 -mindepth 1 -type d
   ```
2. **Read the sub-system's doc surface FIRST**: For each relevant sub-system, read `sub-systems/{sub}/AGENTS.md` (AD-050 — AD/RG/cron tables) and `arch list --pool {system}` filtered to that domain. Understand the sub-system's ADs/RGs before touching its files.
3. **Check doc freshness**: If the sub-system's AGENTS.md, ADs, or RGs are stale relative to the actual infrastructure, that is DRIFT — flag it and fix the DOCS FIRST (write/update the AD/RG via `arch new`/`arch update`, then re-validate) before any infra-level change.
4. **Doc-first ordering rule**: Every audit finding that implies a change must produce its AD/RG or AGENTS.md update BEFORE the infrastructure is modified. Implementation without a doc update is a discipline violation (RG-010, AD-051/052).

---

### Phase 1: Architecture Alignment & Registry Check

Verify the target system's place in the global architecture genome.

1. **Check System Registry**: Read `~/.hermes/systems/architecture/AGENTS.md` (AD-050) and cross-check with arch: `arch list --pool {system}` · `arch related <system-AD>` · `arch gaps`. Is the system registered? Does its AD reference match its `AGENTS.md`? If the pool shows no ADs/RGs in `arch stats`, flag it as a coverage gap.
2. **Check Pool Isolation (AD-014 / RG-013)**: Are all system components contained inside `~/.hermes/systems/{system}/`? Check for leaked files in frozen directories:
   ```bash
   find ~/.hermes/scripts/ ~/.hermes/data/ -name "*{system}*" 2>/dev/null
   ```
3. **Check Git Tracking (RG-021)**: Ensure system files are tracked:
   ```bash
   git -C ~/.hermes status --porcelain systems/{system}/
   ```
4. **Run Validation**:
   ```bash
   arch validate --pool {system}
   ```

---

### Phase 2: Subsystem Topology & Interface Audit

Traverse the full recursive subsystem tree (AD-023).

1. **Map Subsystem Tree**: List all recursive subsystems under `sub-systems/`:
   ```bash
   find systems/{system}/sub-systems/ -name "AGENTS.md" -o -name "_org.yaml"
   ```
2. **Validate Each Subsystem**:
   - Required files present (`AGENTS.md` (AD-050), `_org.yaml`)
   - CLI tools accept required `--reason` flag (AD-032)
   - Interface contracts match between parent and sub-system
3. **Categorization & Relationship Audit (AD-062)**: every organ declares a valid `pool.category` from the Sub-System Category Taxonomy; `relationships.depends_on` targets resolve; no cycles. Run the machine checks:
   ```bash
   arch sub list --category <cat>      # cross-system discovery by category
   arch sub deps                       # full relationship graph (declared + implicit pooled edges)
   arch sub deps {system}/{organ}      # impact analysis: forward + reverse dependents
   arch sub deps {system}/{organ} --impact  # reverse closure: which pools break if this changes (hops + chains)
   arch validate                       # 0/0 gate — ERRORs on unresolved targets and cycles
   ```
   Organs with missing/invalid categories surface as WARNs — categorize them
   (incrementally is fine; the WARN keeps the gate green).
   Genuine bidirectional couplings surface as cycle ERRORs — resolve them by
   declaring the pair as `relationships.loops` on BOTH sides (validated,
   agreed, exempted from the cycle check), never by dropping the edge.
4. **Cross-Pool Dependencies**: Identify all imports or calls to external systems. Check that external dependencies have explicit approval (RG-020).
5. **Cross-Pool Reference Scan**: Search ALL other system pools and skills for references to the target system by name:
   ```bash
   grep -rl "{system-name}" ~/.hermes/systems/ --include="*.py" --include="*.sh" --include="*.yaml" --include="*.yml" --include="*.md" | grep -v "systems/{system}/"
   grep -rl "{system-name}" ~/.hermes/skills/ 2>/dev/null
   ```
6. **Cron Job Prompt Scan**: Cron prompts in `jobs.json` embed CLI commands as **text strings** inside the agent prompt — they are NOT executable code that compile checks can catch. Search for stale references in cron job prompt text:
   ```bash
   python3 -c "
   import json
   with open('~/.hermes/cron/jobs.json') as f:
       data = json.load(f)
   for job in data.get('jobs', []):
       if 'rel-intel campaign' in str(job.get('prompt', '')) or 'sync_to_relintel' in str(job.get('prompt', '')):
           print(f'STALE: {job.get(\"name\")}')
   "
   ```
7. **Stale Internal Ref Scan**: After a migration/split, scan the target pool's OWN executable/config files for leftover references to the OLD system name:
   ```bash
   grep -rl "old-system-name" ~/.hermes/systems/{system}/ \
     --include="*.py" --include="*.sh" --include="*.yaml" --include="*.yml" \
     2>/dev/null | grep -v __pycache__
   ```

---

### Phase 3: End-to-End Operational Flow Test

Test the actual runtime execution path through every subsystem.

**Step 0 — Run the system's smoke manifest (MANDATORY, AXE-AD-010):** Every
pool with a CLI surface declares `smoke.yaml` at its root, and the AXE tick
runs the smoke gate (`axe smoke`) before spawning agents — critical failures
block the tick (fail-closed). An audit MUST verify the system's own gate is
green and that its manifest covers its actual operational surface:

```bash
# Run the full gate, then the target system's checks specifically
axe smoke                 # full gate (all pools)
axe smoke --pool <system> # just this system's manifest
```

If the system has NO smoke.yaml, that is itself a finding (AXE-AD-010
violation): the system is operationally invisible — its breakage would only
be discovered mid-flight by a cron job or agent. The audit must flag it and
require the manifest be scaffolded (see `system-design` step 4b).

**Pitfall — Naming prefix drift after file moves:** When copying an AD/RG from another pool into this pool's `core/decisions/` or `core/regressions/`, the filename must match this pool's AD/RG prefix declared in `_org.yaml` (e.g., `prefix: "PBP-AD-"` for personal-brand-polarizing decisions, `prefix: "RI-RG-"` for rel-intel regressions, etc.). The system-integrity linter checks filenames against the prefix. A copied file `AD-001-polarizing...` will trigger `ERROR file in decisions/ has wrong prefix` (expected the pool's declared prefix). Rename to match the pool's prefix AND update the `ID:` frontmatter field to match — mismatched ID and filename causes cross-ref resolution to fail.

1. **CLI Operational Test**: Run help and dry-run commands for all CLIs in the system:
   ```bash
   # Test main CLI
   systems/{system}/bin/{cli} --help
   # Test sub-commands
   ```
2. **Execution Flow Test**: Execute a real or mocked pass through the system's primary workflow:
   - Create test artifact/entry
   - Process through pipeline stages
   - Verify state updates
   - Clean up test artifacts
3. **Error Handling & Edge Cases**:
   - Test invalid arguments
   - Test missing data files
   - Test empty state
   - Verify non-zero exit codes on failures
4. **Cron Prompt Validation**: Verify cron job prompts don't contain stale CLI references. Cron prompts embed CLI commands as text strings inside `jobs.json` — compile checks won't catch them. Grep the prompt text for old system names after a migration.
5. **Compile-Check All Scripts** (batch): All Python scripts that the system's CLIs or cron jobs call must compile:

---

### Phase 4: Requirement Fulfillment & Gap Analysis

Check if the system fulfills what the user actually needs.

1. **User Requirement Check**: Compare current behavior against:
   - `AGENTS.md` purpose statement (AD-050)
   - Relevant ADs
   - Active user directives in MEMORY.md / USER.md
2. **Classify Gaps**:
   - **BUG**: Code crash, broken CLI, wrong logic, invalid data output
   - **GAP**: Missing requirement, partial implementation, dead-end flow
   - **DRIFT**: Divergence from architectural standards or global conventions
   - **SLOP**: Redundant code, dead files, duplicate features

### Phase 2b: Operational Efficiency Sub-Audit

For cron-driven agent systems, supplement the gap analysis with an efficiency audit. See `references/operational-efficiency-audit-patterns.md` for full patterns.

### Phase 2c: Autonomous Pipeline Forensic Audit (flywheel efficacy)

When the target is a **cron-driven autonomous pipeline** (job-engine, freelance-engine,
multi-phase agent flywheels) and the user reports "no progress" while crons report `ok`,
structural checks pass but the *effectiveness loop* is broken. Run the forensic protocol
in `references/autonomous-pipeline-forensic-audit.md` — it bisects where value leaks:
state-machine ghost detection, score-gate starvation, reply-detection leaks, channel
health, and the visibility gap (why the user sees nothing despite real activity). This is
a state-forensics pass, distinct from Phase 3's CLI dry-run.

**3-level implementation check**:
1. Surface: Does the function/CLI exist? (`grep -n "func_name" scripts/*.py`)
2. Wiring: Is it called from the execution path? (`grep -n "func_name()" scripts/*.py`)
3. Runtime: Does it actually work? (`python3 -c "from module import fn; print(fn())"`)

**Cron execution analysis**: Query `~/.hermes/cron/executions.db` for duration, status distribution, and failure patterns. Check lock file hygiene (`.fire-*.lock` files older than 1h = stale). Check state file accumulation.

**Token waste patterns**: Dead code (functions never called), redundant prompt instructions (self-registration when tick pre-registers, env setup when inherited, multi-tasking for one-shot agents), and missing data ingestion (generated diagnostics not consumed by recovery).

## Related
- autonomous-loops skill — broader autonomous loop patterns

---

### Phase 5: Synthesis & Optimization Plan

Produce the audit report and optimization plan.

1. **Write Audit Report**: Save to `systems/{system}/references/system-audit-YYYY-MM-DD.md` (or pass to user directly if one-shot).
2. **Structure of Audit Report**:
   - **Executive Summary**: Overall health score (PASS / PASS WITH WARNINGS / FAIL)
   - **Architecture Alignment**: Pool isolation, git status, linter results
   - **Subsystem Breakdown**: Status of each subsystem and sub-subsystem
   - **End-to-End Test Results**: Output from operational flow testing
   - **Bugs & Gaps Inventory**: Table of all findings with severity (Critical / High / Medium / Low)
   - **Optimization Plan**: Phased action items to bring system to 100% efficacy
3. **Log Regressions**: If new failure modes were found, log them via `regression-logging` (RG-NNNN).
4. **Log Decisions**: If structural refactoring is needed, write an AD via `decision-logging` (AD-NNNN).

### Phase 6: Mechanism-Extension Design Proposal (when audit reveals a coverage gap in an existing mechanism)

Use this sub-phase when the audit target is an **already-running mechanism** (curator, reflection loop, memory hook, sync engine, smoke gate, post-turn hook, background task) and the gap is "this mechanism should also cover X tier of state, but doesn't." Distinct from "design a brand-new system" (`proposed-system-evaluation`) and from "refactor an existing system" (`refactor-alignment`).

**When to use this phase, not Phase 5 alone:**
- The mechanism is in production, has telemetry, has invariants that must be preserved
- The gap is *scope*: a tier of state (CLI tools, ADs/RGs, KBs, crons, infrastructure) is not being reflected/healed
- Backwards compatibility matters — current users depend on the existing behaviour
- The proposal must respect existing constraints (interval cadence, snapshots, ledger, rollback) rather than design fresh

**The 5-step protocol:**

1. **Inventory the existing seams, not just the symptoms.** Read the actual code (not the docs) to find:
   - The trigger hook (where new logic would attach — e.g. `_run_post_turn_hooks` in `gateway/run.py`)
   - The data model the mechanism operates on (e.g. `agent_created` gate in curator)
   - The state store (e.g. `.curator_state`, `.curator_ledger.jsonl`)
   - The hard invariants (e.g. "never auto-deletes, only archives"; "one external provider at a time")
   Batch all of these in a single tool round — they're independent reads.

2. **Classify the gap precisely.** Distinguish three kinds of gap:
   - **Scope gap**: mechanism exists but only covers one tier (curator → only `~/.hermes/skills/`, not infrastructure)
   - **Cadence gap**: mechanism exists but runs at the wrong frequency (7d idle-gated vs hourly smoke)
   - **Policy gap**: mechanism exists but the gate is too narrow (`agent_created` excludes user-written skills by design — but that policy is wrong for infrastructure)
   Naming the kind of gap determines which of the 3 design options fits.

3. **Surface at least 3 viable designs with tradeoffs.** Never propose a single design. The class of "extend an existing mechanism" has three recurring patterns:
   - **Scope flag on the existing primitive** (e.g. add `infrastructure` scope to curator). One CLI, one config block, one ledger, one rollback. Tightest integration, biggest blast radius if the primitive is wrong.
   - **Sibling pass with shared substrate** (e.g. `hermes steward` that mirrors the curator's snapshot/ledger/rollback pattern but owns its own scope). Tighter per-surface scope, two CLIs to learn, two ledgers to maintain.
   - **Per-turn orchestrator dispatching to per-domain refiners** (e.g. `hermes reflect` runs every turn, dispatches skill-refiner / infra-refiner / memory-pruner). Most aggressive healing latency. Risk: violates Hermes AGENTS.md's "no mid-conversation prompt mutations" rule if the orchestrator mutates the active conversation's prompt cache.
   Always name all three even if you have a recommendation — the user needs to see the trade space.

4. **Identify the load-bearing invariants before proposing mutations.** The most common failure mode in mechanism-extension design is breaking an invariant the user depends on. For each design option, list the invariants it preserves vs the ones it must renegotiate, and explicitly surface which existing user contracts (e.g. "foreground-created skills are off-limits to the curator") would need to be amended. If the proposal requires renegotiating an invariant, that is the highest-stakes part of the design — present it first.

5. **Hold for the user's decision. Do not pick.** Per the architecture-discipline doctrine, mechanism-extension design is a contract renegotiation. Use `clarify` to surface the trade space. If a clarification times out, stop and report the open question rather than guessing the core architecture choice. The cadence / scope / action sub-questions can be asked in the same `clarify` call; the core architecture question is its own decision and should never be batched with the rest.

**Anti-patterns observed in practice:**

- **Designing before reading the code.** A common failure: proposing a new `hermes infra-curator` based only on the documentation, when reading the actual `curator.py` would have shown the `_run_post_turn_hooks` seam already exists and a scope flag would suffice. Always read the code path that implements the current behaviour before proposing an extension.
- **Proposing per-turn mutation as a healing mechanism.** Hermes AGENTS.md is explicit: "per-conversation prompt caching is sacred" and "no synthetic user message injected mid-loop." Any mechanism-extension design that proposes per-turn mutations to the active conversation's prompt is a discipline violation, not a design choice. Healing latency must come from background ticks, not from per-turn work.
- **Conflating "scope gap" with "broken mechanism."** If the existing mechanism is working correctly for its current scope, that is *not* a Phase 4 BUG/GAP/DRIFT finding. It is a Phase 6 design proposal: the mechanism is right, just scoped too narrow. Don't conflate the two — the design protocol is different (propose with options) from the bug protocol (log an RG and fix).
- **Skipping the invariants audit.** Proposing an extension that silently breaks the `agent_created` policy gate is a regression. Always run step 4 before presenting options.
- **Asking only the easy sub-questions.** It is tempting to ask the user about cadence, scope, and action model (the lower-stakes questions) and assume the core architecture choice. The core choice (scope flag vs sibling vs per-turn orchestrator) is the *one* question the user must answer. Do not batch it with the others — give it its own `clarify` round if the first call covers the sub-questions.

---

**Org dimension (AXE-AD-011):** run `axe org check` — orphan employees, jobs without staff,
and live-jobs.json duplication are audit findings. Unstaffed pools must be declared utility/dormant.

## Audit Checklist (Quick Reference)

| Category | Check | Verification Command |
|----------|-------|----------------------|
| Pool Isolation | All files inside pool? | `find ~/.hermes/scripts/ -name "*{system}*"` |
| Git Tracking | System tracked in git? | `git status --porcelain systems/{system}/` |
| Pool Linting | Valid _org.yaml structure? | `arch validate --pool {system}` |
| CLI Compliance | AXI (AD-008) + --reason (AD-032)? | `{cli} --help` and test mutation flags |
| Subsystem Tree | All sub-systems have AGENTS.md? (AD-050) | `find systems/{system}/sub-systems/ -name AGENTS.md` |
| Runtime Test | Primary flow executes without error? | Run end-to-end dry-run or real test |
| Execution History | Cron jobs performing useful work? | Check `executions.db` for duration, status distribution, idle/spawn ratio |
| Token Efficiency | No dead code or redundant instructions? | Check for dead functions, redundant prompt text, missing data ingestion |
| External Deps | All external calls user-approved? | Scan imports/calls for external APIs |
| Requirement | System fulfills active user intent? | Compare behavior vs MEMORY/USER profile |

---

## Genome-Completeness Audit (AD-060 P6 — part of Phase 2)

For every pool with a `sub-systems/` tree — and MANDATORY for compass-graduates — audit the **unified genome** with `arch sub tree --pool {pool}`:

1. **Native organs present for every owned lifecycle?** Each graduate must carry a native sub-system for each lifecycle it genuinely owns (state machine, data, CLI). A pooling-only graduate (zero native organs) is under-genomed (P6) — its owned lifecycles were never scaffolded.
2. **Pooled categories resolve?** Each pooled entry's name must equal the resolved foundation counterpart (P5) — `arch validate --pool {pool}` flags violations.
3. **Foundation push contract (AD-061) — MANDATORY for foundations:** every organ at EVERY depth must be a complete pool (_org.yaml + AGENTS.md), every exposed directory DECLARED with a format rule, so `{graduate}/sub-systems/{foundation}/sub-systems/...` is fully navigable. Run `scripts/foundation_deploy_audit.py` for the 9 deployability criteria + `arch validate` for the undeclared-dir / no-format-rule checks.
4. **Foundations never pool** — a foundation with pooled symlinks is misclassified; its cross-system needs must be `services_consumed`.
5. **Categorical naming** — architecture docs must name foundation CATEGORIES (content-campaigns, research-intelligence, website-development, strategy), never hardcoded system names; concrete names live only in the Foundation Category Registry.
6. **Registry reflects depth** — `arch emit --registry` must record native organs AND nested sub-sub-systems (the surface graduates inherit); a stale registry is a WARN (AD-061).

## Compass-Specific Audit References

When the audit target is the **Compass pipeline itself** (path development, graduation pipeline, or the breeding ground rather than a single graduated pool), load the compass audit methodologies — they are distinct from this generic system-audit flow:

- `references/compass-graduation-audit.md` — audit compass-graduated systems AND the pipeline that produced them
- `references/compass-pipeline-audit.md` — audit the Compass path-development/genome pipeline
- `references/operational-efficiency-audit-patterns.md` — Patterns for auditing cron-driven agent systems: dead code detection, execution history analysis, token waste identification, prompt redundancy checks, lock/state file hygiene.

(These live at the meta-skill's shared `references/` and this leaf's `references/` — see `_map.md` for paths.)

### Onboarding-contract check (AD-070)

Phase 2 must verify the target's AGENTS.md satisfies the operational onboarding
contract: read-order line present · Navigation Map current · Agent Instructions
numbered · auto-zone carries Services / Inter-System Routing / CLI Operations.
Missing sections = findings with disposition FIX (generate via
`architecture/scripts/generate_onboarding_zones.py`, then enrich).

## Resources

- `references/campaign-system-split-pattern.md` — worked split/decomposition pattern; consult during Phase 2 (topology audit) when a system shows multi-domain strain.
