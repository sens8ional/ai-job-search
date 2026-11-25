import { getJson, clean, toDate, salaryText, htmlToText, type JobResult } from "../helpers.js"

const BASE = process.env.ADZUNA_API_URL ?? "https://api.adzuna.com/v1/api/jobs"

export interface AdzunaJob {
  id: string | number
  title?: string
  company?: { display_name?: string }
  location?: { display_name?: string }
  created?: string
  redirect_url?: string
  salary_min?: number
  salary_max?: number
  salary_is_predicted?: string | number
  description?: string
  contract_type?: string
  contract_time?: string
}

export interface AdzunaOpts {
  query: string
  location?: string
  distanceMiles: number
  minSalary?: number
  jobage?: number
  limit: number
  country: string
  fullTime?: boolean
  permanent?: boolean
}

export function searchUrl(o: AdzunaOpts, appId: string, appKey: string): string {
  const p = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: o.query,
    results_per_page: String(o.limit),
    sort_by: "date",
    "content-type": "application/json",
  })
  if (o.location) {
    p.set("where", o.location)
    p.set("distance", String(Math.round(o.distanceMiles * 1.609))) // Adzuna takes km
  }
  if (o.jobage) p.set("max_days_old", String(o.jobage))
  if (o.minSalary) p.set("salary_min", String(o.minSalary))
  if (o.fullTime) p.set("full_time", "1")
  if (o.permanent) p.set("permanent", "1")
  return `${BASE}/${o.country}/search/1?${p}`
}

export function toResult(j: AdzunaJob): JobResult {
  const predicted = String(j.salary_is_predicted ?? "0") === "1"
  const sal = salaryText(j.salary_min, j.salary_max)
  return {
    id: String(j.id),
    title: clean(htmlToText(j.title)),
    company: clean(j.company?.display_name),
    location: clean(j.location?.display_name),
    date: toDate(j.created ?? null),
    url: j.redirect_url ?? null,
    salary: sal ? (predicted ? `${sal} (Adzuna estimate)` : sal) : null,
    // Adzuna returns a ~500 character snippet; /apply fetches the full advert from the url.
    description: htmlToText(j.description),
    source: "adzuna",
  }
}

export async function runSearch(o: AdzunaOpts, appId: string, appKey: string): Promise<JobResult[]> {
  const data = await getJson<{ results: AdzunaJob[] }>(searchUrl(o, appId, appKey))
  return (data?.results ?? []).map(toResult)
}
