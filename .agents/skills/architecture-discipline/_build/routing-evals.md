# Routing Evals (Phase 6)

Mechanical pass done at build time; LLM routing evals run per skill-creator when
next loaded in a session. Each prompt lists the CORRECT leaf and near-miss siblings
it must NOT hit.

| # | Prompt | Correct route | Near-misses that must lose |
|---|---|---|---|
| E1 | "audit all AD/RGs for redundancy" | auditing/record-integrity | writing/decision-logging (writing≠auditing), auditing/system-efficacy |
| E2 | "red-team the kosmos gates" | auditing/red-teaming | refining/self-healing (attacks≠installs) |
| E3 | "make quant-finance self-healing" | refining/self-healing | auditing/red-teaming, lifecycle/cli-development |
| E4 | "dissolve research-engine into kosmos" | refining/refactor-alignment | lifecycle/system-lifecycle (lifecycle handles pool ops; >50-file objective-driven dissolution = refactor-alignment) |
| E5 | "initialize ~/Documents/X as a native system" | lifecycle/system-design | refining/refactor-alignment |
| E6 | "map service contracts between compass and campaigns" | auditing/integration-mapping | lifecycle/system-lifecycle |
| E7 | "record this incident as an RG" | writing/regression-logging | auditing/record-integrity (audits ledger, doesn't write records) |
| E8 | "monthly architecture review" | auditing/monthly-review | auditing/system-efficacy (single-system deep-dive ≠ cadence) |
| E9 | "does saas-engine still fulfill its requirements?" | auditing/system-efficacy | auditing/monthly-review |
| E10 | "reduce manual bookkeeping in financial-os" | refining/low-maintenance-design | refining/self-healing (upkeep-elimination ≠ breakage-detection) |
| E11 | "validate after my changes" | integrity-validation (top-level) | any group router |
| E12 | "add a cron job for nightly syncs" | lifecycle/cron-job-lifecycle | auditing/* |

## Keyword-uniqueness check (mechanical, passed at build)

Sibling description overlap on decisive verbs:
- audit-ledger verbs (redundancy/conflict/citation/shell/parked) → only record-integrity
- attack verbs (bypass/adversarial/red-team/drill) → only red-teaming
- connect verbs (services graph/contracts/one-sided/coupling) → only integration-mapping
- restructure verbs (dissolve/move/consolidate/transmute/stage-gated) → only refactor-alignment
- health verbs (smoke/gate/fail-closed/detect-breakage/auto-repair) → only self-healing
- upkeep verbs (bookkeeping/derived-over-authored/eliminate maintenance) → only low-maintenance-design

Ambiguity deliberately kept: "refactor a system" routes via root dispatch table
(refactor → refining/refactor-alignment for objective-driven; system-lifecycle for
mechanical pool ops). Both leaves state the boundary.
