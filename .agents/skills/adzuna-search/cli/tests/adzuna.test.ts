import { expect, test } from "bun:test"
import { toResult, searchUrl } from "../src/commands/search.js"

test("maps an Adzuna result and labels estimated salaries", () => {
  const r = toResult({ id: 42, title: "<strong>Content</strong> Creator", company: { display_name: "Beta Ltd" }, location: { display_name: "Windsor, Berkshire" }, created: "2026-11-24T10:00:00Z", redirect_url: "https://www.adzuna.co.uk/jobs/land/ad/42", salary_min: 25000, salary_max: 25000, salary_is_predicted: "1", description: "Make videos" })
  expect(r).toMatchObject({ id: "42", title: "Content Creator", company: "Beta Ltd", date: "2026-11-24", salary: "£25,000/year (Adzuna estimate)" })
})

test("converts miles to km and scopes to gb", () => {
  const u = searchUrl({ query: "media planner", location: "Slough", distanceMiles: 25, limit: 20, country: "gb", jobage: 14 }, "id", "key")
  expect(u).toContain("/gb/search/1?")
  expect(u).toContain("distance=40")
  expect(u).toContain("max_days_old=14")
})
