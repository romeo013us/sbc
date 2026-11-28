# SBC organic campaigns

The owner opens **Marketing Hub → Organic campaigns**. The next six four-hour occurrences show a separate platform, copy, destination, language, audience and market. Dated owner campaigns take priority on their selected channels during their Eastern date window. Audience and market describe the intended readership of an organic feed post. Distribution uses the four corporate accounts. Client accounts continue to use their existing publishing workflow.

## Production handoff

1. Deploy the candidate with `SBC_NATIVE_MARKETING_FROM_UTC` unset. The current external schedule keeps publishing. The campaign preview and owner-approved inventory are available in the Hub.
2. In the published writer, use **Check provider access**. Meta and Google use the existing Marketing Hub vault names. LinkedIn needs `LINKEDIN_ORGANIZATION_ID`, `LINKEDIN_ACCESS_TOKEN`, and a supported six-digit `LINKEDIN_API_VERSION`. Account checks use read access. The first real feed receipt establishes write access. Check the existing scheduler's most recent receipts before selecting the handoff occurrence.
3. Pick a future occurrence from the Hub. End the external schedule before that occurrence, after its final assigned slot. Configure the published host with that occurrence's exact UTC ISO timestamp including milliseconds in `SBC_NATIVE_MARKETING_FROM_UTC`. Preview and recovery runtimes cannot dispatch. Runtime leases and atomic database updates arbitrate overlapping ticks. To roll back, remove the setting, wait for in-flight attempts to settle, and resume the external schedule from the next unclaimed occurrence.
4. For first-party visit counts, route `/m/c/:content` to this application on an approved SBC public origin and set `SBC_MARKETING_TRACKING_ORIGIN` to that origin. Without that setting, campaigns use direct tagged links to SBC's contact form. Link preview fetches and HEAD requests do not increment browser-navigation counts. Visits measure requests, not unique people.
5. Check delivery history after cutover. A provider ID records acceptance. Independent provider readback verifies the same account, post, and tracked link. Google must report LIVE. A lost response or interrupted dispatch enters reconciliation. Uncertain sends cannot be blindly replayed. A missed historical window stays visible. Recovery prioritizes the current window to avoid bursts.

## Evidence and boundaries

A tagged inquiry is counted when it reaches the existing CRM customer journey. Gross captured USD uses the last matching tagged inquiry in the 30 days before order creation and the tenant's deduplicated Square capture projection. The report covers native deliveries in the last 30 days. Counts exclude ambiguous payments and test orders. This model measures an association. Net settlement, refunds after the reporting snapshot, and incremental sales require separate reconciliation. Missing source data stays unavailable.

The 24 reusable English and Spanish campaign entries cover website design, branding, visibility and Office Box. The four existing SBC feed images are selected by topic. Facebook and Google can fall back to text. LinkedIn publishes text and Instagram requires a feed image. Marketing Hub also exposes SBC's existing creative production, Search Console and market intelligence tools. The native publisher consumes its campaign inventory and approved reusable images. The signed artwork production queue retains its own approval flow.

Use the native campaign CI workflow for the MySQL-backed regression. Verify the release with the existing deployment artifact gate. Production acceptance still needs real scheduled provider writes, readbacks, missed-window recovery, a tagged form submission, and collected revenue.
