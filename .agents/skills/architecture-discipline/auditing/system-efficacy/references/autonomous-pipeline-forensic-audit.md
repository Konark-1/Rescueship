# Autonomous Pipeline Forensic Audit (flywheel efficacy)

Use this when auditing a **cron-driven autonomous pipeline** (e.g. `job-engine` /
`freelance-engine` flywheels, any multi-phase agent loop) where the user reports
"no progress" but the crons all report `ok`. Structural compliance passes — the
*effectiveness loop* is broken. This is a forensic pass over the pipeline's
ACTUAL STATE, not a CLI dry-run (which is what `system-efficacy` Phase 3 covers).

## Trigger
- "I haven't seen any leads/progress from the engine in weeks"
- "The crons run but nothing comes out"
- "Audit the freelance/job engine and tell me how it's operationalizing"

## The 9-Step Forensic Protocol

Work top-down: prove the system is alive, then bisect where value leaks.

### Step 1 — Structure + cron inventory
```bash
ls -la ~/.hermes/systems/{engine}/          # confirm pool exists, dated mtimes
hermes cron list 2>/dev/null | grep -iE "job-loop|freelance-loop"   # which phases active
hermes cron list 2>/dev/null | grep -A6 "loop-p1" | grep -iE "Name:|Last run:|Next run:"  # liveness
```
Note: `hermes cron list` can throw `BrokenPipeError` if piped to `head`/`tail` —
run WITHOUT the pipe (output is auto-truncated, full text saved to a file).

### Step 2 — Auth / identity health (BEFORE touching data)
```bash
gog auth list                                    # only canonical account must appear
gog gmail search "from:ishan in:anywhere" --max 1 -j   # proves Gmail reachable
```
If a non-canonical account is present → that is itself a critical finding (see
HI-RG-051 isolation pattern). All sends must originate from the canonical identity.

### Step 3 — Item state distribution (parse YAML frontmatter)
Items are `kb/items/*.md` with a `---\n...\n---` frontmatter block.
```bash
cd ~/.hermes/systems/{engine}/kb/items
for f in *.md; do
  awk '/^---/{c++} c==1 && /^status:/{print $2; exit}' "$f"
done | sort | uniq -c | sort -rn
```
**Red flag:** if `stale` dominates (>50%), the FSM is aging items out instead of
converting them. Count total: `ls *.md | wc -l`.

### Step 4 — Score-gate analysis (is the pipeline starved of work?)
```bash
for f in *.md; do
  awk '/^---/{c++} c==1 && /^match_score:/{print $2; exit}' "$f"
done | sort -n | awk '{a[NR]=$1} END{
  for(i=1;i<=NR;i++){if(a[i]>=85)h++;else if(a[i]>=70)m++;else if(a[i]>=50)l++;else z++}
  print ">=85 outreach-ready:",h; print "70-84 medium:",m;
  print "50-69 low:",l; print "<50 reject:",z; print "TOTAL:",NR}'
```
**Red flag:** if 95% score <50 (or <85), the scorer is miscalibrated or the LLM
scorer underperforms → downstream phases have nothing to act on. Cross-check the
run log: `"Pre-scored N items: HIGH=0, MEDIUM=1, LOW=N"` confirms starvation.

### Step 5 — Ghost detection (state vs. evidence)
The FSM may mark items `contacted`/`acquired`/`negotiating` by AGE or RULE, not
by real action. Verify against evidence fields:
```bash
contacted=0; ghost=0
for f in *.md; do
  st=$(awk '/^---/{c++} c==1 && /^status:/{print $2; exit}' "$f")
  if [ "$st" = "contacted" ]; then
    contacted=$((contacted+1))
    draft=$(awk '/^---/{c++} c==1 && /^outreach_draft:/{print $2; exit}' "$f")
    [ -z "$draft" ] || [ "$draft" = "''" ] && ghost=$((ghost+1))
  fi
done
echo "contacted=$contacted ghost(empty-draft)=$ghost"
```
Also check `contacted_date: null`, `email_status: unverified`, `phase: 2` on an
`acquired` item → it was never contacted. This is RG-class corruption (cf. JE-RG-001).

### Step 6 — Reply-detection leak check
```bash
cd ~/.hermes/systems/{engine}/kb/items
for f in *.md; do
  awk '/^---/{c++} c==1 && /reply_detected:/{print $2; exit}' "$f"
done | grep -iv "null\|false" | wc -l    # expect >0 if any real reply exists
```
Then compare against the ACTUAL inbox:
```bash
gog gmail search "to:ishan.parihar.official@gmail.com (subject:re OR from:recruiter OR from:hire)" after:2026-07-25 --max 50 -j
```
**Red flag:** `reply_detected=true` count is 0 while run logs ADMIT missed replies
("1 rejection reply missed by P5", "misrouted support reply"). The detector and
the log disagree → the detector is losing. The pipeline self-reports "0 replies"
while real human replies sit unflagged.

### Step 7 — Channel health (are outreach paths alive?)
```bash
grep -riE "linkedin.*(auth|FAILURE|down|cookies)|reddit.*down|cloudflare.*block" \
  ~/.hermes/systems/{engine}/kb/runs/2026-08-2*.md | head
```
**Red flag:** primary channels dark (LinkedIn auth down, Reddit down, Upwork
Cloudflare-blocked) → outreach collapses to email-only, and email needs verified
addresses many leads lack → `"send-failed: no verified email"`.

### Step 8 — Visibility gap (why the user sees nothing)
```bash
hermes cron list 2>/dev/null | grep -A3 "loop-p4-outreach" | grep -iE "Name:|Deliver:"
```
Check WHERE digests deliver. If they go to an unwatched Telegram **topic** (e.g.
`telegram:5297486612:69475`) or a self-addressed "Daily Summary" about unrelated
domains (trading, not jobs), the user receives ZERO signal despite real activity.
This is often THE reason "nothing is happening" from the user's seat.

### Step 9 — Conversion funnel (the bottom line)
```bash
cd ~/.hermes/systems/{engine}/kb/items
for f in *.md; do awk '/^---/{c++} c==1 && /^status:/{print $2; exit}' "$f"; done \
  | grep -c "closed-won"    # expect >=1 for a healthy engine
```
**Verdict signal:** `0 closed-won` across hundreds of items + dozens of outbound
emails = the funnel is dead past outreach. Real activity, zero outcome.

## Synthesis format (what to report)
A table mapping each dimension to Status + Evidence:
| Dimension | Status | Evidence |
| Cron execution | ✅/❌ | last run ok |
| Email identity | ✅/❌ | all sends from canonical |
| Lead scoring | ❌/⚠️ | 95% <50 |
| State machine | ❌ | ghost acquired/negotiating |
| Reply detection | ❌ | 0 detected, logs admit misses |
| Channel health | ❌ | LinkedIn/Reddit down |
| Human visibility | ❌ | digests to unwatched topic |
| Conversion | ❌ | 0 closed-won |

Then a prioritized fix plan (visibility first — without signal the user can't
trust or steer; then ghost purge; then scorer; then channels; then conversion).

## Pitfalls
- **`hermes cron list | head` breaks** with BrokenPipeError — never pipe it.
- **Frontmatter field names vary** — verify with `sed -n '1,12p' item.md`
  before assuming `score:` vs `match_score:`. This session used `match_score:`.
- **email_log dirs are often shared/duplicated** between engines — 493 "send"
  records were inbox-scan artifacts (LinkedIn alerts RECEIVED), NOT outbound
  proposals. Grep for `ishan.parihar.official@gmail.com` as SENDER to find real
  outbound, or query Gmail `from:ishan.parihar.official@gmail.com` directly.
- **Don't trust FSM status fields** — they lie by promotion rule. Always
  cross-check against `outreach_draft`, `contacted_date`, `email_status`.
