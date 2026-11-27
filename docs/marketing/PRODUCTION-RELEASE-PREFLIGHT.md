# Independent release and original-brand preflight

Run from a trusted checkout on Node 22, using an extracted candidate in a trusted, immutable directory and the private, owner-approved original PNG in a separate trusted directory. Obtain all four release pins from independently verified CI release evidence, and the artwork SHA-256 from the separately approved original file, not from the candidate or an arbitrary generated image. The verifier never creates or approves its own trust anchors. Do not include private artwork or credentials in the repository, CI logs, or public paths.

```sh
node scripts/verify-production-release-gate.cjs \
  "$ABS_RELEASE_ROOT" "$SOURCE_SHA" "$SERVER_SHA" "$SOURCE_FINGERPRINT" \
  "$STAGED_INVENTORY_SHA" "$ABS_PRIVATE_LOGO" "$APPROVED_LOGO_SHA"
```

The preflight reuses the existing staged inventory/release-sync verifier and the bounded PNG digest check in the private replenishment coordinator. It rejects absent pins, wrong source or inventory, altered bytes and a final-component symlink. The logo path must be outside the candidate tree; its parent directory must be trusted and private. A digest only binds bytes to an independently approved reference: it does not prove ownership, decode the entire PNG, or grant publication authority. The FFmpeg staging path still performs its own decoding checks. The output deliberately leaves productionCertified and publicationReady false. Actual owner-approved PNG provisioning, live host identity, runtime integration, writer/recovery, rollback and provider readback remain separate acceptance requirements.

Tests use synthetic PNG artwork and the existing disposable sealed release fixture. No production file, database or provider is modified.
