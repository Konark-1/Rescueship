---
name: refactor-alignment
description: "Plan and execute stage-gated refactors that realign a system or vault with the user's objectives — dissolution, migration, consolidation, de-agglomeration. Use when asked to 'refactor X', 'make X a pure Y', 'dissolve/move/consolidate X', when an audit reveals structural drift from intent, or whenever a change would move/delete >50 files. Encodes the transmutation playbook proven in KOSMOS-AD-001: recon → disposition table → staged execution with fail-closed gates."
---

# Refactor Alignment

Refactors fail by scope-blindness (fixing structure while breaking consumers)
and gate-blindness (no proof each stage worked). This leaf is the antidote,
distilled from the KosmOS pure-research transmutation.

## Phase R1 — Recon (never skip)

Inventory the target: every directory with size/tracked-count/nature; every
consumer (`grep` for path references in code, docs, CI, cron prompts); every
governance record mentioning it (`arch search <name>`). Output: a recon table —
component | size | tracked | nature | disposition candidate.

## Phase R2 — Objective statement + target state

One paragraph: what the system IS after this (the user's objective), rendered as
an exact target tree/inventory. Definition of done = `ls` matches target +
gates green + zero dangling references. If you cannot write the target tree,
the objective is not clear enough to refactor against — stop and ask.

## Phase R3 — Disposition table

Every component gets exactly one: **MOVE** (where/why) · **DISSOLVE** (content
absorbed where) · **ARCHIVE** (path in `_archive/`, frontmatter `archived:` date)
· **KEEP** · **PURGE** (with proof nothing references it). Components without
dispositions are how zombies are born.

## Phase R4 — Stage plan with gates

Order stages cheapest-safest-first (purge junk → reference sweeps → moves →
doc consolidation → canonical rewrite). Each stage ends in a committed gate:
validation green, census stable ±2%, consumer smoke passes, clean tree.
No stage begins before the previous gate is green AND pushed.

**Stage S0 always**: reversible mechanics first — git-mv over delete, ignore
rules before file removal, archive over destroy.

## Phase R5 — Execution discipline

- Reference sweep after EVERY stage (code, docs, CI, crons).
- Governance updated in the same arc: AD via arch CLI (subject = owning pool),
  superseded plans archived not deleted, doctrine-of-record rows added.
- Consumer cutover verified before source retirement (bridges, importers).

## Anti-patterns (each one has caused a real incident)

- mkdir-on-demand of canon roots during moves (RG-054 class)
- hand-written state docs replacing derived views — they rot within days
- deleting before the replacement is live (blind-phase execution)
- refactoring corpus/content and structure in the same stage — never mix

## Related

- auditing/system-efficacy (produces the alignment findings that justify R2)
- refining/self-healing (gates installed during R4 stay as permanent baselines)
- KOSMOS-AD-001 (worked example: 8 stages, full disposition table)
