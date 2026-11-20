# SBC Owner Pre-Marketing Operating Plan — November 20, 2026

**Owner decision:** Stabilize and sell the current products. Do not start paid TV or mass outreach until the real customer journey has evidence-backed signoff. This plan does not change staff schedules, spend money, or send messages.

## Verified current assets
- Website: https://sbcmia.com — published website tiers of $199 Starter, $499 Custom, $799 Advanced, $999 Growth and a separate $99 Business Visibility offer.
- Public contact form says a request is only received when the CRM acknowledges it and otherwise gives phone/email fallback. **A successful real submission has not been verified in this audit.**
- Command Center: `romeo013us/sbc` (default branch `a-sbc-master`). Current release safety check `scripts/sbc-prelaunch-readiness.cjs`.
- Office Box: `romeo013us/sbc-office-box` (default branch `main`). Staging / production signoff still required.
- Connected channels: SBC Facebook Page 1473280249199334, SBC Google Business Profile, LinkedIn company page; Google Analytics 4 and Search Console. Do not infer that Instagram is connected.
- The existing recurring social tasks should not be duplicated or rescheduled based on a few days of small-sample analytics.

## Operator shift cards
**Owner, first 15 minutes of business day**
1. Confirm overnight inbound contacts and actual submissions.
2. Resolve blocked sales/fulfillment and failed payment alerts first.
3. Check which qualified leads are unassigned or have overdue follow-ups.
4. Approve only fact-checked, permissioned outreach and accurately scoped proposals.
5. Record quotes, confirmed payments, and fulfilled orders separately.

**Lead researcher**
- Verify business identity, primary phone, email, website, Street/City/State/ZIP, Google-listed address and evidence URLs; do not invent unavailable fields.
- Return conflicting or unverified records for correction; never create duplicates to bypass errors.
- Research is not consent to cold-message or call.

**Account manager**
- Open assigned account, check history and contact permissions, record one outcome and next touchpoint.
- Lead to proposal only after confirmed business need and package scope.
- Keep a single relationship owner; do not mark paid unless payment provider is verified.
- Do not send automatic cold outreach overnight or outside appropriate recipient local hours.

## Revenue-first offer
- Use the **$199 Business Starter** as the principal first conversation; show one page, real contact route, accurate terms.
- Offer upgrades/hosting/business cards only if relevant and the customer agrees to pricing and renewals. Never imply SSL, domain, hosting, advanced booking, AI features, or support are free or indefinite without written terms.
- The `$199` figure is a gross sale amount, not profit. Track labor, third-party costs, card fees and refunds before judging margin.
- Do not quote testimonials, reviews, expected sales results or actual portfolio work unless verified.

## Five weekly metrics
| Metric | Definition | Source of truth |
|---|---|---|
| New qualified leads | Deduplicated CRM leads with verified need and follow-up permission/status | CRM |
| Follow-ups due | Assigned accounts with next action due by recipient-local date | CRM |
| Open quotes | Customer-facing quotes awaiting decision, excluding demos | CRM/quote records |
| Payments collected | Net payment-provider confirmed amounts, excluding tests/refunds | Square/payment provider |
| Monthly recurring revenue | Active, verified subscriptions billed monthly; exclude potential renewals | Subscription/payment provider |

Additional marketing metrics: GA4 tagged landing-page sessions and lead conversions; Search Console non-brand impressions/clicks; Facebook post impressions/link clicks; GBP website/call actions; LinkedIn post impressions. **Do not sum distinct users over different days as unique customers.**

## Data snapshot (the narrow date windows actually returned)
- Facebook: 5 posts, 43 impressions, 2 engagements and zero link clicks (Nov 19–20 sample).
- GA4: 63 sessions / 136 pageviews on Nov 15, 17, 18 and 19. The daily user sums are NOT de-duplicated people.
- Search Console: 21 impressions, 0 clicks (Nov 11–17).
- GBP: 12 impressions, 0 call and website clicks (Nov 6–20).
- LinkedIn: very low initial company-page reach. Check actual posts for better context.
This is a **baseline**, not evidence of acquisition ROI or a prediction.

## Organic marketing guardrails
- Keep existing daytime scheduled posts; rotate useful business tips, verified package facts, original design concepts clearly marked as concepts, and real business service FAQs.
- One primary CTA per post, such as `https://sbcmia.com/?utm_source=facebook&utm_medium=organic_social&utm_campaign=sbc_growth&utm_content=website_starter`.
- Test a campaign against **actual completed qualified inquiries and payment**, not impressions alone. Do not auto-follow, mass-message, scrape private contacts or invent engagement.
- Google Business Profile post published Nov 20: website-readiness checklist with LEARN_MORE and `utm_source=google&utm_medium=organic&utm_campaign=sbc_prelaunch&utm_content=website_checklist`. Initial result was PROCESSING, not verified LIVE.

## Spend / go-no-go
- No TV, paid ads, printing mailers or cold-call spend without owner approval of a **cost and measurement plan**.
- First close the release gaps in [Command Center issue #425](https://github.com/romeo013us/sbc/issues/425) and [Office Box issue #33](https://github.com/romeo013us/sbc-office-box/issues/33).
- Stage synthetic form -> lead -> owner assignment -> quote -> verified test payment -> ZIP preview -> approved delivery -> rollback. Test mobile 320/375/768/1440 and keyboard navigation.
- Only after this evidence is green, consider a controlled local test budget (historical planning preference about $75/month; not a committed spend) with unique UTMs and a daily cap set by owner.

## Limits of this report
Static checks and public website text were inspected; production backend, authenticated customer accounts, real mobile screenshots, performance benchmarks, database isolation, and application-wide penetration tests were not run here. Do not label this 9.5/10 production-certified until those are complete.
