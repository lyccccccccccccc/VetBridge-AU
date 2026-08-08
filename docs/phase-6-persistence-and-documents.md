# Phase 6 — Transactional persistence and document intake

## Outcome

Phase 6 removes two important prototype limitations:

1. Workflow changes can survive API restarts in a PostgreSQL-backed deployment.
2. Participating clinicians can attach a real file and observe an asynchronous,
   auditable review pipeline.

The portfolio demo still starts without external infrastructure. When
`DATABASE_URL` is absent or `VETBRIDGE_STORE=memory`, the API uses the canonical
JSON dataset in memory. When a database URL is configured, the same state is
stored transactionally in PostgreSQL.

## Persistence design

The normalised Prisma models remain the intended production clinical data
contract. The deterministic portfolio workspace is persisted as a versioned
`DemoWorkspaceState` JSON snapshot. This is deliberate: it avoids maintaining a
third transformation of the curated cases while still proving transactional
persistence, restart recovery, and a stable API contract.

Every mutating operation awaits a PostgreSQL transaction before returning:

- referral status changes;
- extracted-fact approval or correction;
- missing-information resolution;
- follow-up alert acknowledgement and resolution;
- document upload and processing completion;
- demo reset.

The `/health` response reports `persistence: "postgresql"` or
`persistence: "memory"` so deployment configuration is observable.

## Document intake

`POST /referrals/:referralId/documents` accepts one multipart field named
`file`.

- Allowed types: PDF, JPEG, PNG
- Maximum size: 5 MB
- Authorisation: clinician in the referring or receiving organisation
- Storage: random server-generated key; the original filename is metadata only
- Initial state: `QUEUED`
- Worker states: `QUEUED → PROCESSING → READY_FOR_REVIEW`

The worker creates only a draft receipt fact in this phase. It does not diagnose,
triage, prescribe, or mutate referral status. The fact remains unapproved until
a receiving clinician reviews it.

For a public deployment, `DocumentStorageService` is the replacement boundary
for object storage such as S3 or Azure Blob. The local adapter is retained for
development and automated verification.

## Verification

Automated:

- Prisma Client generation against the Phase 6 schema
- full TypeScript typecheck
- 18 TypeScript tests
- 2 FastAPI tests
- Next.js and NestJS production builds
- synthetic JSON cross-record validation
- Python static checks

Process-level HTTP verification:

1. Start the API in memory mode.
2. Upload a synthetic PDF as the referring vet.
3. Receive HTTP `202` and processing state `QUEUED`.
4. Fetch the referral after the background worker runs.
5. Confirm document and job state `READY_FOR_REVIEW`.
6. Confirm the generated fact has no review decision.
7. Confirm the audit trail ends with
   `DOCUMENT_PROCESSING_COMPLETED`.

The current execution environment does not provide Docker or a PostgreSQL
server, so a live database connection was not claimed. Database schema
generation, compilation, and transaction code are verified; the live
PostgreSQL restart test is the first deployment-stage check.

## Deployment gate

The next phase requires user-authorised external infrastructure:

- a PostgreSQL connection string;
- a hosting target for the API and web app;
- persistent object storage for uploaded files;
- allowed web/API origins.

No OpenAI key is required for the public portfolio demo. A real extraction
provider should be added only after the deterministic upload pipeline is
deployed and observable.
