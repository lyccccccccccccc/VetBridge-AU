# Phase 2 — Technical Foundation

Status: Implemented foundation  
Date: 30 July 2026

## Decisions

- Monorepo: pnpm workspaces with Turborepo.
- Web: Next.js and TypeScript.
- Workflow API: NestJS and TypeScript.
- Document boundary: FastAPI and Python.
- Workflow database: PostgreSQL with Prisma.
- Shared domain logic: framework-independent TypeScript package.
- Authentication: interface/stub deferred; no production identity provider selected.
- Clinical document extraction: deterministic stub behind a service boundary.
- Data: three deterministic synthetic cases only.

## Safety invariants already expressed in code

1. Referral transitions are an explicit allow-list.
2. Terminal referral states have no outgoing transitions.
3. The API rejects skipped workflow states.
4. Extracted document facts remain pending clinician review.
5. Synthetic owner addresses use the reserved `.invalid` domain.
6. Case fixtures cover the normal path, information correction, and human
   follow-up alert.
7. The application database, not an AI model, owns workflow state.

## Next implementation slice

The next vertical slice should persist and display a single referral:

1. run PostgreSQL and apply the Prisma schema;
2. seed the three cases;
3. replace the web dashboard's typed fixtures with an API query;
4. add organisation-aware referral reads;
5. implement one transactional transition endpoint that writes both
   `Referral.status` and `ReferralStatusEvent`;
6. build the Case A referral workspace and document-review screen;
7. add integration tests proving cross-organisation access is rejected.

Authentication should remain a local demo identity selector until those access
rules are tested. A production provider can then be selected without changing
the domain model.
