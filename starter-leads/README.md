# SBC Starter Leads

The historical `SBC-250-Verified-Lead-Prospects.csv` is intentionally not fabricated by the release build.

V56.6 Dropzone is the authoritative ingress for new CSV/TXT lead documents. If the optional starter file is supplied later, the existing native lead-mesh stream can consume it without changing the application code.

## Lorna Backup Intake

`SBC-Lorna-Lead-Backup-2026-10-06.csv` is a controlled backup intake containing 17 records supplied by Lorna. V60.1.2 seeds these records into the CRM as `Lead` records with `PENDING_OWNER_VERIFICATION`; they are not automatically marked sales-ready.

## Lorna Barbershop Batch — 2026-10-09

`SBC-Lorna-Barbershop-Batch-2026-10-09.csv` contains 29 additional barber-shop prospects supplied by the owner from Lorna's worksheet. These records are cold, score 0, and require owner verification. The release seeder only processes this file during normal startup after the authoritative MySQL recovery gate has cleared. While `MYSQL_RECOVERY_REQUIRED` is active, the normal mutation pipeline remains suspended and this batch is not seeded.

The source URLs and research notes are preserved in the CSV. Website claims were not independently rechecked during packaging. No lead is marked sales-ready, and no outreach is triggered by this batch.

## Jonathan Barbershop Backup Worksheet — 2026-10-09

`SBC-Jonathan-Barbershop-Backup-2026-10-09.csv` contains 18 barbershop prospects from the owner's pasted backup worksheet. Source URLs and research notes are retained. Every row is initialized as Cold, score 0, and `Jonathan Verification Required`; no email or SMS outreach is triggered. This file is registered with the existing startup lead seeder, which runs only after the authoritative MySQL recovery gate clears. It does not contribute to or alter the 248-record recovery baseline.
