// Company career pages on applicant-tracking systems that publish a public job feed.
// Each employer is listed once in employers.json with its ATS and board slug.
import { getJson, htmlToText, clean, toDate, fail, type JobResult } from "../helpers.js"

export type Ats = "greenhouse" | "lever" | "lever-eu" | "ashby" | "workable" | "workday" | "smartrecruiters"

export interface Employer {
  name: string
  /** The employer's careers page; discover-all reads it to find ats and slug. */
  careers?: string
  ats?: Ats
  slug?: string
  /** Workday only: the career-site host and site name, e.g. "sky.wd3.myworkdayjobs.com" + "Sky-Careers". */
  host?: string
  site?: string
  tags?: string[]
  note?: string
}

export interface RawJob {
  id: string
  title: string | null
  location: string | null
  date: string | null
  url: string | null
  description: string | null
  salary?: string | null
}

const UA = { "User-Agent": "ai-job-search-uk/1.0" }

export async function fetchBoard(e: Employer, query?: string): Promise<RawJob[] | null> {
  if (!e.ats || !e.slug) return null
  switch (e.ats) {
    case "greenhouse": {
      const d = await getJson<{ jobs: any[] }>(`https://boards-api.greenhouse.io/v1/boards/${e.slug}/jobs?content=true`)
      if (!d) return null
      return d.jobs.map((j) => ({
        id: String(j.id),
        title: clean(j.title),
        location: clean(j.location?.name),
        date: toDate(j.first_published ?? j.updated_at),
        url: j.absolute_url ?? null,
        description: htmlToText(j.content),
      }))
    }
    case "lever":
    case "lever-eu": {
      const host = e.ats === "lever-eu" ? "api.eu.lever.co" : "api.lever.co"
      const d = await getJson<any[]>(`https://${host}/v0/postings/${e.slug}?mode=json`)
      if (!d) return null
      return d.map((j) => ({
        id: String(j.id),
        title: clean(j.text),
        location: clean(j.categories?.allLocations?.join(", ") ?? j.categories?.location),
        date: toDate(j.createdAt),
        url: j.hostedUrl ?? null,
        description: [j.descriptionPlain, ...(j.lists ?? []).map((l: any) => `${l.text}\n${htmlToText(l.content) ?? ""}`), j.additionalPlain].filter(Boolean).join("\n\n") || null,
        salary: j.salaryRange ? `${j.salaryRange.currency ?? ""} ${j.salaryRange.min}–${j.salaryRange.max}/${j.salaryRange.interval ?? ""}`.trim() : null,
      }))
    }
    case "ashby": {
      const d = await getJson<{ jobs: any[] }>(`https://api.ashbyhq.com/posting-api/job-board/${e.slug}?includeCompensation=true`)
      if (!d) return null
      return d.jobs
        .filter((j) => j.isListed !== false)
        .map((j) => ({
          id: String(j.id),
          title: clean(j.title),
          location: clean([j.location, ...(j.secondaryLocations ?? []).map((s: any) => s.location)].filter(Boolean).join(", ")),
          date: toDate(j.publishedAt),
          url: j.jobUrl ?? null,
          description: j.descriptionPlain ?? htmlToText(j.descriptionHtml),
          salary: clean(j.compensation?.compensationTierSummary),
        }))
    }
    case "workable": {
      const d = await getJson<{ jobs: any[] }>(`https://apply.workable.com/api/v1/widget/accounts/${e.slug}?details=true`)
      if (!d) return null
      return d.jobs.map((j) => ({
        id: String(j.shortcode),
        title: clean(j.title),
        location: clean([j.city, j.country].filter(Boolean).join(", ")) ?? (j.telecommuting ? "Remote" : null),
        date: toDate(j.published_on ?? j.created_at),
        url: j.url ?? j.application_url ?? null,
        description: htmlToText(j.description),
      }))
    }
    case "smartrecruiters": {
      const q = query ? `&q=${encodeURIComponent(query)}` : ""
      const d = await getJson<{ content: any[] }>(`https://api.smartrecruiters.com/v1/companies/${e.slug}/postings?limit=100${q}`)
      if (!d) return null
      return d.content.map((j) => ({
        id: String(j.id),
        title: clean(j.name),
        location: clean([j.location?.city, j.location?.country?.toUpperCase()].filter(Boolean).join(", ")),
        date: toDate(j.releasedDate),
        url: `https://jobs.smartrecruiters.com/${e.slug}/${j.id}`,
        description: null, // fetched by /apply from the posting url
      }))
    }
    case "workday": {
      if (!e.host || !e.site) fail(`${e.name}: workday employers need host and site`, "BAD_CONFIG")
      // The same public endpoint the employer's own career site calls.
      const res = await fetch(`https://${e.host}/wday/cxs/${e.slug}/${e.site}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...UA },
        body: JSON.stringify({ limit: 20, offset: 0, searchText: query ?? "", appliedFacets: {} }),
      })
      if (res.status === 404) return null
      if (!res.ok) fail(`${e.name}: HTTP ${res.status} from Workday`, "HTTP")
      const d = (await res.json()) as { jobPostings?: any[] }
      return (d.jobPostings ?? []).map((j) => ({
        id: String(j.bulletFields?.[0] ?? j.externalPath),
        title: clean(j.title),
        location: clean(j.locationsText),
        date: postedOnToDate(j.postedOn),
        url: `https://${e.host}/en-GB/${e.site}${j.externalPath}`,
        description: null,
      }))
    }
  }
}

/** Workday says "Posted Today", "Posted Yesterday", "Posted 3 Days Ago", "Posted 30+ Days Ago". */
export function postedOnToDate(s: string | undefined, now = new Date()): string | null {
  if (!s) return null
  const day = 86_400_000
  if (/today/i.test(s)) return now.toISOString().slice(0, 10)
  if (/yesterday/i.test(s)) return new Date(now.getTime() - day).toISOString().slice(0, 10)
  const m = s.match(/(\d+)\+?\s+days?/i)
  return m ? new Date(now.getTime() - Number(m[1]) * day).toISOString().slice(0, 10) : null
}

const UK_HINTS = /\b(uk|united kingdom|england|scotland|wales|london|remote|gb|great britain)\b/i

export function matchesLocation(loc: string | null, wanted: string[]): boolean {
  if (wanted.length === 0) return true
  if (!loc) return true // unknown location: keep it, /rank checks the posting
  const l = loc.toLowerCase()
  return wanted.some((w) => (w.toLowerCase() === "uk" ? UK_HINTS.test(loc) : l.includes(w.toLowerCase())))
}

export function matchesQuery(j: RawJob, terms: string[]): boolean {
  if (terms.length === 0) return true
  const title = (j.title ?? "").toLowerCase()
  return terms.some((t) => title.includes(t.toLowerCase()))
}

export function toResult(e: Employer, j: RawJob): JobResult {
  return {
    id: `${e.ats}:${e.slug}:${j.id}`,
    title: j.title,
    company: e.name,
    location: j.location,
    date: j.date,
    url: j.url,
    salary: j.salary ?? null,
    description: j.description,
    source: `employer:${e.ats}`,
  }
}

const ATS_PATTERNS: [Ats, RegExp][] = [
  ["greenhouse", /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/gi],
  ["lever-eu", /jobs\.eu\.lever\.co\/([a-z0-9_-]+)/gi],
  ["lever", /jobs\.lever\.co\/([a-z0-9_-]+)/gi],
  ["ashby", /jobs\.ashbyhq\.com\/([a-z0-9_.-]+)/gi],
  ["workable", /apply\.workable\.com\/([a-z0-9_-]+)/gi],
  ["smartrecruiters", /(?:jobs|careers)\.smartrecruiters\.com\/([a-z0-9_-]+)/gi],
]
const WORKDAY = /([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/g

/** Finds which supported ATS a careers page links to. Pure function over the page text, for tests. */
export function detectAtsInHtml(html: string): Partial<Employer>[] {
  const seen = new Set<string>()
  const out: Partial<Employer>[] = []
  const add = (e: Partial<Employer>) => {
    const k = JSON.stringify(e)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(e)
    }
  }
  for (const [ats, re] of ATS_PATTERNS) {
    for (const m of html.matchAll(re)) if (!["embed", "v1", "api"].includes(m[1].toLowerCase())) add({ ats, slug: m[1].toLowerCase() })
  }
  for (const m of html.matchAll(WORKDAY)) if (!["wday"].includes(m[3])) add({ ats: "workday", slug: m[1], host: `${m[1]}.${m[2]}.myworkdayjobs.com`, site: m[3] })
  return out
}

export async function detectAts(url: string): Promise<Partial<Employer>[]> {
  const res = await fetch(url, { headers: UA, redirect: "follow" })
  return detectAtsInHtml((await res.text()) + " " + res.url)
}
