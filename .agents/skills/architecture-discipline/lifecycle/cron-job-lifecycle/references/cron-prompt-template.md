# Cron Job .md File Template

**Canonical template:** [`architecture/references/cron-prompt-template.md`](../../../../references/cron-prompt-template.md)

This leaf does not vendor a copy — a diverged duplicate caused drift (org-audit 2026-08-23 F4). Always use the canonical file. It includes the mandatory **Org Identity (AXE-AD-011)** section: every cron job is an employee of its pool-department; frontmatter carries `employee: emp-<cron_id>` (stamped via `axe org sync --write-frontmatter`).

Workflow:
1. Create the cron job in the live scheduler (`~/.hermes/cron/jobs.json`).
2. Copy the canonical template to `{pool}/cron-jobs/{job-name}.md`, fill fields from jobs.json.
3. Run `axe org sync --write-frontmatter` to stamp employee identity.
4. `axe org check` must stay clean (AXE-RG-012/013).
