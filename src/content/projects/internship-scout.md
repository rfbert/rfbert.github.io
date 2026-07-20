---
title: Internship Scout
tagline: A full-stack internship-discovery agent that reads the market every morning so I don't have to
role: Designed, built, and launched — sole developer
start: 2026-07-01
stack: [TypeScript, Next.js, Prisma, PostgreSQL, Docker, GitHub Actions]
status: active
repoNote: Repo public soon
featured: true
order: 1
---

Internship search is high-volume and low-signal: hundreds of postings a day, few of them relevant. Internship Scout is my answer — a product I designed, built, launched, and iterate on my own daily usage.

**How it works.** A daily pipeline (GitHub Actions) scrapes and dedupes postings from multiple sources, applies a deterministic eligibility rules engine, then ranks the survivors with evidence-based LLM scoring — every score must cite verbatim text from the posting. Results land on a kanban board where I track applications end-to-end.

**Built with quality in mind from day one:** idempotent pipeline runs, Vitest unit tests, and Playwright end-to-end tests in CI.
