# /daily - Prepare Today's Applications Without Being Asked

You are running the unattended half of the "pick, then fill" workflow. In one pass: find new
jobs, rank them, fully prepare the best few, and leave a short digest the user can answer with
"yes to 1, 3". Nothing is submitted here. Submission only happens in `/submit`, after the user
picks.

This command is designed to run on a schedule with nobody watching, so it never stops to ask a
question. Where an interactive command would ask, take the conservative choice and note it in
the digest.

`$ARGUMENTS` may hold `--top <N>` (applications to prepare, default 3) and a focus area passed
through to `/scrape`.

## Step 1: Search

Run the `/scrape` workflow (the job-scraper skill) with the default priorities. Where it would
ask the user to pick a job, do not ask: continue to Step 2 with everything it stored as `new`.
Note any portal that failed or was skipped for a missing key.

## Step 2: Rank

Run the `/rank` workflow with `--limit 15 --top 5`. Rank's vetoes (location, language, expiry)
apply unchanged.

## Step 3: Prepare the top applications

For the top `N` shortlisted jobs whose score is at least 70 and that have no row in
`job_search_tracker.csv` yet, run the `/apply` workflow on each posting URL, in order, with
these unattended rules:

- Every step of `/apply` runs, including the reviewer (Step 3), the critic and design pass
  (Step 4b), the PDF checks (Step 5) and recording the application as `drafted` (Step 6b).
- Where `/apply` would pause to ask (an echo-trap "your call", the optional form-field offer),
  keep the conservative choice and list the question in the digest instead. Draft the
  application-form fields (`08-application-forms.md`) whenever the posting shows it needs them,
  so `/submit` has them ready.
- If Step 1 of `/apply` rates the fit below 60, stop that application, record nothing, and list
  the job in the digest under "Looked at, not prepared" with the reason.
- If a step fails (compile error that will not clear, posting unreachable), skip the job and
  report it. Never present a half-checked CV as ready.

## Step 4: Digest

Write `documents/daily/<YYYY-MM-DD>.md` (create the folder if needed) and print the same text:

```
# Applications ready - <weekday> <date>

Reply "yes to 1, 3" (or "skip 2") and I'll fill in those forms.

1. <Role> - <Company> (<location>, <salary or "salary not stated">)
   Fit <score>/100 · closes <deadline or "no deadline given"> · checked live <date>
   Why: <one line>
   Watch out: <gap or flag, or "nothing major">
   Files: <cv pdf>, <cover letter pdf>[, <visual edition pdf>]
   Apply at: <employer's own application url>

[repeat]

## Looked at, not prepared
- <Role> - <Company>: <reason>

## Needs you
- <any question deferred from /apply, any missing API key or connector>
```

Keep it short enough to read on a phone. When nothing cleared the bar, say so in one line and
list the top three near misses.

## Rules

- Never submit, email, or message anyone from this command.
- Never apply twice: the tracker check in Step 3 and `/rank`'s exclusion set prevent it.
- The candidate's truth rules in `01-candidate-profile.md` bind every document, unattended or not.
