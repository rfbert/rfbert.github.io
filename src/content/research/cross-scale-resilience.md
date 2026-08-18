---
title: Cross-Scale Model Resilience for LLM Inference Under Hardware Faults
lab: TRUE (Trustworthy and Responsible) AI Lab, Oregon State University
role: Co-author
start: 2025-11-01
statusLabel: Manuscript under review
summary:
  problem: "Bit flips in GPU memory can silently corrupt LLM inference, and the risk shifts with model scale."
  built: "Robustness experiments and fault-mitigation implementations supporting a speculative-decoding defense, where draft and target models cross-check each other."
  result: "Mitigation implementations and the accuracy / fault-tolerance trade-off analysis; manuscript under review."
order: 1
---

Hardware faults (bit flips in GPU memory) can silently corrupt LLM inference. This work studies how that corruption behaves across model scales and proposes a speculative-decoding-based defense: a smaller draft model and the target model cross-check each other. The verification step doubles as a fault detector and corrector.

My contribution: mitigation implementations and the accuracy / fault-tolerance trade-off analysis, with experiments run on an A100 Slurm HPC cluster.
