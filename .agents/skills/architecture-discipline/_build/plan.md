---
title: "architecture-discipline v5 — Audit-Centric Meta-Skill Restructure"
description: "Plan to evolve the flat architecture-discipline skill into a routed meta-skill whose second pillar is an auditing/refining group enclosing existing audit leaves and adding record-integrity, red-team, integration, and self-healing capabilities."
type: Build-Plan
status: executed
created: 2026-08-23
base_skill: "~/.agents/skills/skill-creator/SKILL.md (Phase 0 read required before leaf-writing)"
registry: "scripts/registry.py (already in tree; re-run after each phase)"
---

# Plan: architecture-discipline → Audit-Centric Meta-Skill

## 0. Design decision (one paragraph)

architecture-discipline is already *de facto* a meta-skill (root router + 10 leaves +
registry.py + _map.md) but shaped as a flat facets list. Rather than creating a sibling
"architecture-auditing" meta-skill — which would fork the governance entry point and
split-brain triggering (non-redundancy, AD-057) — we **restructure in place**: the root
router gains a second-level grouping, and a new `auditing/` + `refining/` pair encloses
the audit-flavored leaves and adds the four capabilities the user named. One root
description keeps triggering; depth organizes without costing loads.

## 1. Capability map (Phase 1 — exhaustive-but-flat, phrased as requests)

| # | Request that should route here | New or encloses |
|---|---|---|
| C1 | "audit all AD/RGs for non-redundancy and conflicts" | NEW |
| C2 | "audit ledger citations / dangling refs / shell records / parked statuses" | NEW (mechanized this session — G1–G9) |
| C3 | "red-team the architecture: bypass gates, contradict guidance, find failure modes" | NEW |
| C4 | "does system X still align with my objectives?" | encloses system-audit Ph4 |
| C5 | "deep-audit system X end-to-end (topology, flows, gaps)" | encloses system-audit |
| C6 | "plan/execute a refactor of system X toward objectives" (transmutation pattern) | NEW (generalize AD-068/KOSMOS-AD-001 playbook) |
| C7 | "increase inter-system integration between A and B" | NEW |
| C8 | "map service contracts; find one-sided/duplicated integrations" | NEW |
| C9 | "make system X self-healing / auto-maintaining" | encloses low-maintenance-design |
| C10 | "wire fail-closed smoke gates / health baselines for X" | NEW (extract from AXE-AD-010 practice) |
| C11 | "run the monthly architecture review" | encloses monthly-review |
| C12 | "validate integrity after CRUD" | encloses integrity-validation |

## 2. Proposed tree (Phase 2 — awaiting sign-off)

```
architecture-discipline/                 root router (facets → groups; <200 lines)
├── SKILL.md                              rewritten routing table
├── _map.md / _registry.yaml / scripts/   regenerated post-build
├── _build/plan.md                        THIS FILE
├── writing/                              router [encloses]
│   ├── decision-logging/SKILL.md         ✓ exists (v4.3/4.4 amendments)
│   └── regression-logging/SKILL.md       ✓ exists
├── lifecycle/                            router [encloses]
│   ├── system-design/SKILL.md            ✓ exists (+ external-init section)
│   ├── system-lifecycle/SKILL.md         ✓ exists
│   ├── cli-development/SKILL.md          ✓ exists
│   └── cron-job-lifecycle/SKILL.md       ✓ exists
├── auditing/                             router — PIPELINE pattern:
│   │                                     scope → mechanize → red-team → synthesize
│   ├── record-integrity/SKILL.md         NEW  (C1,C2: redundancy/conflict/citation/
│   │                                          shell/parked audits; wraps engine pass)
│   ├── system-efficacy/SKILL.md          MOVE+MERGE system-audit (C4,C5)
│   ├── red-teaming/SKILL.md              NEW  (C3: adversarial gate-bypass drills,
│   │                                          guidance-contradiction probes, chaos checks)
│   ├── integration-mapping/SKILL.md      NEW  (C7,C8: services graph audit,
│   │                                          one-sided contracts, coupling opportunities)
│   └── monthly-review/SKILL.md           ✓ exists (C11; becomes cadence wrapper
│                                               sequencing the four above)
├── refining/                             router — SELECTION pattern by objective
│   ├── refactor-alignment/SKILL.md       NEW  (C6: stage-gated transmutation playbook;
│   │                                          disposition tables, fail-closed stage gates)
│   ├── low-maintenance-design/SKILL.md   MOVE low-maintenance-design (C9)
│   └── self-healing/SKILL.md             NEW  (C10: smoke.yaml patterns, auto-task
│                                              wiring, lossless mutation paths)
├── integrity-validation/SKILL.md         stays top-level (C12: cross-cutting,
│                                          invoked after ANY leaf's workflow)
└── references/
    ├── conventions.md                    ✓
    ├── doctrine-of-record.md             ✓ (new)
    ├── foundational-system-patterns.md   ✓
    └── pool-layout.md                    ✓
```

Fan-out check: root=4 groups ✓ (5–12 invariant); auditing=5 ✓; refining=3 ✓;
lifecycle=4 ✓; writing=2 (acceptable — will grow with genome rules).

Routing patterns declared: auditing=PIPELINE (ordered phases share one artifact:
the audit report); refining=SELECTION (objective picks the leaf);
root=FACETS over the four groups.

## 3. Conventions block (every node builder reads first)

1. **Voice/style**: per skill-creator — imperative, no filler, examples over prose.
2. **Governance binding**: every leaf that writes AD/RGs MUST carry the POOL-OWNERSHIP
   TEST + SUPERSEDE CASCADE blocks verbatim-by-reference (point at writing/ leaves,
   never duplicate).
3. **Mechanize-first**: if a check can run as code, the leaf references/exercises the
   engine pass (`check_record_integrity` et al.) instead of describing manual steps.
   Manual procedure is only for what code cannot reach.
4. **Audit artifact format**: one markdown report per engagement —
   findings table (severity/pool/evidence/remediation), burned-down items, carried-forward.
   Stored under the audited pool's `references/` or `_Meta/audits/` for vaults.
5. **No duplication**: content moved into auditing/refining leaves is DELETED from its
   old location in the same commit; registry re-run immediately after.
6. **Line budgets**: routers <200; leaves ≤500; frameworks split when alternatives cluster.

## 4. Build order & status

- [x] P0: read skill-creator base (before first new leaf)
- [x] P3a: write NEW leaves first — record-integrity, red-teaming, integration-mapping,
      refactor-alignment, self-healing (subagent-per-leaf if context tight)
- [x] P3b: MOVE+ADJUST enclosed leaves (system-audit→system-efficacy merge,
      low-maintenance-design move; monthly-review rewired as sequencer)
- [x] P4: wire routers bottom-up (auditing, refining, writing?, lifecycle?, root last)
- [x] P5: registry.py run → _registry.yaml + sharded _map.md; fix all validation errors
- [x] P6 (mechanical; LLM evals next session) routing evals — 6 near-miss prompts (e.g. "audit my cron job" must hit
      lifecycle/cron-job-lifecycle NOT auditing/*); fix descriptions first on mis-route
- [x] P7: root description optimization (the only always-loaded trigger surface)
- [ ] Commit per phase; AD amendment noting the restructure (subject = architecture pool)

## 5. Out of scope (this plan)

- No changes to arch CLI/engine beyond what G1–G9 already shipped.
- No new pools; kosmos & co. untouched except being audit *targets*.
- Cron-jobs/ employee roster unaffected (monthly-review remains the registered cron).
