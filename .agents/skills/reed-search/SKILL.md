---
name: reed-search
version: 1.0.0
description: >
  Search live UK job adverts on Reed.co.uk through Reed's official Job Seeker API, or
  look up one Reed advert. Covers all sectors (marketing, media, sales, admin, logistics,
  public sector agencies). Trigger phrases: Reed jobs, UK jobs near Slough, jobs in London,
  "find <role> jobs in the UK".
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/reed-search/cli/src/cli.ts *)
---

# Reed Search Skill

Official, terms-compliant access to Reed.co.uk, one of the largest UK job boards.
Needs a **free API key**: sign in at https://www.reed.co.uk/developers/jobseeker, copy the
key, and add `REED_API_KEY=<key>` to the repo's `.env` (gitignored). Without it the CLI exits
with `NO_KEY` and /scrape falls back to WebSearch for Reed.

## Commands

```bash
bun run .agents/skills/reed-search/cli/src/cli.ts search -q "<keywords>" [flags]
bun run .agents/skills/reed-search/cli/src/cli.ts detail <jobId|reed.co.uk url> [--format json|plain]
```

Query syntax: plain keywords, matched anywhere in the advert; no quotes, no OR. One term per call.

Flags:
- `-q, --query <text>` keywords (required)
- `--location <place or postcode>` e.g. `Slough`, `SL1`, `London`
- `--distance <miles>` radius around `--location` (default 25)
- `--jobage <days>` client-side recency filter on the posting date (Reed has no server-side recency flag)
- `--min-salary <n>`, `--graduate`, `--full-time`, `--permanent`
- `--limit <n>` 1 to 100 (default 20)
- `--details` fetch each advert's full description (one extra request per result; leave off for discovery)
- `--format json|table|plain` (default json)

Search JSON is `{ "meta": {...}, "results": [...] }`; every result carries `id`, `title`,
`company`, `location`, `date` (YYYY-MM-DD), `url`, `salary` and `description` (a snippet unless
`--details`). Errors go to stderr as `{ "error", "code" }` with exit code 1.

## Examples

```bash
bun run .agents/skills/reed-search/cli/src/cli.ts search -q "social media executive" --location SL1 --distance 25 --jobage 14 --format table
bun run .agents/skills/reed-search/cli/src/cli.ts search -q "graduate sales development" --location London --graduate
bun run .agents/skills/reed-search/cli/src/cli.ts detail 51234567 --format plain
```
