# SBC OS V64.2.6 — Recovery Truth + Read-Only Database Census

Purpose: diagnose authoritative MySQL state without modifying production data.

Safety boundary:
- Read-only recovery census.
- No INSERT/UPDATE/DELETE/ALTER/TRUNCATE.
- No seed, restore, workspace promotion, financial mutation, Revenue PLAY, or Kim mutation mission.
- Owner-only endpoint: `/api/owner/recovery/census`.
- Enumerates `sbc_*` tables and performs exact COUNT(*) row counts.
- Reports database identity, MySQL version/host, read-only flags, core CRM counts, verified baseline, and non-empty tables.

Release identity: V64.2.6
