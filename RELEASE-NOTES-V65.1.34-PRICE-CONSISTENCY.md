# SBC OS V65.1.34 — Price Consistency and Checkout Guard

## Purpose
Apply the owner-approved **$699 one-time SBC Complete Business Launch** price consistently to the current V65.1.33 source snapshot through the existing GitHub-controlled bootstrap/patch pipeline.

## Changes
- Adds the V65.1.34 source patch after the V65.1.33 startup DDL/auth stability patch.
- Aligns the Complete Launch SKU, revenue package mappings, sales thresholds, and planning defaults to $699.
- Removes the stale, unverified fixed Square URL from the bundled PHP storefront and routes the storefront CTA to call SBC rather than implying that the old link charges $699.
- Removes the stale Essentials static checkout URL from the Complete package UI/order-builder mappings; checkout must be generated from the actual order total.
- Updates current training copy to the four-package structure and $699 one-time package.
- Preserves the separate Professional Business recurring monthly tier; this release does not reinterpret it as a one-time launch fee.
- Updates release identity, browser title/cache namespace, and the runtime integrity manifest after patching.

## Safety boundaries
- Does not insert, delete, restore, or migrate customer records.
- Does not unlock database recovery, tenant isolation, or financial mutation gates.
- Does not create a Square transaction or change GoDaddy secrets.
- Does not prove live GoDaddy deployment or end-to-end payment/fulfillment behavior. Those remain post-merge Preview verification steps.

## Validation
The GitHub Actions build must apply all patchers in order, run `npm run test:all`, and pass source syntax verification. A green CI run validates the repository build/test path only; it is not a production deployment attestation.
