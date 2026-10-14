# Compass Pipeline Audit Methodology

Reference for auditing the Compass path development pipeline and path-to-system graduation pipeline. Derived from the 2026-08-15 compass genome audit.

## When to Use

When the user asks to "audit the compass pipeline", "check compass path development", "verify graduation pipeline", or "assess compass system structure". This is distinct from a standard `system-audit` (which audits a single pool's efficacy). The compass pipeline audit evaluates the breeding ground itself.

## Audit Components

### 1. Path Development Pipeline (Gates 1-4)

Check that the quality gate validators are live and returning 0 findings:

```bash
# Gate 4: lineage integrity across all paths
cd ~/.hermes/systems/compass && python3 bin/compass validate all-lineage

# Gate 5: graduation readiness for a specific path
cd ~/.hermes/systems/compass && python3 bin/compass validate graduation <path-ref>
```

Expected: all strategies pass at 100/100, 0 findings on Gate 4. Gate 5 returns READY or NOT READY with specific blocking findings.

### 2. Graduated Pool Genome Compliance

For each pool with `tier: compass-graduate` in `_org.yaml`:

- `compass_graduate` block exists with `status: true`
- `compass-bridge.yaml` in `core/`
- `symlinks.yaml` in `core/`
- `data/compass-services/` with symlinks to compass sub-systems
- `data/compass-alignment.json` exists (feedback file)
- Genesis AD in `core/decisions/` references the compass path_ref
- Sub-systems decomposed per the 4-layer genome (Produce/Operate/Observe/Align)
- At least 3 RGs from documented real failures

### 3. Alignment Sub-System (Layer 4)

- `drift_detector.py` discovers graduated pools via `compass-alignment.json`
- Drift reports are being produced (check `~/.hermes/systems/compass/sub-systems/alignment/data/`)
- The alignment-check cron job is active (not paused)

### 4. Observation Layer (Layer 3)

- Systemic journal entries exist (more than 1)
- Insights and syntheses are being produced
- An insights-capture mechanism (cron or manual) is operational

### 5. Tier Classification Consistency (AD-053)

- Every `_org.yaml` has a `tier` field
- `tier: compass-graduate` pools have valid `compass_graduate` blocks
- `tier: foundation` pools do NOT have `compass_graduate` blocks
- Run: `python3 ~/.hermes/systems/architecture/scripts/system-integrity` (0 errors expected)

## Common Findings

| Finding | Severity | Fix |
|---------|----------|-----|
| Architecture-discipline skill has no compass references | HIGH | Patch meta-skill + system-design with compass graduation protocol |
| Graduated pool missing sub-systems | HIGH | Downgrade tier to standalone or add transitional flag |
| Layer 3 (Observe) has no insights | HIGH | Create insights-capture cron job |
| Alignment cron is paused | MEDIUM | Activate the cron job |
| Gate 5 Layer 2 check is shallow | MEDIUM | Deepen validator to check operational data volume |
| Genesis ADs don't reference compass | MEDIUM | Patch the AD to include path_ref and strategy_ref |
| Path attribution backfill incomplete | LOW | Backfill path_ref on upstream artifacts |
| Graduation ceremony never executed | LOW | First real graduation will test the protocol |

## File References

- Compass ADs: `~/.hermes/systems/compass/core/decisions/CP-AD-00{5,8,9,10}-*.md`
- Graduation design: `~/.hermes/systems/compass/references/path-system-graduation-design.md`
- Genome audit report: `~/.hermes/systems/compass/references/compass-pipeline-genome-audit-2026-08-15.md`
- Gate 5 validator: `~/.hermes/systems/compass/bin/compass validate graduation <path-ref>`
- Drift detector: `~/.hermes/systems/compass/sub-systems/alignment/scripts/drift_detector.py`
- AD-053 (tier classification): `~/.hermes/systems/architecture/core/decisions/AD-053-system-pool-tier-classification-foundation-vs-comp.md`
