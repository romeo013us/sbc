# Creative Intelligence 360 — integrated draft release

This branch implements one private creative workspace inside Website Studio and Marketing. It shares an isolated local job queue, a worker process, and project-scoped content-addressed media storage. It generates real template PNG and short MP4 files without paid provider calls. It does not yet implement generative AI, narration, attachment to a published website or social post, or distributed remote workers.

## Local deployment contract (not production approval)

- Node.js 22.16+ with node:sqlite available, FFmpeg and FFprobe with the codecs/filters exercised by the test suite.
- Use a dedicated host or local volume with a durable, private, writable absolute directory; never a public document root or network-mounted SQLite database. The worker and API must see the same local filesystem.
- The existing server must enforce its owner, tenant and writer gates. Do not enable on a preview read-only process, public/shared workstation, or an unverified production host.
- Configure the following values through the deployment environment, not source control:

| Variable | Meaning |
| --- | --- |
| SBC_CREATIVE_LOCAL_ENABLED | 1 only after infrastructure and owner approval; unset otherwise |
| SBC_CREATIVE_ROOT | Absolute path of a pre-created private data directory |
| SBC_CREATIVE_ORIGIN | Exact HTTPS origin of the Command Center (no trailing slash) |
| SBC_CREATIVE_FFMPEG | Absolute path to the approved FFmpeg executable |
| SBC_CREATIVE_FFPROBE | Absolute path to the approved FFprobe executable |
| SBC_CREATIVE_TENANT | Verified numeric SBC tenant ID |
| SBC_CREATIVE_WORKER_ID | Unique trusted local worker identifier |

Run the isolated worker using `node enterprise/creative-intelligence/worker-process.cjs` under an authorized supervisor. Do not launch it from HTTP handlers. The queue and renderer are local to the configured tenant. The browser sends only a bounded creative brief, never a model command, worker address, filesystem path, or paid provider instruction.

Run `node --test test/sbc-creative-*.test.cjs` before release. The dedicated CI workflow additionally checks the syntax and byte parity of both existing browser bundles. The tests cover route contracts with a fixture, not a live authenticated browser or hosted GoDaddy deployment.

## Owner workflow

Open an editable Website Studio draft or Marketing > Content Studio, then expand Create media. Submit the headline, supporting copy, call to action, palette, aspect ratio, and descriptive alt text. Video uses one or two template scenes. A completed job is private: review the rendered output, copy, licensing and accessibility before manually using it in a delivery workflow. No automatic posting, public URL, domain change, external AI call, or purchase is authorized by this feature. Closing the drawer stops its browser polling; queued work remains durable.

## Remaining production release gates

1. Provision and verify the durable host/worker environment, storage quotas, retention, backups, restore and safe cleanup.
2. Complete remote worker authentication, distributed coordination and real-model licensing/hardware validation (including genuine AI image/video, voice and caption output).
3. Complete asset approval and native Website Studio insertion/export, Marketing approved attachment and publishing receipts, Kim integration and commercial order/fulfillment.
4. Prove the real browser flow on mobile/tablet/desktop, owner and staff boundaries, frame policies, production packaging, full repository CI, performance baselines, hosted preview, rollback and live acceptance.
5. Preserve zero additional mandatory subscription fees, no paid fallback, and no CRM/calling downtime.

No deployment or production merge is approved by this document.
