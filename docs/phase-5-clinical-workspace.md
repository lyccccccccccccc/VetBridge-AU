# Phase 5 — Clinical workspace

Phase 5 turns the synthetic longitudinal records from data fixtures into
clinician-facing, role-aware workflows.

## Delivered

- Typed clinical records for encounters, observations, diagnostics,
  conditions, clinician-entered medication, information requests, discharge
  plans, owner follow-up submissions and follow-up alerts.
- A clinical record tab grouped by encounter and organisation.
- A handover tab for outstanding information requests and approved discharge
  plans.
- Referring-clinic action to mark requested information as supplied.
- A follow-up tab showing owner answers and rule-triggered review reasons.
- Receiving-clinician actions to acknowledge and then resolve follow-up alerts.
- An audit event for every new mutable workflow action.
- Role enforcement in the API, not only in the interface.

## Safety boundaries

- Medication is displayed only when entered in the source synthetic record by
  a clinician.
- Follow-up alerts remain rule-based routing signals, not diagnoses or urgency
  determinations.
- An alert must be acknowledged by a receiving clinician before resolution.
- Supplying requested material does not automatically resubmit or accept a
  referral.

## API additions

```text
POST /referrals/:referralId/information-requests/:requestId/resolve
POST /referrals/:referralId/follow-up-alerts/:alertId/actions
```

The second endpoint accepts either `ACKNOWLEDGE` or `RESOLVE`.

## Verification

- Monorepo TypeScript typecheck passed.
- 17 TypeScript tests passed across domain, database and API packages.
- API and Next.js production builds passed.
- Live API verification confirmed information-supply and alert workflows plus
  their audit events.
- The production web server returned the VetBridge referral workspace.

## Remaining deployment work

The demo still resets from canonical JSON into memory when the API starts. The
next phase should introduce PostgreSQL-backed repositories and transactions,
object storage for uploaded documents, background document processing, and a
public deployment.
