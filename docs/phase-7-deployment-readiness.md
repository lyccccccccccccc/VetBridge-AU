# Phase 7: Deployment readiness

Phase 7 prepares VetBridge AU for a public portfolio deployment. No real animal,
owner, clinic, or clinical data is included.

## Added

- Separate production containers for the Next.js web app and NestJS API.
- A Render Blueprint for the web app, API, and managed PostgreSQL database.
- Production port binding and explicit CORS allow-listing.
- S3-compatible object storage for PDF, JPEG, and PNG uploads.
- A production guard that refuses ephemeral local file storage.
- A cold-build fix that makes Prisma generation explicit in the API image.
- Storage tests covering local development writes and production fail-closed
  behaviour.

## Required deployment secrets

The deployment owner must supply the following through the hosting platform;
they must never be committed to the repository:

- `S3_BUCKET`
- `S3_ENDPOINT`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

The Blueprint provisions `DATABASE_URL`. The final web and API origins must be
checked after the platform reserves service names.

## Deployment gate

Before the public URL is placed on a resume:

1. Create the services from `render.yaml` in an authenticated cloud account.
2. Create an S3-compatible private bucket and provide its credentials.
3. Verify `/health` reports `persistence: postgresql`.
4. Perform a state change, restart the API, and verify the change persists.
5. Upload one synthetic PDF and verify it reaches `READY_FOR_REVIEW`.
6. Verify an unrelated-clinic identity receives `403`.
7. Reset the deterministic demo and confirm the audit trail is restored.

Until those checks pass, the project is deployment-ready but not deployed.
