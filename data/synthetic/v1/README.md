# VetBridge synthetic data v1

This directory is the canonical data source for the local VetBridge demo.
Every person, animal, clinic and clinical event is fictional. The records are
for development and portfolio demonstration only and must not be used for
clinical decisions.

- `catalog.json` contains shared organisations, demo identities and curated case paths.
- `cases/case-a.json` is the normal canine foreign-body referral.
- `cases/case-b.json` covers a missing attachment and corrected extraction.
- `cases/case-c.json` covers discharge and a rule-based follow-up review alert.
- `schema/case.schema.json` documents the exchange contract.
- `generated/dataset-100-seed-2026.json` is reproducibly generated from the
  curated templates.

Commands:

```bash
pnpm data:validate
pnpm data:generate
pnpm data:validate -- --file=data/synthetic/v1/generated/dataset-100-seed-2026.json
```

The generator defaults to seed `2026` and 100 cases. Passing the same seed and
count produces byte-for-byte identical output.
