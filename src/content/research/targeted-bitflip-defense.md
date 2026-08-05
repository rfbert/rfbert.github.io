---
title: Defending LLM Inference Against Targeted Bit-Flip Attacks
lab: TRUE (Trustworthy and Responsible) AI Lab, Oregon State University
role: Data & benchmarks
start: 2026-06-01
status: in-preparation
# My involvement, not the manuscript's state: I contributed and moved on, and the
# lab carries the direction forward. "In preparation" read as active authorship.
statusLabel: Contributor
area: Adversarial fault tolerance
summary:
  problem: "Adversarial bit-flips corrupt a handful of chosen weights while the model’s output still looks plausible — when can monitoring catch it?"
  built: "A benchmark of fault-tolerance defenses across stealth and damage attack classes."
  result: "7 defenses evaluated against 2 attack classes on GSM8K; work continues at the lab toward publication."
order: 2
---

Adversarial bit-flip attacks corrupt a handful of carefully chosen weights to degrade or hijack a model while its output still looks plausible. This direction asks when output-level monitoring can catch these attacks, and when it cannot.

My contribution: data and early results. I benchmarked 7 fault-tolerance defenses against 2 attack classes (stealth and damage) on GSM8K; the work continues at the lab toward publication.
