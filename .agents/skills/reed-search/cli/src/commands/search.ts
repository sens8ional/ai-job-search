import { getJson, htmlToText, clean, toDate, salaryText, type JobResult } from "../helpers.js"

const BASE = process.env.REED_API_URL ?? "https://www.reed.co.uk/api/1.0"

export interface ReedJob {
  jobId: number
  employerName?: string
  jobTitle?: string
  locationName?: string
  minimumSalary?: number | null
  maximumSalary?: number | null
  date?: string
  datePosted?: string
  expirationDate?: string
  jobDescription?: string
  jobUrl?: string
  externalUrl?: string | null
}

export interface ReedSearchOpts {
  query: string
  location?: string
  distance: number
  minSalary?: number
  limit: number
  jobage?: number
  graduate?: boolean
  fullTime?: boolean
  permanent?: boolean
  details: boolean
}

export function authHeader(key: string): Record<string, string> {
  return { Authorization: "Basic " + Buffer.from(`${key}:`).toString("base64") }
}

export function toResult(j: ReedJob, description?: string | null): JobResult {
  return {
    id: String(j.jobId),
    title: clean(j.jobTitle),
    company: clean(j.employerName),
    location: clean(j.locationName),
    date: toDate(j.datePosted ?? j.date ?? null),
    url: j.jobUrl ?? `https://www.reed.co.uk/jobs/${j.jobId}`,
    salary: salaryText(j.minimumSalary, j.maximumSalary),
    description: description ?? htmlToText(j.jobDescription),
    source: "reed",
  }
}

export function searchUrl(o: ReedSearchOpts): string {
  const p = new URLSearchParams({ keywords: o.query, resultsToTake: String(o.limit) })
  if (o.location) {
    p.set("locationName", o.location)
    p.set("distanceFromLocation", String(o.distance))
  }
  if (o.minSalary) p.set("minimumSalary", String(o.minSalary))
  if (o.graduate) p.set("graduate", "true")
  if (o.fullTime) p.set("fullTime", "true")
  if (o.permanent) p.set("permanent", "true")
  return `${BASE}/search?${p}`
}

export async function runSearch(o: ReedSearchOpts, key: string): Promise<JobResult[]> {
  const data = await getJson<{ results: ReedJob[] }>(searchUrl(o), authHeader(key))
  let jobs = data?.results ?? []
  const out: JobResult[] = []
  for (const j of jobs) {
    let desc: string | null = null
    if (o.details) {
      const full = await getJson<ReedJob>(`${BASE}/jobs/${j.jobId}`, authHeader(key))
      desc = htmlToText(full?.jobDescription)
    }
    out.push(toResult(j, desc))
  }
  if (o.jobage !== undefined) {
    const cutoff = Date.now() - o.jobage * 86_400_000
    return out.filter((r) => !r.date || new Date(r.date).getTime() >= cutoff)
  }
  return out
}

export async function runDetail(id: string, key: string): Promise<JobResult | null> {
  if (!/^\d+$/.test(id)) return null
  const j = await getJson<ReedJob>(`${BASE}/jobs/${id}`, authHeader(key))
  return j ? toResult(j, htmlToText(j.jobDescription)) : null
}
