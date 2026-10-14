# Routing Evals — LLM Pass Results (Phase 6 completion)

Date: 2026-08-25 · Run in live session per skill-creator eval protocol.
Method: for each prompt, the routing decision was made walking root → group router →
leaf using ONLY the description surfaces agents see (_map.md + leaf `description:`
frontmatter). Near-miss leaves were actively considered and rejected with reasons.

| # | Prompt | Routed to | Verdict | Near-miss rejection rationale |
|---|---|---|---|---|
| E1 | "audit all AD/RGs for redundancy" | auditing/record-integrity | PASS | 'audit all AD/RGs' matches record-integrity's ledger-audit scope verbatim; system-efficacy = single-system, writing = record creation not audit |
| E2 | "red-team the kosmos gates" | auditing/red-teaming | PASS | attack verbs vs self-healing's install verbs; gates exist already, we probe them |
| E3 | "make quant-finance self-healing" | refining/self-healing | PASS | outcome-naming (install baselines), not an attack; no CLI build involved |
| E4 | "dissolve research-engine into kosmos" | refining/refactor-alignment | PASS | 'dissolve' is refactor-alignment's trigger verb; boundary rule (objective-driven >50-file = refactor-alignment) resolves the system-lifecycle near-miss |
| E5 | "initialize ~/Documents/X as a native system" | lifecycle/system-design | PASS | scaffold triggers + root dispatch table ('initialize system'); no realignment of existing pool |
| E6 | "map service contracts between compass and campaigns" | auditing/integration-mapping | PASS | read/audit op on services graph, not structural modification |
| E7 | "record this incident as an RG" | writing/regression-logging | PASS | record-creation verb; record-integrity audits but never writes (explicit leaf boundary) |
| E8 | "monthly architecture review" | auditing/monthly-review | PASS | verbatim cadence-wrapper trigger; efficacy = single-target |
| E9 | "does saas-engine still fulfill its requirements?" | auditing/system-efficacy | PASS | 'requirement fulfillment' phrase match; single named system, no cadence signal |
| E10 | "reduce manual bookkeeping in financial-os" | refining/low-maintenance-design | PASS | upkeep-elimination verbs; nothing broke — breakage-detection near-miss rejected |
| E11 | "validate after my changes" | integrity-validation (top-level) | PASS | CRUD-post validation trigger; no group keyword present so group routers lose |
| E12 | "add a cron job for nightly syncs" | lifecycle/cron-job-lifecycle | PASS | cron-add verb + root dispatch ('automate every Y'); no audit target |

**Result: 12/12 PASS.** No routing corrections required. The deliberately kept
ambiguity ("refactor a system") resolved correctly via the root dispatch table in
both simulated directions.

Note: E10's example pool (financial-os) was dissolved on 2026-08-25 per LB-AD-002;
the eval prompt remains valid as a historical routing case.
