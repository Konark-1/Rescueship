---
name: system-design
description: "Design and scaffold a new system with its pool directory under ~/.hermes/systems/. Use when creating a system, starting a new project, or planning infrastructure for a new domain. Triggers: 'create system', 'new system', 'design a', 'add a system'."
version: 3.0.0
---

# System Design — Scaffolding New System Pools

Use this leaf when a new capability needs its own home. A system is anything that owns scripts, data, skills, or cron jobs and warrants an Architectural Decision (AD). If the components already exist and just need moving, use `../system-lifecycle/SKILL.md` instead.

## When to Use

Triggers: "create system", "new system", "design a", "add a system", "scaffold a system", "new project infrastructure".

**Do not use this leaf when:**
- Adding a component to an *existing* system → use `system-lifecycle`.
- Recording a design decision (AD) for an already-built system → use `../decision-logging/SKILL.md`.
- The work fits inside an existing pool without structural change → just do the work.

## Pre-flight

1. Run `arch pool list` — check existing pools so you don't duplicate a domain.
2. Run `arch recon pool=<pool-name>` for recon context before creating.
3. If a similar AD exists, `arch show <ID>` it. Your new system may need to update that AD rather than create one.
4. **Read `~/.hermes/systems/architecture/references/genome-design.md`** — the system-architecture genome. Design the sub-system map and workflow contract BEFORE scaffolding. This is mandatory for any system with >1 sub-system.
5. **Recon-first (AD-052):** All pool creation requires a recon token. Run `arch recon pool=<name>` first, then use the returned token with `arch pool create`.

## Step-by-Step

### 1. Define the system purpose

Write a 2–3 sentence statement of what the system does and what it owns. If you can't state it that tersely, the system boundary is too fuzzy — split or merge before scaffolding.

**Why:** A crisp purpose determines the pool name, the AD scope, and which components belong inside. Vague systems drift into catch-all junk drawers.

### 2. Map the operational genome

If the system will have sub-systems, use `references/genome-design.md` to:
- Classify each planned sub-system into a genome layer (Produce / Operate / Observe / Align)
- Verify the feedback loop closes (Align layer feeds back into Produce layer)
- Write the workflow contract (what artifacts flow between sub-systems, in what format)

**Why:** The genome determines the shape. Scaffolding first, genome later, produces systems that execute but never learn or that duplicate canonical sources.

### 3. Choose the pool name

- kebab-case, no spaces / underscores / camelCase
- Describe the *domain*, not the implementation (e.g., `revenue-engine`, not `python-cron-jobs`)
- Short enough to type in cron prompts; unique within the registry

**Why:** The pool name is referenced in cron prompts, ADs, symlinks, and the registry. A bad name propagates friction everywhere.

### 4. Scaffold with arch CLI (AD-051, AD-052)

```bash
# Get a recon token first (REQUIRED for all write operations)
RECON=$(arch recon pool=<name> 2>&1 | grep "Recon ID:" | awk '{print $3}')

# FOUNDATIONAL system (graduate-pool-ready by default, AD-060):
#   --category is REQUIRED — pick the capability class from the Foundation
#   Category Taxonomy (content-campaigns, research-intelligence,
#   website-development, strategy, identity, relationship-intelligence,
#   task-execution, infrastructure, financial-intelligence). --prefix picks
#   the canonical AD/RG prefix (default: slug form).
arch pool create <name> --tier foundational --category {category} [--prefix PREFIX] --recon $RECON

# COMPASS-GRADUATE (strategic base — unified genome, AD-060 P6):
arch pool create <name> --tier compass-graduate --recon $RECON
```

This scaffolds (production-grade, graduate-pool-ready):
- `_org.yaml` — pool structure + **tier + category + declared AD/RG prefix**
  (AD-060 scale rule / AD-061), service-contract sections, `sub-systems/`
  genome capacity (allow_any, AD-060 P6)
- `AGENTS.md` — router template: Read-this-first, Foundation Identity (tier/category/pooled-by/sub-sub-systems), Key Artifacts incl. ops surface + genome organs (AD-050)
- `core/decisions/` and `core/regressions/` (governance dirs)
- `scripts/`, `skills/`, `data/`, `references/`, `archive/`, `bin/`, `cron-jobs/`, `lib/`, `sub-systems/` (standard dirs — ALL declared in `_org.yaml`, RG-027/AD-061, so pooled consumers can route to every one)
- **Zero registration (AD-061):** the pool's `_org.yaml` IS its registration —
  `arch pool create` re-emits the architectural registry so the new pool
  appears in `data/architecture-registry.yaml`, the Foundation Category
  Registry table, and the root `systems/AGENTS.md` registry automatically. No
  code or doc edits.

A foundational system is graduate-pool-ready the moment it is scaffolded: it has
the category to be classified, the `sub-systems/` capacity for its own genome
organs, a router AGENTS.md, and its services sections — everything the
foundation-deployability audit (9 criteria) checks.

### 4b. Declare the departmental identity (AXE-AD-011)

The new pool is a **department**. Before its first cron job exists:

- Add an advisory `employees:` block to `_org.yaml` describing the roles the
  department expects (e.g., `scanner`, `scorer`, `dispatcher`) — consumed
  read-only by `axe org`; the runtime roster stays derived from jobs.json.
- When the first cron jobs land, run `axe org sync --write-frontmatter` so each
  gets an employee record + `employee:` frontmatter (see cron-job-lifecycle leaf).
- The pool's AGENTS.md gains an auto-generated **Your Department** roster block
  via `arch emit` — never hand-write org content into AGENTS.md.
- Cross-department work this system will need? Create teams explicitly:
  `axe org team create <id> "<mission>" --members emp-a,emp-b [--cross-dept]`.

A department born without employee expectations produces anonymous contractor
jobs — the exact drift AXE-RG-012 blocks at the smoke gate.

If the system will have sub-systems (native genome organs):
```bash
# Get a new recon token for the sub-system creation
RECON2=$(arch recon pool=<name>/<sub-name> 2>&1 | grep "Recon ID:" | awk '{print $3}')
# Positional order is: arch sub create <POOL> <ORGAN>
arch sub create <name> <sub-name> \
    [--dirs 'templates:suffix=.md'] [--rules 'Owns the <organ> lifecycle'] \
    --recon $RECON2
```

Complex organs declare custom directory structures with `--dirs` (RG-027:
every directory declared) and nested organs via the built-in `sub-systems/`
capacity — the linter is config-driven (AD-022), so any organ shape is
expressible.

**Categorize every organ at creation (AD-062):** `arch sub create` scaffolds
`pool.category` — fill it from the Sub-System Category Taxonomy
(`SUB_SYSTEM_CATEGORIES` in `systems/architecture/lib/core.py`;
`systems/architecture/references/sub-system-category-taxonomy.md`). If the
organ has known cross-system couplings, declare them as forward
`relationships.depends_on` in the same `_org.yaml` (targets: `system` or
`system/sub-system`). Pooled-symlink dependencies are DERIVED (AD-062) —
never hand-written. `arch validate` then verifies resolution + cycle-freedom
and `arch sub deps <organ>` renders the impact graph.

**Why:** `arch pool create` is the canonical scaffolding path (AD-051). It enforces recon-first (AD-052), creates the correct structure, and seeds `_org.yaml` with the right schema. Manual `mkdir + touch` bypasses the linter and produces non-compliant pools. Every new foundational system MUST declare its category (linter-enforced) and settle into the Foundation Category Registry.

### 4b. Scaffold the operational smoke manifest (MANDATORY — AXE-AD-010)

Every system with a CLI surface MUST declare a `smoke.yaml` at its pool root.
The AXE tick runs the smoke gate (`axe smoke`) before spawning ANY agent —
critical failures block the tick (fail-closed). This is the infrastructure's
anti-fragility contract: agents never operate on a broken baseline, and a
failed check auto-creates a kanban fix task so the system learns its new
operational baseline.

```yaml
# <pool>/smoke.yaml
version: 1
checks:
  - name: "CLI parses"
    cmd: "python3 -m py_compile ~/.hermes/systems/<pool>/bin/<cli>"
    timeout: 30
    critical: true
    reason: "the CLI is the system's operational surface"
  - name: "unit tests pass"
    cmd: "cd ~/.hermes && python3 -m pytest systems/<pool>/tests/ -q >/dev/null 2>&1"
    timeout: 120
    critical: true
    reason: "the regression suite must stay green"
```

Rules (AXE-AD-010):
- `cmd` is a shell command; exit 0 = pass. Never fabricate checks that always
  pass — each check must fail if the surface it guards breaks.
- `critical: true` (default) blocks the tick on failure; `critical: false`
  reports without blocking (use for soft/optional surfaces).
- Discovery is filesystem-driven: dropping the file in is registration. The
  linter (`arch validate`) will enforce that pools with `bin/` or `scripts/`
  declare a smoke.yaml.

**Why:** A system without a smoke manifest is operationally invisible — its
breakage is only discovered when a cron job or agent hits it mid-flight. The
smoke gate moves that discovery to BEFORE execution.

### 5. Write the README.md manifest (AD-042 — formerly `SYSTEM.md`)

Copy the template at `../references/system-template.md` into the pool's `README.md` (AD-042 — the canonical manifest, formerly `SYSTEM.md`). Fill in:
- **Identity**: pool path, AD reference (assign during step 5), status `Active`, created date
- **Purpose**: the statement from step 1
- **Components**: list each subdirectory you'll actually populate
- **Cron Jobs**: leave empty if none yet — do not fabricate entries
- **Related ADs / RGs**: link by ID once step 5 is done

**Why:** `README.md` is the entry point (AD-042 — formerly `SYSTEM.md`). `monthly-review` reads it; cron prompts reference it. A blank or stale manifest defeats the audit.

### 6. Write the AD for the system

Every new system requires an Architectural Decision documenting why it exists, what trade-offs it encodes, and what it owns. Use `../decision-logging/SKILL.md` for the full AD-writing process.

Minimum the AD must capture:
- Why a new pool is needed (not folded into an existing one)
- The system boundary: what's in, what's out
- Dependencies on other systems (shared resources, upstream cron jobs)

After the AD is written, go back to the pool `README.md` (AD-042 — formerly `SYSTEM.md`) and fill in the `AD reference` field with the assigned number (e.g., `AD-014`).

**Why:** Without an AD, the system is undocumented. Six months later nobody knows why it exists, and `monthly-review` can't validate it. The AD is the system's birth certificate.

### 7. Register in the architecture README

Add a row to the Systems table in `~/.hermes/systems/architecture/README.md`. The table currently follows this shape:

```
| System | Pool Path | AD Reference | Status | Cron Jobs |
|--------|-----------|--------------|--------|-----------|
| Design-Aesthetic | ~/.hermes/systems/design-aesthetic/ | AD-014 | Active | (none yet) |
```

**Why:** The registry is the index. `monthly-review` and `architecture-discipline` routing both rely on it being complete. An unregistered pool is an orphan.

### 8. Symlink skills if needed

If the system has skills that must be discoverable via `~/.hermes/skills/{category}/`:

```bash
ln -s ~/.hermes/systems/$SYSTEM/skills/{skill-name} \
      ~/.hermes/skills/{category}/{skill-name}
```

The skill *source* lives in the pool; the symlink enables discovery. Do not leave skill source outside the pool.

**Why:** The pool is the source of truth; the symlink is a pointer. reversing this (real files in `~/.hermes/skills/`, symlink back to pool) creates orphans when the pool moves.

### 9. Validate with the linter (REQUIRED)

After scaffolding, **always** run the linter to verify the new pool conforms to AD-023:

```bash
arch validate --pool $SYSTEM
```

This performs the full check (directory structure, file extensions, frontmatter, forbidden patterns). `_index.yaml` is a superseded legacy artifact (AD-042) — the canonical doc is the pool's AGENTS.md (`arch emit --agents $SYSTEM`). **Required outcomes:**
- Exit code 0 (no errors)
- The pool passes all structural checks
- `_index.yaml` exists at the pool root

If the linter reports errors:
- `decisions/` at pool root → must be `core/decisions/`
- `regressions/` at pool root → must be `core/regressions/`
- `SUB-SYSTEM.md` outside `sub-systems/` → move into `sub-systems/`
- Missing required files → create them
- Wrong file extensions/prefixes → rename or restructure

**Important:** Do NOT create or expect `_index.yaml` at the pool root. It is a superseded legacy artifact (AD-042 deprecated it in favor of `AGENTS.md` + `_org.yaml`). The linter will NOT require it — if Step 9's text mentions it as a required output, that is stale guidance and the linter result should be trusted over the wording. `AGENTS.md` (auto-generated via `arch emit --agents`) is the canonical index, not `_index.yaml`.

**Why:** The linter is the schema-compliance gate. Without this step, a new pool may exist in the registry but violate AD-023. `monthly-review` will flag it as a regression. Run the linter immediately after scaffolding, not later.

### 10. Declare system CLIs in the unified registry (AD-056 / RG-045)

If the new system ships a CLI (a `bin/` entry point or a script that should be
on PATH), declare it in the unified registry — this is its **ONLY** integration
step. No manual `~/bin` symlinks, no hand-edited tool-index tables:

```bash
# 1. Add one entry to systems/hermes-agent-infra/cli-version-registry.yaml
#    under `system_clis:` — name, bin_link, target, pool, smoke:
#   - name: mycli
#     description: "..."
#     bin_link: mycli
#     target: systems/my-system/bin/mycli
#     pool: my-system
#     smoke: "--help"

# 2. Integrate (creates ~/bin/mycli + smoke-tests):
system-integrity --sync-clis
```

**Why (AD-056):** manual CLI integration is how CLIs get forgotten — AD-051
declared an `arch` CLI that was never deployed. The registry + `--sync-clis`
make integration one declaration + one command, and `--cli-check` turns any
future drift into a visible failure instead of a silent gap.

## Worked Example: `design-aesthetic`

1. **Purpose**: "Curate and apply a visual design standard across generated artifacts (slides, HTML, PDFs). Owns the aesthetic profiles, evaluation scripts, and reference galleries."
2. **Name**: `design-aesthetic` — domain-descriptive, kebab-case.
3. **Scaffold**:
   ```bash
   mkdir -p ~/.hermes/systems/design-aesthetic/{scripts,skills,data,references,archive}
   touch ~/.hermes/systems/design-aesthetic/SYSTEM.md
   ```
   (`kb/` omitted — no knowledge base yet.)
4. **SYSTEM.md**: filled from template, AD reference left blank pending step 5.
5. **AD**: write AD-014 "Design Aesthetic System" via `../decision-logging/SKILL.md`. Captures: why a separate pool (distinct from AD-008 AXI standard), system boundary, that it owns profiles + evaluation but not the artifact generators.
6. **Registry**: append row to `~/.hermes/systems/architecture/README.md` Systems table with `AD-014`, status `Active`, cron jobs `(none yet)`.
7. **Symlink**: `design-aesthetic-skills` skills symlinked into `~/.hermes/skills/design/` if any.

## Pre-Graduation Scaffolding (compass-graduate pools before strategy activation)

Sometimes you scaffold a compass-graduate pool BEFORE its compass strategy is activated. This is the "pre-graduation" pattern: the pool exists with `graduation_stage: 1` and all-zero compass-alignment.json, ready to receive operations when the strategy goes active. Use this when:

- A compass path has a strategy in draft status but you want to build the operational skeleton in parallel with strategy maturation (e.g., saas-engine scaffolding while strategy-009 is still draft).
- The sequencing protocol (e.g., CP-AD-007) says only one surface launches first, but infrastructure should be ready when it does.

**Key differences from normal scaffolding:**

1. `_org.yaml` sets `compass_graduate.graduation_stage: 1` (not 2 or 3).
2. `_org.yaml` sets `compass_graduate.graduation_date: null` (not yet graduated).
3. `data/compass-alignment.json` has `operational_status: "pre-graduation"`, `strategies_active: 0`, `strategies_draft: 1`.
4. The 4-layer genome sub-systems (produce/operate/observe/align) are scaffolded with `_org.yaml`, `AGENTS.md`, `README.md` in each, but they contain no scripts or cron jobs yet — they're operational skeletons.
5. No cron jobs are created. No content is posted. No scripts are run. This is infrastructure scaffolding only.

**Do NOT scaffold all surfaces at once if the sequencing protocol gates them.** NOTE (2026-08-18): the personal-brand gating model is DEPRECATED — CP-AD-007's tech-first sequencing is superseded (tech surface archived; PBP-AD-001/PBI-AD-001). The two holonic surfaces (The Undercurrent — anonymous; Ishan Parihar — name-brand) were scaffolded TOGETHER 2026-08-18 under auto-mode agentic cron, NO follower gates (operator directive 2026-08-17). The general principle survives: only scaffold what the sequencing protocol currently allows — check the path-004 entry in `personal-os/sub-systems/path/data/trajectories/path-entries.md` for the current surface state before scaffolding.

## Compass-Graduate Sub-System Pooling (AD-060)

A compass-graduate pool is the **strategic base** for its function. When scaffolding a graduate that extends shared infrastructure, DO NOT wire the shared systems through `services_consumed` + CLI bridges alone — **pool them as symlinked sub-systems** (AD-060):

1. **Design the UNIFIED GENOME first (P6 — requirement-driven, NOT pooling-only).** List what the graduate OWNS (state machines, data, CLIs — product FSM, application pipeline, delivery rhythm) → those become NATIVE sub-systems via `arch sub create`. Then list which foundational CATEGORIES the function extends (content-campaigns, research-intelligence, website-development, strategy) → those get POOLED. **Categorical naming:** describe foundations by category, never hardcode system names — resolve concrete systems via the Foundation Category Registry (`references/foundational-system-patterns.md`).
2. **Scaffold native genome organs** (owned lifecycle first):
   ```bash
   RECON=$(arch recon topic=genome 2>&1 | grep -oE 'recon-[a-z0-9-]+' | tail -1)
   arch sub create {native-organ} --pool {graduate} --recon $RECON   # owns _org.yaml + AGENTS.md, inherits graduate's AD/RG prefix
   ```
3. **Pool each extended foundation category as a sub-system** with the arch CLI (the only write path). **P5 exact-name rule: the symlink name MUST equal the RESOLVED foundation counterpart's name** — never an authored alias:
   ```bash
   # auto-import the graduate's whole pooled_sub_systems list by exact name:
   arch sub pool --pool {graduate} --sync --recon $RECON
   # or pool one foundation (resolve {foundation} from the registry, name must equal it):
   arch sub pool {foundation} --pool {graduate} --source ../../{foundation} --recon $RECON
   ```
   The symlink is RELATIVE (survives clones/restores). The foundation stays canonical — never copy its data (RG-028). `--sync` resolves each name to `systems/{name}/` (top-level pool) or `systems/compass/sub-systems/{name}/` (compass sub-system); an unresolved name is an error — the foundation counterpart must exist first.
4. **Declare `sub-systems/` in `_org.yaml`** with `allow_any: true` (symlinks are not files; pattern rules would flag them). The linter validates native organs (Tier 1 recursion, AD-039) and skips pooled symlinks (AD-042).
5. **One mechanism per relationship (P3)**: pooled as a sub-system → do NOT also list it in `services_consumed`. Only services called but NOT pooled go in `services_consumed`.
6. **Sub-sub-systems (genomic depth).** A graduate's native organs may carry their own sub-systems (`arch sub create` nested) — and a pooled foundation's own sub-systems stay visible through the symlink (`{graduate}/sub-systems/{foundation}/sub-systems/...`). Foundations keep their sub-systems complete so nested navigation works.
7. **Do not classify foundations as graduates.** Foundations are the SOURCE of pooling — they never pool; their cross-system needs are plain `services_consumed` contracts.
8. **Validate**: `arch validate --pool {graduate}` + `arch emit --agents {graduate}` (exit 0 required).

**Why:** the graduate's `sub-systems/` tree shows its complete operational genome at a glance (P1), consistency is structural (the symlink IS the foundation's live folder — no drift), and management overhead drops because shared capabilities appear automatically in every graduate that pools them (AD-060 P2/P4).

## Pitfalls

- **Don't create components outside the pool.** A script that starts at `~/.hermes/scripts/foo.py` instead of `~/.hermes/systems/{name}/scripts/foo.py` is an orphan the moment it's written. `monthly-review` will flag it; `system-lifecycle` will have to migrate it. Start it in the pool.
- **Don't use `~/.hermes/scripts/` for new systems.** That directory is deprecated for new work. Existing scripts there are migration candidates, not a precedent.
- **Don't skip the AD.** A pool without an AD is untraceable. `monthly-review` cannot validate a system whose rationale was never recorded. Write the AD before declaring the system done — even if the AD is short.
- **Don't fabricate cron entries in SYSTEM.md.** If the system has no cron jobs yet, write `(none yet)`. Inventing a schedule that doesn't exist poisons the registry.
- **Don't create speculative subdirectories.** If there's no KB, don't make `kb/`. If there's no MCP server, don't make `mcp/`. Empty modeless directories accumulate without purpose.
- **Don't put skill source outside the pool.** The real files live in `systems/{name}/skills/`; `~/.hermes/skills/` gets symlinks. Reversing this orphans skills when the pool moves.

## References

- Pool layout spec: `../references/pool-layout.md`
- **Genome design methodology: `../references/genome-design.md`** (design the sub-system map + workflow contract — do this BEFORE scaffolding)
- **Foundational system pools: `../references/foundational-system-pattern.md`** (shared infrastructure systems consumed by multiple graduate/domain pools — e.g., `campaigns`, `hermes-agent-infra`)
- SYSTEM.md template: `../references/system-template.md`
- SUB-SYSTEM.md template: `../references/sub-system-template.md`
- AD writing: `../decision-logging/SKILL.md`
- System lifecycle (move/migrate/remove): `../system-lifecycle/SKILL.md`
- Root router: `../SKILL.md`


## Initializing an EXISTING External Project as a Native System

Trigger: user asks to make an external repo/vault (e.g. under ~/Documents/) into a
first-class hermes system — "initialize", "make native", "apply the genomic template",
or you are about to write its AD/RGs and discover no pool exists.

1. **Recon**: `arch recon topic=<project>`; confirm no pool exists (`arch pool list`).
2. **Scaffold**: `arch pool create <name> --prefix <PREFIX> --category <class> --recon $RECON`.
   Prefix issues `<PREFIX>-AD-001`/`<PREFIX>-RG-001` namespaces (AD-034).
3. **Map the genome onto reality** in `_org.yaml`: declare `directories:` for what EXISTS
   in the project (with suffix/pattern/allow_any constraints, RG-027); use `paths:` or
   pooled symlinks (`sub-systems/<organ> -> <relative-or-absolute target>`) when the
   project body must stay where it is (git history, consumer paths). Do NOT bulk-move
   large bodies into ~/.hermes/systems unless consumers can follow.
4. **Governance lives in the pool**, not the project: `core/{decisions,regressions}`,
   smoke.yaml, cron-jobs/. The project keeps code/content; the pool owns decisions,
   regressions, crons, CLI registration.
5. **CLI registration (AD-056)**: declare the project CLI in
   `hermes-agent-infra/cli-version-registry.yaml`, then `arch cli sync`. Never hand-link.
6. **Emit + validate**: `arch emit --agents --pool <name>` && `arch validate`; fix until green.
7. Backfill: supersede any subject-scoped records previously misfiled in core
   (re-create with pool prefix, mark originals Superseded) — never leave dual-active copies.
