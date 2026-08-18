---
organization: TRUE (Trustworthy and Responsible) AI Lab
parent: Oregon State University
role: Undergraduate Researcher, URSA Engage — LLM Reliability & Safety
location: Corvallis, OR
start: 2025-11-01
stack: [PyTorch, Hugging Face, Slurm]
summary:
  problem: "Hardware bit-flips can silently corrupt LLM inference — how robust are models, and what defends them?"
  built: "Robustness evaluations on the lab’s fault-injection harness, run at scale on an A100 Slurm cluster."
  result: "Benchmarked 7 defenses against 2 attack classes on GSM8K across 1B–8B models; co-authored a cross-scale resilience manuscript, now under review."
order: 2
---

- Evaluate robustness of 1B–8B Llama 3 models to hardware bit-flip faults using the lab's fault-injection harness (PyTorch, Hugging Face), run at scale on an A100 Slurm HPC cluster
- Benchmarked 7 fault-tolerance defense methods against 2 classes of adversarial bit-flip attacks (stealth and damage) on GSM8K
- Co-authored manuscript on cross-scale model resilience; contributed to the design of a draft-model-gated decoding defense and to the accuracy-versus-compute trade-off analysis
