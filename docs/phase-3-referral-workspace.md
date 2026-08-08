# Phase 3 — Interactive Referral Workspace

Status: Implemented and verified  
Date: 30 July 2026

## Outcome

Phase 3 turns the static product shell into an operable Case A vertical slice.
The browser now reads referral data from the NestJS API and all actions are
checked against the selected local identity, organisation membership, role,
current referral status, and the shared domain state machine.

The runtime demo store is intentionally in-memory because PostgreSQL is not
available in the current workspace. Its DTOs and workflow rules mirror the
Prisma production model. Replacing the store with a Prisma repository will not
require redesigning the web interface or domain state machine.

## Implemented user journey

1. Select Dr Maya Chen, the referring veterinarian.
2. Open Case A and inspect the submitted referral, clinical history, status
   timeline, attached document, and unreviewed AI-extracted facts.
3. Observe that Maya cannot accept the referral or approve receiving-hospital
   document extraction.
4. Switch to Dr Oliver Smith at the receiving specialist hospital.
5. Accept, decline, cancel, or request more information according to the
   explicit status and role rules.
6. Approve or correct each AI-extracted fact using its source page, source
   section, model version, and confidence.
7. Inspect the audit tab to verify state changes and fact reviews.
8. Switch to Dr Nora Patel at an unrelated clinic and observe that no referral
   is visible; direct access to Case A returns HTTP 403.
9. Reset the demo to restore the original deterministic state.

## API surface

| Method | Route                                         | Purpose                                       |
| ------ | --------------------------------------------- | --------------------------------------------- |
| `GET`  | `/health`                                     | Process health                                |
| `GET`  | `/demo/identities`                            | List local demo identities and memberships    |
| `POST` | `/demo/reset`                                 | Restore deterministic demo state              |
| `GET`  | `/referrals`                                  | List organisation-authorised referrals        |
| `GET`  | `/referrals/:id`                              | Read an authorised referral workspace         |
| `POST` | `/referrals/:id/transitions`                  | Apply an authorised state change and audit it |
| `POST` | `/documents/:documentId/facts/:factId/review` | Approve or correct an AI-extracted fact       |

The demo identity is supplied in the `x-demo-user` header. This is not
production authentication; it is an explicit adapter seam for a future identity
provider.

## Safety and access controls

- A user must belong to the referring or receiving organisation to read a
  referral.
- State transitions are accepted only when both the state machine and role
  policy allow them.
- A state transition appends a status event and audit event in the same service
  operation.
- Only a receiving clinician can review extracted clinical facts.
- A correction cannot be saved without a corrected value.
- AI output cannot change the referral state, prescribe, diagnose, or triage.
- Returned DTOs are copied so clients and tests cannot mutate the server store
  through shared object references.
- All names and clinical records in this workspace are synthetic.

## Verification

- Monorepo TypeScript type check passed.
- NestJS and Next.js production builds passed.
- 14 TypeScript tests passed:
  - 3 domain state-machine tests;
  - 3 deterministic fixture tests;
  - 2 workflow-service tests;
  - 6 access, transition, audit, review, and reset tests.
- 2 FastAPI document-service tests passed.
- Live HTTP verification passed for:
  - initial Case A read;
  - receiving-clinician acceptance;
  - audit-event creation;
  - AI fact correction;
  - unrelated-clinic HTTP 403;
  - web server response;
  - demo reset.

## Next implementation slice

Phase 4 should replace the in-memory store with PostgreSQL/Prisma and add:

1. database migrations and transactional repositories;
2. authenticated sessions instead of the demo header;
3. clinical document upload to object storage;
4. asynchronous processing jobs connected to the FastAPI service;
5. an information-request thread for Case B;
6. integration and browser tests against the running database;
7. first cloud deployment and a stable public demo URL.
