---
name: integration-mapping
description: "Audit and strengthen inter-system integration: map the services graph (services_offered/consumed, pooled sub-systems, bridges), find one-sided contracts, orphaned consumers, duplicated capabilities across pools, and coupling that should become contracts. Use when asked to 'increase integration between systems', 'map how systems connect', 'find one-sided or broken service contracts', when a pool's _org.yaml declares consumption the provider doesn't offer, and during deep audits of any multi-system workflow."
---

# Integration Mapping

Systems earn their name by connecting. This leaf makes the connection graph
visible, then hardens it: every edge declared on both ends, every duplication
collapsed to the lowest common ancestor, every missing bridge named as an
opportunity with an owner.

## 1. Build the graph

Sources of truth (in priority order):
1. `arch emit-registry` output — `architecture/data/architecture-registry.yaml`
2. Each pool's `_org.yaml` → `services_offered:` / `services_consumed:`
3. `sub-systems/` pooled symlinks (AD-060) — foundation extends
4. Code-level imports/subprocess calls crossing pool boundaries

Render as: `consumer --[via what]--> provider` rows. The registry is generated;
rows found in code but absent from `_org.yaml` are undeclared edges — findings.

## 2. The five defect classes

| Defect | Signal | Fix |
|---|---|---|
| One-sided contract | consumer declares; provider offers nothing | provider adds `services_offered:` row or consumer re-declares honestly |
| Ghost consumption | consumed service id has no living entry point | remove row or restore CLI; check cli-version-registry |
| Undeclared edge | code crosses pools, no declaration | declare it — invisible coupling is unmanaged coupling |
| Duplicated capability | two pools own near-identical scripts/CLIs | LCA rule: hoist to shared ancestor or hermes-agent-infra; delete loser |
| Bridge without contract | sidecar script reads another system's files ad-hoc | promote to declared service or move behind the owning CLI |

## 3. Strengthening passes

### Contract completion
For each real workflow spanning pools, verify the chain is fully declared:
every hop has both sides + access mode (`cli|symlink`). Missing middle hops are
the usual gap — workflows work by accident until a path changes.

### Coupling opportunities
When two+ pools hand-roll similar logic (dedup, scoring, sync), propose ONE
canonical owner per the Foundation Category Registry; others consume. Proposals
become ADs (subject = proposed owner — ownership test applies).

### Integration depth ladder
Rate each declared edge: `file-scrape < cli < typed-contract`. Recommend the
next rung only where traffic justifies it; do not gold-plate dormant edges.

## Report artifact

Graph summary (pools, edges, defects by class) + disposition table +
top-3 integration opportunities ranked by leverage. Registry regenerated via
`arch emit --all` after any `_org.yaml` edit.

## Related

- lifecycle/system-design (services_offered schema)
- references/foundational-system-patterns.md (pooling patterns)
- auditing/red-teaming D4 (corrupted-edge detection drills)
