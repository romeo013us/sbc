# SBC OS V60.1.0 — God-Tier Business Operating System Foundation

## Purpose
V60 turns the existing V58.3 production engine into a measurable, failure-isolated operating foundation without replacing the known-good Node/MySQL runtime or financial safety controls.

## What is new
- Durable MySQL event fabric with idempotency keys.
- Event processing state machine: `PENDING → PROCESSING → PROCESSED`.
- Bounded retries with exponential backoff.
- Dead-letter persistence after six failed attempts.
- Manual owner-only event replay endpoint.
- Checkout webhook emits a durable `checkout.received` business event after the authoritative checkout handler accepts the event.
- Circuit-breaker primitives for MySQL, Twilio, Square and AI dependency boundaries.
- SLO registry measuring API success, API P95 latency, event processing success and critical dependency success.
- Owner-only operational health endpoints for events, SLOs and circuit state.
- Release identity promoted to V60.0.0 while retaining rollback compatibility with V58.3.0 and historical releases.

## Safety boundaries
- No new GoDaddy environment secrets are required.
- No payment, refund, fulfillment, credential, MFA or owner-permission action is made autonomous by V60.
- The existing V56.16 revenue event broker remains authoritative for revenue state transitions. V60 provides durable ingress/replay infrastructure and does not duplicate financial execution.
- Kafka, Kubernetes, Ollama and FFmpeg are intentionally not forced into the production runtime. They are future scaling options only when measured workload and infrastructure justify them.

## Operational targets
| SLO | Target |
|---|---:|
| API success | >= 99.9% |
| API P95 latency | <= 300 ms |
| Event processing success | >= 99.9% |
| Critical dependency success | >= 99.9% |

These are engineering targets, not claims about current live performance.

## Endpoints
- `GET /api/god-tier/health` — owner health snapshot.
- `GET /api/god-tier/events` — owner event ledger view.
- `POST /api/god-tier/events/replay/:eventId` — owner-only replay.
- `GET /api/god-tier/slo` — current SLO/error-budget evidence.
- `GET /api/god-tier/circuits` — dependency circuit state.

## Deployment verification
The first GoDaddy log line that matters after deployment is:

`SBC FINAL PRODUCTION 60.0.0 running on port 20011`

Then verify `/healthz`, `/api/god-tier/health`, and `/api/production/readiness` from an authenticated owner session.
