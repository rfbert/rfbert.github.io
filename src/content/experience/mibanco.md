---
organization: Mibanco
parent: Credicorp
role: Artificial Intelligence Intern
location: Lima, Peru
start: 2026-06-15
end: 2026-09-30
stack: [Databricks, Python, SQL, Azure AI Speech]
summary:
  problem: "Recorded customer audio had to become structured, usable data for production workflows."
  built: "A parallelized audio-ingestion and speech-to-text pipeline on Databricks with Azure AI Speech, plus a prototype LLM interpretation layer over the transcripts."
  result: "Cut end-to-end runtime from 7 min per request — 20 min under load — to a stable 5 min; partially adopted on real customer calls at Peru’s largest microfinance bank."
order: 1
---

- Built a parallelized audio-ingestion and speech-to-text pipeline on Databricks (Python, SQL) using Azure AI Speech, at Peru's largest microfinance bank; now partially adopted on real customer calls
- Cut end-to-end pipeline runtime from 7 minutes per request, degrading to 20 minutes under concurrent load, to a stable 5 minutes independent of load — by parallelizing the concurrent work and restructuring the code rather than adding compute
- Prototyped LLM-based interpretation of transcribed speech, evaluating Azure AI models on output quality, cost, and workflow fit
- Coordinated the AI team's project planning while automating routine engineering tasks with LLM-assisted tooling
