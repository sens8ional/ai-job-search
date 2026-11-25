#!/usr/bin/env bun
// Adzuna official API: aggregates many UK job boards and company sites.
// Free developer keys: https://developer.adzuna.com/ (ADZUNA_APP_ID and ADZUNA_APP_KEY in env or .env).
import { parseFlags, checkFlags, str, int, fail, output, envVar } from "./helpers.js"
import { runSearch } from "./commands/search.js"

const HELP = `adzuna-search: search Adzuna (UK job aggregator) via its official API

  bun run .agents/skills/adzuna-search/cli/src/cli.ts search -q "<keywords>" [--location "Slough"] [--distance 25]
      [--jobage 14] [--min-salary 25000] [--limit 20] [--country gb] [--full-time] [--permanent]
      [--format json|table|plain]

--distance is in miles. Needs ADZUNA_APP_ID and ADZUNA_APP_KEY (free from https://developer.adzuna.com/).`

async function main() {
  const flags = parseFlags(process.argv.slice(2), { q: "query", n: "limit", l: "location" })
  const cmd = flags._[0]
  if (!cmd || flags.help) {
    console.log(HELP)
    return
  }
  if (cmd !== "search") fail(`unknown command ${cmd}`, "BAD_ARG")
  checkFlags(flags, ["query", "location", "distance", "jobage", "min-salary", "limit", "country", "full-time", "permanent", "format"])
  const appId = await envVar("ADZUNA_APP_ID")
  const appKey = await envVar("ADZUNA_APP_KEY")
  if (!appId || !appKey) fail("ADZUNA_APP_ID / ADZUNA_APP_KEY not set. Register free at https://developer.adzuna.com/ and add both to .env", "NO_KEY")
  const query = str(flags, "query")
  if (!query) fail("search needs -q/--query", "BAD_ARG")
  const country = (str(flags, "country") ?? "gb").toLowerCase()
  if (!/^[a-z]{2}$/.test(country)) fail("--country must be a two-letter code such as gb", "BAD_ARG")
  const results = await runSearch(
    {
      query,
      location: str(flags, "location"),
      distanceMiles: int(flags, "distance", 25, 0, 200),
      jobage: str(flags, "jobage") ? int(flags, "jobage", 14, 1, 365) : undefined,
      minSalary: str(flags, "min-salary") ? int(flags, "min-salary", 0, 0, 1_000_000) : undefined,
      limit: int(flags, "limit", 20, 1, 50),
      country,
      fullTime: flags["full-time"] === true,
      permanent: flags.permanent === true,
    },
    appId,
    appKey,
  )
  output(results, str(flags, "format") ?? "json", { source: "adzuna", query })
}

await main()
