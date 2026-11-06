# SBC V66.88/89 — Revenue truth and Monday business-phone readiness

Target operational date: **Monday, November 9, 2026** (America/New_York).
Main source branch: `a-sbc-master`. **No automatic phone calls, payments or outreach.**

## Payment dashboard — confirmed source defect and change
- **10-Brain Revenue Autopilot**: counts Square-proven orders using `enterprise/v56134-god-tier-revenue.js` and its shared `v6640-payment-evidence.cjs` classifier, excluding synthetic system orders.
- **Consultative Revenue Engine (previous)**: counted any order whose `paymentStatus||status` matched `Paid|Completed|Fulfilled`, allowing an order label to inflate a paid count.
- **Fixed**: Consultative snapshot reuses the same read-only 10-Brain metrics. The Square-backed total **still includes the protected $1 owner QA payment**. It must not be presented as a genuine customer sale or bank deposit. No Square transaction or stored order is changed.
- **Remaining**: inspect exact live order references for any unexplained count discrepancy. Stored Square metadata is evidence, but not independent Square/bank confirmation.

## Voice system architecture and known implementation evidence
- Owner human-initiated outbound web calls use the **local Twilio JavaScript Voice SDK 2.18.5**.
- `GET /api/voice/status` requires the Twilio account, API Key SID + Secret, TwiML App SID and Twilio phone number. Its `webhookSignatureReady` independently requires a trusted HTTPS origin and the Twilio Auth Token for a signed voice callback.
- `GET /api/voice/token` issues short-lived outgoing-only access tokens. `POST /api/voice/twiml` is signature-checked before generating a chargeable `<Dial>`. An authorized operator must check that the **TwiML App's Voice URL is the exact Published HTTPS origin + `/api/voice/twiml`**, using HTTP POST.
- Each phone attempt first commits a tenant-bound CRM call-log session via `/api/voice/log`, then attempts `Device.connect`. V66.89 **blocks the Twilio call unless the first log returned `ok:true, durable:true`**. Suppressed contacts and invalid numbers are blocked; a failed final log is shown as unsynced, not silently marked saved.
- For sessions longer than 45 minutes, the web client fetches a new access token before the next call, without dropping an active connection.
- The native handset fallback is labeled **personal/carrier caller ID**, not SBC Twilio; its activity is not automatically captured by the Twilio SDK. Log handset calls manually.
- The code and CI tests do **not** prove that a real carrier connected, a human answered, audio worked, or the Twilio event appeared in the provider dashboard.

## Monday acceptance checklist — owner-controlled test using your own number
1. Deploy a verified release to **Preview** then **Published**, comparing `SBC-FLAT-RELEASE-IDENTITY.json` source SHA, inventory receipt, MySQL writer lease, and rollback.
2. Sign in as the owner from **desktop Chrome or Edge** over HTTPS. Confirm microphone permissions, speaker/headset, stable Internet connection, and correct target business number on the dialer.
3. Open the owner read-only `/api/owner/voice-preflight` and `/api/voice/status`. Record only booleans / missing **secret names**, never secret contents or JWTs. Confirm `configured` and `webhookSignatureReady` both true.
4. In Twilio Console, confirm the TwiML App Voice request URL and HTTP POST, correct account/API key and assigned outbound Caller ID. Check allowed geo permissions and adequate balance; use test mode only if provisioned intentionally.
5. Run **one consented live outbound call to your own phone**, manually clicking SBC's Call button. Check ring/connect, two-way audio, correct SBC caller ID, hang-up, duration, and that MySQL confirms a *single* tenant-owned call log with the expected notes and outcome. Compare Twilio's Call SID/status with SBC. Do not use a sales prospect for the first live test.
6. Deny microphone permission and retry in a non-calling diagnostic session: verify a clear permission error and no actual connection. Simulate an intentionally unavailable CRM writer **only in an isolated test environment**: verify no call can start when durability fails.
7. Test **iPhone** Safari/Chrome with page in foreground and mic permission. The browser SDK supports foreground calls but is **not a native background-capable phone app**. For dependable mobile background calling, a separate native iOS Voice SDK app or a configured call-forwarding solution would be needed. Do not assert one already exists.
8. Close/reopen your browser; confirm the owner notification recipients are still masked/saved. Send **one explicit test email and one explicit test SMS** and verify actual delivery. SMTP/SMS readiness is not Voice calling readiness.

## Evidence-based voice grade (not a fabricated 9.5)
Static code and synthetic tests: inspect and score separately.
- Signed provider callback / token setup (2.0 points)
- One live call and verified two-way audio / caller ID (2.0 points)
- Durable CRM logging and no phantom records (2.0 points)
- Permissions, recovery, useful errors / retry (1.5 points)
- Foreground mobile usability and transparent fallback (1.0 point)
- Security, DNC/suppression and legal compliance (1.5 points)

A **9.5/10 phone grade is NOT certifiable** until actual live tests, valid Twilio account configuration, call audio, call logs, and approved outreach compliance are evidenced.

## Florida outbound-call controls
Lead verification is not proof of consent or regulatory eligibility. Check Florida rules and applicable federal laws before cold calling, autodialing, recording or messaging. Do not auto-enable bulk calls, AI voice, or SMS based only on CRM counts. Start the Monday test with an owner-controlled number.

## Pinned server authorization hold (must not be misrepresented)
The current authoritative V66 server release still uses `auth` alone for `/api/voice/token`; it does **not** yet enforce an explicit `owner / manager / caller` role allowlist on that endpoint. The source-integrity checks correctly reject a one-line direct server modification because the pinned release hash would be invalid. We intentionally reverted that direct server edit and retained the integrity gate. **Do not grant researcher/demo users phone access or issue them voice tokens.** Treat backend role restriction as an open security acceptance item requiring a separately verified complete server build; it cannot be certified by the browser UI hiding calling buttons. This is a blocker to claiming 9.5/10 secure multi-role phone readiness. Owner testing against the authenticated route and signed callback may proceed under the existing controls, but broad outbound rollout remains on hold.
