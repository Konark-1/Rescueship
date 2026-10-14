# Compass Graduation Pipeline Audit Methodology

Reference for auditing compass-graduated systems and the compass path development pipeline. Derived from the 2026-08-15 compass system architecture audit.

## What to Audit

When auditing a compass-graduated system, check both the graduated pool AND the compass pipeline that produced it.

### 1. Tier Classification (AD-053)

Verify the pool's tier is correct using the department/project test:
- **Foundation (department)**: permanent org function serving the ecosystem. No `compass_graduate` block. Declares `services_offered`.
- **Compass-graduate (big project)**: born from a compass path. Has `compass_graduate` block with `status: true`, non-null `path_ref`, `graduation_ad`, `graduation_date`, `graduation_stage`.

Common misclassification: a system that is infrastructure (research-engine, relationship-intel) but was marked compass-graduate. The test: "Is this a department or a big project?"

### 2. Path-Entry Backlink

For every compass-graduate, the corresponding path entry in `~/.hermes/systems/personal-os/sub-systems/path/data/trajectories/path-entries.md` MUST have:
- `system_pool_ref: ~/.hermes/systems/{pool-name}/` pointing to the graduated pool
- `operational_status` reflecting the actual stage (seedling → sprouted → operative → hardened)

If the `compass_graduate` block in `_org.yaml` has `path_ref: path-NNN` but the path entry has no `system_pool_ref` backlink, the graduation is one-directional and broken.

### 3. Gate 5 Validation

Run `compass validate graduation <path-ref>` or `compass validate all-lineage` to verify:
- Gate 4 (lineage integrity): 0 findings
- Gate 5 (graduation readiness): all 4 genome layers pass
  - Layer 1 (Produce): active strategies (not draft)
  - Layer 2 (Operate): alignment snapshots with operational data
  - Layer 3 (Observe): journal entries, insights, syntheses (NOT zero)
  - Layer 4 (Align): drift detection operational, `compass-alignment.json` exists

If Gate 5 returns NOT READY, the pool should NOT have `compass_graduate: status: true` unless it has a transitional flag with a remediation plan and deadlines.

### 4. 4-Layer Genome Depth

For each genome layer, check:
- **Produce**: How many active (not draft) strategies exist? Are they passing Gate 2 (depth+lineage)?
- **Operate**: How many sub-systems exist? The 4-layer genome requires Produce/Operate/Observe/Align sub-systems. Zero sub-systems = premature graduation.
- **Observe**: How many insights, syntheses, journal entries? CP-AD-008 flagged this as "NEARLY DEAD" when it has 1 journal + 0 insights + 0 syntheses. The feedback loop is structurally present but data-starved.
- **Align**: Is the alignment cron active (not paused)? Are drift reports being generated? Does `compass-alignment.json` exist in the graduated pool's `data/`?

### 5. Compass Service Bridge

For each compass-graduate pool, verify:
- `core/compass-bridge.yaml` exists and declares which compass sub-systems it uses
- `core/symlinks.yaml` declares all symlinks into compass
- `data/compass-services/` has live symlinks to compass sub-systems (forge, grounding, strategies)
- `data/compass-alignment.json` exists (the feedback file)

### 6. Genesis AD

The genesis AD in the pool's `core/decisions/` MUST reference:
- The compass path_ref (e.g., `path-005`)
- The compass strategy it graduated from (e.g., `strategy-20260809-006`)

If the genesis AD doesn't mention compass, the genealogical link is structural (in `_org.yaml`) but not narrative (in the AD). The AD is the system's birth certificate and must name its parents.

### 7. RG Depth (3 Real Failures Rule)

CP-AD-005 requires 3+ RGs from documented failure modes before graduation. Check:
- How many RGs exist in `core/regressions/`?
- Are they from REAL failures (not speculative)?
- Do they have prevention measures?

2 RGs = not enough for graduation. 0 RGs = system has never operated long enough to fail and learn.

### 8. Architecture-Discipline Skill Integration

The architecture-discipline skill chain (meta-skill + system-design + system-lifecycle) should reference the compass graduation protocol. If an agent using system-design to scaffold a new pool would NOT know about compass integration requirements, this is a HIGH finding.

## Audit Output Format

Structure findings as:
```
Finding N: [Title] (SEVERITY: HIGH/MEDIUM/LOW)
Problem: ...
Impact: ...
Fix: ...
```

Group by:
1. Architecture-discipline integration gaps (skill doesn't know about compass)
2. Premature graduations (Gate 5 NOT READY but pool marked graduated)
3. Dead layers (Layer 3 observe with 0 data)
4. Missing structural links (no system_pool_ref backlink, no genesis AD reference)
5. Cron/feedback loop gaps (alignment cron paused, no insights cron)
```
