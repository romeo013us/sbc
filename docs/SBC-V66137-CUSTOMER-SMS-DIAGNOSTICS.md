# SBC Customer SMS Delivery — diagnostic and rollout record
Date: November 9, 2026. Target: a-sbc-master. Mode: staged source fix; no outbound send.

## Report
Owner attempted customer SMS from Command Center; email successfully sent, SMS did not work. This is not enough to determine whether Twilio rejected the API call, queued but failed carrier delivery, or whether SBC blocked the request before contacting Twilio.

## Existing source evidence
- The customer button posts to POST /api/communications/sms, a separate service from email.
- The sender previously passed the CRM phone string unchanged to Twilio. A locally formatted phone may be rejected.
- Existing server routes require customer SMS consent for lead-like contacts and can block outreach.
- The Communications READY indicator only checked Twilio credential presence. It did not verify A2P registration or delivered status.
- Twilio's create-message HTTP response is not delivery evidence.
- The sender did not preserve Twilio's immediate provider status in the response.

## Staged V66.137 fixes
- Normalize ordinary US 10-digit and 11-digit phone formatting to E.164; reject malformed phones before a chargeable API call.
- Preserve all existing outreach gates. Suppress known opt-outs and do-not-contact status even for an existing customer.
- Report Twilio error codes with actionable guidance for 30034 (unregistered A2P), 30035 (registration pending), 21610 (recipient opt-out), 21211 (invalid phone).
- Show Twilio submission SID and provider status, not the unverified claim SMS sent/delivered. Keep draft open on failure.
- Disable the submit button while the request is outstanding. No automatic resubmission or customer messages during tests.
- Show CONFIGURED instead of READY based only on environment variables. Mark A2P as unverified rather than inventing registration.
- All fixes are free deterministic Node/JS code; no OpenAI calls.

## Determine actual failure before sending again
1. In Twilio Console > Monitor > Logs > Messaging, check the attempted outbound text around the timestamp. Do not paste account auth tokens, API keys, or customer private details into tickets or chats.
2. No Twilio message record => inspect the published Command Center route and HTTP error, including recovery/read-only guards and consent.
3. Twilio message record with 30034 => verify approved A2P Brand and Campaign and sender number membership in Messaging Service sender pool.
4. Twilio message record with 30035 => number registration still in progress; avoid moving it between Messaging Services while waiting.
5. 21610 => honor opt-out; no retry without new consent.
6. 21211 => correct CRM phone format, test only with a permitted number.
7. Sent/queued is not delivered. Check final provider status and delivery error code. Confirm customer received it before marking Delivered.
8. One owner-authorized test SMS to a personally controlled opted-in number only, after registration and sandbox checks. Do not use a customer as the first diagnostic test.

## Activation
- The script scripts/v66137-stage-sms-delivery-truth.cjs modifies only disposable CI staging server.js, not checked-in pinned server.js. The existing GoDaddy release pipeline regenerates its inventory/identity before publishing.
- The unmodified master/published service is not fixed until a verified release is published. No secrets, paid Twilio request, or live customer communication are involved in this PR.
- Observe a real controlled test with provider SID, delivery outcome and CRM activity after deployment before certification.

## Provider references
- https://www.twilio.com/docs/api/errors/30034
- https://www.twilio.com/docs/api/errors/30035
- https://www.twilio.com/docs/messaging/guides/debugging-common-issues
