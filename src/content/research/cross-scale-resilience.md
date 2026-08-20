---
title: Cross-Scale Model Resilience for LLM Inference Under Hardware Faults
lab: TRUE (Trustworthy and Responsible) AI Lab, Oregon State University
role: Co-author
start: 2025-11-01
statusLabel: Manuscript under review
summary:
  problem: "Bit flips in GPU memory can silently corrupt LLM inference, and a model at another scale is a cheap reference for noticing when they have."
  built: "Robustness experiments and benchmarks supporting a speculative-decoding defense, where draft and target models cross-check each other."
  result: "Experiments, benchmarks and the accuracy / fault-tolerance trade-off analysis; manuscript under review."
order: 1
---

Hardware faults (bit flips in GPU memory) can silently corrupt LLM inference, and numerical checks are a poor proxy for whether the output is still correct. This work proposes a speculative-decoding-based defense: a smaller draft model and the target model cross-check each other, and the divergence between them flags corruption at the output level rather than in the weights. Verification is the detector; recovery reloads only the weight tensors whose hashes changed, then regenerates.

My contribution: experiments, benchmarks and the accuracy / fault-tolerance trade-off analysis, run on the lab's Slurm HPC cluster.
