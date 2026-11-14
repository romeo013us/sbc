# Lorna Lead Research — Urgent Full-Account Research Checklist

## Owner request
Make research in Lorna's existing lead workspace cover every relevant account detail, with **separate verification evidence for the street/business address and the Google-listed address**. Keep the existing lead import, owner-controlled account management, and automated verification protections.

## User-requested priority account — Miranda Maintenance & Repair Corp
The owner provided these **research candidates**:
- Business: Miranda Maintenance & Repair Corp
- Decision maker: Alexeis Alonso Miranda
- Primary telephone: 1 305-922-0061
- Candidate street/business address: 8430 SW 8th St Apt 302, Miami, FL 33144
- Industry: Handyman Services
- Google Maps / profile short URL: https://maps.app.goo.gl/rtTGRPAxt9mBt6ft9
- Email, website, next follow-up: not recorded
- Lead status: Lead
- Original intake channel: Lead Research - Bulk Import

**None of the address, Google listing identity, decision maker, or phone details have been independently verified by this release.** This document is a training/QA reference for an authorized researcher, not a change to the authoritative CRM account. Do not create a duplicate Miranda lead.

## What the code changes
1. A persistent urgent owner-instruction notice on Lorna's authenticated research workspace, naming the priority business but excluding phone/person/address data from the public UI source.
2. Business Address Research section now distinguishes:
   - canonical CRM candidate street address;
   - street address status `not_checked` / `verified` / `not_public` / `conflict`;
   - street evidence URL;
   - Google Maps / Business Profile URL;
   - exact Google-listed address;
   - Google address status `not_checked` / `matches` / `different` / `not_published` / `listing_not_found`;
   - separate Google evidence URL.
3. Full research checklist scores completed and missing fields without treating imported information or a Maps link as independent verification.
4. CSV / list importer understands additional source, Google, address, research-history and next follow-up columns and preserves those details in `leadIntelligence.researchBrief`; its canonical CRM payload remains limited to existing allowed fields.
5. Mirrored browser assets and bumped cache versions are included.

## Important access boundary
The existing Lorna workstation only displays the leads returned to this researcher by the server. She can correct an account through the existing workflow only when the CRM has returned it for correction. This update **does not assign Miranda to Lorna, modify an existing Miranda CRM record, bypass role isolation, or send a message**. Owner must confirm the existing record is assigned/returned to her. No external communications are performed. An urgent in-workstation notice becomes visible **only after the updated static files are deployed**.

## Release checks
`node scripts/lorna-full-research-checklist.test.cjs`
`node scripts/lorna-address-notice.test.cjs`
`node scripts/lead-research-import-goals.test.cjs`
`node scripts/v66137-research-brief-nextday.test.cjs`
`node scripts/v6686-research-secondary-phone.test.cjs`

Before any production claim: GitHub regression CI, GoDaddy deployed-asset SHA/identity, owner-authenticated Lorna view, existing-CRM duplicate safety and saved research brief inspection.
