#!/usr/bin/env bun
// Reed.co.uk official Job Seeker API (free key: https://www.reed.co.uk/developers/jobseeker).
// The key is read from REED_API_KEY (environment or the repo's gitignored .env).
import { parseFlags, checkFlags, str, int, fail, output, envVar } from "./helpers.js"
import { runSearch, runDetail } from "./commands/search.js"

const HELP = `reed-search: search Reed.co.uk via its official API

  bun run .agents/skills/reed-search/cli/src/cli.ts search -q "<keywords>" [--location Slough] [--distance 25]
      [--min-salary 25000] [--jobage 14] [--limit 20] [--graduate] [--full-time] [--permanent]
      [--details] [--format json|table|plain]
  bun run .agents/skills/reed-search/cli/src/cli.ts detail <jobId|reed url> [--format json|plain]

Needs REED_API_KEY (free from https://www.reed.co.uk/developers/jobseeker) in the environment or .env.`

async function main() {
  const flags = parseFlags(process.argv.slice(2), { q: "query", n: "limit", l: "location" })
  const cmd = flags._[0]
  if (!cmd || flags.help) {
    console.log(HELP)
    return
  }
  const key = await envVar("REED_API_KEY")
  if (!key) fail("REED_API_KEY is not set. Get a free key at https://www.reed.co.uk/developers/jobseeker and add REED_API_KEY=... to .env", "NO_KEY")
  const format = str(flags, "format") ?? "json"
  if (cmd === "search") {
    checkFlags(flags, ["query", "location", "distance", "min-salary", "jobage", "limit", "graduate", "full-time", "permanent", "details", "format"])
    const query = str(flags, "query")
    if (!query) fail("search needs -q/--query", "BAD_ARG")
    const results = await runSearch(
      {
        query,
        location: str(flags, "location"),
        distance: int(flags, "distance", 25, 0, 100),
        minSalary: str(flags, "min-salary") ? int(flags, "min-salary", 0, 0, 1_000_000) : undefined,
        limit: int(flags, "limit", 20, 1, 100),
        jobage: str(flags, "jobage") ? int(flags, "jobage", 14, 1, 365) : undefined,
        graduate: flags.graduate === true,
        fullTime: flags["full-time"] === true,
        permanent: flags.permanent === true,
        details: flags.details === true,
      },
      key,
    )
    output(results, format, { source: "reed", query })
    return
  }
  if (cmd === "detail") {
    checkFlags(flags, ["format"])
    const raw = flags._[1] ?? ""
    const id = raw.match(/(\d{6,})/)?.[1] ?? ""
    if (raw.startsWith("http") && !/^https:\/\/www\.reed\.co\.uk\//.test(raw)) fail("detail only accepts reed.co.uk URLs", "BAD_ID")
    const r = await runDetail(id, key)
    if (!r) fail(`no Reed job ${raw}`, "NOT_FOUND")
    output([r], format === "table" ? "json" : format, { source: "reed" })
    return
  }
  fail(`unknown command ${cmd}`, "BAD_ARG")
}

await main()
