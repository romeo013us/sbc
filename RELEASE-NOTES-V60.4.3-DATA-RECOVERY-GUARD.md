# SBC Business Command Center V60.4.3
## DATA RECOVERY GUARD / NON-DESTRUCTIVE MYSQL BOOT

### Critical fix
V60.4.2 could enter the legacy-workspace migration branch when the four core relational tables were empty. The `sbc_workspace` table is intentionally an auxiliary compatibility store and does not contain the authoritative CRM/customer/order snapshot. V60.4.3 refuses that migration unless the legacy payload demonstrably contains complete canonical core arrays.

### Safety behavior
- Never overwrite an empty relational database from an auxiliary/partial workspace payload.
- Never seed MySQL from an empty runtime object.
- Populated relational tables remain authoritative.
- A populated local workspace may seed an empty relational database.
- If no authoritative recovery source exists, runtime enters `mysql-recovery-required` mode rather than fabricating or deleting data.
- No new GoDaddy secrets.
- No synthetic lead reconstruction.
- No pricing/payment changes.

### Recovery evidence
The pre-V60.4.2 runtime reported 238 active sales leads and 248 CRM records. Those records must be recovered from the authoritative MySQL backup/snapshot if the live relational tables were emptied; this build does not invent replacement records.
