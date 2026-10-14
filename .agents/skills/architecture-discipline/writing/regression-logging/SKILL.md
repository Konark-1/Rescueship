---
name: regression-logging
description: "Write or update a Regression Guard (RG) via the arch CLI. Use when an incident occurs or a failure mode is discovered, to prevent the same class of error from recurring. Triggers: 'write RG', 'log a regression', 'something broke', 'document failure', 'prevent recurrence', 'post-mortem', 'what went wrong'. Do NOT use for forward architecture design — use decision-logging instead."
version: 2.1.0
category: devops
parent: architecture-discipline
---

# Regression Logging — Write a Regression Guard (RG)

> Leaf of the architecture-discipline meta-skill.
> Root router: `~/.hermes/skills/architecture/architecture-discipline/SKILL.md`
> Storage: Global RGs at `~/.hermes/systems/architecture/core/regressions/`, system-specific RGs at `~/.hermes/systems/{system}/core/regressions/` (RGs are NEVER archived)

**POOL-OWNERSHIP TEST (mandatory, before any arch new):**

> *The SUBJECT owns the record — the system whose failure mode this is.*
> Subject = architecture/hermes-infra → core pool. Subject = existing system → THAT
> pool. Subject is a real system with no pool → scaffold it FIRST
> (system-design → "Initializing an EXISTING External Project"), then write there.
> Misfiling into core is a discipline violation (architecture RG-055).

## When to Use This Leaf

Write a new RG after any of these events:

- An outage, partial failure, or silent corruption occurred.
- A recurring error pattern surfaced again (read the existing RG first — extend it, do not duplicate).
- Debugging took longer than ~30 minutes and the cause was non-obvious.
- A fix was applied but no structural guard was added yet.

**Exact trigger phrases from operator input**: `write RG`, `log a regression`,
`something broke`, `document failure`, `prevent recurrence`, `we've hit this before`,
`why did that work yesterday`, `add a guard`.

If the operator is designing forward (new feature, new pool layout), that is an
Architectural Decision (AD), not a Regression Guard. Route to `decision-logging`.

## Non-Negotiable: CLI-Only (AD-051, AD-052)

`arch` is **the ONLY entry point** for AD/RG lifecycle. Agents MUST NOT manually create or edit AD/RG markdown files. Never `cp` a template, never hand-assign numbers, never hand-edit the README index. If you need the rubric, run `arch guide rg` — it lives inside the CLI itself.

> **Org rule:** an RG's owning pool = the department where the regression manifested. Cross-dept regressions cite every affected pool in Related. Org-model violations (orphan employees, roster drift) log to `autonomous-executor` per AXE-RG-012/013.

## Process (arch-first)

1. **Confirm the trigger.** Is this a post-mortem of an incident or a newly
   understood failure mode? If yes, continue. If it is forward design, route to `decision-logging`.

2. **Recon — prove you reviewed existing coverage (REQUIRED).**
   ```bash
   arch recon topic=<symptom-keyword>      # or: arch recon pool=<pool>
   ```
   Capture the `Recon ID:` — every write needs `--recon <id>`. Search the results for
   the same symptom pattern. If a match exists, **extend that RG** (add a new
   `### Incident N` block under What Happened) via `arch update` — each symptom
   class gets ONE RG with multiple incidents (RG-010). Never create a duplicate.

3. **Create via arch.**
   ```bash
   arch new --pool <pool> --type rg \
     --title "Symptom Title (2-5 words)" \
     --desc "One-line summary (≤200 chars)" \
     --severity High|Medium|Low|Critical \
     --recon <recon-id>
   ```
   arch handles numbering (permanent, never reused), filename, and frontmatter.
   The kebab title should describe the failure mode, e.g. `rg-013-odbc-driver-mismatch`.

   **Sub-system RGs — target the sub-system directly (HI-AD-042, AD-033):** `arch new --pool`
   also resolves sub-systems, so a sub-pool's RG is created at its own `core/regressions/`
   with no move step:
   ```bash
   arch new --pool <sub-system-name> --type rg --title "..." --desc "..." --severity High --recon <recon-id>
   ```
   Sub-system RGs **inherit the owner pool's prefix and continue its number sequence**
   (e.g. `--pool browser-infrastructure` issues `HI-RG-NNN` in the hermes-agent-infra namespace —
   never a separate prefix, AD-033 rule 3). They are CLI-visible: `arch list/stats/gaps/related/update`
   all see them (scan recursion, HI-AD-042); the file path is `{owner}/sub-systems/{sub}/core/regressions/<ID>-<slug>.md`.
   `arch update <ID>` works on them in place — no manual file moves.

4. **Fill the body — every section, no placeholders.**
   - **Symptom** — write it as **what the operator would type into a search bar** when debugging. Use the actual error strings, log fragments, or observable behavior — not your own diagnosis. "Service crashes on startup with exit code 137 and no stack trace" beats "memory exhaustion in the worker pool".
   - **Root Cause** — trace back to an **architectural assumption or operational gap**. Not "what happened" (that goes in What Happened). WHY it was allowed to happen. If the root cause is only "we forgot to run X", the RG is incomplete — identify the missing check that WOULD make forgetting safe.
   - **What Happened** — one `### Incident N` block per real occurrence: dates, counts, file names, exact error message, fix applied.
   - **Detection** — diagnostic signals: things to grep, metrics, log lines. Add a "How to distinguish this from X" line tying it to neighboring RGs.
   - **Prevention** — **every measure must include exact commands or config blocks.** "Add a guard on the publish path" is unacceptable; write the guard. Prefer a `### Permanent Guard` subsection for structural guards that make the error class impossible.
   - **Related** — AD IDs the RG validates/refutes, affected system pools, sibling RGs with the same root-cause family, skills used during diagnosis.

5. **Update the index — NOT by hand.** `arch emit --agents` regenerates the AGENTS.md auto-zone index from frontmatter (AD-050). Hand-editing the index is a violation — it gets overwritten.

6. **Validate (REQUIRED — AD-029).**
   ```bash
   arch validate
   ```
   Exit 0 required. Confirm frontmatter passes structural checks, cross-references resolve, no ID collision.

## Quality Bar

A RG is acceptable when:

- [ ] Symptom contains the literal error string or observable behavior.
- [ ] Root Cause names the architectural assumption or operational gap.
- [ ] Prevention contains copy-pasteable commands or config, not prose.
- [ ] Related links at least one AD or system pool.
- [ ] Created via `arch new` — number sequential and permanent.
- [ ] `arch validate` exits 0.

## Pitfalls

- **Duplicate RGs.** Always recon before creating. Symptom reoccurrences extend the same RG, they do not spawn a new one.
- **Vague prevention.** "We should be more careful" is not prevention. If no concrete command or config exists, the incident is not yet resolved.
- **Forward design creep.** RGs document what broke and why. New architecture goes in an AD, even if the RG motivates the AD.
- **Hand-editing.** Never `cp` templates or edit the README index manually — that is exactly what AD-051/052 exist to prevent.
- **Renumbering.** Never renumber, even after deletions. Gaps in the sequence indicate historical incidents that were promoted or merged — record that in the Related section, do not collapse the numbering.


**SUPERSEDE CASCADE (when superseding/moving a record):**

> Superseding is not done until its citations are done. Run \`arch related <ID>\`,
> update every Active record citing it to the successor, then mark the original
> Superseded. Validators treat Active-cites-Superseded as drift.
