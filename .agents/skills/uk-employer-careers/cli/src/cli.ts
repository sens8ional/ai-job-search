#!/usr/bin/env bun
// Searches the career pages of named employers through the public job feeds their
// applicant-tracking systems publish (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Workday).
import { parseFlags, checkFlags, str, int, fail, output, daysOld, type JobResult } from "./helpers.js"
import { fetchBoard, matchesLocation, matchesQuery, toResult, detectAts, type Employer } from "./commands/search.js"

const DIR = import.meta.dir
const DEFAULT_LIST = `${DIR}/../../employers.json`

const HELP = `uk-employer-careers: search named employers' own career pages

  bun run .agents/skills/uk-employer-careers/cli/src/cli.ts search [-q "marketing,social media"] [--location "uk,london,slough"]
      [--tag creative] [--employer konami] [--jobage 30] [--limit 50] [--list employers.json] [--format json|table|plain]
  bun run .agents/skills/uk-employer-careers/cli/src/cli.ts check [--list employers.json]
  bun run .agents/skills/uk-employer-careers/cli/src/cli.ts discover <careers page url>
  bun run .agents/skills/uk-employer-careers/cli/src/cli.ts discover-all [--list employers.json]

-q is a comma-separated list of title words (any match). --location defaults to "uk" (any UK place or remote).
check reports which listed boards answer; discover finds which ATS a careers page uses.`

async function loadEmployers(path: string): Promise<Employer[]> {
  try {
    const data = await Bun.file(path).json()
    return (data.employers ?? data) as Employer[]
  } catch (e) {
    fail(`cannot read employer list ${path}: ${e}`, "BAD_CONFIG")
  }
}

const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean)

async function main() {
  const flags = parseFlags(process.argv.slice(2), { q: "query", n: "limit", l: "location" })
  const cmd = flags._[0]
  if (!cmd || flags.help) {
    console.log(HELP)
    return
  }
  const path = str(flags, "list") ?? DEFAULT_LIST

  if (cmd === "search") {
    checkFlags(flags, ["query", "location", "tag", "employer", "jobage", "limit", "list", "format"])
    const terms = list(str(flags, "query"))
    const where = list(str(flags, "location") ?? "uk")
    const tag = str(flags, "tag")
    const only = str(flags, "employer")?.toLowerCase()
    const jobage = str(flags, "jobage") ? int(flags, "jobage", 30, 1, 365) : undefined
    const limit = int(flags, "limit", 50, 1, 500)
    let employers = (await loadEmployers(path)).filter((e) => e.ats && e.slug)
    if (tag) employers = employers.filter((e) => e.tags?.includes(tag))
    if (only) employers = employers.filter((e) => e.name.toLowerCase().includes(only) || e.slug.toLowerCase() === only)
    const results: JobResult[] = []
    const failed: string[] = []
    for (const e of employers) {
      try {
        const jobs = await fetchBoard(e, terms[0])
        if (!jobs) {
          failed.push(`${e.name} (board not found)`)
          continue
        }
        for (const j of jobs) {
          if (!matchesQuery(j, terms) || !matchesLocation(j.location, where)) continue
          const age = daysOld(j.date)
          if (jobage !== undefined && age !== null && age > jobage) continue
          results.push(toResult(e, j))
        }
      } catch (err) {
        failed.push(`${e.name} (${String(err).slice(0, 80)})`)
      }
    }
    results.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    output(results.slice(0, limit), str(flags, "format") ?? "json", { source: "employers", employers: employers.length, failed })
    return
  }

  if (cmd === "check") {
    checkFlags(flags, ["list"])
    for (const e of await loadEmployers(path)) {
      if (!e.ats) {
        console.log(`${e.name.padEnd(28)} ${"-".padEnd(15)} not set up yet (run discover-all)`)
        continue
      }
      let status: string
      try {
        const jobs = await fetchBoard(e)
        status = jobs ? `ok (${jobs.length} open roles)` : "NOT FOUND - fix slug or remove"
      } catch (err) {
        status = `ERROR ${String(err).slice(0, 60)}`
      }
      console.log(`${e.name.padEnd(28)} ${e.ats.padEnd(15)} ${status}`)
    }
    return
  }

  if (cmd === "discover") {
    checkFlags(flags, [])
    const url = flags._[1]
    if (!url || !/^https:\/\//.test(url)) fail("discover needs an https careers page url", "BAD_ARG")
    console.log(JSON.stringify({ found: await detectAts(url) }, null, 2))
    return
  }

  if (cmd === "discover-all") {
    // Fills in ats/slug for every employer that only has a careers page url, and writes the list back.
    checkFlags(flags, ["list"])
    const raw = await Bun.file(path).json()
    const employers: Employer[] = raw.employers ?? raw
    for (const e of employers) {
      if (e.ats || !e.careers) continue
      try {
        const found = await detectAts(e.careers)
        if (found.length > 0) {
          Object.assign(e, found[0])
          console.log(`${e.name}: ${found[0].ats} ${found[0].slug}`)
        } else {
          e.note = "no public ATS feed found; covered by Reed/Adzuna/web search"
          console.log(`${e.name}: no feed found`)
        }
      } catch (err) {
        console.log(`${e.name}: could not load careers page (${String(err).slice(0, 60)})`)
      }
    }
    await Bun.write(path, JSON.stringify(raw.employers ? { ...raw, employers } : employers, null, 2) + "\n")
    return
  }
  fail(`unknown command ${cmd}`, "BAD_ARG")
}

await main()
