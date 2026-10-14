---
name: decision-logging
description: "Write a new Architectural Decision (AD) via the arch CLI. Triggers on 'write AD', 'log a decision', 'architectural decision', 'document why'. Covers recon-first coverage check, arch new, body sections, supersession, and validation. arch is the ONLY entry point (AD-051/052) — never hand-craft AD files."
version: 2.1.0
category: devops
parent: architecture-discipline
---

# Decision Logging — Write a New Architectural Decision (AD)

## When to Use This Leaf

Descend from `architecture-discipline` when any of these apply:

- You made a design decision with trade-offs and it needs a permanent record
- Trigger phrases: "write AD", "log a decision", "architectural decision", "document why"
- A new pattern, standard, or constraint was established during build work
- The root skill's Post-Decision Checklist step 2 flagged "new AD needed"

Do **not** descend for regression documentation — that is `regression-logging`. Do not descend for system creation/lifecycle — those are `system-design` and `system-lifecycle`.

## Non-Negotiable: CLI-Only (AD-051, AD-052)

`arch` is **the ONLY entry point** for AD/RG lifecycle. Agents MUST NOT manually create or edit AD/RG markdown files. Never `cp` a template, never hand-assign numbers, never hand-edit the README index — every one of those is now done by arch. If the embedded guidance ever feels insufficient, run `arch guide ad` — the rubric lives inside the CLI itself.

> **Org rule:** an AD belongs to the department it governs. Decisions spanning departments (teams, channels, shared stores) name every affected pool and live in the primary owner's `core/decisions/`.

## Process (arch-first)

### 1. Recon — prove you reviewed existing coverage (REQUIRED)

```bash
arch recon topic=<your-topic>        # at-a-glance: existing ADs/RGs mentioning your topic
# or, if you know the pool:
arch recon pool=<pool-name>
```

Capture the `Recon ID:` printed at the end — every write below needs `--recon <id>`.

### 2. Apply the update-before-create rule (RG-010)

- Scan the recon output for overlapping scope.
- If an existing AD covers **>50%** of the new content, **update it in place** (add a dated amendment section) instead of creating a new one.
- Only create a new AD when the decision is genuinely novel or the existing AD covers <50%.

### 3. Create via arch

```bash
arch new --pool <pool> --type ad \
  --title "Human-Readable Title" \
  --desc "One-line machine-readable summary (≤200 chars)" \
  --recon <recon-id>
```

arch handles everything you used to do by hand: next-ID assignment (permanent, never reused), filename slug, frontmatter (ID/Title/Status/Date/Description/Deciders), and the template body.

**POOL-OWNERSHIP TEST (mandatory, before any arch new):**

> *The SUBJECT of a record owns it — not the session you happen to be in.*
> Ask: "which system does this decision/regression govern?"
> 1. Subject = architecture/hermes-infra itself → core architecture pool.
> 2. Subject = an existing system/sub-system → THAT pool (`--pool <name>`; prefix follows owner per AD-033).
> 3. Subject is a real system that has NO pool yet → **STOP. Scaffold the pool first**
>    (`arch pool create` / see system-design → "Initializing an existing external project"),
>    then write the record there. Creating its records in core architecture is a
>    discipline violation (see architecture RG-055).

**Sub-system ADs — target the sub-system directly (HI-AD-042, AD-033):** `arch new --pool` also resolves sub-systems, so a sub-pool's AD is created at its own `core/decisions/` without a move step:

```bash
arch new --pool <sub-system-name> --type ad --title "..." --desc "..." --recon <recon-id>
# e.g. --pool vps-operations, --pool browser-infrastructure, --pool freelancing
```

Sub-system ADs **inherit the owner pool's prefix and continue its number sequence** — `arch new --pool vps-operations` issues `HI-AD-NNN` (hermes-agent-infra namespace), never a separate prefix (AD-033 rule 3). They are CLI-visible everywhere: `arch list --pool <owner>`, `arch stats`, `arch gaps`, `arch related`, and `arch update` all see them (scan recursion, HI-AD-042) — the file path is `{owner}/sub-systems/{sub}/core/decisions/<ID>-<slug>.md`.

### 4. Fill the body — every section, no placeholders

arch writes the skeleton; you fill the substance in the created file:

- **Context**: What problem forced the decision. What options were considered. What constraints exist. This section is the *why*.
- **Decision**: What was decided. Be specific — exact configs, exact paths, exact parameters. This is the canonical reference.
  - **Architecture**: Structure, components, relationships (ASCII diagram or table)
  - **Principles**: Named, numbered list of design principles with rationale
  - **Configuration**: Exact YAML/config snippet that implements the decision
- **Consequences**: Positive impacts, negative impacts, trade-offs (what was sacrificed)
- **Related**: Cross-references to other ADs, RGs, skills, and memory entries

Quality bar: "Use X" is not a decision. Record *why*, *what alternatives were rejected*, and *exact configuration*.

### 5. Handle supersession (if replacing an existing AD)

```bash
arch supersede <old-ID> --by <new-ID> --reason "..." --recon <recon-id>
```

The old AD stays in place with `Status: Superseded` — never deleted, never renumbered. Cross-references are handled by arch.

### 6. Cross-reference related artifacts

In the new AD's `## Related` section, list AD/RG IDs (bidirectional — add this AD's ID to their Related sections too), skills that implement it, and memory entries (reference the AD ID, never paraphrase). If the decision affects system pools, ensure their `AGENTS.md` auto-zones (AD-050) reference this AD — for cross-system ADs, BOTH pools must reference it.

### 7. Validate + emit (REQUIRED — AD-029)

```bash
arch validate              # validation engine (AD-029, AD-059); must exit 0
arch emit --agents-all     # regenerate derived docs (AGENTS.md) — do NOT hand-edit
```

A workflow is not complete until `arch validate` returns exit 0.

## Verification

1. The file exists at `{pool}/core/decisions/<auto-assigned-ID>-<slug>.md` (or `{owner}/sub-systems/{sub}/core/decisions/<ID>-<slug>.md` for sub-system ADs)
2. All template sections filled — no `[bracketed placeholder]` or `TODO:` text remains
3. `arch validate` exits 0 (structural checks, cross-references resolve, no ID collision)
4. Related ADs/RGs have reciprocal links back to this AD
5. `arch emit --agents-all` regenerated derived docs

## Pitfalls

- **Creating a duplicate**: Always recon first (RG-010 exists because this was a recurring failure)
- **Vague decisions**: "Use X" is not a decision. Record *why*, *alternatives rejected*, *exact configuration*
- **Deleting superseded ADs**: Never. They stay with `Status: Superseded` so history is recoverable
- **Hand-numbering**: Never. arch assigns numbers permanently; hand-assigned numbers collide
- **Skipping recon**: `arch new` refuses to run without `--recon` (AD-052 enforcement)
- **Paraphrasing in memory**: Memory entries reference ADs by ID. They do not duplicate the decision text


**SUPERSEDE CASCADE (when superseding/moving a record):**

> Superseding is not done until its citations are done. Run \`arch related <ID>\`,
> update every Active record citing it to the successor, then mark the original
> Superseded. Validators treat Active-cites-Superseded as drift.
