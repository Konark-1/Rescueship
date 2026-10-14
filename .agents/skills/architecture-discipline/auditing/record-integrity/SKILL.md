---
name: record-integrity
description: "Audit the AD/RG governance ledger for non-redundancy, conflicts, and decay: duplicate decisions, dangling citations, Active-cites-Superseded, unfilled template shells, parked records, status-enum drift. Use whenever asked to 'audit all AD/RGs', 'check ledger integrity', 'find redundant or conflicting ADs', before/after bulk record changes, and as the mechanized first phase of any architecture audit. Mechanize-first — run the engine pass, never hand-scan."
---

# Record Integrity Audit

Audit the governance ledger (all AD/RG files across pools + sub-systems) for the
six decay classes. Mechanize-first: the validator already implements most checks —
your job is to run it, interpret findings, and burn them down.

## The pass

```bash
cd ~/.hermes/systems/architecture && arch validate
```

The `check_record_integrity` engine pass reports:
- **ERROR** — Related-section citations resolving nowhere (live pools incl.
  sub-systems → archive/ → `archive/TOMBSTONES.md`)
- **ERROR** — Active records with ≥2 unfilled template sections past 7-day grace
- **WARN** — Open/Accepted records parked >14 days

## What the engine cannot see (manual passes)

### 1. Redundancy (RG-010 class)
Same DECISION recorded twice under different titles defeats title-dedup. Scan by
topic, not title:

```bash
arch recon topic=<keyword>          # per topic
arch stats                          # density anomalies (pool with 2× median RGs?)
```

Redundant pair found → keep the richer one, fold unique content of the other into
it, mark loser Superseded → winner. Run the SUPERSEDE CASCADE (writing leaves).

### 2. Conflicts
Two Active records giving contradictory instructions for the same concern.
Detection: read `references/doctrine-of-record.md` — one row per topic. Any topic
with two plausible governors is a conflict candidate; diff their verdicts.

Resolution order: newer wins unless older is load-bearing elsewhere → then amend
the winner to absorb the exception, supersede the loser.

### 3. Authority drift
Active prose citing a Superseded ID as governing authority (not as history).
Fix by re-pointing at the successor or at `doctrine-of-record.md`.

## Burn-down protocol

Every finding gets exactly one disposition: **FIX** (in place), **FOLD** (merge +
supersede), **TOMBSTONE** (dead ID → add row to `archive/TOMBSTONES.md`),
or **CARRY** (dated audit note in the record body explaining why it stays open).
Carry requires an owner and a scope sentence — naked carries are not dispositions.

## Report artifact

One markdown block appended to the engagement report:

```
| finding | class | severity | pool | disposition |
```

Then re-run `arch validate` — done means zero NEW errors vs the pre-audit baseline.

## Related

- writing/decision-logging + writing/regression-logging (ownership test, cascade rule)
- references/doctrine-of-record.md (authority map)
- engine.py `check_record_integrity` (the mechanized pass)
