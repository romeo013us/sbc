# Historical Backup Comparison — V65.1.10

| Archive | Source-derived value | Integration decision |
|---|---|---|
| V55.10.2 Canonical Renderer Fix | Historical duplicate-renderer issue and final restore asset | Did not copy legacy renderer reset; V65 uses a canonical `sbcPrimaryRender` and many wrappers. Add current-version regression checks instead. |
| V55.10.0 Autonomous Mission Control | Mission-control modules and event spool | Reference only; no state or mission-control data copied into production code. |
| V55.8.20 / V55.8.22 Training | Training open-button and timeclock-era UI | Reference only; preserve current training modules and state. |
| V55.17.9 Lead Sync | Explicit save confirmation and save-queue regression intent | Used as a persistence regression reference. |
| V55.18.1 / V55.18.3 Workforce Auth | Lorna identity guard and endpoint-level RBAC intent | Kept least-privilege role checks; no stale-role identity bypass copied into the new generic endpoint. |
| V55.18.5 / V55.18.0 Direct CRM Write | Avoid broad snapshot writer for single-lead persistence; verify MySQL write before reporting success | Adapted into the new direct-write endpoint, but it fails closed under the current recovery guard and does not call `saveData()`. |

This report records source-level design findings. It does not claim that every historical feature was ported or that live production is verified.
