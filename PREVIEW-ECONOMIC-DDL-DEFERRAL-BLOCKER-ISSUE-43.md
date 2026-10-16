# Preview economic-control DDL deferral — issue #43

## Status

**Not patched or verified. Do not deploy this branch.**

Preview is reported to attempt schema-changing work that the Preview runtime must not perform. The implicated module is embedded in `SBC-OS-V65.1.13-ROOT-FIXED-LOCKFILE-BLOCKED.zip` at `enterprise/v56220-economic-control.js`.

GitHub's text connector cannot expose the binary ZIP contents. The earlier V65.1.40 patch must not be reused: its assumed `runEconomicControlCycle(ctx)` anchor failed in CI and was reverted.

## Required safe fix

1. Inspect the actual embedded economic-control module and trace the startup call path responsible for the Preview DDL attempt.
2. Defer only the schema-dependent economic operation in Preview/read-only mode. Keep the HTTP/API listener independent where the existing startup architecture permits it.
3. Preserve explicit DDL opt-in, Published-writer-only mutation permission, exclusive MySQL writer lease, recovery evaluation/lock, tenant isolation, owner veto, and financial mutation gates.
4. Add tests proving Preview runs no DDL; Published without DDL defers schema-dependent economic work; recovery-required, recovery-unknown, and missing writer lease remain fail-closed.
5. Run the real bundle build and regression suite, then confirm GitHub Actions passes before asking for a Preview redeploy.

## Guardrail

Do not fabricate an anchor, broaden a regex replacement, enable DDL in Preview, clear recovery locks, or publish to Live to test this fix. If the archive is unavailable to the patch workflow, obtain the exact file from a checked-out copy of the ZIP and review it before changing code.

Tracking issue: https://github.com/romeo013us/sbc/issues/43
