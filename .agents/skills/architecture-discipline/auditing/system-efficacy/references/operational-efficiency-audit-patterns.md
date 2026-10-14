# Operational Efficiency Audit Patterns

When auditing a cron-driven autonomous agent system (like AXE), focus on these patterns to identify inefficiency and waste.

## 1. Phase-2 Implementation Status Audit

When checking if a planned feature is implemented, look beyond "does the function exist?" — verify it's **wired into the execution path**.

### Pattern: Check Three Levels

1. **Surface existence**: Does the CLI command exist? Does the function exist in the library?
   ```bash
   grep -n "func_name\|cli_command" scripts/*.py bin/*
   ```

2. **Wiring check**: Is the function actually called from the main execution loop?
   ```bash
   grep -n "func_name()" scripts/*.py
   ```

3. **Runtime verification**: Does the function actually do what it claims? Run a test.
   ```bash
   python3 -c "from axe_lib import fn; print(fn())"
   ```

### Example: Notice Board Threading

- `thread_id` parameter in `NoticeBoard.post()` — ✅ exists
- `--thread-to` flag in `axe notice post` — ✅ exists  
- `NoticeBoard.thread()` method — ✅ exists
- `axe notice reply` command — ❌ NOT in CLI
- Actually used in tick loop — ❌ NOT wired in

**Verdict**: Partially implemented but operationally dead.

## 2. Cron Execution Analysis

Use `executions.db` (SQLite) to audit cron job performance:

```bash
python3 -c "
import sqlite3, os
from datetime import datetime
db = os.path.expanduser('~/.hermes/cron/executions.db')
conn = sqlite3.connect(db)
c = conn.cursor()
c.execute('SELECT started_at, finished_at, status, error FROM executions WHERE job_id = ? ORDER BY started_at DESC LIMIT 20')
for r in c.fetchall():
    s = datetime.fromisoformat(r[0]) if r[0] else None
    f = datetime.fromisoformat(r[1]) if r[1] else None
    dur = int((f - s).total_seconds()) if s and f else '?'
    print(f'  dur={dur}s status={r[2]} err={r[3][:50] if r[3] else \"\"}')
c.execute('SELECT status, COUNT(*) FROM executions WHERE job_id = ? GROUP BY status', (job_id,))
print(f'  Distribution: {dict(c.fetchall())}')
"
```

### Key Metrics to Check

- **Duration**: Average and max. If >600s, the tick may be blocking on agent recovery.
- **Failure rate**: `failed` executions with "Fire claim ownership lost" = race condition.
- **Idle ratio**: Count `IDLE` notices vs `spawn` notices in the notice board to measure useful work ratio.
  ```bash
  # Count from notice board
  python3 -c "
  import json
  with open('~/.hermes/systems/autonomous-executor/data/notice-board.jsonl') as f:
      notices = [json.loads(l) for l in f if l.strip()]
  spawns = sum(1 for n in notices if 'spawn' in n.get('tags', []))
  idles = sum(1 for n in notices if 'IDLE' in n.get('message', ''))
  print(f'Spawn: {spawns}, Idle: {idles}, Ratio: {spawns/(spawns+idles)*100:.0f}%')
  "
  ```

### Lock File Hygiene

Check for stale `.fire-*.lock` files:
```bash
ls -la ~/.hermes/cron/.fire-*.lock 2>/dev/null | wc -l
# Should be ~0 between executions; lock files older than 1 hour are stale
```

### State File Accumulation

Check for accumulated state files:
```bash
ls ~/.hermes/systems/autonomous-executor/data/state/ | wc -l
# Clean state: ~3-5 files (one per active/recent agent)
# Bloated: 20+ files indicates GC not working
```

## 3. Token Waste Identification

### Dead Code Detection

1. **Unused functions**: `grep -c "function_name(" scripts/*.py` — if 0, the function is never called
2. **Legacy versions**: Look for `# v2`, `# v3` comments indicating superseded implementations
3. **Test scaffolding**: Functions that exist only for testing and were never removed

### Redundant Prompt Instructions

When auditing agent prompts (found in `axe-tick.py`'s `build_agent_prompt()`), check:

1. **Self-registration**: Does the prompt tell the agent to register itself when the tick already does this?
2. **Environment setup**: Does the prompt include PATH/export commands that are already in the environment?
3. **Multi-tasking**: Does the prompt instruct a one-shot agent to "check for more tasks" when the next tick handles that?
4. **Redundant closing**: "Execute now." / "Go." — the agent executes by default; these are noise.

### Missing Data Ingestion

Check if generated diagnostic data is actually consumed:

```bash
# Does the recovery function read the usage file?
grep -n "usage" axe-tick.py | grep -v "usage_path\|usage-file\|usage-file"
# If nothing, the --usage-file output is being discarded
```

## 4. Execution Flow Efficiency

### Non-blocking vs Blocking Spawn

The tick should ALWAYS use non-blocking spawn (`nohup` + `setsid`) and exit immediately:

```bash
# Check the spawn function
grep -n "nohup.*setsid\|_spawn_nonblocking\|subprocess.Popen.*start_new_session" scripts/axe-tick.py
# Should find _spawn_nonblocking being called from execute()
```

If the spawn is blocking (Popen + poll loop), the tick itself runs for 20 minutes instead of exiting in seconds.

### Recovery Phase Analysis

Each tick should:
1. GC stale state (agents, locks, state files) — ~50ms
2. Check for running agent (os.kill(pid, 0)) — ~1ms
3. If running: exit immediately (next tick will recover)
4. If finished: parse results, post notices, clean up — ~100-500ms

If a tick takes >600s, it's likely stuck in a blocking operation (old v2 pattern) or the agent is still running but the PID check failed.

## 5. Operational Patterns to Flag

| Pattern | Flag | Action |
|---------|------|--------|
| Function defined but never called | Dead code | Remove |
| CLI command in help but not in argparse | Broken feature | Fix or remove |
| Prompt tells agent to do something tick already does | Redundancy | Remove from prompt |
| `hermes -z --usage-file` but no usage reader | Wasted data | Add usage ingestion |
| State file without outcome/duration | Missing metrics | Add to recovery |
| Lock files > 1h old | Stale locks | Sweep at tick start |
| State files > 1h old with `status: running` | Crashed agent | Mark crashed, recover |
