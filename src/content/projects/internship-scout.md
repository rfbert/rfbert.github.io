---
title: Internship Scout
tagline: A full-stack agent that reads the internship market so I don’t have to.
role: Product direction and delivery — I specified it and directed the build
start: 2026-07-01
stack: [TypeScript, Next.js, Prisma, PostgreSQL, Vercel, GitHub Actions]
status: active
repoNote: Public repo — github.com/rfbert/internship-scout
summary:
  problem: "Internship search is high-volume and low-signal — hundreds of postings a day, few of them relevant."
  built: "A five-stage pipeline I specified: collect → dedupe → eligibility rules → LLM scoring that cites verbatim posting text → kanban."
  result: "Two deployments, a public demo and a private instance against the live search. Idempotent runs, with Vitest unit and integration tests plus Playwright end-to-end tests gating CI."
featured: true
order: 1
---

Internship search is high-volume and low-signal: hundreds of postings a day, few of them relevant. Internship Scout is my fix, and it is mine in the sense that matters: I decided what it does, what it is not allowed to do on its own, and what it runs on.

I wrote the specification rather than the implementation. I directed AI coding agents scoped to separate parts of the system, setting what each one was and was not allowed to decide, and integrated GitHub, Vercel and managed Postgres by hand. The boundaries are the interesting part: one ingest path, because a second one is how scoring logic drifts apart; deterministic eligibility and sponsorship gates that run before any model call, because a rule I can read and test beats a model call I cannot explain; and a person accepting every result before it counts.

The pipeline collects and dedupes postings, runs them through the eligibility rules engine, and ranks the survivors with LLM scoring that must cite verbatim text from the posting. Results land on a kanban board where I track every application to its outcome.

I run two deployments: a public demo on invented data, and a private instance against the live search. The collector that feeds the private one is not part of the public repository; the pipeline it feeds is. Reviewing live output is where the real work happens. I caught the classifier ranking an AI marketing posting as a top engineering match, and a deploy failing intermittently on database migrations, and set both fixes.

Pipeline runs are idempotent; CI covers Vitest unit and integration tests plus Playwright end-to-end tests.
