# Script Sync Protocol & --reason Flag Patterns

**Session:** 2026-08-17 — Fixing 5 script drifts + 6 missing `--reason` flags
**ADs:** AD-032 (--reason mandate), AD-039 (Multi-Tier Governance Compiler)

---

## Script Sync Direction Protocol

### Canonical vs Deployment

| Location | Role | Authority |
|----------|------|-----------|
| `~/.hermes/systems/{pool}/scripts/{script}.py` | **Canonical source** | Authoritative; edit here for persistent changes |
| `~/.hermes/scripts/{script}.py` | **Deployment artifact** | Cron runtime copy; overwritten on sync |

### Sync Rule
**After editing pool canonical → `cp pool → ~/.hermes/scripts/`**

```bash
# Standard sync (pool canonical is newer/correct)
cp ~/.hermes/systems/{pool}/scripts/{script}.py ~/.hermes/scripts/{script}.py
```

### Exception: Cron Copy Has Newer Feature
If a feature was added directly to `~/.hermes/scripts/` during cron-run debugging, the cron copy may be newer:
1. Compare timestamps: `ls -la ~/.hermes/systems/{pool}/scripts/{script}.py ~/.hermes/scripts/{script}.py`
2. Diff content: `diff -u pool cron-copy`
3. **Manually inspect** which side has correct behavior
4. If cron copy is correct: `cp cron-copy → pool` then re-sync back

### Anti-Pattern: Never Edit `~/.hermes/scripts/` Directly
It is a deployment artifact. Edits are lost on next sync.

---

## --reason Flag Pattern (AD-032 Mandate)

### Requirement
**Every state-modifying CLI using `argparse` MUST accept `--reason`**

### Implementation Template
```python
import argparse

parser = argparse.ArgumentParser(description="Your script description")
# ... existing arguments ...

# AD-032: Audit trail for state mutations
parser.add_argument(
    '--reason',
    default='Automated cron execution',
    help='Reason for this state change (AD-032 audit trail)'
)

args = parser.parse_args()
# ...
# Thread args.reason into decision log / status updates:
# decision_log.log(..., reason=args.reason)
# kb.update_status(..., reason=args.reason)
```

### Scope
- **Tier 2 scripts** (cron-invoked agents, loop phase scripts)
- Any script with `argparse` that **mutates state**: writes KB, updates status, sends messages, modifies files

### Affected Scripts This Session (6 total)

| Script | Pool | State Mutations |
|--------|------|-----------------|
| `conversion-dashboard.py` | job-engine, freelance-engine | Updates conversion metrics, writes dashboard |
| `interview-tracker.py` | job-engine, freelance-engine | Updates interview statuses, writes tracking |
| `response-scanner.py` | job-engine, freelance-engine | Updates proposal/item reply statuses |

### Verification
```bash
python ~/.hermes/systems/{pool}/scripts/{script}.py --help | grep reason
# Should show: --reason REASON  Reason for this state change (AD-032 audit trail)
```

---

## Drift Resolution Workflow

1. **Run validation:** `arch validate --pool {pool}` or `arch validate`
2. **Read Tier 2 warnings:** Script drift + `--reason` flag findings
3. **For each drift:**
   ```bash
   diff -u ~/.hermes/systems/{pool}/scripts/{script}.py ~/.hermes/scripts/{script}.py
   # Determine canonical (newer timestamp + correct behavior)
   # Sync: cp canonical → other
   ```
4. **For each missing --reason:**
   - Patch the pool canonical script's `argparse` section
   - Sync: `cp pool → ~/.hermes/scripts/`
5. **Re-validate:** `arch validate` until 0 errors, 0 warnings

---

## Prevention Checklist (Embed in Pool AGENTS.md)

> **Script Canonical Source:** `~/.hermes/systems/{pool}/scripts/`
> 
> **Cron Runtime Copies:** `~/.hermes/scripts/` are DEPLOYMENT ARTIFACTS. Never edit directly. Sync via `cp pool → scripts/` after pool changes.
> 
> **AD-032 Mandate:** All state-modifying CLIs MUST have `--reason` flag with default `'Automated cron execution'`. Thread `args.reason` into decision log calls.