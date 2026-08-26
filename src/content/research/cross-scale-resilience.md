---
title: Cross-Scale Model Resilience for LLM Inference Under Hardware Faults
lab: TRUE (Trustworthy and Responsible) AI Lab, Oregon State University
role: Co-author
start: 2025-11-01
statusLabel: Manuscript under review
summary:
  problem: "Bit flips in GPU memory can silently corrupt LLM inference, and a model at another scale is a cheap reference for noticing when they have."
  built: "Robustness experiments and benchmarks supporting a speculative-decoding defense, where draft and target models cross-check each other."
  result: "Accuracy under critical faults restored from 0% to 96.9–99.4%, at 0.1–0.4% latency overhead. Manuscript under review."
order: 1
---

Hardware faults can silently corrupt LLM inference, and numerical checks are a poor proxy for whether the output is still correct. The fault model is specific: **random double-bit flips in weight tensors**. Single-bit errors are corrected transparently by on-die GPU ECC, so double-bit errors — detected but *not* corrected — are the realistic residual threat.

This work proposes a speculative-decoding-based defense. A smaller draft model and the target model cross-check each other, and the divergence between them flags corruption at the output level rather than in the weights. The signal is the maximum of the target's normalized negative log-likelihood under the draft and the normalized Jensen–Shannon divergence between the two distributions, averaged over a sliding 10-token window, alarming at the 99.5th percentile of a fault-free calibration run. Verification is the detector; recovery reloads only the weight tensors whose hashes changed, then regenerates.

**What it achieves.** Accuracy under critical faults goes from 0% to 96.9–99.4%, at 0.1–0.4% latency overhead in fault-free execution, with detection at or above 97.5% true-positive for a false-positive rate at or below 0.6%. Hash-based isolation with selective reload recovers 17.3–112.2× faster than a full model reload — 0.1 to 0.3 seconds. Across the sampled fault population, 88.6% of faults are benign and 11.4% critical.

Evaluated on 8B–32B parameter target models — Llama-3-8B, Falcon3-10B and Qwen3-32B, paired with 1B–4B drafts — across GSM8K, MMLU and APPS, against four published baselines: Ranger, FT2, Structural Coding and LM-Fix.

My contribution: experiments, benchmarks and the accuracy / fault-tolerance trade-off analysis, run on the lab's 8× A40 Slurm cluster.
