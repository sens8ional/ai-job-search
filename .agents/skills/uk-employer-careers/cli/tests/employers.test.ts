import { expect, test } from "bun:test"
import { detectAtsInHtml, matchesLocation, matchesQuery, postedOnToDate } from "../src/commands/search.js"

test("detects ATS feeds linked from a careers page", () => {
  const html = `<a href="https://boards.greenhouse.io/acme/jobs/1">x</a> <iframe src="https://jobs.eu.lever.co/beta"></iframe>
    <a href="https://sky.wd3.myworkdayjobs.com/en-GB/Sky-Careers/job/1">y</a> <a href="https://jobs.ashbyhq.com/gamma">z</a>`
  expect(detectAtsInHtml(html)).toEqual([
    { ats: "greenhouse", slug: "acme" },
    { ats: "lever-eu", slug: "beta" },
    { ats: "ashby", slug: "gamma" },
    { ats: "workday", slug: "sky", host: "sky.wd3.myworkdayjobs.com", site: "Sky-Careers" },
  ])
})

test("uk location filter keeps UK and remote, drops elsewhere", () => {
  expect(matchesLocation("London, UK", ["uk"])).toBe(true)
  expect(matchesLocation("Remote - EMEA", ["uk"])).toBe(true)
  expect(matchesLocation("New York, NY", ["uk"])).toBe(false)
  expect(matchesLocation("Slough", ["slough", "windsor"])).toBe(true)
})

test("title query matches any comma term", () => {
  const job = { id: "1", title: "Social Media Executive", location: null, date: null, url: null, description: null }
  expect(matchesQuery(job, ["marketing", "social media"])).toBe(true)
  expect(matchesQuery(job, ["engineer"])).toBe(false)
})

test("reads Workday's relative posting dates", () => {
  const now = new Date("2026-11-25T12:00:00Z")
  expect(postedOnToDate("Posted Today", now)).toBe("2026-11-25")
  expect(postedOnToDate("Posted 3 Days Ago", now)).toBe("2026-11-22")
  expect(postedOnToDate("Posted 30+ Days Ago", now)).toBe("2026-10-26")
})
