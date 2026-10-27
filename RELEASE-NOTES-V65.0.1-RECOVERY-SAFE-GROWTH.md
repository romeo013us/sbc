# SBC OS V65.0.1 — Lead Recovery + Recovery-Safe Growth Staging

## Fixes
- Align package version and authoritative runtime release identity at V65.0.1.
- Update visible public UI version labels from stale V64.2.28/V64.2.29 to V65.0.1.
- During protected CRM recovery, run the idempotent `sbc_lead_mesh` → `sbc_customers` restore, then allow the Growth OS to generate and persist campaign/content drafts only.
- Keep general automation, outbound outreach, financial mutations, fulfillment workers, and other startup mutation workers suspended while full authoritative core recovery remains unresolved.
- Prevent Growth OS from marking an asset `PUBLISHED` merely because a connector variable is configured. Without an actual provider dispatch adapter and verified receipt, assets remain staged.
- Keep paid ads disabled by default. No additional GoDaddy secrets required.

## Verification
- `scripts/predeploy-open-gate.js`: PASS
- `scripts/v6433-unattended-ops-test.js`: PASS
- `scripts/v6501-recovery-growth-test.js`: PASS
- JavaScript/CJS/MJS syntax audit: run at packaging time; report exact result.

## Operational caveat
A prior live log reported `source=243 inserted=243` for the lead restore. That confirms the V64.3.2 recovery transaction committed at that time. It does not, by itself, prove that the latest V65 deployment's UI is showing those rows or that sales automation is unlocked. Full CRM recovery and real provider publishing/payment/fulfillment checks remain live acceptance gates.
