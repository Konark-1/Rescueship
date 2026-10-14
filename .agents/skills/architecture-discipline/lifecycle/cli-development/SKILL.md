---
name: cli-development
description: "Design, build, manage, audit, and retire CLI tools for hermes system pools. Use when creating a new system CLI, upgrading an existing CLI, adding sub-commands, ensuring AXI compliance, registering a CLI in the unified registry, auditing CLI health, consolidating or deprecating redundant CLIs, or investigating which CLI owns a capability. Triggers: 'create CLI', 'build CLI', 'add command', 'CLI design', 'AXI compliance', 'CLI registry', 'bin entry', 'cli sync', 'cli development', 'CLI audit', 'redundant CLI', 'consolidate CLIs', 'deprecate CLI', 'retire CLI'."
version: 2.0.0
---

# CLI Development — Building Agent-Facing CLIs

Use this leaf when a system pool needs a CLI surface — the primary interface through which autonomous agents and cron jobs interact with the system. Every hermes system with operational intent ships a CLI in `bin/`.

## When to Use

Triggers: "create CLI", "build CLI", "add command", "CLI design", "AXI compliance", "register CLI".

**Do not use this leaf when:**
- Just running an existing CLI → use the CLI directly
- Writing ADs/RGs → use `../decision-logging/` or `../regression-logging/`
- Scaffolding the system pool itself → use `../system-design/`

## Pre-flight

1. **Load AXI skill** (`skill_view(name='axi')`) — the 10 design principles are the quality bar. Every CLI MUST comply with Tier 1 (Principles 1, 4, 5, 6, 8, 10) minimum.
2. **Read existing CLIs** for patterns — `arch`, `campaigns`, `research`, `forge`, `axe` are reference implementations.
3. **Check AD-056** — the CLI registry mandate. Your CLI will be registered via `arch cli sync`, not manually.
4. **Check AD-032** — the `--reason` flag mandate. All mutation commands require `--reason`.
5. **Check AD-008** — the AXI design standard. This leaf operationalizes it.

## The Hermes CLI Pattern

Every hermes system CLI follows this structure:

```
systems/{pool}/
├── bin/{cli-name}           # Entry point (thin dispatcher)
├── core/                    # Business logic modules
│   ├── module_a.py
│   ├── module_b.py
│   └── __init__.py
├── sub-systems/{name}/core/ # Sub-system specific logic
│   └── module_c.py
└── smoke.yaml               # Smoke tests for the CLI
```

### Entry Point Template

```python
#!/usr/bin/env python3
"""cli-name — One-line description of what this CLI does.

Subcommands:
  cli-name entity action    Description of what this does
  cli-name entity action    Description of what this does
  cli-name status           Show current state (no-args default)
"""
import argparse
import json
import os
import sys
from pathlib import Path

# Bootstrap paths
POOL_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(POOL_ROOT / "core"))

# Import core modules
from module_a import function_a, function_b
from module_b import function_c

def now_iso():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def cmd_entity_list(args):
    """List entities in TOON format (AXI Principle 1)."""
    items = function_a()
    # AXI Principle 1: TOON output
    print(f"items[{len(items)}]{{id,name,status}}:")
    for item in items:
        print(f"  {item['id']},{item['name']},{item['status']}")
    # AXI Principle 4: pre-computed aggregate
    print(f"count: {len(items)}")
    # AXI Principle 9: contextual disclosure
    if items:
        print(f"help[1]: Run `cli-name entity get <id>` for details")

def cmd_entity_get(args):
    """Get a single entity by ID."""
    item = function_b(args.id)
    if not item:
        # AXI Principle 5: definitive empty state
        print(f"error: entity {args.id} not found")
        print(f"help: cli-name entity list to see available entities")
        sys.exit(1)
    # AXI Principle 2: minimal default schema + --fields
    fields = args.fields.split(",") if args.fields else ["id", "name", "status"]
    for f in fields:
        if f in item:
            val = str(item[f])
            # AXI Principle 3: content truncation
            if len(val) > 500:
                print(f"{f}: {val[:500]}... (truncated, {len(val)} chars total)")
            else:
                print(f"{f}: {val}")

def cmd_entity_create(args):
    """Create a new entity."""
    # AXI Principle 6: structured errors
    if not args.name:
        print("error: --name is required")
        print("help: cli-name entity create --name \"...\" [--description \"...\"]")
        sys.exit(2)
    # AD-032: --reason required for mutations
    if not args.reason:
        print("error: --reason is required for mutations (AD-032)")
        sys.exit(2)
    result = function_c(name=args.name, reason=args.reason)
    # AXI Principle 5: definitive success state
    print(f"created: {result['id']},{result['name']}")
    print(f"help[1]: Run `cli-name entity get {result['id']}` to view")

def main():
    parser = argparse.ArgumentParser(
        prog="cli-name",
        description="One-line description of the CLI",
    )
    sub = parser.add_subparsers(dest="subcommand", required=True)

    # Entity subcommand group
    entity_p = sub.add_parser("entity", help="Manage entities")
    entity_sub = entity_p.add_subparsers(dest="action", required=True)

    # entity list
    entity_sub.add_parser("list", help="List all entities")

    # entity get
    get_p = entity_sub.add_parser("get", help="Get entity by ID")
    get_p.add_argument("id", help="Entity ID")
    get_p.add_argument("--fields", help="Comma-separated fields to show")

    # entity create
    create_p = entity_sub.add_parser("create", help="Create a new entity")
    create_p.add_argument("--name", required=True, help="Entity name")
    create_p.add_argument("--description", help="Entity description")
    create_p.add_argument("--reason", required=True, help="Reason for creation (AD-032)")

    # Status (no-args default — AXI Principle 8)
    sub.add_parser("status", help="Show current state")

    args = parser.parse_args()

    # Dispatch
    if args.subcommand == "entity":
        if args.action == "list":
            cmd_entity_list(args)
        elif args.action == "get":
            cmd_entity_get(args)
        elif args.action == "create":
            cmd_entity_create(args)
    elif args.subcommand == "status":
        cmd_entity_list(args)  # Content first (AXI Principle 8)

if __name__ == "__main__":
    main()
```

## AXI Compliance Checklist

Every CLI MUST pass these checks before deployment:

| Principle | Requirement | Verification |
|-----------|-------------|--------------|
| **1. Token-efficient** | TOON output on stdout (not JSON) | `cli status` outputs TOON format |
| **2. Minimal schemas** | Default 3-4 fields per list item | `cli entity list` shows id,name,status |
| **3. Truncation** | Large fields truncated with size hint | Long text shows `(truncated, N chars)` |
| **4. Aggregates** | Counts inline in list output | `count: N` appears in list output |
| **5. Empty states** | Explicit zero-result output | `items[0]: count: 0` on empty |
| **6. Structured errors** | Errors on stdout, exit codes 0/1/2 | `error: ...` format, no raw tracebacks |
| **7. Ambient context** | Session hooks (optional) | If applicable, hook registered |
| **8. Content first** | No-args shows live data, not help | `cli` with no args shows status |
| **9. Contextual hints** | Next-step suggestions after output | `help[1]: Run 'cli ...'` lines |
| **10. Consistent help** | `--help` on every subcommand | `cli entity --help` works |

## Smoke Manifest

Every CLI MUST have a `smoke.yaml` at the pool root:

```yaml
version: 1
checks:
  - name: "CLI parses"
    cmd: "python3 -m py_compile ~/.hermes/systems/{pool}/bin/{cli}"
    timeout: 30
    critical: true
    reason: "the CLI is the system's operational surface"
  - name: "CLI --help works"
    cmd: "python3 ~/.hermes/systems/{pool}/bin/{cli} --help >/dev/null 2>&1"
    timeout: 30
    critical: true
    reason: "agents need --help for discovery"
```

## Registry Integration (AD-056)

After building, register the CLI:

1. Add entry to `systems/hermes-agent-infra/cli-version-registry.yaml` under `system_clis:`
2. Run `arch cli sync` (creates ~/bin symlink + smoke-tests)
3. Run `arch cli check` — must exit 0 before you call the CLI done

**Never** hand-edit `~/bin` links. The registry is the only integration path.

## CLI Lifecycle Governance (RG-048 / HI-RG-030)

Every CLI must satisfy four properties at all times. Before adding one, and on any audit, check all four:

| Property | Check | Failure example |
|----------|-------|-----------------|
| **Declared** | entry in the unified registry, owning pool named | media utilities loose in `~/bin` pre-audit |
| **Functional** | runs at its declared path | `lm-studio` → uninstalled target, exit 127 |
| **Relevant** | ≥1 runtime consumer (cron job, skill, or pool doc references it) | `axe-feedback` symlink: zero references |
| **Owned** | exactly ONE pool owns it; targets resolve to living pools | old forge path → purged strategic-engine |

**The family rule (one capability = one family = one core):**
Multiple bin entries over ONE core are correct (the AD-059 thin-entry pattern) — `axe`, `axe-tick` share axe.py/axe-tick.py cores. Multiple entries that are separate implementations of the same capability are redundancy: fold them into subcommands of the family's primary CLI. When in doubt, ask: does each entry have its own consumers? If removing an entry breaks nothing, it is not a thin entry — it is dead weight.

**Deprecation workflow:**
1. Confirm zero runtime consumers (grep `cron/jobs.json` + cron `.md` prompts + skills corpus).
2. Remove bin link via registry edit + `arch cli sync` (never bare `rm` of links).
3. Move the entry to the registry's `removed:` section with reason — history is evidence.
4. If the underlying script has value but no owner, migrate it into the consuming pool's `scripts/` first (RG-013), then re-declare.

**Audit methodology** (quarterly, or when the surface feels fragmented): inventory registry sections + raw `~/bin`, probe `--help` on every link, count references across jobs.json + skills corpus, resolve ownership per link. Full worked example: `../../data/audit-reports/cli-infrastructure-audit-2026-08-23.md`.

## Org Model Note (AXE-AD-011)

A pool's CLI is its department's service interface — employees (cron agents) and cross-department consumers call it; they never touch the pool's data files directly. Design every command as if another department's employee will run it: TOON output, structured errors, no interactive state assumptions.

## Sub-Command Design Rules

### Mutations vs Queries
- **Queries** (list, get, status, report): no `--reason` required, read-only
- **Mutations** (create, update, delete, transition, dispatch): `--reason` REQUIRED (AD-032)

### Error Handling
- Exit 0: success (including no-ops like "already in desired state")
- Exit 1: error (entity not found, validation failed)
- Exit 2: usage error (unknown flag, missing required arg)

### Output Channels
- **stdout**: all structured output (data, errors, suggestions)
- **stderr**: debug logging only (agents don't read this)
- **Never mix** progress messages into stdout

### Idempotent Mutations
Don't error when desired state already exists. If agent closes something already closed, acknowledge with exit 0.

## Reference Implementations

| CLI | Pattern | Notes |
|-----|---------|-------|
| `arch` | Thin entry → `lib/cli.py` | Most complex; good for multi-module patterns |
| `campaigns` | Entry → `core/` modules + sub-system core | Good for sub-system delegation |
| `research` | Entry → sub-system script dispatch | Simplest; good for thin wrappers |
| `forge` | Entry → core modules | Good for kanban/task patterns |
| `loo` | AXI Tier 3 compliant | Reference for full AXI compliance |

## Common Pitfalls

1. **JSON output** — agents waste tokens parsing it. Use TOON format (AXI Principle 1).
2. **No --reason on mutations** — violates AD-032. Agents can't trace why changes were made.
3. **Help text on no-args** — violates AXI Principle 8. Show live data instead.
4. **Interactive prompts** — agents can't respond to them. Fail immediately with clear error.
5. **Missing exit codes** — agents need to know success vs failure programmatically.
6. **Hand-editing ~/bin** — violates AD-056. Use `arch cli sync` instead.
7. **No smoke.yaml** — violates AXE-AD-010. System is operationally invisible.
8. **Raw tracebacks on stdout** — agents try to interpret them as data. Catch and format.
9. **Sibling CLIs instead of subcommands** — a second bin entry implementing what a `--mode` or subcommand of the existing CLI could do (RG-048). Fold before you add; the axe family is the sanctioned exception pattern.
10. **Deleting a CLI without registry bookkeeping** — bare `rm ~/bin/foo` leaves a phantom registry entry and breaks consumers silently. Use the deprecation workflow above.

## Advanced Patterns (for complex CLIs like arch, axe, compass)

### Multi-Module Architecture
For CLIs with 500+ lines or complex logic, separate into modules:

```
bin/{cli}                    # Thin entry point (< 30 lines)
  lib/cli.py              # Command surface (argparse + dispatch)
  lib/engine.py           # Business logic engine
  lib/core.py             # Shared utilities, data structures
```

### Guide Command (embedded rubric)
Every CLI with >5 subcommands should have a guide command that surfaces the embedded management rubric.
This is how agents learn the CLI without reading source code.

### Recon/Write Pattern (for mutation CLIs)
1. cli recon <scope> - returns a recon token + context summary
2. cli create --recon <token> - requires the token from step 1
3. This prevents blind mutations and ensures agents have context before writing.

### Validate/Emit Commands
- cli validate - wraps arch validate --pool <pool> for self-validation
- cli emit - wraps arch emit --agents <pool> for AGENTS.md regeneration

### Sub-System Management
- cli sub list - list all sub-systems with status
- cli sub status <name> - detailed status of a specific sub-system
- cli sub create <name> - scaffold a new sub-system (delegates to arch sub create)

### Comparison: Simple vs Advanced CLIs

| Feature | Simple | Advanced (arch, axe) |
|---------|--------|---------------------|
| Lines | <200 | 500+ |
| Modules | single file | lib/ separation |
| Guide | no | embedded rubric |
| Validate | no | self-validation |
| Sub mgmt | no | sub list/status/create |
| Recon | no | recon-first writes |

## References

- AXI skill: `~/.hermes/skills/axi/SKILL.md`
- AD-008 (AXI Design Standard): `arch show AD-008`
- AD-032 (--reason mandate): `arch show AD-032`
- AD-056 (CLI Registry): `arch show AD-056`
- AD-059 (arch = unified surface): `arch show AD-059`
- conventions.md: `../references/conventions.md` §The Organizational Model
- RG-048 (redundancy/relevance): `arch show RG-048`
- HI-RG-030 (registry integrity): `arch show HI-RG-030`
- Root router: `../SKILL.md`
