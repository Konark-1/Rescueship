---
name: cron-job-lifecycle
version: 4.1.0
description: "Manage cron job lifecycle (create, update, decommission) for a system pool. Part of architecture-discipline (umbrella). Use when adding, modifying, or removing cron jobs, designing multi-phase loop pipelines, or managing workflow DAGs. Triggers: 'add cron', 'create cron', 'modify cron', 'remove cron', 'decommission cron', 'cron pipeline', 'cron workflow', 'cron loop', 'phase pipeline', 'flywheel', 'DAG', 'sync cron'."
parent: architecture-discipline
related_adrs: [AD-002, AD-026, AD-027, AD-029, AD-030, AD-034, AD-035]
---

# Cron Job Lifecycle

Comprehensive guide for creating, updating, decommissioning, and validating cron jobs within a system pool. This is a child leaf of `architecture-discipline` (AD-028) — the umbrella skill for all infrastructure-related leaves.

Every workflow in this leaf ends with `arch validate --pool {pool-name}` returning exit 0 (AD-029, AD-059).

## Dependency
**Requires:** `prompt-master` skill for template-based prompt generation.

---

## Telegram Thread Routing (Critical)

### How Thread Delivery Works

When a cron job has `deliver = "telegram:CHAT_ID:THREAD_ID"`:
- **Numeric thread_id** (e.g., `telegram:5297486612:72730`): The scheduler resolves it via `_parse_target_ref()` and delivers to that thread directly.
- **Named thread_id** (e.g., `telegram:5297486612:Forge`): Requires the `createForumTopic` Bot API 9.4+ endpoint. The gateway's `ensure_dm_topic()` handles this if the `deliver` field uses a named topic.
- **No thread_id** (e.g., `telegram:5297486612`): Delivers to the default DM chat. If `origin.thread_id` is set, the scheduler uses that for topic routing.

### Creating a New Telegram DM Topic (MANDATORY PROCEDURE)

**ALWAYS follow the procedure in `references/telegram-topic-creation.md`.** Do NOT improvise. Do NOT use `origin.thread_id` alone. Do NOT guess thread IDs.

**Quick version:**

1. Run `python3 ~/.hermes/scripts/create_telegram_topic.py "Topic Name"` — creates the topic via Bot API `createForumTopic` and verifies delivery. Outputs `thread_id=XXXXX`.
2. Set `deliver="telegram:5297486612:XXXXX"` in the cron job (the `XXXXX` is the numeric thread_id from step 1).
3. Run the job with `cronjob(action="run", job_id="...")` and verify `last_status=ok`.
4. Ask the user to confirm receipt.
5. Add the new thread to the Known Thread Assignments table below AND in AD-005.

**Prerequisite**: Topics must be enabled in the Telegram chat (BotFather, Bot Settings, Threads Settings, Enable Topics). Chat `5297486612` already has this enabled.

**For full details, pitfalls, and platform-specific rules**: Load `references/telegram-topic-creation.md` with `skill_view(name='cron-job-management', file_path='references/telegram-topic-creation.md')`.

### Known Thread Assignments

| Thread | Purpose | deliver value |
|--------|---------|---------------|
| 69475 | Job loop | `telegram:5297486612:69475` |
| 69476 | Freelance loop | `telegram:5297486612:69476` |
| 69477 | Review | `telegram:5297486612:69477` |
| 69700 | General DM | `telegram:5297486612:69700` |
| 68142-68147 | Revenue-intel outputs | `telegram:5297486612:68142` |
| 66046 | Holonic News Intelligence | `telegram:5297486612:66046` |
| 65858 | Career Market Mapping | `telegram:5297486612:65858` |
| 65866 | Platform Intelligence Research | `telegram:5297486612:65866` |
| 66259 | VPS Health Watchdog | `telegram:5297486612:66259` |
| 64203 | Q'uo Community Pulse | `telegram:5297486612:64203` |
| 72730 | Forge Task System | `telegram:5297486612:72730` |
| 78956 | Design-Aesthetic Intel | `telegram:5297486612:78956` |

---

## Job Type → Template Mapping

| Job Type | Template | Why |
|----------|----------|-----|
| **Autonomous agent** (job search, community bot, trading) | **Template H** (ReAct + Stop Conditions) | Stop conditions, checkpoints, scope locks prevent runaway loops |
| **Complex research** (paper discovery, market analysis, news intelligence) | **Template M** (Opus 4.7/4.8 Task Brief) | Front-loads context, target state, acceptance criteria for literal Opus 4.8 |
| **Simple scheduled task** (backup, cleanup, health check) | **Template A** (RTF) | One-shot, clear role/task/format |
| **Creative/content generation** (social posts, newsletters) | **Template D** (CRISPE) | Personality, tone, variants controlled |
| **Code/IDE agent task** (refactor, scaffold, fix) | **Template G** (File-Scope) | Exact file paths, scope locks, no config drift |

---

## Quick Start: Create a New Cron Job

```
# 1. Load both skills
skill_view(name='prompt-master')
skill_view(name='cron-job-lifecycle')

# 2. Use the workflow below to generate a prompt, then create the job
cronjob action=create name="My Job" schedule="0 9 * * *" prompt="<GENERATED_PROMPT>" skills=["my-skill"] deliver="telegram:5297486612:THREAD_ID"
```

### CLI Alternative

If you have shell access instead of MCP tool access:

```bash
# List existing cron jobs (shows System field for each job)
hermes cron list

# Create a new cron job with system ownership
hermes cron create "0 9 * * 1" "prompt text" --name "Job Name" --system revenue-engine

# Check what system owns a specific cron_id (reverse-lookup via AGENTS.md auto-zone)
grep -r "cron_id: <ID>" ~/.hermes/systems/*/cron-jobs/ ~/.hermes/systems/*/sub-systems/*/cron-jobs/

# Or use the AGENTS.md cron_jobs section (auto-generated by arch emit --agents per AD-050)
# This lists all cron jobs with their pool, cron_id, schedule, and status
yq '.cron_jobs[] | {cron_id, schedule, status}' <(awk '/^---/{c++; next} c==1' ~/.hermes/systems/{pool}/AGENTS.md)
```

---

## Declarative Cron Sync (--sync-cron) — AD-034

**The .md file is the source of truth.** Write or patch the `.md` file, then sync to `jobs.json`:

```bash
# 1. Write the .md file with YAML frontmatter
#    (see references/cron-prompt-template.md for the format)

# 2. Sync all pools
arch cron sync

# Or sync one pool only
arch cron sync revenue-engine
```

**What `--sync-cron` does:**
- Reads all `cron-jobs/*.md` files across system pools
- Parses YAML frontmatter (cron_id, name, schedule, status, deliver, skills)
- For new jobs (no existing `jobs.json` entry): generates cron_id if missing, creates entry
- For existing jobs: updates schedule, skills, deliver, status; preserves runtime state (last_run_at, repeat.completed, next_run_at)
- For jobs without .md files (orphans): preserves them as-is (does NOT delete)
- Writes updated `jobs.json`

**This replaces the dual-entry process** (write .md + call `cronjob(action='create')`). Now: write .md → run `--sync-cron` → job is live.

### Golden Trajectory: CREATE via --sync-cron

1. Create `{pool}/cron-jobs/{job-name}.md` with YAML frontmatter (no `cron_id` field — it will be auto-generated)
2. Run `arch cron sync {pool}` — the script generates a `cron_id` and writes it back into the .md file
3. Read the `.md` file to retrieve the generated `cron_id` (needed for future UPDATE/DECOMMISSION):
   ```bash
   head -5 {pool}/cron-jobs/{job-name}.md
   ```
4. Run `arch validate --pool {pool}` to validate (exit 0)

### Golden Trajectory: UPDATE via cron sync

1. Edit the `.md` file (schedule, prompt, skills, etc.)
2. Run `arch cron sync {pool}` — the script updates `jobs.json` to match
3. Run `arch validate --pool {pool}` to validate (exit 0)

### Golden Trajectory: DECOMMISSION

1. Set `status: superseded` in the `.md` frontmatter
2. Run `arch cron sync {pool}` — the script reads the new status and sets `enabled: false` in `jobs.json`
3. Run `arch validate --pool {pool}` to validate (exit 0)

---

## Systemic Cron Management

Guidance for agents managing cron jobs at the system level (not just per-job).

### Pre-Flight Checklist (Skills to Load First)

Before ANY cron-job operation, load these skills:
1. `skill_view(name='cron-job-lifecycle')` — this skill (the canonical workflow)
2. `skill_view(name='prompt-master')` — for template-based prompt generation (CREATE only)

### Which Command to Use When

| Scenario | Command |
|----------|---------|
| Create a new job | Write `.md` → `--sync-cron {pool}` → read cron_id → `--cron-only {pool}` |
| Update an existing job | Edit `.md` → `--sync-cron {pool}` → `--cron-only {pool}` |
| Decommission a job | `status: superseded` in `.md` → `--sync-cron {pool}` → `--cron-only {pool}` |
| Validate only (no changes) | `--cron-only {pool}` (or `--cron-only` for all pools) |
| Full pool validation | `arch validate --pool {pool}` (includes structural linting + cron) |

### Employee Identity Step (AXE-AD-011 — mandatory after ANY cron CRUD)

Every cron job is an **employee** of its owning pool (department). The lifecycle is not complete until the org roster reflects it:

```bash
axe org sync --write-frontmatter   # creates employee record + stamps employee: frontmatter
axe org check                      # must be clean; smoke gate blocks the tick on drift (AXE-RG-012)
```

- CREATE: `--write-frontmatter` stamps the new job's `.md` with its `employee:` field and registers the employee.
- UPDATE/DECOMMISSION: sync reconciles status (`paused`/`retired`) automatically.
- Teams: membership changes go through `axe org team create` only (AXE-RG-013 validation at write time).
- Full context: `references/conventions.md` §The Organizational Model.
| Sync all pools | `--sync-cron` (no pool filter) |
| Sync one pool only | `--sync-cron {pool}` (pool-scoped, only reports that pool's orphans) |

### Workflow DAG Management

When creating jobs that are part of a multi-phase pipeline (e.g., revenue-loop-p1 → p2 → p3):

1. Create each job `.md` file individually (per the CREATE workflow above)
2. Create or update `{pool}/cron-jobs/_workflows/{workflow-name}.yaml` with the DAG using the **canonical schema** (see `references/cron-workflow-graph-schema.md`):
   ```yaml
   name: revenue-loop
   system: revenue-engine
   sub_system: job
   type: compound-loop
   description: >
     8-phase revenue generation flywheel.

   phases:
     - id: p1-acquire
       cron_id: 4f6e7073860f
       schedule: "0 */4 * * *"
       depends_on: []
       reads: [KB/items where status=new]
       writes: [KB/items upserted with phase=1]
       next: p2-score

     - id: p2-score
       cron_id: 1bcf46075baf
       schedule: "15 */4 * * *"
       depends_on: [p1-acquire]
       reads: [KB/items where phase=1]
       writes: [KB/items.score, KB/items.phase=2]
       next: p3-enrich
   ```
3. Run `--sync-cron {pool}` to register all new jobs
4. Run `--cron-only {pool}` to validate

### Batch Operations

To update schedules across an entire workflow:
1. Edit each `.md` file's `schedule:` field
2. Run `--sync-cron {pool}` once — all changes are synced in one pass
3. Update the `_workflows/*.yaml` DAG schedules to match
4. Run `--cron-only {pool}` to validate

### Cross-Pool Coordination

When jobs in different pools feed each other (e.g., research-engine → strategic-engine):
- Each pool's `.md` files are independent — they sync separately
- The `system:` field in each `.md` MUST match its pool directory name (AD-030 isolation)
- Cross-pool dependencies are documented in the workflow DAG, not enforced at the pool level
- To sync all pools: `arch cron sync` (no filter)

### Heading Depth Contract (AD-035)

**The `## Prompt` section is the runtime prompt.** Everything else is reference material.

1. All content intended for the agent's runtime prompt MUST live under `## Prompt` as `### ` subsections.
2. Sibling `## ` headings after `## Prompt` are NOT included in the runtime prompt (the extractor stops at the next `## ` heading).
3. The `.md` file is the source of truth. The `jobs.json` prompt is derived via `_extract_prompt_section()`.

**Correct pattern:**
```markdown
## Prompt

### Objective
Rich instructions here...

### Sources
Reference material here...

### Output
Expected format here...
```

**Incorrect pattern (prompt truncation):**
```markdown
## Prompt

One-line stub.

## Objective
Rich instructions here... (NOT included in runtime prompt!)
```

**AD-035**: The linter now flags `.md` files where `## Prompt` has fewer than 100 characters AND there are sibling `## ` headings after it.

---

### Common Pitfalls

1. **Wrong `system:` field** — if you copy a `.md` from one pool to another, update the `system:` field. The validator catches this (AD-030 isolation check).
2. **Typo in `cron_id`** — if you manually enter a cron_id with a typo, `--sync-cron` will create a DUPLICATE. The GAP-3 fix catches this by matching on name+system, but always let `--sync-cron` auto-generate the ID.
3. **Missing `## Prompt` section** — if the `.md` body has no `## Prompt` heading, the prompt extraction fails and the job gets an empty prompt. Always include `## Prompt` in the body.
4. **Invalid skill reference** — skills listed in `skills:` frontmatter are validated against the skill registry (RG-017). Typos cause errors.
5. **Forgetting to sync** — writing a `.md` file does NOT update `jobs.json`. You MUST run `--sync-cron` after writing/editing.
6. **Prompt truncation** — if `## Prompt` contains only a stub and rich content lives under sibling `## ` headings, the runtime prompt will be a stub. Always put ALL prompt content under `## Prompt` as `### ` subsections (AD-035).

---

## Workflow: Generate Optimized Prompt

### Step 1: Classify the Job
1. **Does it run an autonomous agent that takes actions?** → Template H
2. **Is it multi-step research/analysis with binary success criteria?** → Template M
3. **Is it a simple one-shot command?** → Template A
4. **Does it generate content with voice/tone requirements?** → Template D
5. **Does it edit code in a repo?** → Template G

### Step 2: Fill the Template Variables
### Step 3: Run Pattern Audit (check against prompt-master's patterns.md)

---

## Template Variable Checklists

### Template H (ReAct + Stop Conditions) — Agentic Jobs
- `OBJECTIVE`, `STARTING_STATE`, `TARGET_STATE`, `ALLOWED_ACTIONS`, `FORBIDDEN_ACTIONS`, `STOP_CONDITIONS`, `CHECKPOINTS`

### Template M (Opus 4.7/4.8 Task Brief) — Research Jobs
- `OBJECTIVE`, `CONTEXT`, `TARGET_STATE`, `SCOPE_WORK_IN`, `SCOPE_DO_NOT_TOUCH`, `CONSTRAINTS`, `ACCEPTANCE_CRITERIA`, `STOP_CONDITIONS`, `PROGRESS_FORMAT`

### Template A (RTF) — Simple Jobs
- `ROLE`, `TASK`, `FORMAT`

---

## Pattern Audit (Run Before Deploy)

| # | Pattern | Fix |
|---|---------|-----|
| 3 | No success criteria | Add binary Acceptance Criteria |
| 22 | No stop condition for agents | Add Stop Conditions block |
| 31 | No starting state | Define STARTING_STATE explicitly |
| 32 | No target state | Define TARGET_STATE with metrics |
| 33 | Silent agent | Add CHECKPOINTS with ✅ format |
| 34 | Unlocked filesystem | Add SCOPE_DO_NOT_TOUCH |
| 35 | No human review trigger | Add Stop Conditions for destructive acts |
| 36 | Vague first turn on Opus 4.8 | Use Template M, front-load everything |

---

## Loop Architecture (Phase-Based Cron Design)

**Canonical pattern: AD-002 (Cron Loop Architecture).** Read it before designing any multi-phase pipeline.

Use when multiple jobs form a pipeline (acquire → score → outreach → track → convert). Each phase writes to a shared KB, the next phase reads from it. The canonical loop has 8 phases:

```
P1 DISCOVER/ACQUIRE  → Fresh signals enter KB (phase=1)
P2 SCORE              → AI fit rubric applied (phase=2)
P3 ENRICH/DRAFT       → Outreach drafts generated (phase=3)
P4 OUTREACH           → Contact via ATS/DM/email (phase=4)
P5 TRACK              → Reply detection (phase=5)
P6 CONVERT            → Surface negotiating items to human (phase=6)
P7 COMPOUND           → KB hygiene + strategy recalculation, feeds back to P1 (phase=7)
P8 RETRO              → Weekly strategy review (phase=8)
```

### Loop DAG File (AD-030)

Every loop MUST have a `_workflows/{loop-name}.yaml` DAG file in the owning pool's `cron-jobs/_workflows/` directory. This file documents phase dependencies, KB reads/writes, and handoff semantics. See `references/cron-workflow-graph-schema.md` for the schema.

### KB Schema Requirements
Each item must carry: `phase`, `batch_id`, `acquired_at`, `enriched_at`, `reply_at`, `priority`, `platform`, `channel`, `application_status`.

### Compound Learning (P7 → P1 Feedback)
The `acquisition_strategy.json` file is the loop's memory. Each phase 7 cycle recalculates weights from closed-won data. Weight formula: `max(0.5, 1.0 + wins*0.2 + replies*0.1)`

### Creating a New Loop (Meta-Workflow)

1. **Design the loop**: Define N phases, their schedules (staggered), KB state-passing, and compound feedback path.
2. **Create each phase job**: Run the CREATE workflow (above) N times, one per phase. Set `loop:` and `phase:` frontmatter fields.
3. **Write the DAG file**: Create `_workflows/{loop-name}.yaml` with phase dependencies.
4. **Validate**: Run `arch validate --pool {pool}` to verify the entire DAG.

---

## Cron Job Lifecycle Workflow

The full lifecycle of a cron job within a system pool. Every step ends with `arch validate --pool {pool-name}` returning exit 0 (AD-029, AD-059).

### CREATE a Cron Job

1. **Design the prompt** using `prompt-master` skill. Choose the template (Template M, H, A, D, or G per the section above).
2. **Verify the pool has a `cron-jobs/` directory**. If not, run `arch pool init {pool-name}` to scaffold, or create it manually.
3. **Register the job via the cronjob MCP tool** — this generates the `cron_id`:
   ```
   cronjob(action='create', name='Job Name', schedule='0 9 * * 1',
           prompt='<full prompt text>', skills=['relevant-skill'],
           deliver='telegram:CHAT_ID:THREAD_ID',
           system='<pool-name>')
   ```
   The `system` parameter tags the job with its owning pool in `jobs.json` (UX-01).
   The tool returns the `cron_id` (12-char hex). This is the runtime registry entry in `~/.hermes/cron/jobs.json`.
4. **Write the .md file** at `{pool}/cron-jobs/{job-name}.md` from `references/cron-prompt-template.md`. Fill the frontmatter:
   - `cron_id`: from step 3
   - `name`: from step 3
   - `schedule`: from step 3
   - `system`: must equal the pool directory name (AD-030 isolation)
   - `status: active`
   - Optional fields: `sub_system`, `ad_scope`, `deliver`, `skills`, `enabled_toolsets`, etc.
   - **Prompt section**: copy the prompt text from the cronjob tool call verbatim
5. **If part of a workflow DAG**, add a node entry to `{pool}/cron-jobs/_workflows/{workflow-name}.yaml` (AD-030):
   ```yaml
   nodes:
     - name: discover-builders
       file: cron-jobs/discover-builders.md
       schedule: "0 9 * * 1"
       depends_on: []  # or list of upstream node names
   ```6. **Validate with arch** (REQUIRED — exit 0):

   ```bash
   arch validate --pool {pool-name}
   ```
   The validator checks: frontmatter schema, cron_id in jobs.json, schedule match, prompt hash match (AD-029), skills exist, system isolation (AD-030), workflow DAG validity.

### UPDATE a Cron Job

1. **Modify via the cronjob tool** (this updates `jobs.json`):
   ```
   cronjob(action='update', job_id='EXISTING_ID', prompt='<new prompt>', schedule='0 10 * * 1')
   ```
2. **Update the .md file** to match:
   - Update `last_updated` date
   - Update the `Prompt` section to match the new prompt in jobs.json
   - Update any other fields you changed (e.g., `schedule`)
3. **If workflow DAG references need updating**, edit `_workflows/{workflow-name}.yaml`.
4. **Validate with arch** (REQUIRED — exit 0):
   - Schedule match check will catch drift if you forgot to update the .md schedule
   - Prompt hash check will catch drift if you forgot to update the .md Prompt section

### DECOMMISSION a Cron Job

1. **Remove via the cronjob tool**:
   ```
   cronjob(action='remove', job_id='EXISTING_ID')
   ```
2. **Set the .md file `status: superseded`** (do NOT delete it — preserve genomic history):
   - Update frontmatter: `status: superseded`, `last_updated: <today>`
   - Optionally add a note: "Decommissioned YYYY-MM-DD. See AD-NNN for rationale."
3. **Remove from any `_workflows/*.yaml`** DAG nodes.
4. **Validate with arch** (REQUIRED — exit 0):
   - The validator will NOT flag the superseded .md as drift (it stops cross-checking superseded jobs against `jobs.json`).

## Why arch validate at Every Step

The integrity check is **not** a monthly audit. It runs after every CREATE, UPDATE, DECOMMISSION. Drift is caught at the step where it was introduced:

- Forgot to fill `cron_id`? Caught at CREATE.
- Schedule in jobs.json doesn't match .md? Caught at UPDATE.
- Skill referenced doesn't exist? Caught at CREATE.
- Cross-system isolation violation? Caught at any step.

The validator exits 0 only when all sources of truth are aligned. A workflow is not complete until `arch validate --pool {pool-name}` returns exit 0.

## Integration with Hermes cronjob Tool

```
# Create
cronjob(action="create", name="Job Name", schedule="0 9 * * *",
        prompt="<GENERATED_PROMPT>", skills=["relevant-skill"],
        deliver="telegram:5297486612:THREAD_ID",
        enabled_toolsets=["terminal", "web"])

# Update
cronjob(action="update", job_id="existing-id", prompt="<OPTIMIZED_PROMPT>")
```

---

### Cron Jobs: Genomic Documentation (AD-026)

Every cron job prompt in a pool's `cron-jobs/` directory follows a standard YAML frontmatter format. The `.md` file documents why the job exists; `~/.hermes/cron/jobs.json` is the runtime registry.

**Required frontmatter**: `cron_id`, `name`, `schedule`, `system`, `status`
**Optional**: `sub_system`, `ad_scope`, `deliver`, `skills`, `enabled_toolsets`, `model`, `repeat`, `no_agent`, `script`, `created`, `last_updated`

**The linter validates**:
- All required frontmatter fields present
- `cron_id` matches a job in `jobs.json` (no drift)
- `status` is `active`/`paused`/`superseded`
- Schedule is a valid cron expression
- `AGENTS.md` (AD-050) includes an auto-generated `cron_jobs:` auto-zone (via `arch emit --agents`) listing all jobs with their metadata

**Workflow**:
1. `cronjob(action='create', ...)` → job gets ID in `jobs.json`
2. Write `{pool}/cron-jobs/{job-name}.md` from the template (see `references/cron-prompt-template.md`)
3. Fill in frontmatter + Prompt section
4. Run `arch validate --pool {pool-name}` to verify

**Reference**: `references/cron-prompt-template.md`

## Skill Maintenance
- When prompt-master updates templates/patterns, update the checklists above
- Add new job types to the mapping table as discovered
- Run pattern audit on all cron jobs monthly (Pattern 37: context rot)
