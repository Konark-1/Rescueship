# Foundational System Patterns & the Foundation Category Registry

> Loaded by architecture-discipline leaves when scaffolding foundational or
> compass-graduate system pools.
>
> **Categorical principle:** architecture documents describe foundational
> systems by CATEGORY (capability class), never by hardcoded system names.
> Concrete system names live ONLY in the registry table below — as the
> architecture expands, new systems settle into a category and the registry is
> the single place to update.

## The Foundation Category Taxonomy

A foundational system provides shared infrastructure consumed by multiple
domain pools but serves no end-user purpose on its own. Every foundation
belongs to exactly one category (its capability class). A graduate's genome
extends foundations **by category**; concrete systems resolve via the registry.

| Category | Genome role | Provides | Examples of future members |
|----------|-------------|----------|----------------------------|
| `content-campaigns` | L1 produce + L2 operate | campaign lifecycle, content pipeline, audience segmentation, distribution | any new campaign/content engine |
| `research-intelligence` | L1 produce | research KBs, market/platform intelligence, news ingestion | any new research/KB engine |
| `website-development` | L2 operate | site registry, scaffolding, quality gates, deployment | any new web-presence engine |
| `strategy` | L4 align | strategy artifacts, launch gates, alignment cycles | any new strategy/alignment organ |
| `identity` | context | candidate/brand profile, contact identity | any new profile/identity store |
| `relationship-intelligence` | L2 operate | contacts, audiences, outreach automation | any new relationship engine |
| `task-execution` | cross-cutting | task engine, grounding snapshots, agent coordination | any new executor/orchestrator |
| `infrastructure` | cross-cutting | infra utilities, browser/CLI, comms, cron management | any new platform-service organ |
| `financial-intelligence` | cross-cutting | financial state, forecasting, ledgers, runway | any new finance engine |

## Canonical Foundation Registry (concrete names — the ONLY place they live)

> AUTO-GENERATED (AD-061): derived from each pool's own `_org.yaml` category
> declaration by `arch emit --all` / `arch emit --registry`. Scaffolding a new
> foundational system (`arch pool create --tier foundational --category {cat}`)
> re-registers it automatically — never edit this table by hand.

<!-- AUTO-GENERATED (AD-061) — Canonical Foundation Registry

| Category | Current system(s) |
|----------|-------------------|
| `content-campaigns` | campaigns |
| `research-intelligence` | kosmos, research-engine |
| `website-development` | saas-engine, webdev |
| `strategy` | compass, law-of-one-community |
| `identity` | identity, personal-brand-integrating, personal-brand-polarizing |
| `relationship-intelligence` | design-aesthetics, relationship-intel |
| `task-execution` | autonomous-executor, freelance-engine, job-engine |
| `infrastructure` | architecture, archive, hermes-agent-infra, logbook, technical-authority |
| `financial-intelligence` | quant-finance |

<!-- END AUTO-GENERATED (AD-061) -->

## Pattern: Compass-Graduate Pools Foundations by Category (AD-060)

A compass-graduate is the strategic base for its function. Its `sub-systems/`
tree is the **unified genome**: native organs it owns (P6 — own lifecycle) +
pooled foundation categories it extends (P5 — exact-name symlinks).

```
systems/{graduate}/sub-systems/
├── {native-organ}/              # OWNED — own lifecycle, data, CLI (arch sub create)
├── {content-campaigns} → ../../{resolved}     # POOLED — resolve via registry
├── {research-intelligence} → ../../{resolved}
└── {website-development} → ../../{resolved}
```

Rules (AD-060 P1–P6):
- **P1** The graduate's `sub-systems/` tree IS its operational genome — native
  organs + pooled foundation categories inside the pool, no external spelunking.
- **P2** The foundation owns data + lifecycle; the graduate extends by pooling.
  Never copy foundation data into the graduate (RG-028).
- **P3** One mechanism per relationship: pooled as a sub-system → not in
  `services_consumed`; only called → `services_consumed`. Never both.
- **P4** Relative symlinks only (survive clone/restore).
- **P5** Exact-name rule: the pooled symlink name MUST equal the resolved
  foundation's name — import is mechanical: `sub-systems/{foundation} → ../../{foundation}`.
- **P6** Own natively, extend by pooling: wherever the graduate owns a
  lifecycle, scaffold a native organ; pooling-only graduates are under-genomed.

Create with the CLI only:
```bash
arch sub pool {foundation} --pool {graduate} --source ../../{foundation} --recon $RECON
arch sub pool --pool {graduate} --sync --recon $RECON     # auto-import whole genome
arch sub create {native-organ} --pool {graduate} --recon $RECON   # native genome organ
```

A foundation may be pooled by many graduates (one-way dependency; the
foundation never lists graduates). When a foundation is renamed, all pooled
symlinks dangle — re-pool each consumer (system-lifecycle RENAME, AD-060).

## Pattern: Foundations Push Complete Sub-Sub-Systems (depth contract, AD-061)

A foundation is pooled by graduates as a symlinked sub-system; the graduate
surfaces the foundation's WHOLE genome as its sub-sub-genome. So a foundation
must be forged so its organs ARE perfect graduate sub-systems — at every depth:

1. **Every organ at every depth is a complete pool** — `_org.yaml` + `AGENTS.md`
   (router, AD-050), created via `arch sub create` (genome-capable scaffold:
   `core/` with parent prefixes, `scripts/`, `data/`, `references/`,
   `cron-jobs/`, `sub-systems/`; complex organs add `--dirs` custom structures).
2. **Every exposed directory is declared** with a format rule (RG-027) — the
   pooled symlink's routing map IS the foundation's `_org.yaml`, so undeclared
   dirs (`lib/`, `mcp/`, `audit/`, `ontology/`, …) are invisible to graduate
   agents. The linter WARNs on undeclared dirs and rule-less declarations.
3. **Organs nest fully** — sub-sub-systems are themselves complete pools
   (e.g. personal-os → logbook → activity/financial/nutrition/…), so a graduate
   pooling the foundation inherits the whole depth for free.
4. **Relative refs only** — no machine paths; everything survives the symlink
   (foundation-deployability audit criteria).
5. **`arch emit --registry` records the depth** — native organs, nested
   sub-sub-systems, pooled symlinks all appear in `architecture-registry.yaml`,
   so the graduate's inherited surface is machine-verifiable.

Foundation-genome audit (2026-08-17) verified all 11 foundations: 0 incomplete
organs at any depth; 32 undeclared dirs found by the new linter check and
fixed; `lib/`, `cron-jobs/`, `skills/` added to the pool scaffold so future
foundations declare the full surface from birth.

## Pattern: Sub-Systems That Share Parent Data

When a sub-system writes to the PARENT pool's data directory, it must NOT
declare its own data/ in _org.yaml. Doing so causes
`system-integrity: required directory missing: data/` errors.

Fix: omit data/ from the sub-system's directories: block entirely, or set
required: false. Add a rules: section documenting where data actually lives.

## Pattern: Per-Consumer Cron (No System-Level Cron)

A foundational system that provides services to N consumers must NOT deploy
its own system-level cron jobs for service delivery. Each consumer pool deploys
its own cron that calls the foundational system CLI/engine functions.

Consumer cron calls the foundation's dispatch CLI (`campaigns execute dispatch
--surface <surface> --format json`) to compute the filtered queue, then routes
to its own distribution CLIs.

## Pattern: Prefix Registration is DECLARATIVE (AD-061)

There is NO central prefix registry to maintain. Each pool's AD/RG prefix is
declared in its OWN `_org.yaml` (`directories.core.sub_dirs.decisions.prefix`
/ `.regressions.prefix`). `core.get_prefixes()` derives the registry by
scanning those declarations; `arch pool create --prefix {PREFIX}` writes the
declaration for you (default: slug form). Nothing in code or docs is edited.

After any `_org.yaml` change, run `arch emit --all` to regenerate
`systems/architecture/data/architecture-registry.yaml` + the Foundation
Category Registry table + the root `systems/AGENTS.md` registry — the linter
WARNs if the registry is stale (AD-061).
