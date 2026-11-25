# /daily - Find and Rank Today's Jobs Without Being Asked

You are running the unattended half of the "pick, then apply" workflow. In one pass: find new
jobs, rank them, and leave a short digest of **at least 5** good matches that the user can answer
with "yes to 1, 3". By default nothing is drafted here: the full CV and cover letter are written
only for jobs the user approves (see `/submit`), so each daily run stays light on Claude usage.
Nothing is ever submitted from this command.

This command is designed to run on a schedule with nobody watching, so it never stops to ask a
question. Where an interactive command would ask, take the conservative choice and note it in
the digest.

`$ARGUMENTS` may hold:
- `--show <N>`: jobs to list in the digest (default 8, never fewer than 5 when that many pass)
- `--prepare <N>`: also fully prepare the top N applications now (default 0; the old behaviour)
- a focus area, passed through to `/scrape`

## Step 1: Search

Run the `/scrape` workflow (the job-scraper skill) with the default priorities. Where it would
ask the user to pick a job, do not ask: continue to Step 2 with everything it stored as `new`.
Note any portal that failed or was skipped for a missing key.

## Step 2: Rank

Run the `/rank` workflow with `--limit 15 --top <show>`. Rank's vetoes (location, language,
expiry) apply unchanged. If fewer than 5 jobs score 60 or more, run `/scrape broad` once and
rank again before writing the digest.

## Step 3: Check each listed job is live

For every job going into the digest, confirm the advert is still open on the employer's own page
(or the board's page when the employer has none) and record the date checked. Drop expired ones
and list them under "Closed since found". Board copies often stay up after the real advert closes.

## Step 4 (only with `--prepare N`): Prepare the top applications

For the top `N` jobs scoring at least 70 with no row in `job_search_tracker.csv`, run the
`/apply` workflow unattended: every step runs (reviewer, critic and design pass, PDF checks,
tracker row `drafted`); deferred questions go in the digest; a fit below 60 stops that job.

## Step 5: Digest

Write `documents/daily/<YYYY-MM-DD>.md` (create the folder if needed) and print the same text:

```
# Jobs for you - <weekday> <date>

Reply "yes to 1, 3" and I'll write the CV and cover letter for those, then fill in the forms.

1. <Role> - <Company> (<location>, <salary or "salary not stated">)
   Fit <score>/100 · closes <deadline or "no deadline given"> · live, checked <date>
   Why: <one line>
   Watch out: <gap or flag, or "nothing major">
   Link: <employer's own advert url>

[repeat, best first, at least 5 when 5 pass]

## Near misses
- <Role> - <Company>: <score> - <reason>

## Closed since found
- <Role> - <Company>

## Needs you
- <any missing API key, connector or failed source>
```

Keep it short enough to read on a phone. If fewer than 5 jobs pass even after the broad search,
say so plainly and fill the list with the best near misses, marked as such.

## Rules

- Never submit, email, or message anyone from this command.
- Never list a job already in `job_search_tracker.csv`.
- The candidate's truth rules in `01-candidate-profile.md` bind every document, unattended or not.
