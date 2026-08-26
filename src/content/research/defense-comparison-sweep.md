---
title: Which defense actually holds, and why the survivors survive
lab: TRUE (Trustworthy and Responsible) AI Lab, Oregon State University
role: Experiments and analysis
start: 2026-01-01
statusLabel: Unpublished — internal study
summary:
  problem: "Published fault-tolerance defenses are each evaluated on their own terms, so nobody knows which one to reach for."
  built: "A 42-cell comparison: 7 defense configurations against 2 bit-flip attack classes across 3 benchmarks."
  result: "Every fault the defense detected, it also corrected — so the failures that remain are detection failures, not repair failures."
order: 2
---

Published defenses against bit-flip attacks are each evaluated on their own benchmark, under their own fault model, so there is no honest answer to *which one should I use*. The two evaluation tracks were team priorities; I ran the comparison: **7 defense configurations × 2 attack classes (damage and stealth) × 3 benchmarks (GSM8K, DROP, TriviaQA)**, swept across flip counts from 0 to 50 — 42 evaluation cells, on Llama-3-8B.

**The result that changed what the team works on.** Every fault the defense detected, it also corrected. Not one case, across any attack or any benchmark, was detected-but-uncorrected. That means the repair step is not where the losses are — every answer that comes back wrong is a *detection* failure. The early-warning signal is the whole problem, and the recovery machinery is already good enough.

**Where it goes blind.** The stealth attack bites hardest at *low* flip counts and recovers as flips accumulate, which is the opposite of the intuition. In that low-flip regime accuracy collapses while detection stays near zero. The distinctive failure is output that is fluent, confident, and wrong — text that reads perfectly normally, produces no disagreement between draft and target, and therefore raises no alarm. That is the target for a better signal.

Getting there meant recovering legacy fault records from a superseded cluster path and verifying all 50 flips per attack reproduce bit-for-bit through the new pipeline, so old results stayed comparable without re-spending GPU time; finding and fixing two correctness bugs in the shared evaluation runner; and correcting the cohort methodology — conditioning failure analysis on clean-correct samples, which retracted a preliminary cross-attack result that turned out to be entirely baseline model error.
