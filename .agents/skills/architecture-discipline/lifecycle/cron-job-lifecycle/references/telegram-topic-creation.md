# Telegram Topic Creation and Thread Delivery Routing

## The Complete Procedure (Verified 2026-07-30)

When a cron job needs a dedicated Telegram thread, follow these steps IN ORDER.

### Step 1: Create the Forum Topic

Use the helper script at `~/.hermes/scripts/create_telegram_topic.py`:

```bash
python3 ~/.hermes/scripts/create_telegram_topic.py "Topic Name"
# Output: thread_id=72861 verified=true
```

The script reads the bot token from Hermes config, calls `createForumTopic`, and sends a test message to verify. It outputs the numeric `thread_id` on success.

**Optional icon colors**: `7322096` (red), `16766590` (amber), `9367192` (green), etc.

**Prerequisite**: The user must have Topics enabled in their Telegram chat with the bot (BotFather, Bot Settings, Threads Settings, Enable Topics). Chat `5297486612` is a supergroup with `is_forum: true` and Topics is already enabled.

### Step 2: Create or Update the Cron Job with the Thread ID

Use the `cronjob` tool with `deliver` set to `telegram:CHAT_ID:THREAD_ID`:

```
cronjob(action="create", name="Job Name", schedule="0 9 * * *",
        prompt="...", skills=["skill-name"],
        deliver="telegram:5297486612:THREAD_ID")
```

Or update an existing job directly in `~/.hermes/cron/jobs.json`:

```python
import json, os
jobs_path = os.path.expanduser("~/.hermes/cron/jobs.json")
with open(jobs_path) as f:
    data = json.load(f)
for job in data["jobs"]:
    if job["id"] == "JOB_ID":
        job["deliver"] = "telegram:5297486612:THREAD_ID"
with open(jobs_path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
```

### Step 3: Run the Job and Verify

```
cronjob(action="run", job_id="JOB_ID")
```

Check: `last_status` should be `ok`, `last_delivery_error` should be `null`. Ask the user to confirm receipt in the new topic.

### Step 4: Update the Thread Assignments Table

Add the new thread to the Known Thread Assignments table below AND in AD-005 (`~/.hermes/architecture/decisions/AD-005-telegram-thread-routing.md`).

---

## Critical Rules

### Rule 1: ALWAYS put thread_id in the deliver field

The ONLY reliable mechanism for Telegram thread routing is `deliver="telegram:CHAT_ID:THREAD_ID"`. The `origin.thread_id` field is preserved but has NO effect on Telegram delivery (scheduler only inherits `origin.thread_id` for Slack, not Telegram).

### Rule 2: NEVER rely on origin.thread_id auto-inheritance

The scheduler's `_resolve_single_delivery_target()` in `cron/scheduler.py` only inherits `origin.thread_id` for Slack:

```python
if (thread_id is None and platform_key == "slack" and origin and ...):
    thread_id = origin.get("thread_id")  # ONLY Slack!
```

For Telegram, this fallback does NOT exist. Always use explicit `CHAT_ID:THREAD_ID` in `deliver`.

### Rule 3: Use numeric thread_id from createForumTopic

The `_TELEGRAM_TOPIC_TARGET_RE` regex accepts both numeric (`72730`) and named (`Forge`) thread IDs. However, numeric thread IDs returned by `createForumTopic` are the proven, reliable format. Named topics require the gateway's `ensure_dm_topic()` path which has additional dependencies and may require a gateway restart.

### Rule 4: Read the bot token from config, not from environment variables

The token at runtime in the terminal tool may be empty or masked. The helper script reads it directly from the Hermes config file. Do NOT try to pass the token as a command-line argument or environment variable.

### Rule 5: Bot must be admin with topic management permissions

The bot must have `can_manage_topics=true` in the chat. Chat `5297486612` is already configured this way.

### Rule 6: Forum topics require Topics enabled on the chat

Chat `5297486612` is a supergroup with `is_forum: true` (confirmed via `getChat`). Topics is already enabled. If creating topics for a new chat, enable Topics first via BotFather.

---

## Known Thread Assignments (Updated 2026-07-30)

| Thread ID | Topic Name | Purpose | deliver |
|-----------|-----------|---------|--------|
| 64203 | Q'uo Community Pulse | Law of One community ops | `telegram:5297486612:64203` |
| 65858 | Career Market Mapping | Job market research | `telegram:5297486612:65858` |
| 65866 | Platform Intelligence Research | Platform research | `telegram:5297486612:65866` |
| 66046 | Holonic News Intelligence | News KB pipeline | `telegram:5297486612:66046` |
| 66259 | VPS Health Watchdog | Infrastructure monitoring | `telegram:5297486612:66259` |
| 69475 | Job loop | Career pipeline | `telegram:5297486612:69475` |
| 69476 | Freelance loop | Freelance pipeline | `telegram:5297486612:69476` |
| 69477 | Review | Cross-system review | `telegram:5297486612:69477` |
| 69700 | General DM | Architecture discussions | `telegram:5297486612:69700` |
| 68142-68147 | Revenue-intel (6 topics) | Revenue pipeline phases | `telegram:5297486612:68142` |
| 68249-68251 | Revenue-intel (3 topics) | KB sanitize, outreach, review | `telegram:5297486612:68249` |
| 72730 | Forge Task System | Task management cron + reminders | `telegram:5297486612:72730` |

---

## Pitfalls

### Pitfall 1: `hermes send` reports success but message never arrives

The `hermes send` CLI reports success based on the HTTP status code, not actual delivery confirmation from the user. If the thread_id doesn't exist as a real Telegram forum topic, the message silently disappears. Always verify with the user.

### Pitfall 2: Named thread_id requires gateway restart

Named (non-integer) thread IDs in the `deliver` field require the regex patch in `send_message_tool.py` to be loaded by the running gateway. Numeric thread IDs from `createForumTopic` work without any patches. Always prefer numeric IDs.

### Pitfall 3: Terminal tool blocks gateway restart commands

The terminal tool blocks commands containing `restart`, `stop`, `kill` with `hermes-gateway` to prevent SIGTERM loops. To restart the gateway:
- Ask the user to run `/restart` in Telegram
- Or ask the user to run `systemctl --user restart hermes-gateway.service` from a separate shell

### Pitfall 4: Cron job `deliver` field parsing

The `deliver` field format is `platform:chat_id:thread_id`. The parser splits on `:` and the thread_id must match `_TELEGRAM_TOPIC_TARGET_RE` (numeric or named). If the thread_id is not recognized, the entire string after the first `:` is treated as chat_id and thread_id is lost.

---

## Related Files

- `scripts/create_telegram_topic.py` (in `~/.hermes/scripts/`) — Helper script to create topics
- `AD-005` (`~/.hermes/architecture/decisions/AD-005-telegram-thread-routing.md`) — Architecture decision
- `devops/cron-job-thread-management` skill — Specialized skill for thread persistence bugs and platform-specific notes
- `cron/scheduler.py` — `_resolve_single_delivery_target()` function
- `tools/send_message_tool.py` — `_TELEGRAM_TOPIC_TARGET_RE` regex parser
- `plugins/platforms/telegram/adapter.py` — `create_handoff_thread()` and `ensure_dm_topic()`
