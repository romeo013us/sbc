# Off-provider release preflight

Use only an independently obtained trusted CI canonical candidate, extracted into a new clean directory. Obtain the source commit and inventory SHA-256 independently from the associated CI artifact report; never trust an unverified directory's self-reported pins. Use Node 22 on the recovery host. The portable proof script validates the expected source and inventory pins, checks the inventory verifier before loading it, reuses the anchored inventory gate, and invokes the exact flat launcher in preflight-only mode with no inherited provider or database credentials.

```
node scripts/sbc-portable-runtime-proof.cjs /path/to/clean-candidate <expected-source-commit> <expected-inventory-sha256>
```

The output records only an offline startup-integrity proof. It does not boot the application, install runtime dependencies, restore MySQL, verify a writer lease, call external providers, or certify production. A canonical package must not be overlaid on an existing mirrored GoDaddy runtime. Do not alter or manually re-sign a staged inventory. Rebuild and verify through CI.

For actual hosting independence, follow SBC-PORTABLE-ENCRYPTED-RECOVERY.md: provision an approved isolated host and disposable database, inject secrets through a secret store, install locked dependencies, verify encrypted backup restore and row digests, enforce single writer, and complete hosted acceptance before owner-controlled DNS and traffic cutover. No new hosting expenditure is authorized by this script.
