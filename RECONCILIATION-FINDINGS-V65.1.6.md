# Read-only reconciliation findings — V65.1.6

## Evidence currently available
- The package-root `database.sql` is schema-only and has no authoritative customer-row payload to restore.
- The separately supplied `SBC_Command_Center.sql` is a populated SQL dump, but prior inspection indicates it reflects the 243-row compromised state, not a verified 248-row pre-incident baseline.
- The three packaged CSV worksheets contain 64 rows total. A read-only text scan against the supplied populated SQL dump found 17 possible text matches and 47 rows with no text match.

## Interpretation
The text scan is candidate discovery only. It is not a relational join, does not prove the source's time of capture, and does not identify the exact five missing customers. Some text matches can occur in logs or metadata rather than the authoritative customer table. No recovery patch is generated.

## Safe next action
Use `node scripts/audit-preincident-snapshot.js /path/to/authoritative-pre-incident.sql` against a genuine pre-incident dump. Compare stable customer primary keys and related foreign keys from the correct source tables. Keep the production recovery lock active until the 248-row baseline is substantiated and the differences are reviewed.
