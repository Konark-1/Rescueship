# Integrity Checks Reference

Complete list of integrity checks performed by `system-integrity` (AD-029).

## Structural Checks (AD-022, AD-023)

| Check | Severity | Description |
|-------|----------|-------------|
| `_org.yaml` exists | WARN | Pool directory has a `_org.yaml` declaration |
| Required files present | ERROR | README.md exists (system or sub-system, AD-042) |
| Directory structure | ERROR | Required dirs from `_org.yaml.directories` exist |
| File extensions match | ERROR | Files match the `suffix:` rule for their directory |
| File prefixes match | ERROR | Files match the `prefix:` rule (e.g., `AD-`, `RG-`) |
| Frontmatter required fields | ERROR | AD/RG files have all required frontmatter fields |
| AD/RG cross-references | WARN | Every AD-NNN/RG-NNN reference resolves to a real file |
| Forbidden patterns | ERROR | `__pycache__/`, `*.pyc` etc. are absent |
| Frozen dir violations | WARN | New files in deprecated directories are flagged |
| Naming conventions | WARN | Pool/sub-system names are kebab-case |
| AD-023: decisions/ in core/ | ERROR | `decisions/` is inside `core/`, not at pool root |
| AD-023: regressions/ in core/ | ERROR | `regressions/` is inside `core/`, not at pool root |
| AD-023: README.md in sub-systems/ | ERROR | Sub-system README.md is inside `sub-systems/`, not at pool root (AD-042) |

## Cron Integrity Checks (AD-029)

| Check | Severity | Description |
|-------|----------|-------------|
| Frontmatter present | ERROR | `.md` file has YAML frontmatter (between `---` markers) |
| Required frontmatter fields | ERROR | `cron_id`, `name`, `schedule`, `system`, `status` are present |
| `cron_id` in jobs.json | ERROR | `status: active` requires `cron_id` to exist in `~/.hermes/cron/jobs.json` |
| Status valid | ERROR | `status` is one of `active`, `paused`, `superseded` |
| Schedule looks like cron | WARN | `schedule` has 5-6 whitespace-separated fields |
| `system` field matches pool | ERROR | `system` field equals the pool directory name (AD-030 isolation) |
| Skills exist | ERROR | Every skill in `skills[]` exists in `~/.hermes/skills/` (AD-029) |
| Schedule matches jobs.json | ERROR | `.md` `schedule` equals `jobs.json` `schedule_display` (drift detection) |
| Prompt hash matches jobs.json | ERROR | SHA-256 of `.md` Prompt section equals SHA-256 of `jobs.json` prompt |

## Workflow DAG Checks (AD-030)

| Check | Severity | Description |
|-------|----------|-------------|
| YAML parse | ERROR | `_workflows/*.yaml` is parseable YAML |
| Workflows dict | ERROR | `workflows:` is a dict at top level |
| Workflow dict | ERROR | Each workflow is a dict |
| Nodes list | ERROR | `nodes` is a list |
| Node file reference | ERROR | Every node's `file:` path exists in the pool |
| Depends_on resolution | ERROR | Every `depends_on` reference resolves to a real node |
| Reads_from_kb path | WARN | Every `reads_from_kb` path exists |
| No cycles | ERROR | The DAG has no cycles (DFS detection) |

## Exit Codes

- `0` — all checks passed (only WARN or PASS findings)
- `1` — at least one ERROR finding (drift detected, fix required)

## Output Format

TOON (TOON-structured Object Notation):

```
ERROR  {pool-or-component}  {description}
WARN   {pool-or-component}  {description}
PASS   {pool-or-component}  {description}

Summary: X errors, Y warnings, Z passes
```

The summary line is the final line. Use it for at-a-glance status.
