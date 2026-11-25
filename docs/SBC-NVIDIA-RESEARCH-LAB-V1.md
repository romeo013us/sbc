# NVIDIA AI-Q and Retriever isolated operator lab

Actual HTTP clients for the AI-Q 2.2.0 REST contract and NVIDIA Retriever embedding API. These are synthetic-only tools, not an autonomous research service or a production knowledge store. Do not connect a production tenant or credentials. A listening loopback service could proxy elsewhere; only use an independently verified isolated backend with no billable provider or external egress. No NVIDIA backend is installed by this change.

## AI-Q
- Default command with no opt-in is disabled.
- Discovery reads /health, /v1/jobs/async/agents, /v1/data_sources. Requires healthy Dask/database/encryption readiness, configured deep_researcher, knowledge_layer.
- An operator may explicitly submit ONE fixed fictional research prompt to a synthetic knowledge collection, using a unique sbc-lab- plus 32 lowercase hex characters job ID. Set SBC_AIQ_LAB_ENABLED=1, SBC_AIQ_URL=http://127.0.0.1:8000, SBC_AIQ_MODE=submit, SBC_AIQ_JOB_ID=<unique synthetic ID>, SBC_AIQ_ISOLATED_ACK=1. Run node enterprise/sbc-nvidia-research-lab.cjs aiq.
- Use SBC_AIQ_MODE=status to reconcile the same job, including after a timeout or 409. Never retry submission blindly. No polling or cancellation loop.
- Result returns report digest and source counts only, not report content or citations verified against actual sources. AI-Q may leave unmapped utility tools available even when data_sources is restricted; enforce server-side sandbox and egress independently before any submission. No shared unauthenticated backend.
- Actual research acceptance requires deployment, source correctness, tool isolation, cost/latency evaluation and owner review.

## Retriever
Run node enterprise/sbc-nvidia-research-lab.cjs retriever. Explicit opt-in SBC_RETRIEVER_LAB_ENABLED=1 plus SBC_NVIDIA_EMBED_URL and SBC_NVIDIA_EMBED_MODEL. First checks readiness and exact model availability. Sends four fictional passages in passage mode and four bilingual queries in query mode. Validates exact model/indices/dimensions, normalizes finite nonzero vectors, measures top-1 retrieval, treats ties as incorrect. Never stores vectors or exposes real customer data.
Four synthetic examples are smoke tests, not a 9.5 quality score. A future representative evaluation corpus, durable tenant-isolated knowledge index, ACL checks, provenance, deletion and re-indexing are required before production.

Official contracts: https://docs.nvidia.com/aiq-blueprint/2.2.0/integration/rest-api.html and https://docs.nvidia.com/nim/nemo-retriever/embedding/latest/use-the-api-openai.html .
