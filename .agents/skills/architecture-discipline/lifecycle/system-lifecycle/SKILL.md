---
name: system-lifecycle
description: "Expand, contract, rename, remove, migrate, or integrate a system pool. Use when modifying an existing system's structure, moving fragmented components into a pool, cleaning up, or making system A a plugin of system B (cross-system integration via CLI + symlinks per RG-028). Triggers: 'expand system', 'add to system', 'remove system', 'rename system', 'migrate', 'consolidate', 'clean up', 'integrate system', 'plugin pattern', 'backbone integration'."
version: 1.3.0
category: devops
---

# System Lifecycle — Modify, Migrate, and Remove System Pools

This leaf governs structural changes to existing system pools: expanding, contracting, renaming, removing, and migrating. Every operation here preserves the pool-directory principle from the root skill — no component ends up outside its pool.

## When to Use This Leaf

Descend here when the task involves:
- **Expand**: adding scripts, skills, data, or capabilities to an existing system
- **Contract**: removing unused components or trimming a system
- **Rename**: changing a system's pool directory name
- **Remove**: archiving or deleting an entire system
- **Migrate**: moving scattered components from `~/.hermes/scripts/`, `~/.hermes/data/`, `~/.hermes/research/`, `~/.hermes/skills/` into an existing pool, or consolidating fragments into a new pool
- **Consolidate**: merging two systems or pulling orphaned components into the right pool
- **Clean up**: removing dead components, stale symlinks, or orphaned cron jobs

## Watch for These Trigger Phrases

`expand system`, `add to system`, `remove system`, `rename system`, `migrate`, `consolidate`, `clean up`, `where does X belong`, `move X into the pool`, `decommission system`.

## Doc-First Sub-System Routing (MANDATORY — do this before EVERY operation below)

Any audit or refactor MUST route through the sub-system documentation first — docs are upgraded BEFORE infrastructure-level implementation (HI-AD-041, AD-052, RG-010). This is how architectural drift is prevented: the AD/RG always reflects reality because it is written first.

1. **Identify the sub-system**: Which recursive sub-system (AD-023) does this change belong to? `arch sub list --pool {system}` · or `ls systems/{system}/sub-systems/`.
2. **Read the sub-system's doc surface BEFORE touching files**: `sub-systems/{sub}/README.md` (AD-042 — AD/RG/cron tables) + `arch list --pool {system}` + `arch show` the relevant ADs/RGs. Understand what is already documented and governed.
3. **Upgrade the docs FIRST**: If this change is architecturally significant (new data flow, new dependency, new interface boundary, new ownership), write/update the sub-system AD via `arch new --pool {system}` / `arch update` (decision-logging) and the RG (regression-logging) BEFORE moving any file. Update the sub-system `README.md` Components table.
4. **Then implement**: only after the docs reflect the intended end state, perform the physical change (move/copy/delete files).
5. **Validate**: `arch validate --pool {system-name}` — exit 0 required.

> **Rule of thumb**: if you can describe the change to another agent by pointing at a doc, you are done with step 3. If you can only describe it by pointing at files, you skipped a doc.

---

## Departmental Bootstrap (AXE-AD-011)

A new system is a new department. Before calling creation done:
1. Every operational cron job gets an `.md` doc + `axe org sync --write-frontmatter` (employee identity).
2. `arch emit --agents --pool <pool>` renders the Department block into AGENTS.md.
3. If the system launches unstaffed (no crons yet), it must appear in `employees.json` meta as
   `dormant_pools` — declared absence, never accidental omission.
4. Cross-dept dependencies? Consider a team (`axe org team create`).

## Operations

### EXPAND — Add Components to a System

1. Identify the target pool at `~/.hermes/systems/{system-name}/`.
2. Place the new component in the correct subdir:
   - Defining logic (FSM, store, schemas) → `core/`
   - ADs about this system → `core/decisions/` (see `decision-logging` leaf)
   - RGs about this system → `core/regressions/` (see `regression-logging` leaf)
   - Scripts → `scripts/`
   - Skills → `skills/` (with symlink to `~/.hermes/skills/{category}/`)
   - Data/state → `data/`
   - Reference docs → `references/`
   - MCP server → `mcp/`
   - Sub-systems → `sub-systems/{sub-name}/` (with README.md + _org.yaml, see AD-023/AD-042)
   - Cron job prompts → `cron-jobs/`
3. If adding a **new directory type** that doesn't exist yet (e.g., creating `cron-jobs/` for the first time), update the pool's `_org.yaml` to declare the new directory:
   ```yaml
   # Add to directories: section
   cron-jobs/:
     suffix: .md
     required: false
   ```
   The linter reads `_org.yaml` to know what directories are valid. An undeclared directory may cause warnings or errors.
4. If the component is a skill that needs to stay discoverable in `~/.hermes/skills/{category}/`, create a symlink:
   ```
   ln -s ~/.hermes/systems/{system-name}/skills/{skill-name} \
         ~/.hermes/skills/{category}/{skill-name}
   ```
5. Update `README.md` (AD-042): add the component to the Components table and add an Evolution log entry with today's date.
6. If the addition is architecturally significant (new data flow, new dependency, new interface boundary), write a new AD under `decision-logging`. Do not skip this for anything that changes how the system interacts with other systems.
7. If the addition introduces a new cron job, add it to the Cron Jobs table in `README.md` (AD-042) and register it with the system's cron entry.
8. **Validate with the linter (REQUIRED)**: Run `arch validate --pool {system-name}` to verify the pool still conforms to AD-023 after the change, then `arch emit --agents {system-name}` to refresh its canonical AGENTS.md (AD-050/051). Exit code 0 required.

### CONTRACT — Remove Components from a System

1. Identify the component to remove within the pool.
2. Before deleting, search for cross-system dependencies:
   ```
   rg -l 'component-name' ~/.hermes/systems/ ~/.hermes/skills/ ~/.hermes/systems/architecture/
   ```
   Do not delete if another system imports or references it. If it does, either resolve the dependency first or leave the component in place and mark it deprecated in `README.md` (AD-042).
3. Move the component to `archive/` within the pool instead of deleting outright. Keep a record.
4. Remove any symlinks pointing to the component:
   ```
   find ~/.hermes/skills/ -type l -lname '*{component-name}*' -delete
   ```
5. Update `README.md` (AD-042): remove from Components table, add Evolution log entry.
6. If the component had a cron job, delete the cron job entry and remove it from the Cron Jobs table.
7. If the removal changes architectural boundaries, write an AD or update the existing one.
8. **Validate with the linter (REQUIRED)**: Run `arch validate --pool {system-name}` to verify the pool still conforms to AD-023 after the removal, then `arch emit --agents {system-name}` to refresh its canonical AGENTS.md (AD-050/051). Exit code 0 required.

### RENAME — Rename a System Pool

1. Rename the pool directory:
   ```
   mv ~/.hermes/systems/{old-name} ~/.hermes/systems/{new-name}
   ```
2. Update `README.md` inside the pool: change pool path, update frontmatter.
3. Update the system registry in `~/.hermes/systems/architecture/README.md`: change the name and pool path in the table.
4. Update `~/.hermes/config.yaml` if any entry references the old pool path (MCP servers, data dirs).
5. Update all cron job prompts that reference the old path. Search broadly:
   ```
   rg '{old-name}' ~/.hermes/config.yaml ~/.hermes/systems/architecture/
   ```
6. Update any symlinks:
   ```
   find ~/.hermes/skills/ -type l -lname '*systems/{old-name}*' -print
   ```
   Recreate them pointing to `{new-name}`.
7. **Re-pool dangling pooled sub-systems (AD-060).** If any graduate pooled this system as a sub-system, its relative symlink now dangles:
   ```
   find ~/.hermes/systems/{graduate}/sub-systems -xtype l -print
   ```
   Delete the dangling symlink and re-run `arch sub pool {foundation} --pool {graduate} --source ../../{new-name} --recon $RECON` (name must equal the new counterpart name — AD-060 P5) or `arch sub pool --pool {graduate} --sync --recon $RECON` for each affected graduate.
8. Update the architecture README's system registry table.
8. Write an AD if the rename reflects a scope change. A pure rename (same scope, new name) does not require an AD but does require a registry update.
9. **Validate with the linter (REQUIRED)**: Run `arch validate --pool {new-name}` to verify the renamed pool still conforms to AD-023, then `arch emit --agents {new-name}` to refresh its canonical AGENTS.md with the new pool name (AD-050/051). Exit code 0 required.

### REMOVE — Decommission a System

1. Archive the entire pool:
   ```
   mv ~/.hermes/systems/{system-name} ~/.hermes/systems/_archive/{system-name}
   ```
2. Mark the system's AD as `Status: Superseded` in the AD file. Add a Superseded note with the date and reason.
3. Delete all cron jobs associated with this system. Search for the system name in cron config:
   ```
   rg '{system-name}' ~/.hermes/config.yaml
   ```
   Remove each matching cron entry.
4. Remove the system from the registry table in `~/.hermes/systems/architecture/README.md`.
5. Purge all symlinks pointing into the archived pool:
   ```
   find ~/.hermes/skills/ -type l -lname '*systems/{system-name}*' -delete
   ```
6. Check for references from other active systems. If another system depends on this one, do not remove until the dependency is resolved. Resolve by either updating the dependent system to use a different resource or keeping a thin compatibility shim.
7. Update the AD index in `~/.hermes/systems/architecture/README.md` to reflect the Superseded status.
8. **Validate with the linter (REQUIRED)**: Run `arch validate` (all pools) to verify the removal didn't break other pools, then `arch emit --agents-all` to refresh all canonical AGENTS.md files (AD-050/051). Exit code 0 required.

### SPLIT — Divide One Pool into Two or More Separate Pools

A split is NOT a rename or migrate — it creates two or more new pools from one parent, each inheriting shared resources but gaining independent compass alignment, independent graduation tracks, and independent lifecycle going forward.

**When to split:**
- A single pool serves two or more compass paths (e.g., revenue-engine housed both path-002/job and path-003/freelance). CP-AD-005 says each path gets its own pool.
- Two sub-systems have different operational models, different strategies, different metrics, and would pass Gate 5 independently but are blocked because the parent pool's compass_graduate block can only reference ONE path_ref.
- The parent pool's audit scores are dragged down by split focus (one half pulls the other's maturity score down).
- **NEW:** A pool mixes domain-specific campaign/content data with universal shared infrastructure (e.g., rel-intel mixing da-builder campaigns with pb-thought-leadership campaigns). See the **Domain Coupling Audit** below for how to detect this.

> **PRE-SPLIT DOMAIN COUPLING AUDIT (MANDATORY before SPLIT).** A split without audit is an amputation, not a refactor. Run this 7-step audit first. Save results to `references/{pool}-domain-coupling-audit.md`.

**Audit Steps:**

1. **Map all data objects** to their semantic category. Inventory every campaign, audience, content piece, and strategy bridge. Classify each by its primary domain (e.g., `da-*` = B2B outreach, `pb-*` = personal-brand social, `loo-*` = community growth). Use `domain` field if present, else infer from naming convention + strategy_ref cross-reference.

2. **Analyze data model coupling.** Read the core `store.py` / `schemas.py` paths. Are domain-specific objects stored side-by-side with shared objects? Are there hardcoded paths that assume all domains share the same storage layout? Document the coupling points (e.g., `CAMPAIGNS_DIR = POOL / "data" / "campaigns"` holds 5 unrelated campaign types with identical schemas but different operational models).

3. **Analyze CLI coupling.** Read the main pool CLI. Which command groups serve which domains? Are there shared commands that would need domain-specific parameters if the split happened naively? Document command-group-to-domain mapping (e.g., `campaign create/target/send` serves all 5 domains but B2B targeting uses `leverage_points` while social campaigns use `audience_segment`).

4. **Map cross-domain dependencies.** Which domain's data objects reference which other domains' data? (e.g., `pb-*` campaigns reference `ai-developer-community` audiences). Does domain A's content pipeline depend on domain B's contacts store with a different contract? Document the dependency graph.

5. **Identify true shared infrastructure** (stays in parent) vs. domain-specific assets (move to child). Shared infrastructure = contacts, inbox scanning, diagnostics, recon. Domain-specific = campaigns, audiences, content pipelines that differ in distribution channel, cadence, success metrics, or platform hooks.

6. **Determine the split topology** from the audit:
   - **Full split (both compass-graduate):** Parent pool archived, two+ new pools each owning a separate compass path. (Original SPLIT procedure applies.)
   - **Extract-to-foundational (partial split):** Extract domain-specific assets into a new foundational pool (offers services like `campaigns`/`audiences`), parent pool retains shared infrastructure (offers `contacts`). Parent pool becomes a consumer of the new foundational pool via RG-028 plugin pattern. Parent may or may not be compass-graduate.
   - **Extract-to-plugin (partial split):** Extract domain-specific assets + context into a new pool that consumes a foundational pool's services. Parent pool becomes the foundational pool. (This session's dad-arch-campaigns vs campaigns pattern.)

7. **Write the split AD** (see procedure below). The AD must document: why split (from audit), what each new pool gets, what stays in parent, dependency graph, graduation pipeline status of each new pool (foundational vs compass-graduate vs plugin).

**Procedure:**

1. **Write the split AD** (e.g., AD-054) in the architecture pool, **after** completing the Domain Coupling Audit. Document: why split (cite audit findings), what each new pool gets, what happens to the old pool. Reference the parent's genesis AD as superseded. **For extract-to-foundational splits:** explicitly declare the parent pool's new service set and its new dependency on the child pool (RG-028 plugin pattern). **For extract-to-plugin splits:** declare the child pool's `domain_context/` ownership and the bridge interface contract to the parent.

2. **Create new pool directories** at `~/.hermes/systems/{new-pool-name}/`. Do NOT create them inside `archive/` — they must be at the top level alongside other active pools. (If a subagent creates them in archive/ by mistake, move them up with `mv ~/.hermes/systems/archive/{pool} ~/.hermes/systems/{pool}`.)

3. **Write `_org.yaml` for each new pool:**
   - Set `tier: compass-graduate` if the new pool serves a compass path, OR `tier: foundational` if it is infrastructure consumed by other pools (no own strategy, no path_ref).
   - For compass-graduate pools: set `compass_graduate.path_ref` to the single path this pool now serves, `compass_graduate.strategy_refs` to only the strategies for THIS path, `compass_graduate.graduation_ad` to the split AD number.
   - For foundational pools: omit `compass_graduate` block entirely, declare `services_offered` and `services_consumed` per AD-056/RG-028.
   - Use new AD/RG prefixes for each pool (e.g., JE-AD- for job-engine, FE-AD- for freelance-engine, CM-AD- for campaigns).

4. **Create `core/` subdirectories** in each new pool: `core/decisions/` and `core/regressions/`. Copy existing RGs to relevant pools with renamed prefixes (a regression guard about the parent's failure mode may apply to one child, both, or neither — decide based on the audit).

5. **Distribute cron jobs and sub-system data based on audit findings:**
   - For each cron .md file and each data directory to migrate: update `system:` frontmatter to the new pool name (AD-030 isolation enforcement), then move.
   - **For full splits:** move ALL parent's cron jobs, as each child needs its own scheduling layer.
   - **For extract-to-foundational splits:** only migrate domain-specific cron jobs and data. Cron jobs that operate on shared infrastructure (inbox scanning, contact diagnostics) STAY in the parent pool.
   - **For extract-to-plugin splits:** domain-specific cron jobs move to the child; the bridge cron jobs stay in parent and dispatch to child via CLI.

6. **Archive the old pool (full split) OR keep parent slimmed down (partial split):**
   - **Full split:** `mv ~/.hermes/systems/{old-pool} ~/.hermes/systems/archive/{old-pool}-pre-split`. Fix broken symlinks: `find ~/.hermes/systems/archive/{old-pool} -type l ! -exec test -e {} \; -delete`.
   - **Extract-to-foundational/plugin split:** Do NOT archive the parent. Update parent's `_org.yaml` to remove migrated `services_offered`, add new `services_consumed` entry pointing to the child pool. Update parent's AD to reflect reduced scope. Create deprecation shims if cross-references are too broad to update in one pass.

7. **Create compass integration files** for compass-graduate pools:
   - `core/compass-bridge.yaml` — declare services consumed (forge, grounding, alignment, strategy-read)
   - `data/compass-alignment.json` — snapshot with `operational_status: "split-in-progress"`, `strategies_active: 0`
   - `data/compass-services/` — symlinks to compass sub-systems

8. **Update path-entries.md:** Change `system_pool_ref` for each affected path to point to the new pool. Add an operational_note about the split.

9. **Create stub AGENTS.md** for each new pool BEFORE running `--emit-agents`. The emit-agents command skips pools with validation errors (including "missing AGENTS.md"), creating a chicken-and-egg loop. Write a minimal AGENTS.md first, then run `--emit-agents all` to regenerate the full version.

10. **Update service-registry.md** (architecture/references/service-registry.md): Add the new pool's `offers`/`consumes` entries. Update parent pool's service set. For RG-028-compliant plugin pattern: declare only the interface contract, not internal data paths.

11. **Validate and emit:**
    ```bash
    arch validate           # must be 0 errors
    arch emit --agents-all  # refresh all canonical AGENTS.md files (AD-050)
    ```

12. **Update all cross-system consumers** that reference the old parent pool for the migrated services. Search broadly, update AGENTS.md + _org.yaml + cron prompts. This is required even for historical references in decision docs if they break imports or execution paths.

> **Pitfall — Partial split vs full split:** The revenue-engine split (AD-054) was a full split where the parent was archived. But a split where the parent retains shared infrastructure (e.g., rel-intel keeps contacts, extracts campaigns into a new foundational pool) requires the parent to be updated as a consumer of the new pool — this is a two-way dependency (parent consumes child), the reverse of the normal one-way plugin pattern. Validate both directions: `arch validate --pool {parent}` AND `arch validate --pool {child}`.

**New in v1.3:** Added Domain Coupling Audit (7-step pre-split methodology) and Extract-to-Foundational/Extract-to-Plugin split topologies. The original SPLIT procedure only covered full splits where both children are compass-graduate pools and the parent is archived.

**Pitfalls (from revenue-engine split, AD-054):**

- **Subagent pool placement:** Subagents dispatched to create new pools may create them inside `archive/` instead of at the systems root. Always verify with `ls -d ~/.hermes/systems/{pool}/` after any delegated pool creation.
- **Subagent timeouts on large splits:** Pool splits involve many file operations (copy 15 scripts, create 10+ structural files, update path-entries, archive old pool, validate). Subagents timed out at 900s twice. Prefer doing the structural work directly in the parent agent, or give subagents very tight scope (just write _org.yaml, just copy scripts, just create compass files — one task each).
- **Legacy `--emit-readme`:** No longer writes pool README.md files (AD-050 guard in `lib/engine.py`) and cannot recreate the backward-compatible symlink. If a stale `~/.hermes/systems/{old-pool}` symlink from a past split still exists, remove it: `unlink ~/.hermes/systems/{old-pool}`.
- **Cross-system references to the old pool name:** Dozens of files across other pools reference the old pool path (compass grounding_collector.py, strategy .md files, service-registry.md, etc.). These are historical references in decision docs — they do NOT need updating for the split to be structurally valid. They remain valid as historical context since the old pool is archived (still readable).

### INTEGRATE — Make System A a Plugin of System B (Cross-System Plugin Pattern)

When system A needs capabilities that system B already owns (campaign management, content pipeline, contact profiles), do NOT duplicate the capability in A. Use the plugin pattern: A holds domain context + a bridge module; B owns the canonical data + pipeline. Per **RG-028** (Inter-System Non-Duplication Principle).

> **For compass-graduate consumers, prefer AD-060 sub-system pooling over the CLI-bridge plugin pattern.** A graduate is the strategic base for its function; its `sub-systems/` tree should show the complete operational genome at a glance (native organs it owns + pooled foundation categories it extends). If A is a compass-graduate and B is a foundational system in a category A extends (content-campaigns, research-intelligence, website-development, strategy — resolve concrete names via the Foundation Category Registry, never hardcode them), create a pooled sub-system instead of a bridge module:
>
> ```bash
> arch sub pool {foundation} --pool {graduate} --source ../../{foundation} --recon $RECON   # name MUST equal counterpart (P5)
> arch sub pool --pool {graduate} --sync --recon $RECON                                   # auto-import whole genome
> ```
>
> The pooled symlink replaces the `services_consumed` entry + bridge module for that relationship (one mechanism, P3). Writes still go through B's CLI (read-only symlink); B stays canonical. The CLI-bridge plugin pattern remains the right tool when A is NOT a graduate (e.g. a non-graduate consuming a content-campaigns foundation) or the capability is called rarely (not part of A's genome).

**Steps:**

1. **Map capability ownership.** Before any integration work, draw the ownership table:

   | Capability | Owner (backbone) | Consumer (plugin) | Interface |
   |---|---|---|---|
   | Campaign CRUD | B | A | `B campaign create/get/draft/send` CLI |
   | Content pipeline | B | A | `B content create/advance` CLI |
   | Contact profiles | B | A | `B contacts add/get` CLI |
   | Domain context (scripts, positioning) | A | B (reads via draft message text) | File read from `data/da_context/` |

   The principle: **B owns functionality + state; A owns domain context only.** The boundary is a CLI call, never a file write into B's data directory.

2. **If B uses an enum/controlled vocabulary, propose an extension BEFORE writing the bridge.** This session extended rel-intel's `--domain` enum to include `dad-arch` by patching `schemas.py` (`enum: [...]` list) AND the CLI argparse `choices=[...]`. Both locations must be updated — the schema alone is not enough because argparse enforces `choices` separately. Verify with a test CLI invocation (`B campaign create --domain <new> --dry-run` or a throwaway campaign, then delete it).

3. **Write a bridge module in A's sub-system.** The bridge is the only code in A that talks to B. Pattern:

   ```python
   # A/sub-systems/lead-orchestration/core/bridge.py
   import subprocess
   def backbone_cli(*args) -> dict:
       """Invoke backbone CLI — NEVER write to backbone's data dir directly."""
       result = subprocess.run(["backbone-cli"] + list(args), capture_output=True, text=True, timeout=30)
       if result.returncode != 0:
           return {"success": False, "error": result.stderr.strip()}
       return {"success": True, "output": result.stdout.strip()}
   ```

4. **Validate cross-pool references immediately after creation (extends RG-007).** After `backbone_cli("campaign", "create", ...)`, validate the campaign exists before creating a symlink or a walkin-queue entry. A silent failure here leaves dangling references the next status check can't recover cleanly.

5. **Symlinks from A → B for read-only reference.** The canonical data lives in B; A holds symlinks so A's tooling can reference the path:

   ```python
   from pathlib import Path
   # A's data/campaigns/{category}/{slug} → B's data/campaigns/{slug}
   symlink_path = a_campaigns_dir / category / slug
   if symlink_path.exists():
       symlink_path.unlink()
   symlink_path.symlink_to(b_campaign_path.resolve())
   ```

   Git tracks the symlink, not the target. When B is restored from backup, symlinks resolve automatically. Use `Path.exists()` + `os.readlink()` to detect and prune dangling symlinks during the daily sync.

6. **A owns domain context in `data/da_context/{slug}/`.** This is the "what to say" layer — pitch scripts, builder positioning, NCR market hooks. B never reads these files directly; the bridge injects the message text into a `backbone_cli("campaign", "draft", "--message", pitch_text)` call.

7. **Walk-in queue lives in A.** The handoff list (`data/walkin_queue.yaml`) tracks leads awaiting the user's manual send decision. The bridge appends to it after a successful `backbone_cli("campaign", "create") + campaign draft`. The user reviews, then triggers `B campaign send` — the agent does NOT auto-send cold outreach.

8. **Write an AD in A documenting the plugin dependency.** The AD names:
   - The backbone system (B) and which of its capabilities A consumes
   - The interface contract (which CLI subcommands A calls, what flags A passes)
   - That domain context lives in A, not B (per RG-028)
   - That symlinks point A → B, never B → A (direction matters for backup/restore semantics)

9. **Update both README.md manifests (AD-042).** A's manifest lists the sub-system + the inter-system dependency. B's manifest does NOT need to mention A (B is the backbone; it doesn't know who plugs into it). Canonical routers stay oblivious — the dependency is one-way.

10. **Clean up dead artifacts from the pre-refactor design.** A refactor that leaves dead files (e.g., `audio_digest.py` after an audio → email migration, or a test artifact in the production KB) next to live ones creates confusion for monthly-review and future agents. Archive dead code to `archive/`, delete orphan cron .md files, and ensure the cron scheduler is updated via `cronjob action=remove` (old) + `cronjob action=create` (new).

11. **Validate with the linter (REQUIRED)**: Run `arch validate --pool {system-A}` AND `arch validate --pool {system-B}` after the integration. The bridge touches B's enum (schemas.py) so B must also re-lint. Exit code 0 required for both.

**Pitfalls (this session):**

- **The `patch` tool corrupts YAML files with backticks.** YAML treats `` ` `` as a reserved character. When patching `_org.yaml` rules sections that mention a literal string like `` `dad-arch` ``, the linter will reject it. Either quote the value (`"dad-arch"`) or avoid backticks in rules text entirely.
- **The `patch` tool can introduce literal `\n` in place of actual newlines** when the `new_string` contains `\n` as text. If Pyright reports "unexpected character after line continuation character" after a patch, check whether a literal `\n` snuck in and re-patch with a real newline.
- **The `clarify` tool with structured `choices` may fail in Telegram context** ("list object has no attribute 'strip'"). Fall back to inline question in your response text — do not waste a turn retrying the tool.
- **Cron job .md files are not auto-synced to the scheduler.** Renaming a cron job (e.g., `smb-intel` → `smb-digest`) requires: (a) deleting the old job via `cronjob action=remove`, (b) creating the new one via `cronjob action=create`. Editing the .md file alone leaves the old prompt active in the scheduler.

### Post-Modification: Linter as the Compliance Gate

After **every** lifecycle operation (EXPAND, CONTRACT, RENAME, REMOVE, MIGRATE, INTEGRATE), the linter is the final gate:

```bash
# Lint a single pool after modifying it:
arch validate --pool {system-name}

# Lint all pools + refresh canonical AGENTS.md after a major change:
arch validate
arch emit --agents-all
```

This is **required** because:
- Structural changes may introduce violations (files in wrong dirs, missing _org.yaml entries, broken cross-refs)
- `AGENTS.md` must be regenerated via `arch emit --agents {pool}` to reflect the new state (stale indexes mislead agents searching for files)
- The linter catches regressions that manual review would miss (e.g., a moved script that left a stale symlink)

Exit code 0 is mandatory. If the linter reports errors, fix them before considering the task complete.

### MIGRATE — Move Fragmented Components into a Pool

Migration is the most common operation right now. Existing systems are scattered: Design-Aesthetic across 6 directories, Forge across 5, revenue loops across 4, and 69 files mixed in `~/.hermes/scripts/`.

1. **Identify all components** belonging to the system. Search every scatter directory:
   ```
   # By naming convention
   rg -l '{system-name}' ~/.hermes/scripts/ ~/.hermes/data/ ~/.hermes/research/

   # By AD reference
   rg -l 'AD-NNNN' ~/.hermes/scripts/ ~/.hermes/skills/ ~/.hermes/data/
   ```
2. **Sort components by type**: scripts go to `scripts/`, defining logic to `core/`, skills to `skills/`, data/JSONL/state to `data/`, research docs to `references/`, KB files to `kb/`. ADs go to `core/decisions/`, RGs go to `core/regressions/`.
3. **Create or confirm the pool** at `~/.hermes/systems/{system-name}/` with the canonical structure (see `../references/pool-layout.md`, AD-023 for `core/` + `sub-systems/` layout).
4. **Move each component**:
   ```
   mv ~/.hermes/scripts/{component}.py ~/.hermes/systems/{system-name}/scripts/
   mv ~/.hermes/data/{system-name}/* ~/.hermes/systems/{system-name}/data/
   mv ~/.hermes/research/{system-name}-* ~/.hermes/systems/{system-name}/references/
   ```
5. **Create symlinks** for skills that need to stay discoverable:
   ```
   ln -s ~/.hermes/systems/{system-name}/skills/{skill-name} \
         ~/.hermes/skills/{category}/{skill-name}
   ```
6. **Update all import paths** inside moved scripts:
   ```
   rg -l 'scripts/' ~/.hermes/systems/{system-name}/scripts/
   rg -l 'data/' ~/.hermes/systems/{system-name}/scripts/
   ```
   Replace absolute paths with pool-relative paths. Use `~/.hermes/systems/{system-name}/` as the base.
7. **Update cron job prompts** that reference old scattered paths. Every cron prompt must now include the new pool path so the agent knows where to find scripts and data.
8. **Write or update the README.md** manifest (AD-042) using `../references/system-template.md`. List all migrated components in the Components table.
9. **Create or update the AD** if the migration consolidates a previously fragmented architecture. This is architecturally significant — record it.
10. **Verify** by running a script from the pool and checking that imports resolve and symlinks work.
11. **Validate with the linter (REQUIRED)**: Run `arch validate --pool {system-name}` to verify the pool conforms to AD-023, then `arch emit --agents {system-name}` to refresh its canonical AGENTS.md (AD-050/051). Exit code 0 required. If errors, fix before declaring migration complete.

## Migration Checklist for Fragmented Systems

When migrating existing systems that are scattered across non-pool directories:

- [ ] Identified every component across `~/.hermes/scripts/`, `~/.hermes/data/`, `~/.hermes/research/`, `~/.hermes/skills/`
- [ ] Sorted components by type (scripts, skills, data, references, kb)
- [ ] Pool directory created with canonical structure
- [ ] Components moved into correct subdirs
- [ ] Import paths updated inside all scripts
- [ ] Symlinks created for skills that stay discoverable in `~/.hermes/skills/{category}/`
- [ ] Cron job prompts updated with new pool paths
- [ ] README.md manifest written (AD-042) with full component table
- [ ] System registry updated in `~/.hermes/systems/architecture/README.md`
- [ ] AD written or updated if consolidation is architecturally significant
- [ ] Cross-system dependencies checked — nothing in `~/.hermes/scripts/` that belongs to another system was moved
- [ ] Verified by running at least one script from the new pool
- [ ] `system-integrity {system-name}` passes with exit code 0
- [ ] `AGENTS.md` regenerated via `arch emit --agents {pool}`

## References

- Pool layout spec: `../references/pool-layout.md`
- Domain Coupling Audit Checklist: [`references/domain-coupling-audit-checklist.md`](references/domain-coupling-audit-checklist.md) — run before SPLIT to detect monoliths
- SYSTEM.md template: `../references/system-template.md`
- AD writing: `../decision-logging/SKILL.md`
- System lifecycle (move/migrate/remove): this file
- Integrity validation: `../integrity-validation/SKILL.md`

2. **Do not forget to update cron job prompts with new paths.** Cron prompts embed paths as guidance for the agent. A migrated script at a new pool path with an old cron prompt pointing at `~/.hermes/scripts/` will fail silently or work on stale code.

3. **Do not break symlinks.** When moving skill directories or renaming pools, symlinks in `~/.hermes/skills/` become dangling. Always check with:
   ```
   find ~/.hermes/skills/ -type l -xtype l -print
   ```
   Recreate or delete broken symlinks after every move or rename.

4. **Do not assume ownership by filename.** In `~/.hermes/scripts/`, a file named `forge-orchestrator.py` might belong to the Forge system, but `revenue-scan.py` might belong to revenue-engine. Trace AD references and import chains to confirm ownership before moving.

5. **Do not migrate partially and stop.** A half-migrated system — some scripts in the pool, some still in `~/.hermes/scripts/` — is worse than fully fragmented. It creates two sources of truth. Complete the migration in one pass or do not start it.

6. **Do not forget config.yaml.** MCP server entries, data paths, and provider configs in `~/.hermes/config.yaml` reference absolute paths. A rename or migration that does not update `config.yaml` breaks runtime references.
