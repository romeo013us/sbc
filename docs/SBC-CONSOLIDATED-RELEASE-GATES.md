# Consolidated release gates

Command Center: run npm run gate:release on an unmodified source checkout with Node 22, installed dependencies and FFmpeg. The candidate ZIP workflow requires that source job to succeed before its existing staging, transformation and artifact verification job runs. The separate npm run verify:v66:artifact command requires a freshly extracted candidate with its generated identity and inventory. Never run a stale deployment receipt as source proof.

Office Box: npm run gate:release is the existing lockfile, backend and browser suite entrypoint; its existing package job additionally requires its real MySQL integration job. Package receipts are generated at packaging time.

Do not consider one repository's checks proof of the other's. Both exact commits, identical shared core contract, successful package checks, hosted acceptance and a tested rollback are required for a coordinated production release. GitHub repository ruleset enforcement and alternate atomic-promotion workflows must be independently checked; this change only wires the existing candidate ZIP workflow. Do not automatically retry ambiguous MySQL mutations: reconcile authoritative records before issuing another write. The classifier is deliberately conservative and is not a SQL permission barrier.
