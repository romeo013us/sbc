# SBC Dynamic Training Sources

Place current SOPs, policies, pricing sheets, product updates, and approved operating documents here.

- `approved/` = eligible for automatic course-version generation.
- `inbox/` = detected and queued for review; not automatically published.

Supported deterministic source formats in V55.10.0: Markdown, text, JSON, CSV. PDF/Office ingestion can be added through a document extraction worker without changing the training-state contract.

Dynamic update rule: published course history is never overwritten. A changed approved source creates a new draft course version, preserving prior learner progress and assessment history.
