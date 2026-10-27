# SBC OS V65.0.3 — Lorna Barbershop Batch

## Included
- Added 29 additional barbershop prospects from the owner-provided Lorna worksheet.
- Preserved supplied contact fields, website status, source URLs, and research notes.
- Registered the batch with the existing starter-lead seeder.
- All new records enter as `Lead`, `Cold`, score `0`, and `Jonathan Verification Required`; they are not sales-ready.
- The seeder runs only in the normal startup pipeline, which is skipped while `MYSQL_RECOVERY_REQUIRED` is active.
- Recovery thresholds and recovery-mode write protection remain unchanged.

## Not claimed
- This package does not insert records into the live database during packaging.
- Website status and contact data were not independently reverified in this build step.
- No outreach, sales execution, or automated contact is initiated.

## Test
Run `npm run test:v6503-lorna-batch`.
