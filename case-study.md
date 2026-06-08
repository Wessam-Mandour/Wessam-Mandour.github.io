# Building an AI Recruiting Automation Platform

**A case study in automation engineering and operational documentation.**

> All client names, database identifiers, and proprietary data have been removed. The architecture, engineering decisions, and trade-offs are real; code excerpts are illustrative reconstructions, not production source.

---

## TL;DR

I built and operate an end-to-end AI recruiting platform that takes a job opening from an intake form and runs the entire top-of-funnel automatically: candidate outreach, screening-interview ingestion and scoring, CV parsing, and LLM-based role matching, writing a ranked, *explained* shortlist back to the recruiting team's workspace.

It is two systems:

- **Matching Engine**, Python / FastAPI, ~3,900 lines. A six-stage funnel that turns a free-text job description into a ranked shortlist with a written rationale per candidate.
- **Candidate Flow**, Node / Express, 14 independently deployed services handling email, WhatsApp, transcript ingestion, transcript scoring, and CV parsing.

The interesting part is not "it uses an LLM." It's that it runs **unattended, in production, against rate-limited third-party APIs**, and stays correct, affordable, and recoverable while doing so.

---

## The problem

Recruiting top-of-funnel is repetitive, high-volume, and easy to get subtly wrong:

- Hundreds of candidates per role, most of them not a fit.
- Outreach (email + WhatsApp) that must respect provider rate caps and not double-send.
- Screening interviews that arrive as transcripts and need scoring.
- A final matching judgment that a human can *trust*, a bare number isn't enough; a recruiter needs to know *why*.

Doing this by hand doesn't scale, and a naïve script ("loop over candidates, call the LLM") falls over the moment it meets real volume, real rate limits, and real schema drift.

---

## Architecture

The platform is **event-driven** off the recruiting team's workspace, which is the single source of truth. A record changes → a webhook fires → exactly one service picks it up, does one job, and writes the result back.

```
Workspace ──webhook──▶  Candidate Flow (14 svc)  ──┐
                        Email · WhatsApp           │
                        CV parse · transcript      │
                        ingest · transcript score  │
                                                    ├──writes back──▶ Workspace
Workspace ──webhook──▶  Matching Engine            │
                        queue → 6-stage funnel ─────┘
                        rubric (LLM) · score (LLM) ──▶ ranked shortlist + rationale
```

Why this shape:

- **No shared mutable database.** Services are stateless; the workspace holds state. Nothing to corrupt between services.
- **Failure isolation.** WhatsApp going down cannot block matching. Each service is its own deployment.
- **One job per service.** Each branch does a single thing well, which keeps each one small enough to fully document and reason about.

---

## The matching funnel, stage by stage

Each stage exists to **narrow the pool before the next, more expensive stage runs.** The expensive stage is the LLM; everything upstream is about not wasting it.

### Stage 1, Rubric extraction (LLM)
A free-text job description is turned into a structured rubric: hard gates, core vs. preferred requirements, search keywords, allowed locations. This converts fuzzy hiring intent into criteria the rest of the pipeline can filter and score against deterministically.

### Stage 2, Keyword pool reduction (cheap, local)
A fast keyword-overlap pass drops candidates with no plausible signal **before any paid LLM call**. This is the single biggest cost lever in the system: it's the difference between scoring 400 candidates and scoring 60.

### Stage 3, Hard eligibility filters (rules)
Non-negotiable gates, language, location, minimum screening score. Missing or unexpected data is tolerated and logged, never crashed on.

### Stage 4, Priority bucketing and ordering (heuristics)
Survivors are bucketed by business priority (referrals first, then priority backgrounds) and ordered by the best available baseline score. This means a **capped** run still spends its budget on the highest-value candidates first.

### Stage 5, LLM scoring (concurrency-limited, retried)
Each candidate receives a 0-100 score **and a written rationale**, under a global concurrency cap. Transport errors, empty completions, and malformed JSON are retried. A single candidate's failure is isolated and skipped, it does not kill the run.

### Stage 6, Qualification and backfill (targeting)
Above-threshold candidates are linked first. If the qualified pool falls short of the run's target, the engine backfills with the highest-scoring below-threshold candidates and **logs the fallback explicitly**, so the team always gets a usable shortlist, and never mistakes a backfill for a true qualifier.

---

## Engineering decisions that matter

| Concern | Decision | Why |
|---|---|---|
| **Idempotency** | Already-scored records are excluded from future runs | A duplicate webhook or manual re-trigger can't double-contact candidates or duplicate matches |
| **Rate limits** | Sequential job queue, concurrency cap, inter-write delays | Stay under provider quotas by design instead of getting throttled and retried into a storm |
| **Reliability** | Exponential backoff; empty-response and invalid-JSON hardening | Third-party flakiness is expected, not exceptional |
| **Graceful degradation** | Skip individual failures; fail the job only if *zero* usable results | One bad candidate shouldn't sink a 200-candidate run |
| **Schema drift** | Ignore missing props, log+skip unexpected types, re-check eligibility after cache | A workspace edit can't silently corrupt a run |
| **Cost** | Cheap filters before expensive ones; candidate caps; TTL cache | The LLM only sees candidates worth paying to score |
| **Observability** | Structured logs keyed by page id, email, stage, skip reason | "Why wasn't this candidate matched?" is answerable from logs alone |
| **Multi-tenancy** | Branch-per-workflow, each deployed as its own service; config via env vars | A client with a different schema gets a tailored deployment with no fork and no code change |

---

## Documentation as a reliability layer

Because the system runs unattended, the documentation isn't an afterthought, it's how the system stays operable.

Every service ships an **operational handbook** that is:

- **Audience-layered**, opens with a one-table overview a manager can read, then drills into branch-level specifics an engineer needs.
- **Operational**, documents exactly which log line proves which behavior, so debugging is "grep this string," not "read the source."
- **Failure-first**, a troubleshooting section maps real symptoms to the precise gate that caused them.

Example troubleshooting entry (sanitized):

```
Candidate not considered for a role, check, in order:
  1. Stage-2 keyword overlap (did any role keyword match the profile?)
  2. Stage-3 hard filters (language, location, minimum score)
  3. existing scored row (already processed in a prior run)
  4. duplicate-email de-duplication

Fewer qualified matches than the run target, expected:
  Stage 6 backfills below-threshold candidates by descending score
  and logs `fallback_selected_below_threshold=true` on each.
```

---

## Results

Read this two ways, because two audiences care about two different things.

**For the business (the numbers):**

| Metric | Result |
|---|---|
| Candidate database scanned per run | **~40,000 rows** |
| Time for a full run, end to end | **~2 hours, unattended, on Railway** |
| Manual equivalent | **weeks** of recruiter screening per role, collapsed into one run |
| Services in production | **14**, all deployed on Railway, triggered by webhooks |
| Explainability | a **written rationale on every match**, so the shortlist is actionable on sight |

The headline a non-technical hiring manager remembers: *a single unattended 2-hour run on Railway turns a 40,000-row candidate database into a ranked, explained shortlist, work that is otherwise weeks of manual screening.*

**For the engineering team (why those numbers are even possible):**

- The 40,000-row scan stays cheap because the funnel runs free filters first and only sends the narrowed pool to the paid LLM.
- The 2-hour run stays inside third-party quotas through a sequential queue, concurrency caps, and exponential backoff, rather than hammering APIs and getting throttled.
- The run is safe to leave unattended because of idempotent re-runs, per-candidate error isolation, and schema-drift defense, so a duplicate webhook or a workspace edit cannot corrupt the output.
- Everything is event-driven on Railway: a workspace change fires a webhook, the responsible service handles it, and the result is written straight back.

---

## What this demonstrates

- **Automation engineering**, 14 integrated, event-driven services running unattended in production with idempotency, rate limiting, and graceful degradation.
- **Technical writing**, audience-layered operational handbooks, failure-first troubleshooting, and this case study.
- **Applied AI**, a cost-aware, explainable, retried LLM scoring pipeline rather than a single API call.

---

*Wessam Mandour, AI Automation Engineer & Technical Writer*
*[wessam.mandour94@gmail.com](mailto:wessam.mandour94@gmail.com) · [LinkedIn](https://www.linkedin.com/in/wessam-mandour/) · [GitHub](https://github.com/Wessam-Mandour)*
