# UK Job Engine: plain-English guide

This fork adds a UK job search and a "pick, then fill" application flow on top of AI Job Search.
You choose which applications to send. Everything else is prepared for you.

## What happens each day

1. **`/daily`** searches UK job sources, ranks what it finds against your profile, and fully
   prepares the best few: a tailored CV, a cover letter, answers to form questions, all checked
   by two reviewers. It writes a short digest to `documents/daily/<date>.md`.
2. **You reply** with something like "yes to 1 and 3".
3. **`/submit 1, 3`** opens each employer's application form in the browser, fills it in,
   uploads your files and stops at the Submit button so you can glance over it. It submits only
   when you say so.

Nothing is ever sent without your say-so, and LinkedIn and Indeed "easy apply" logins are never
automated (their rules forbid it and accounts get banned).

## Where jobs come from

| Source | How | Setup |
|---|---|---|
| Reed.co.uk | Official API (`.agents/skills/reed-search`) | Free key: https://www.reed.co.uk/developers/jobseeker, then add `REED_API_KEY=...` to `.env` |
| Adzuna (pulls from many UK boards) | Official API (`.agents/skills/adzuna-search`) | Free keys: https://developer.adzuna.com/, then add `ADZUNA_APP_ID=...` and `ADZUNA_APP_KEY=...` to `.env` |
| Indeed | Claude's Indeed connector | Turn on the Indeed connector in Claude's connector settings |
| Employers' own career pages | `.agents/skills/uk-employer-careers` | Edit `employers.json`, then run `bun run .agents/skills/uk-employer-careers/cli/src/cli.ts discover-all` |
| UK tech roles | `freehire-search` with `--region uk` | Nothing |
| GOV.UK Find a Job, Civil Service Jobs, NHS Jobs, Totaljobs, CV-Library, Guardian Jobs, graduate and creative boards | Web search fallback | Nothing |
| LinkedIn | Web search results only (no login, no direct scraping, no Easy Apply); applies on the employer's own site | Nothing |

`.env` is never committed to git.

## The critic and designer

After the usual reviewer, a second agent (`.claude/agents/application-critic.md`):

- reads the CV like a recruiter's 7-second scan, an ATS parser, and a busy hiring manager;
- scores each document out of 100 and sends anything under 75 back for one more rewrite;
- themes the CV and cover letter in the employer's colours (`tools/brand_palette.py` finds them
  on the employer's site and darkens pale colours until text is readable);
- for creative roles, also builds a **visual edition in Canva** in the employer's design style.
  The plain ATS edition is always what goes into the application form; the visual edition is
  for emails, portfolios and "other documents" upload fields.

## Keeping your details private

This GitHub repository is public. Your filled-in profile lives only on your own computer
(`Claude Builds/Job Engine`). Run `python tools/install_privacy_guard.py` once in that folder:
it blocks any `git push` that would carry your profile.

## Running it on a schedule

`/daily` never stops to ask questions, so it can run unattended. Schedule it from the Claude
desktop app (a daily scheduled task that opens this folder and runs `/daily`), or ask Claude in
your project to set it up.
