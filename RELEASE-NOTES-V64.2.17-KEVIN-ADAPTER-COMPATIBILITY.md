# SBC OS V64.2.17 — Kevin Adapter Compatibility Hotfix

- Restores the `SBCAdapter` named export required by `enterprise/kevin/kevin-core.js`.
- Restores the `dispatch()` and `readBusinessSnapshot()` integration contract.
- Retains the V64.2.16 atomic persistence safety assessment as `SbcPersistenceAdapter`.
- Normalizes active Kevin/server runtime identity to V64.2.17.
- No destructive persistence behavior added.
