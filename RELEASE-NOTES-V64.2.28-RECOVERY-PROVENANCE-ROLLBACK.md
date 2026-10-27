# SBC OS V64.2.28 — Recovery Provenance + Adversarial Rollback

## Purpose
Harden the recovery quarantine, validate the surviving `sbc_lead_mesh` records without mutation, produce an owner-gated promotion manifest, and add a deterministic rollback test harness.

## Recovery isolation
- Kevin background heartbeat is suspended while `MYSQL_RECOVERY_REQUIRED` is true.
- Kevin durable schema bootstrap and Kim executive briefing worker are skipped during recovery.
- Manual Kevin heartbeat returns `KEVIN_RECOVERY_SAFE` during recovery.
- Manual Kim executive briefing returns `KIM_RECOVERY_SAFE` during recovery.
- Existing production pipeline remains read-only in recovery.
- Recovery projection remains explicitly non-authoritative.

## Lead provenance
New owner-only read endpoints:
- `/api/owner/recovery/provenance/v6428`
- `/api/owner/recovery/promotion-manifest/v6428`

The validator evaluates each lead for:
- source provenance
- business identity completeness
- verification status
- E.164 phone validity
- email syntax
- freshness
- contactability
- duplicate identity candidates
- deterministic provenance hash

Classification:
- GREEN: structurally complete, current, contactable, verified, and no duplicate candidate.
- YELLOW: actionable but requires owner review.
- RED: insufficient provenance/identity/contact evidence.

No provenance endpoint writes to MySQL.

## Promotion gate
The existing verified-lead commit bridge now:
- refuses promotion while authoritative CRM recovery is required;
- requires explicit `leadMeshIds` selection;
- permits only GREEN provenance candidates;
- keeps owner confirmation mandatory;
- promotes only the selected candidates after the recovery gate is cleared.

## Adversarial rollback harness
`infra/sandbox/Dockerfile` runs `scripts/v6428-adversarial-rollback-test.js`.

The harness verifies:
- stale epoch refusal;
- staged mutation behavior;
- verification-failure rollback;
- state/hash restoration;
- financial state preservation;
- safe sandbox commit behavior.

## Validation
- 518 JS/CJS/MJS files: syntax checked, 0 failures.
- Existing `test:all`: PASS.
- Recovery isolation test: PASS.
- Adversarial rollback test: PASS.
- Recovery control / verified-lead / Kim integrity checks: PASS.
- Docker image definition included; Docker execution was not available in the build runner and therefore was not falsely reported as executed.

## Safety boundary
V64.2.28 does not promote or restore the 243 production lead-mesh records automatically. The live production database must be queried through the new read-only provenance endpoint after deployment, and owner approval remains required for any later promotion.
