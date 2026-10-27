# SBC OS V65.1.4 — Recovery-Safe Bootstrap and Customer 360

## Purpose
Targeted patch based on the supplied V65.1.3 package and the reported Training Center / Customer 360 failures. This is a source package; it has not been deployed to GoDaddy.

## Changes
- Made `/api/v9/bootstrap` read-only with respect to customer normalization and training-catalog repair while `MYSQL_RECOVERY_REQUIRED` is active.
- Training catalog repair/assignment generation during recovery runs against a detached snapshot; it does not call `saveState` or write the live DB.
- Added `recoveryRequired` and `readOnly` flags to the workforce bootstrap response so the UI can clearly reflect recovery mode.
- Updated Operations 360 Customer 360 to normalize common camelCase and snake_case fields (including business/contact/phone/email/website/follow-up/assignment fields).
- Related orders, quotes, tasks, activities, messages, and payments now match both `customerId` and `customer_id`-style links.
- Customer 360 shows a read-only recovery banner and disables its Edit Customer action while the recovery flag is active.
- Bumped release identity and active asset cache tokens to V65.1.4.

## Safety boundaries
- No production database was accessed or changed by this build.
- No customer records were fabricated, inserted, deleted, or restored.
- No secrets or payment configuration were changed.
- The authoritative MySQL recovery lock remains in place. This patch does not unlock it.
- Customer 360 can only display fields present in the data returned to the browser; missing source data is not synthesized.

## Verification performed locally
- `npm run test:all` passed.
- JavaScript syntax checks passed for all shipped JavaScript files.
- ZIP integrity is checked before delivery.

## Deployment status
Built and tested locally only. Deploy through the existing GoDaddy/Airo workflow, then verify the live version and customer/training endpoints. Do not assume it is live until the production UI and logs confirm V65.1.4.
