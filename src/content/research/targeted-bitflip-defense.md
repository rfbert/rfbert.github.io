---
title: Defending LLM Inference Against Targeted Bit-Flip Attacks
lab: TRUE (Trustworthy and Responsible) AI Lab, Oregon State University
role: Initial investigation & results
start: 2026-06-01
status: in-preparation
statusLabel: In preparation
area: Adversarial fault tolerance
order: 2
---

Adversarial bit-flip attacks corrupt a handful of carefully chosen weights to degrade or hijack a model while its output still looks plausible. This direction asks when output-level monitoring can catch these attacks, and when it cannot.

I ran the initial investigation and early results: I designed a draft-model-gated decoding defense and early-warning detection metrics, and benchmarked 7 fault-tolerance defenses against 2 attack classes (stealth and damage) on GSM8K. The work continues at the lab toward publication.
