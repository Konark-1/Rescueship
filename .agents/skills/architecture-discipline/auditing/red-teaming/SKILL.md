---
name: red-teaming
description: "Adversarially attack the architecture itself: try to bypass its gates, make guidance surfaces contradict each other, feed misplacement attempts through every write path, and probe for silent-drift classes. Use when asked to 'red-team the system', 'try to break the governance', before trusting a new gate, after any major architecture change, and as the third phase of deep audits. Assumes record-integrity already passed — this leaf attacks BEHAVIOR, not bookkeeping."
---

# Architecture Red-Teaming

You are the adversary. The architecture claims: content cannot be misplaced,
guidance cannot contradict enforcement, gates cannot silently rot. Prove it wrong
before reality does. Every successful bypass = an RG; every near-miss = a
hardening note.

## Attack surface inventory (enumerate first)

1. **Write paths**: every CLI command that creates/modifies files (`kosmos create`,
   `entity ensure`, `capture add`, `arch new`, morph verbs, import commands).
2. **Guidance surfaces**: AGENTS.md files, `where` oracles, orient output, skill
   leaves, schema descriptions — anything an agent reads before acting.
3. **Gates**: lint rules, smoke manifests, formlessness checks, realm guards.
4. **Derived stores**: indexes/edges caches — corruption or staleness vectors.

## The five drills

### D1 — Misplacement battery
For each write path, attempt the classic violations with VALID-looking inputs:
research type into DIM/ENT · entity evidence into FRA · Self-cycle types outside
Self · path traversal in slugs (`../`) · mkdir-on-demand of phantom modules.
**Pass** = refused at command level OR caught by lint at commit level. Anything
that lands on disk clean is a finding.

### D2 — Guidance-contradiction sweep
Pick a doctrine (realm placement, canonical docs, ownership test). Read EVERY
surface that mentions it. One surface saying Dimensions while another says
Frameworks = the RG-055 class recurring. Mechanize partially:

```bash
grep -rn "Dimensions/" <cli+scripts+docs> | grep -v "test\|archive"
```

Judge each hit: live instruction vs historical reference.

### D3 — Gate-rot drill
Fire-test every declared gate with a synthetic violation (rogue file, foreign
type, broken frontmatter). A gate that cannot fail is decoration. Check smoke.yaml
manifests reference commands that still exist and exit non-zero on broken input.

### D4 — Silent-drift probes
Corrupt a derived store copy in a scratch checkout (never the live vault) and
verify detection fires. Delete a tombstone row and confirm dangling-ref ERRORs
reappear. Rename a pool dir and count how many records go stale unnoticed.

### D5 — Agent-simulation
Replay real incident prompts from past sessions ("add this capture", "write a
note about X") against current surfaces. Follow the FIRST instruction each
surface gives. Where two surfaces disagree, the disagreement IS the finding.

## Disposition

| Result | Action |
|---|---|
| Bypass confirmed | RG via arch CLI (subject = owning pool), fix same session |
| Near-miss | Hardening note in the gate's governing AD |
| Held | Log in report — the pass-fail ledger is the deliverable |

Report format mirrors record-integrity's: findings table + dispositions +
post-fix re-run proving each hole closed.

## Related

- auditing/record-integrity (runs first — bookkeeping before behavior)
- refining/self-healing (turns confirmed holes into standing gates)
- RG-053/RG-054/RG-055 (the canon of found holes)
