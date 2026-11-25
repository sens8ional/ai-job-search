---
name: adzuna-search
version: 1.0.0
description: >
  Search UK job adverts aggregated by Adzuna (many UK boards, recruiters and company sites in
  one place) through Adzuna's official API. All sectors. Trigger phrases: Adzuna, UK job search,
  jobs near Slough, jobs in London, overseas jobs in another country (--country).
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/adzuna-search/cli/src/cli.ts *)
---

# Adzuna Search Skill

Adzuna aggregates adverts from hundreds of UK sources, so it is the widest single net.
Needs a **free developer account** at https://developer.adzuna.com/: add `ADZUNA_APP_ID=` and
`ADZUNA_APP_KEY=` to the repo's `.env` (gitignored). Without them the CLI exits `NO_KEY`.

```bash
bun run .agents/skills/adzuna-search/cli/src/cli.ts search -q "<keywords>" [flags]
```

Query syntax: plain keywords (all words must appear); no quotes, no OR. One term per call.

Flags:
- `-q, --query <text>` (required)
- `--location <place>` and `--distance <miles>` (default 25; converted to km for the API)
- `--jobage <days>` server-side recency filter
- `--min-salary <n>`, `--full-time`, `--permanent`
- `--country <code>` default `gb`; also `au`, `ca`, `nz`, `us`, `sg`, `de`, `nl`, etc. for overseas searches
- `--limit <n>` 1 to 50 (default 20)
- `--format json|table|plain`

Each result has `id`, `title`, `company`, `location`, `date`, `url` (Adzuna redirect to the
original advert), `salary` (marked "(Adzuna estimate)" when Adzuna predicted it) and a short
`description` snippet. /apply reads the full advert from the url.

```bash
bun run .agents/skills/adzuna-search/cli/src/cli.ts search -q "media planner" --location London --jobage 14 --format table
bun run .agents/skills/adzuna-search/cli/src/cli.ts search -q "photographer" --country au --format table
```
