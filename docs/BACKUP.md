# Backup Strategy

Two independent layers. Neither alone is sufficient — use both.

## Layer 1: Supabase's own backups (primary safety net)

The database lives on Supabase (project `xmsgkshtgtdkdbmkhmep`). Supabase takes
automatic backups of the whole Postgres instance on paid plans:

- **Pro plan and above**: daily backups, retained 7 days, restorable from
  Project Settings → Database → Backups in the Supabase dashboard.
- **Point-in-Time Recovery (PITR)**: available as an add-on on Pro+, lets you
  restore to any point in the last N days, not just a daily snapshot.

**Action item**: confirm the project is on a plan with daily backups enabled
(the Free tier has none) and note that in the Supabase dashboard directly —
this is configuration, not something this repo's code can control.

This is the right first line of defense: zero maintenance, restores the
entire instance (schema + data + auth + storage) exactly as it was.

## Layer 2: Portable backup script (this repo)

`scripts/backup.js` — an owner-controlled, portable backup that doesn't
depend on Supabase's dashboard or plan tier. Useful for:
- Keeping your own copy of the data, independent of the hosting provider
- Migrating to a different Postgres host later
- Recovering a single table without restoring the entire instance

It connects via `DATABASE_URL`, dumps every application table's rows to a
JSON file, and copies the current `supabase/schema.sql` alongside — the pair
(`schema.sql` + per-table JSON) is a complete, restorable snapshot.

Why JSON instead of `pg_dump`: `pg_dump` requires the Postgres client tools
installed on whatever machine runs the backup, which isn't guaranteed (a
Windows PC, a CI runner, a Vercel cron job). The JSON approach only needs the
`pg` npm package, already a project dependency, so it runs anywhere Node runs.

### Running a backup

```bash
npm run backup
```

Writes to `backups/<timestamp>/` (gitignored — this is real customer data,
it must never be committed). Each run is a new timestamped folder; old ones
are never overwritten or auto-deleted, so apply your own retention (see below).

### Restoring from a backup

```bash
node scripts/restore.js backups/2026-07-26T02-33-49-264Z --force
```

**This is destructive** — it deletes every row in every table it has a JSON
file for, then reloads the backup's data, inside a single transaction (so a
failure rolls back cleanly rather than leaving the database half-restored).
It also resets each table's auto-increment sequence past the highest restored
id, so new rows created after a restore don't collide with restored ones.

The `--force` flag is required on purpose — running it without it prints a
warning and exits, so it can't be triggered by an accidental copy-paste.

Use this for disaster recovery onto a fresh database (run
`supabase/schema.sql` there first to recreate the tables/RLS policies, then
restore), or to reset a staging/demo environment back to a known state. It is
not meant for casual use against the live production database.

### Scheduling

Nothing in this repo runs the backup automatically — pick one:

- **Windows Task Scheduler** (if running on the restaurant's own PC): a daily
  task running `npm run backup` from the project directory.
- **A cron job** on any always-on server: `0 3 * * * cd /path/to/royal-chilli-pos && npm run backup`
- **A scheduled GitHub Action**, if the repo is on GitHub — set `DATABASE_URL`
  as a repository secret, run on a `schedule:` trigger, and upload the
  `backups/` folder as a workflow artifact (or push it to private cloud
  storage — never to the git history itself).

### Retention

Keep it simple: 7 daily + 4 weekly is a reasonable starting point for a single
restaurant's data volumes. Delete older folders manually or with a small
script — not automated here, since retention policy is a business decision
(how much history do you want to be able to go back to), not a technical one.

## What's NOT covered here

- **`.env.local` / API keys**: not a database backup concern — keep a copy of
  the Supabase project's keys somewhere safe (a password manager), since
  losing them means losing access to the project regardless of data backups.
- **Uploaded files / images** (menu photos, etc.), if any are stored outside
  Postgres (e.g. Supabase Storage): not dumped by `scripts/backup.js`, which
  only covers Postgres tables. Supabase Storage has its own backup coverage
  under Layer 1.
