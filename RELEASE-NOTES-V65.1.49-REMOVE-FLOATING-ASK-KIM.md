# SBC OS V65.1.49 — Remove the Blocking Floating Ask Kim Button

## User-requested behavior
Remove the always-visible floating Ask Kim launcher because it obstructs controls. Do not replace it with another fixed launcher.

## Preserved behavior
- Existing in-page Ask Kim buttons continue to call the canonical `openSbcAI` bridge.
- The Kim panel remains available when opened from an in-page action, and its header remains draggable, its size remains adjustable, and its close/minimize controls remain available.
- Existing chat send behavior and authenticated backend remain unchanged.

## Changes
- Remove creation of the fixed `#ckLauncher` / `.ck-launcher` button.
- Remove launcher show/hide coupling from opening and closing the Kim panel.
- Repeatedly clean up known legacy floating launcher IDs/classes if an older script injects one.
- Add defensive CSS to suppress cached/legacy floating launcher variants.
- Bust frontend asset and service-worker cache keys.
- Keep database recovery, tenant isolation, and writer-lease controls unchanged.

## Deployment
Run the complete regression suite and build checks. Deploy the complete V65.1.49 package to GoDaddy Preview first. Verify no floating Ask Kim button remains and that an in-page Ask Kim button still opens and sends a message. Publish Live only after that Preview check passes.
