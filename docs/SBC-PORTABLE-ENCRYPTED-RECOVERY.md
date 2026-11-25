# Portable encrypted database recovery — operator runbook

Status: source candidate only. No production database has been exported or restored by this change.

- Use a trusted Linux recovery workstation, a private directory outside the repository and web root, and a read-only database account. Freeze schema changes during the export.
- Supply SBC_BACKUP_ENCRYPTION_KEY through an approved secret store as canonical base64 encoding of 32 cryptographically random bytes. Keep a separately protected recovery copy; losing it makes encrypted archives unrecoverable. Never commit, log, email, or paste the key or SQL.
- With the key present and DB_* settings securely injected, run `node scripts/mysql-backup.js /private/recovery/sbc-backup-YYYY-MM-DD.sql.enc`. The export is authenticated AES-256-GCM, uses a random 96-bit nonce, and refuses to overwrite an existing file. No plaintext SQL file is generated during encrypted export.
- Transfer only the encrypted archive to an independently controlled storage location; retain according to approved policy. Git ignore rules are additional protection, not a storage policy.
- Recover locally with the same key: `node scripts/mysql-backup.js --decrypt /private/recovery/sbc-backup-YYYY-MM-DD.sql.enc /private/recovery/recovered.sql`. Authentication must succeed before a private SQL file is published. A wrong key or altered ciphertext fails closed. Decryption does not connect to a database.
- Use the existing isolated restore drill and its strict disposable-target authorization; never point it at production. Compare all expected table counts and row digests, record recovery time, and securely dispose of temporary plaintext.
- Legacy unencrypted exports are still supported for existing workflows; do not transfer them to off-provider storage. Encrypted SQL is bounded to 128 MiB, and decryption currently authenticates in memory. Larger schemas require a separately validated recovery path.
- Actual independence requires an approved off-provider destination, successful real-data backup and isolated restore, tested recovery time, and owner-controlled cutover. Do not claim those gates passed from CI fixtures alone.
