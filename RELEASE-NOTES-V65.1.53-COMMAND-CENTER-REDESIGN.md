# SBC OS V65.1.53 — Command Center Visual Redesign

## Scope
A presentation-layer redesign of the existing Command Center. It changes layout, spacing, component styling, and color system without replacing application modules, changing business workflows, altering CRM records, or bypassing operational safeguards.

## Visual changes
- Deep jade navigation rail with new spacing and active states.
- Warm-neutral workspace canvas and sticky translucent header.
- Redesigned KPI cards, tables, forms, modals, and buttons.
- Jade, mint, coral, and warm-neutral palette.
- Responsive tablet/mobile rules and coordinated dark mode.
- Versioned stylesheet and service-worker cache key.

## Recovery-control correction
A header-only guard removes buttons whose labels explicitly say “Recovery Lock,” “Lock Recovery,” or “Unlock Recovery.” It does not remove recovery status content or controls in dedicated administrative workflows. The theme switch remains.

## Safety
Visual-only patch. CRM, lead import, Kim in-page actions, authentication, database logic, tenant isolation, recovery gating, and writer-lease logic are preserved. No database writes, recovery unlock, or production deployment are performed by this patch.

## Verification
The root bootstrap applies the patch during both build verification and runtime startup. The dedicated regression checks version identity, stylesheet injection, responsive/dark-mode tokens, header guard presence, cache version, and recovery/writer guard markers.
