---
name: writing
description: "Router for governance-record creation. Two leaves sharing the ownership test and supersede cascade: decision-logging (ADs) and regression-logging (RGs). Route here when creating or amending AD/RG records."
---

# Writing Governance Records

| Task | Leaf |
|---|---|
| Record a forward design decision | `decision-logging/SKILL.md` |
| Record a failure/incident guard | `regression-logging/SKILL.md` |

Both leaves enforce, before any `arch new`:
1. **POOL-OWNERSHIP TEST** — the SUBJECT owns the record; missing pool ⇒ scaffold first.
2. **UPDATE-BEFORE-CREATE** — recon existing coverage; >50% overlap = amend, not duplicate.
3. **SUPERSEDE CASCADE** — superseding includes updating every Active citation.
