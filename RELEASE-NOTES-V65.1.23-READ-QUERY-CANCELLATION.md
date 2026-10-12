# SBC OS V65.1.23 — Read-only MySQL query cancellation

## Change
- Adds a 5-second bound to read-only SELECT/SHOW/DESCRIBE/EXPLAIN/WITH statements routed through the guarded MySQL pool.
- On timeout, destroys the specific leased connection so the DB server receives a disconnect rather than leaving a detached query running on a pooled socket.
- Marks this timeout as non-retryable; it will not automatically replay a timed-out statement.
- Does not add DB secrets, alter data, unlock recovery, enable money movement, or trigger outreach.

## Limits
- This is client-side connection cancellation, not proof that every MySQL/MariaDB server instantly stops work on disconnect.
- A live GoDaddy database and API smoke test are not available from the build environment.
- Recovery and financial safeguards remain engaged.
