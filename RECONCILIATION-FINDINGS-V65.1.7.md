# Evidence-Based Reconciliation — V65.1.7

## Purpose
This release upgrades the prior SQL-text scan into a read-only parser for the `INSERT` rows of `sbc_customers` and `sbc_lead_mesh`. It cross-references actual row fields against the packaged CSV candidate worksheets using normalized business name, email, and phone. It never writes to MySQL and never emits a recovery `INSERT` patch.

## Five-record claim review
The five proposed labels (`Lorna Ingest Entity 01`, `Lorna Ingest Entity 02`, `Retail Barbershop Lead A`, `Retail Barbershop Lead B`, and `Historical Legacy Sync`) do not appear as exact business names in their named packaged CSV sources. The provided short hex strings are not verifiable record hashes without a documented hash algorithm and canonical input. These claims are therefore **not accepted as recovery data**.

## Required interpretation
- A CSV row absent from the current dump is only a candidate, not proof of a deleted customer.
- Name/email/phone matches can be ambiguous and must be reviewed.
- A true missing-record determination requires a genuine pre-incident database snapshot or an independently verifiable source export and stable record keys.
- No IDs 244–248 are assigned and no records are synthesized.
- Production recovery lock must remain engaged until authoritative baseline reconciliation is approved.

## Run
`node scripts/diff-leads-reconciliation.js /path/to/SBC_Command_Center.sql`

The command emits a JSON report to stdout. It does not connect to the database, alter files, or generate SQL changes.
