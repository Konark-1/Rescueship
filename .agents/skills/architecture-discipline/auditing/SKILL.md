---
name: auditing
description: "Router for architecture auditing. Children form a PIPELINE: record-integrity → structural sweeps (system-efficacy) → integration-mapping → red-teaming, sequenced by monthly-review. Route here for any audit/red-team/ledger-integrity request."
---

# Auditing Pipeline

**Pattern: PIPELINE.** Phases share one artifact — the audit report (findings
table + dispositions). Run in order; each phase assumes the previous passed.

| Phase | Leaf | Answers |
|---|---|---|
| 1 | `record-integrity/SKILL.md` | Is the ledger clean? (redundancy, conflicts, citations, shells, parked) |
| 2 | `system-efficacy/SKILL.md` | Does system X align with objectives and actually work end-to-end? |
| 3 | `integration-mapping/SKILL.md` | How do systems connect; which contracts are one-sided/missing? |
| 4 | `red-teaming/SKILL.md` | Can the gates be bypassed; do surfaces contradict? |
| cadence | `monthly-review/SKILL.md` | What runs this month; where do dispositions land? |

Hand-off artifact between phases: findings table (severity · pool · evidence ·
disposition). Dispositions are exactly FIX / FOLD / TOMBSTONE / CARRY(+owner+date).

Jump when you know the phase; walk when scoping an engagement.
Announce the active leaf; re-route on task shift.
