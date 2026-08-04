---
title: Internship Scout
tagline: A full-stack agent that reads the internship market every morning so I don't have to
role: Sole developer, design to launch
start: 2026-07-01
stack: [TypeScript, Next.js, Prisma, PostgreSQL, Docker, GitHub Actions]
status: active
repoNote: In daily use — public release in progress
summary:
  problem: "Internship search is high-volume and low-signal — hundreds of postings a day, few of them relevant."
  built: "A daily GitHub Actions pipeline: scrape → dedupe → eligibility rules → LLM scoring that cites verbatim posting text → kanban."
  result: "Idempotent daily runs with Vitest unit and Playwright end-to-end tests in CI; in personal use every morning."
featured: true
order: 1
---

Internship search is high-volume and low-signal: hundreds of postings a day, few of them relevant. Internship Scout is my fix. I built it alone and keep adjusting it as I use it.

Each morning a GitHub Actions pipeline scrapes and dedupes postings from multiple sources, runs them through a deterministic eligibility rules engine, and ranks the survivors with LLM scoring that must cite verbatim text from the posting. Results land on a kanban board where I track every application to its outcome.

Pipeline runs are idempotent; CI covers Vitest unit tests plus Playwright end-to-end tests.
