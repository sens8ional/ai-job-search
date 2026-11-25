// Shared helpers for the UK portal CLIs. Zero runtime dependencies: runs with plain `bun`.
// Every search result follows the /scrape contract: id, title, company, location,
// date (YYYY-MM-DD or null), url, salary, description.

export interface JobResult {
  id: string
  title: string | null
  company: string | null
  location: string | null
  date: string | null
  url: string | null
  salary: string | null
  description: string | null
  source: string
}

export interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

export function parseFlags(argv: string[], alias: Record<string, string> = {}): Flags {
  const flags: Flags = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("-") || a === "-") {
      ;(flags._ as string[]).push(a)
      continue
    }
    const name = a.replace(/^-+/, "")
    const key = alias[name] ?? name
    const next = argv[i + 1]
    let value: string | boolean = true
    if (next !== undefined && !next.startsWith("--") && !(next.startsWith("-") && next.length === 2)) {
      value = next
      i++
    }
    flags[key] = value
  }
  return flags
}

export function str(flags: Flags, key: string): string | undefined {
  const v = flags[key]
  return typeof v === "string" ? v : undefined
}

export function int(flags: Flags, key: string, fallback: number, min = 1, max = 100): number {
  const v = str(flags, key)
  if (v === undefined) return fallback
  const n = Number.parseInt(v, 10)
  if (!Number.isFinite(n) || n < min || n > max) {
    fail(`--${key} must be a whole number from ${min} to ${max}`, "BAD_ARG")
  }
  return n
}

export function fail(error: string, code: string): never {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
  process.exit(1)
}

/** Rejects flags the CLI does not document, so a typo never silently widens a search. */
export function checkFlags(flags: Flags, allowed: string[]): void {
  for (const k of Object.keys(flags)) {
    if (k !== "_" && !allowed.includes(k)) fail(`unknown flag --${k}`, "BAD_ARG")
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** GET JSON with retry on 429/5xx. Returns null on 404. */
export async function getJson<T>(url: string, headers: Record<string, string> = {}, tries = 3): Promise<T | null> {
  let last = ""
  for (let attempt = 0; attempt < tries; attempt++) {
    let res: Response
    try {
      res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "ai-job-search-uk/1.0", ...headers } })
    } catch (e) {
      last = String(e)
      await sleep(500 * 2 ** attempt)
      continue
    }
    if (res.status === 404) return null
    if (res.status === 401 || res.status === 403) fail(`access refused (${res.status}): check the API key`, "AUTH")
    if (res.status === 429 || res.status >= 500) {
      last = `HTTP ${res.status}`
      await sleep(1000 * 2 ** attempt)
      continue
    }
    if (!res.ok) fail(`HTTP ${res.status} from ${new URL(url).host}`, "HTTP")
    return (await res.json()) as T
  }
  fail(`request failed after ${tries} tries: ${last}`, "NETWORK")
}

// Zero-width and bidi characters are a known prompt-injection carrier in postings.
const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿­]/g

export function stripInvisible(s: string): string {
  return s.replace(INVISIBLE, "")
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", pound: "£" }

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
}

/** HTML to readable text. Drops script/style and elements hidden with inline styles. */
export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null
  let s = decodeEntities(html) // some APIs double-encode their HTML
  s = s.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, "")
  s = s.replace(/<([a-z0-9]+)[^>]*style\s*=\s*"[^"]*(display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, "")
  s = s.replace(/<li[^>]*>/gi, "\n- ").replace(/<\/(p|div|h[1-6]|ul|ol|tr)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n")
  s = s.replace(/<[^>]+>/g, "")
  s = decodeEntities(s)
  s = stripInvisible(s).replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim()
  return s || null
}

export function clean(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null
  const t = stripInvisible(String(s)).replace(/\s+/g, " ").trim()
  return t || null
}

/** Any date-ish input (ISO, epoch ms, dd/mm/yyyy) to YYYY-MM-DD, or null. */
export function toDate(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined || v === "") return null
  if (typeof v === "string") {
    const uk = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (uk) return `${uk[3]}-${uk[2]}-${uk[1]}`
  }
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export function daysOld(date: string | null, now = new Date()): number | null {
  if (!date) return null
  return Math.floor((now.getTime() - new Date(date + "T00:00:00Z").getTime()) / 86_400_000)
}

export function salaryText(min?: number | null, max?: number | null, period = "year"): string | null {
  const f = (n: number) => "£" + Math.round(n).toLocaleString("en-GB")
  if (min && max && min !== max) return `${f(min)}–${f(max)}/${period}`
  if (min || max) return `${f((min || max) as number)}/${period}`
  return null
}

export function output(results: JobResult[], format: string, meta: Record<string, unknown>): void {
  if (format === "json") {
    process.stdout.write(JSON.stringify({ meta: { count: results.length, ...meta }, results }, null, 2) + "\n")
    return
  }
  if (format === "table") {
    const rows = results.map((r) => [r.date ?? "", (r.title ?? "").slice(0, 48), (r.company ?? "").slice(0, 28), (r.location ?? "").slice(0, 24), r.salary ?? "", r.url ?? ""])
    for (const row of rows) process.stdout.write(row.join(" | ") + "\n")
    return
  }
  if (format === "plain") {
    for (const r of results) {
      process.stdout.write(`${r.title} - ${r.company}\n${r.location ?? ""} | ${r.date ?? "undated"} | ${r.salary ?? "salary not stated"}\n${r.url}\n\n${r.description ?? ""}\n\n---\n`)
    }
    return
  }
  fail(`--format must be json, table or plain`, "BAD_ARG")
}

/** Reads KEY=value pairs from the repo-root .env (gitignored) when not already in the environment. */
export async function envVar(name: string): Promise<string | undefined> {
  if (process.env[name]) return process.env[name]
  try {
    const text = await Bun.file(".env").text()
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/)
      if (m && m[1] === name) return m[2]
    }
  } catch {
    // no .env file
  }
  return undefined
}
