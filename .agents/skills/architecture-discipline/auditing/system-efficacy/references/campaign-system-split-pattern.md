# Campaign System Split Pattern

## Context

The `relationship-intel` system pools **all campaign types** (B2B outreach, personal-brand social media, job pipelines, community growth, quant finance) into one architecture: 3 sub-systems (contacts/content/outreach) with a shared `campaigns` and `audiences` service.

This creates architectural coupling: social media content distribution for personal-brand surfaces shares the same infrastructure as B2B lead delivery to a architecture firm. As personal-brand surfaces grow into independent pools (per CP-AD-007), this coupling becomes a bottleneck.

## Detection Heuristic

A system-audit should flag when campaigns serve multiple **strategic surfaces** with different operational models:

- **B2B Relationship Outreach** (dad-arch, enterprise): WhatsApp/email, conversation rate, lead conversion — human-in-the-loop
- **Personal-Brand Social Media** (pb-*): postiz/xurl, follower growth, engagement rate — volume automation  
- **Talent Pipeline** (job, freelance): LinkedIn/recruiter outreach, interview conversion — funnel metrics
- **Community Growth** (LoO): Telegram, interactivity rate — community facilitation

If the same system manages >2 distinct operational models, a split is warranted.

## Split Pattern

### 1. Identify the separable domain
Campaigns that are **social-media distribution** (content + scheduling + engagement tracking) are distinct from **relationship outreach** (contact mapping + leverage analysis + human-in-the-loop delivery).

### 2. Extract to a new pool
Create a `social-media-campaigns/` pool with the 4-layer genome:
- **produce**: Content creation (delegates to personal-brand surface pools)
- **distribute**: Social media posting (postiz, xurl, social-media-agent)
- **measure**: Engagement tracking + follower growth + performance analytics
- **align**: Drift detection vs compass strategy expectations

### 3. Update shared systems
- **service-registry.md**: New pool offers `social-campaigns`, `social-audiences`, `social-content`; rel-intel removes `audiences` from its offerings
- **rel-intel _org.yaml**: Remove `audiences` from `services_offered`
- **Compass-graduate _org.yaml** (e.g., saas-engine, webdev): pool `campaigns` + `research` as symlinked sub-systems (AD-060 `arch sub pool`) instead of adding `social-campaigns`/`social-audiences` to `services_consumed`

### 4. Gate enforcement
NOTE (2026-08-18): the tech-surface gating model is DEPRECATED (strategy-009; the archived personal-brand-tech pool). Personal-brand surfaces now run auto-mode agentic cron with NO follower gates (operator directive 2026-08-17); separation is structural (PBP-RG-001/PBI-RG-001), not sequential-gated. The pattern that survives: brand surfaces pool `campaigns` + `research-engine` as symlinked sub-systems (AD-060 `arch sub pool`) instead of duplicating campaign infrastructure.

## Rel-Intel Audit Checklist (for system-audit Phase 2)

When auditing rel-intel (or any system with mixed campaign types):

1. **List all campaign IDs** — `ls sub-systems/outreach/data/campaigns/`
2. **Categorize by prefix** — `pb-*` (social), `da-*` (B2B), `job-*`/`freelance-*` (talent), `loo-*` (community)
3. **Map audiences per campaign** — `grep audience_segment campaigns/*/`
4. **Identify cross-cutting audiences** — audiences used by multiple campaign types
5. **Flag for split** — if `pb-*` campaigns > 0 and `da-*` campaigns > 0 and audiences serve both

## Related

- CP-AD-007: Personal-Brand 3-Pool Architecture (social-media-campaigns feeds personal-brand surface pools)
- CP-AD-010: Plugin Pattern (social-media-campaigns integrates as a service provider via compass-services symlinks)
- PBT-RG-001: Premature Activation Gate (social-media-campaigns inherits this gate)
