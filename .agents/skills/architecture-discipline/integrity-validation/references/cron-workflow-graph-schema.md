# Cron Workflow Graph Schema (AD-030)

Multi-phase cron pipelines are documented as YAML DAGs in `{pool}/cron-jobs/_workflows/{workflow-name}.yaml`. The integrity validator walks these DAGs and verifies integrity.

## Canonical Schema (matches deployed DAGs)

```yaml
# Workflow metadata
name: {workflow-name}                    # unique loop name
system: {pool-name}                      # must match the pool directory name
sub_system: {sub-system-name}             # optional: for sub-system pools
type: compound-loop                      # or: sequential, triggered-loop
description: >
  {human-readable description}

# Phases: the main pipeline nodes
phases:
  - id: {phase-id}                       # unique within this workflow (e.g., p1-acquire)
    cron_id: {12-char-hex}                # links to jobs.json entry
    schedule: "{cron expression}"         # must match jobs.json
    depends_on: [{phase-id}]              # upstream phase ids
    reads: [{KB state description}]       # semantic description of what this phase reads
    writes: [{KB state description}]      # semantic description of what this phase writes
    next: {next-phase-id}                 # the downstream phase
    feedback_to: {phase-id}               # optional: compound learning feedback target (P7 → P1 pattern)
    type: {phase-type}                    # optional: retrospective, recovery, standard

# Recovery: side-channel jobs that fix transient failures
recovery:                                 # optional
  - id: {recovery-id}
    cron_id: {12-char-hex}
    schedule: "{cron expression}"
    depends_on: []
    trigger: {trigger description}

# Memory: jobs that replay/consolidate historical state
memory:                                   # optional
  - id: {memory-id}
    cron_id: {12-char-hex}
    schedule: "{cron expression}"
    depends_on: [{phase-id}]
```

## Field Reference

### Workflow Level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Unique workflow name (e.g., `revenue-loop`) |
| `system` | string | yes | Pool name; must match the pool directory (AD-030 isolation) |
| `sub_system` | string | no | Sub-system name if the workflow lives in a sub-system pool |
| `type` | string | yes | `compound-loop` (P7 feeds back to P1), `sequential` (one-way), `triggered-loop` (event-driven) |
| `description` | string | yes | Human-readable description |
| `phases` | list | yes | Ordered list of pipeline phases |
| `recovery` | list | no | Side-channel recovery jobs |
| `memory` | list | no | Memory replay/consolidation jobs |

### Phase Level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique phase id within the workflow (e.g., `p1-acquire`) |
| `cron_id` | string | yes | 12-char hex ID from jobs.json |
| `schedule` | string | yes | Cron expression; must match jobs.json |
| `depends_on` | list | yes | Upstream phase ids this phase depends on |
| `reads` | list | yes | Semantic description of KB state this phase reads |
| `writes` | list | yes | Semantic description of KB state this phase writes |
| `next` | string | no | The downstream phase id |
| `feedback_to` | string | no | Phase id that receives compound learning feedback (P7 → P1 pattern from AD-002) |
| `type` | string | no | Phase type: `retrospective`, `recovery`, `standard` (default) |

## Loop Types

- **compound-loop**: Phases form a cycle. P7 (compound) feeds strategy back to P1 (discover). This is the canonical pattern from AD-002.
- **sequential**: One-way pipeline, no feedback loop. Phases run in order and the last phase doesn't feed back.
- **triggered-loop**: Phases triggered by events rather than schedules. `depends_on` includes trigger descriptions.

## Integrity Validation

The `system-integrity` validator (`integrity_check_cron_workflow(pool)` MCP tool or `system-integrity {pool} --cron-only` CLI) walks the DAG and reports:

### ERROR-level findings

- YAML parse error in `_workflows/*.yaml`
- Missing required field (`name`, `system`, `type`, `description`, `phases`)
- `system:` doesn't match the pool directory name (AD-030 isolation violation)
- A phase's `cron_id` doesn't exist in `jobs.json`
- A phase's `depends_on:` reference doesn't resolve to a real phase in the same workflow
- A phase's `next:` reference doesn't resolve to a real phase
- Cycle detected in the DAG (DFS detection, excluding `feedback_to` which is intentional)

### WARN-level findings

- A phase's `schedule:` doesn't match `jobs.json` schedule for that `cron_id`
- `recovery` or `memory` section references a `cron_id` not in `jobs.json`
- Phase has no `reads` or `writes` (may indicate incomplete documentation)

## Example: Revenue Loop (compound-loop)

```yaml
name: revenue-loop
system: revenue-engine
sub_system: job
type: compound-loop
description: >
  8-phase revenue generation flywheel. Each phase reads KB state written
  by the prior phase. Phase 7 compounds learnings back to Phase 1.

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

  # ... phases 3-6 ...

  - id: p7-compound
    cron_id: a2cc2c1c6e68
    schedule: "0 6 * * *"
    depends_on: [p6-convert]
    reads: [KB/items where status=won, acquisition_strategy.json]
    writes: [acquisition_strategy.json updated, KB sanitized/deduped]
    next: p8-retro
    feedback_to: p1-acquire    # AD-002: compound learning feeds back to P1

  - id: p8-retro
    cron_id: b0823df7de2b
    schedule: "0 23 * * 0"
    depends_on: [p1-acquire, p2-score, p3-enrich, p4-outreach, p5-track, p6-convert, p7-compound]
    reads: [decision_log all phases this week]
    writes: [weekly_retrospective.md]
    type: retrospective

recovery:
  - id: recover
    cron_id: db23927c9d6c
    schedule: "*/15 * * * *"
    depends_on: []
    trigger: transient failure in any phase
```

## Per-Pool Isolation (AD-030)

A workflow in `strategic-engine/_workflows/`:
- Cannot reference phases from `revenue-engine/`
- `system:` must match the pool directory name
- Sub-system workflows set `sub_system:` to the sub-system name
- The validator flags cross-pool references as isolation violations

## Related

- AD-002: Cron Loop Architecture (the canonical 8-phase pattern)
- AD-027: Cron Job Lifecycle (the workflow that creates and updates these DAG files)
- AD-029: system-integrity MCP (the validator that walks these DAGs)
- AD-030: Per-System Cron Job Isolation & Workflow Graph
- `integrity_check_cron_workflow(pool)` MCP tool — the validator entry point
