---
name: uk-employer-careers
version: 1.0.0
description: >
  Search named employers' own career pages (dream employers and target companies) through the
  public job feeds of their applicant-tracking systems: Greenhouse, Lever, Ashby, Workable,
  SmartRecruiters and Workday. Catches roles that never reach job boards. Trigger phrases:
  check dream employers, any jobs at Konami/PlayStation/Ogilvy, company career pages.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/uk-employer-careers/cli/src/cli.ts *)
---

# UK Employers Search Skill

No API key needed. The employer list lives in `.agents/skills/uk-employer-careers/employers.json`:
each entry has a `name`, `careers` page and `tags`. Run `discover-all` once (and after adding
employers) to detect which ATS each careers page uses; entries with no public feed are noted and
left to Reed, Adzuna and web search.

```bash
bun run .agents/skills/uk-employer-careers/cli/src/cli.ts search [-q "marketing,social media"] [--location uk] [--tag creative] [--employer konami] [--jobage 30] [--format json|table|plain]
bun run .agents/skills/uk-employer-careers/cli/src/cli.ts check
bun run .agents/skills/uk-employer-careers/cli/src/cli.ts discover <careers page url>
bun run .agents/skills/uk-employer-careers/cli/src/cli.ts discover-all
```

Query syntax: comma-separated title words, any of which may match the job title (e.g. `-q "marketing,content,social media"`); no quotes, no OR. Leave `-q` off to list every UK role at the listed employers.

- `--location` comma list; `uk` (default) means any UK place or remote; or name towns, e.g. `london,slough,windsor,reading`
- `--tag` limits to employers with that tag (`creative`, `gaming`, `advertising`, `media`, `tech`, `finance`, `airline`, `travel`, `dream`)
- `--jobage <days>` drops older postings (undated postings are kept)
- Each result has `id`, `title`, `company`, `location`, `date`, `url`, `salary` and `description`
  (null for SmartRecruiters and Workday, whose feeds carry no body: /apply reads the advert url).
- `meta.failed` lists employers whose board could not be read, so a broken slug is visible.

These feeds are the employers' own public job listings, published for job sites to read.
Applications still go through the employer's form (see `/submit`).

## Why this is not named `*-search`

It reads employers' own applicant-tracking systems rather than a job board, so its postings are
the employer's official adverts. Keeping it outside the `*-search` portal set means `/apply`'s
source-host check still treats greenhouse.io, lever.co, workday and similar hosts as official
employer systems, and the posting fetcher reads those adverts directly.
