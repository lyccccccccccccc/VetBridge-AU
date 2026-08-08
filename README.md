# VetBridge AU

VetBridge AU is a portfolio MVP for safe veterinary referral, discharge handover,
and owner follow-up workflows. It connects a referring clinic, a receiving
specialist or emergency hospital, and a pet owner without attempting diagnosis,
triage, prescribing, or replacement of a practice management system.

**Live demo:** [vetbridge.edwardliu.dev](https://vetbridge.edwardliu.dev)

## Workspace

- `apps/web`: Next.js role-aware product shell
- `apps/api`: NestJS workflow API
- `apps/document-service`: FastAPI document-processing boundary
- `packages/domain`: shared types and enforced referral state machine
- `packages/database`: Prisma schema and deterministic synthetic seed cases
- `data/synthetic/v1`: canonical JSON schema, three curated cases, and generated dataset
- `scripts`: deterministic generation and cross-record validation
- `docs`: product and implementation specifications

## Current demo

Phase 7 includes an interactive clinical referral workspace backed by canonical
JSON and an optional transactional PostgreSQL state store:

- switch between referring, receiving, and unrelated-clinic identities;
- read only referrals visible to the selected organisation;
- apply role-aware referral status transitions;
- write status history and audit events together;
- review or correct AI-extracted clinical facts;
- prove cross-organisation access is rejected;
- reset the deterministic synthetic demo.
- inspect three detailed longitudinal case files;
- generate and validate a 100-animal dataset with seed `2026`.
- inspect typed encounters, observations, diagnostics and medication records;
- manage missing-information handover as the referring clinic;
- review owner follow-up answers and acknowledge or resolve alerts as the
  receiving clinician.
- upload PDF, JPEG, or PNG clinical records with a 5 MB limit;
- queue uploaded documents for asynchronous processing;
- keep every extracted fact pending until a receiving clinician approves or
  corrects it;
- persist the resettable demo workspace in PostgreSQL when `DATABASE_URL` is
  configured, with an automatic memory fallback for zero-setup demos.

See
[`docs/phase-7-deployment-readiness.md`](docs/phase-7-deployment-readiness.md)
for
the current workflow and verification record. The canonical data contract is
documented in
[`docs/phase-4-synthetic-data-foundation.md`](docs/phase-4-synthetic-data-foundation.md).

## Synthetic data

```bash
pnpm data:validate
pnpm data:generate
pnpm data:validate -- --file=data/synthetic/v1/generated/dataset-100-seed-2026.json
```

The generator creates deterministic fictional data for development and
demonstration. It is not clinical guidance, a diagnostic dataset, or real-world
patient data.

## Local setup

Prerequisites: Node.js 22+, pnpm 10+, Python 3.12+, Docker.

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres
pnpm db:generate
pnpm --filter @vetbridge/database exec prisma db push
pnpm db:seed
pnpm dev
```

To use the zero-setup in-memory mode instead:

```bash
VETBRIDGE_STORE=memory pnpm dev
```

The web app runs on `http://localhost:3000`, the API on
`http://localhost:3001`, and the document service on `http://localhost:8000`
when started in its Python environment.

All included names, clinics, owners, animals, records, and documents are
synthetic.

## Production deployment

`render.yaml`, `Dockerfile.api`, and `Dockerfile.web` define a reproducible
public deployment with managed PostgreSQL. Production document uploads require
private S3-compatible storage; local disk is deliberately disabled in
production. Copying the Blueprint still requires an authenticated hosting
account and private object-storage credentials.

If the runtime cannot enumerate network interfaces, start the web app with an
explicit local host:

```bash
pnpm --filter @vetbridge/web exec next dev -H 127.0.0.1
```
