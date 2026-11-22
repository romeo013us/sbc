# SBC Academy 360 · V66.166 Preview candidate

This continues the supplied V66.165 complete GoDaddy package. The learner studio is `/sbc-am-academy.html`; Jonathan's owner review desk is `/sbc-am-academy-owner.html`.

## Included

- Twelve English/Spanish lessons, quizzes and structured fictional work samples.
- Guided illustrated workflows with browser narration, lesson navigation and keyboard-accessible tabs.
- Branching objection practice with server grading and specific English/Spanish coaching.
- Owner cohort dashboard with time budgets, stage blockers, latest work samples, assessment history and capstone coaching history.
- Seven-dimension bilingual observation rubric, separate owner certification, revocation and certificate-expiry checks.
- Eight-hour/two-shift normal budget, visible actual capacity and one bounded owner extension.
- Legacy API bypass protections, same-tenant checks, writer/recovery checks, failed-save rollback and a clearance hold during pending training writes.

The original role-specific researcher training is preserved. This release concentrates the new practical academy on experienced Account Managers.

## Deployment

Use GoDaddy Preview first, preserving the existing database, secrets and single-writer policy. Do not give Preview writer access to the production database. Read-only Preview can display lessons and owner records; save/clock/certification acceptance needs an isolated authorized test database and valid writer lease.

Extract this complete ZIP at the app root. `package.json` and `sbc-godaddy-flat-entrypoint.cjs` remain at the ZIP root. Use Node 22 and the existing production start command. Do not mix files from earlier releases. No GoDaddy deployment is performed by preparing this package.

Existing Academy attempts and payroll records remain. Built-in curriculum metadata upgrades to the new bilingual content. Earlier text-only practice and certifications are retained as history; the new clearance policy requires current structured work samples, the latest observed bilingual capstone and a fresh owner certification bound to that capstone. Owner access remains separate.

## Verification

Run `npm ci --ignore-scripts --no-audit --no-fund`, `npm run test:academy360`, `npm run test:academy360:ui`, and `npm run verify:v66:artifact` in an isolated checkout. The UI test uses jsdom to exercise all twelve Spanish lessons and the owner workflow. It verifies state and API interactions; it does not render browser pixels or validate real speech voices.

Production-only dependency installation may omit jsdom, which is a development dependency. The normal application does not depend on jsdom, external AI or a new training subscription.

Hosted acceptance must prove: default restriction, first/second shift accounting, cutoff, one-time exception, saved attempts, owner rubric, certification/revocation, tenant isolation, restart recovery, backup restore, and desktop/mobile layout. Real customer calls and Square transactions are unnecessary for Academy testing.

See `docs/SBC-ACADEMY-360-TWENTY-PLATFORM-BENCHMARK.md` for the twenty-platform feature mapping and outstanding media/acceptance work.
