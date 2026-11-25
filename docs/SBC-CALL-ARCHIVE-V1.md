# SBC call archive

The normal Call Center keeps the latest 1,000 saved attempts in its rolling workspace. The optional MySQL archive stores captured attempts indexed by tenant, caller, account, number, status and date. It records each distinct saved revision. A Twilio CallSid identifies a provider record. Connection and delivery confirmation require independent provider evidence.

## Capture and recovery

The authoritative writer locks the previous workspace, captures both the previous and incoming call lists, then commits the archive and new workspace in the same transaction. This includes a call evicted by the rolling cap. An older snapshot cannot supersede a newer revision. Invalid ownership or conflicting session identity rejects the transaction.

Capture requires `SBC_CALL_ARCHIVE_CAPTURE=YES`, `SBC_CALL_ARCHIVE_RETENTION_APPROVED=YES` and a reviewed policy named by `SBC_CALL_ARCHIVE_RETENTION_POLICY_REF`. With capture active, the normal voice save route resolves a rolling-history miss by authenticated tenant, caller, session, account and manual-dial mode. A matching retry receives its original call ID. Conflicting notes, status, disposition or call identity return a conflict, leaving the current draft available. A failed lookup stops the save. Archived retries leave the current CRM routing, activity feed, call facts and rolling history intact.

## Search and correct notes

In Dialed Number History, choose SQL archive. Search and paging require `SBC_CALL_ARCHIVE_READ=YES` plus approved capture. Callers see their own attempts. Owners and managers can search the tenant. Coverage begins with captured or reconciled records. Unavailable history displays an error.

The owner can correct notes on an evicted entry and give a reason. The server verifies the current writer lease, locks the durable workspace and the archive entry, and compares the revision the owner opened. Saving preserves the original note and records the correction author, timestamp, reason and predecessor revision. A retry of the same edit returns its committed revision. A conflicting edit requires reviewing the latest entry. Call outcomes, provider facts, language preferences and assignments retain their existing values.

## Release evidence

The isolated MySQL release workflow writes 10,000 fictional attempts, exercises rolling eviction, scoped search, replay, corrections, conflicting edits and transaction rollback. A separate step dumps both archive tables, restores them to a new isolated schema and compares every ordered record and revision plus the links between them.

Before hosted activation, reconcile legacy ownership and history coverage, review retention duration, export, erasure and backup expiry, confirm query performance, and verify the actual GoDaddy schema, backup and restore with authorized accounts. The CI recovery drill covers synthetic archive data. An approved production retention window and a hosted restore receipt are still required.
