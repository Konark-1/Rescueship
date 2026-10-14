# Domain Coupling Audit — Pre-Split Checklist & Taxonomy

## When to Use

Before running the SPLIT operation in system-lifecycle, run this audit to detect monoliths where unrelated domains share infrastructure.

## Quick Checklist

### Step 1: Map Data Objects by Domain
Inventory all data objects. Classify each by naming convention:
- `da-*` = B2B business outreach (dad's architecture firm)
- `pb-*` = personal-brand social media
- `loo-*` = community growth
- `ai-infra-*` / `freelance-*` = job/freelance pipeline
- `quant-*` = quantitative finance
- `job-*` = job search

### Step 2: Check Data Model Coupling
Read `core/store.py` + `core/schemas.py`. Red flags:
- Same directory holds objects from 2+ domains with identical schema but different operational models
- Hardcoded `CAMPAIGNS_DIR` / `AUDIENCES_DIR` paths that assume co-location
- `campaign.yaml` fields used differently per domain (e.g., `leverage_points` for B2B vs `audience_segment` for social)

### Step 3: Check CLI Coupling
Map each command group to its domains:
- `contacts`, `journal`, `diagnose`, `recon` — UNIVERSAL (shared infrastructure)
- `campaign`, `content`, `audience`, `impact` — often COUPLED across domains
- If one CLI group serves domains with different distribution channels → split candidate

### Step 4: Map Cross-Domain Dependencies
```bash
rg -l 'strategy-20260809-01[01]' ~/.hermes/systems/{pool}/  # which domains reference which strategies
rg -l 'da-builder' ~/.hermes/systems/{pool}/data/campaigns/pb-*/  # cross-domain pollution
```

### Step 5: Identify Split Topology
- **Full split:** Parent serves 2+ compass paths, both children need full lifecycle → archive parent
- **Extract-to-foundational:** Parent has shared infra + domain-specific assets → new foundational pool gets campaigns/audiences/content; parent keeps contacts/recon/inbox
- **Extract-to-plugin:** Domain-specific assets + context → new plugin pool consumes foundational pool

## Real-World Example: rel-intel Pre-Split Audit (Aug 16, 2026)

70 campaigns (56 da-* + 8 pb-* + 6 other) crammed into rel-intel's `outreach/data/campaigns/`. 14 audiences mixed B2B + social. 10 command groups serving 5 domains through identical interfaces. Verdict: extract-to-foundational (campaigns pool) + extract-to-plugin (dad-arch-campaigns).