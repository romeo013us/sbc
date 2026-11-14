# SBC Website Studio — Smart-First Concept, Classic Fallback (release checklist)

## What has been built on the PR #369 branch
- Existing **Build Full Website** and Account 360 website buttons remain intact.
- When the Command Center owner opens a *Draft* website, the embedded iframe now defaults to the **art-directed Studio** rather than the previous same-layout card generator.
- **Business Starter** smart concept: one-page. **Business Basic/Essentials** smart concept: four linked pages (Home, Services, About, Contact).
- A one-click **Classic Preview** switch returns to the untouched existing one-page/four-page legacy renderer. Owner-approved presentations continue using their original approved renderer.
- The new `GET /api/website-production/sites/:id/studio/auto-preview` route uses existing authenticated owner, site-ID, tenant, and read-only guards; a `page` query selects approved page names for the four-page package only.
- Automatic first-run concepts are **private and unverified**. They use only business name, proposed industry/category and city to guide visual styling. They omit unapproved services, contact data, ratings, reviews, awards, owners and credentials. Three illustrative sample sections are visibly marked **EXAMPLE ONLY** and **FACT CHECK REQUIRED**. No data is stored as approved.
- For sites with an existing owner-approved `websiteStudioApprovedProfile`, the same private preview uses actual reviewed services/contact information.
- The existing saved draft `themeVariant` (1–3) now selects the art-directed palette and variant. Refresh after an editor save preserves the selected Smart/Classic preview mode.
- A sandboxed Content Security Policy, private noindex header, and deterministic static preflight remain enforced. No paid AI, image API, remote scripts, backend form submission, SMS/email delivery, or domain automation is introduced.

## What the upgrade is NOT
- **Not** a full drag-and-drop design editor, uploaded image library, external business research agent, working public quote form, or production publisher.
- **Not** a fully completed customer website until customer-approved copy/photos, operational forms/booking, customer consent, hosting/DNS/SSL, SEO schema, and verified release QA are complete.
- **Not** a verified top-1% or 9.5+/10 score. The visual browser pass and real Lighthouse numbers remain outstanding.
- Existing four-page live/approved templates are not silently replaced. The new art-directed pages are private previews only.

## Test gates to clear before merge/deploy
1. Green GitHub Actions on the final PR commit, plus local unit tests.
2. Owner login and tenant-isolation checks against a staging database; employee access must be blocked.
3. Desktop (1440px) and mobile (390px) browser screenshots at all four pages for multiple industries and variant selections; inspect navigation, contrast, keyboard support, overflow and missing styles.
4. Confirm Smart/Classic switching, owner editor save/reload, approved-website preservation, one-page Starter vs four-page Basic.
5. Verify no outreach or purchases, zero public indexing of private draft, no network forms, and no website content promoted to customer-ready without explicit approval.
6. When public publishing is implemented separately, require media rights, end-to-end inquiry delivery, DNS/SSL, rollback and payment/fulfillment evidence.

## Full source
Review GitHub PR #369 against `a-sbc-master`. Download the entire **feature branch source archive** from:
`https://github.com/romeo013us/sbc/archive/refs/heads/upgrade/site-creative-quality-v1.zip`

Do not overwrite production with this feature archive without the staging test and deployment approval process.
