---
name: self-healing
description: "Wire fail-closed health baselines and auto-maintenance into any system: smoke.yaml manifests, pre-commit gates, drift detection that auto-creates fix tasks, lossless mutation paths, derived-over-authored doc patterns. Use when asked to 'make X self-healing', 'add a health gate', 'auto-maintain X', when a system needs manual babysitting to stay healthy, or after red-teaming confirms holes that must become standing gates."
---

# Self-Healing Architecture

A healthy system knows it is sick before it acts. This leaf installs the three
organs of self-healing: **detect** (smoke gates), **route** (auto-created fix
tasks), **repair** (lossless, idempotent paths). Pattern authority: AXE-AD-010.

## Organ 1 — Detect: the smoke manifest

Every pool with an operational surface declares `smoke.yaml`:

```yaml
version: 1
checks:
  - name: cli-reachable          # imperative, specific names
    cmd: <cli> --help > /dev/null
    critical: true               # blocks the tick on failure
    timeout: 30
    reason: "why this surface must stay green"
```

Rules:
- Checks are CHEAP (seconds) and run pre-tick/pre-commit. Deep checks belong to
  scheduled validation, not the gate.
- Every check's `reason` names the incident class it prevents — no reason, no check.
- Vault-style systems chain their own deeper gate as one check
  (e.g. kosmos runs `tests/smoke_cli.py --gate`).

Fire-test before declaring done: break a thing, watch the gate fail, repair.
A gate that has never failed is untested decoration (RG-053 class).

## Organ 2 — Route: findings become tasks

Detection without routing is noise. Wire failures to the executor's task queue:
AXE tick failure → kanban fix task (existing pattern); lint findings → named
owner + scope in the report; monthly review WARNs → carry-or-fix decision with
a date. A warning repeated twice without disposition is a process bug — escalate
to an RG.

## Organ 3 — Repair: lossless by construction

- **Derived-over-authored**: indexes, registries, maps regenerate from source
  (`arch emit`, registry.py, index rebuilds). Hand-edited derived files are defects.
- **Idempotent provisioning**: services/links install via content-hash compare,
  self-heal on every invocation (AD-069 pattern). No manual setup steps.
- **Lossless mutation**: snapshots before destructive ops; stash never dropped;
  per-file conflict backups (RG-029 guards are the reference).
- **Fail-closed default**: a broken gate BLOCKS work rather than degrading to
  warn-and-continue. The halt is the healing signal.

## Installation checklist

- [ ] Inventory surfaces → one smoke check per critical surface
- [ ] Manifest committed + fire-tested (synthetic failure proven caught)
- [ ] Failure → task routing verified end-to-end
- [ ] Derived stores enumerated with regeneration commands in pool AGENTS.md
- [ ] Destructive paths audited for snapshot guards

## Related

- auditing/red-teaming (finds the holes this leaf converts to gates)
- refining/low-maintenance-design (the upkeep-elimination sibling)
- AXE-AD-010 · AD-069 · RG-029/KOSMOS-RG-001 (pattern authorities)
