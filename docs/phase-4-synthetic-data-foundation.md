# Phase 4 — Canonical Synthetic Data Foundation

Status: Implemented and verified  
Date: 30 July 2026

## Outcome

Phase 4 replaces the duplicated, hand-coded demo fixtures with visible,
versioned JSON records. The three curated longitudinal cases are now the single
source read by the NestJS demo API and the Prisma fixture adapter.

The phase also adds a deterministic generator that expands the curated
scenarios into 100 fictional animals while preserving valid identifiers,
references, event order, species/breed combinations, medication dates, referral
state transitions and synthetic-only contact details.

## Canonical files

| File          | Scenario                                           | Current state               |
| ------------- | -------------------------------------------------- | --------------------------- |
| `case-a.json` | Canine gastrointestinal foreign body               | `SUBMITTED`                 |
| `case-b.json` | Feline urinary obstruction with missing attachment | `MORE_INFORMATION_REQUIRED` |
| `case-c.json` | Canine fracture discharge and follow-up alert      | `FOLLOW_UP_ACTIVE`          |

Each case includes:

- fictional owner and animal demographics;
- one or more linked encounters;
- observations, diagnostic results, conditions and clinician-entered medication records;
- referral details and a complete legal status history to the current state;
- document metadata, synthetic clinical text and source-grounded extraction candidates;
- consent and information requests;
- discharge and follow-up records when applicable;
- immutable-style audit events.

The JSON Schema is a documented interchange contract. The executable validator
adds cross-record rules that JSON Schema alone does not express conveniently.

## Generator

`pnpm data:generate` defaults to:

```text
seed = 2026
case count = 100
```

The checked output contains:

| Entity          | Count |
| --------------- | ----: |
| Animals / cases |   100 |
| Encounters      |   133 |
| Documents       |   100 |
| Extracted facts |   201 |
| Audit events    |   266 |

The first three records are the exact curated cases. The remaining 97 are
deterministic variants of the three controlled scenario templates. They are
appropriate for UI population, API testing and performance demos; they are not
claimed to be clinically validated epidemiological data.

## Validation rules

The validator checks:

- every dataset and case is explicitly marked synthetic;
- owner emails use `.invalid` and phone numbers use a reserved demo pattern;
- IDs are unique and all owner, animal, encounter, organisation and referral references resolve;
- species and breed combinations are coherent;
- dates parse and medication end dates do not precede start dates;
- each status history starts at `DRAFT`, remains chronological and only uses legal transitions;
- current referral status matches the last status event;
- target scenario paths are legal;
- document references resolve and extracted confidence/page values are valid;
- corrected AI facts include a human-entered corrected value.

## Runtime integration

The API loads `catalog.json` and the three case files at startup. Resetting the
demo re-reads an in-memory clone of that canonical dataset, so interactive
actions never overwrite source fixtures. Detailed encounters, consents,
information requests, discharge plans and follow-up plans are returned under
`clinicalRecord`.

Prisma still requires a running PostgreSQL service to write these records. Its
fixture adapter now derives the core owners, animals, referrals and status
paths from the canonical JSON rather than maintaining a second hand-written
case list.

## Verification

- Curated dataset validation passed.
- Generated 100-case dataset validation passed.
- Repeating generation with the same seed produced the same file hash.
- API type checking and production build passed.
- API tests prove all three cases and their detailed scenario-specific records
  are loaded from JSON.
- Full monorepo tests, type checks and production builds passed.

## Next implementation slice

Phase 5 should make the data-backed features visible in the product and move
toward deployment:

1. add encounter, diagnostic, medication, discharge and follow-up panels;
2. implement the Case B information-request response;
3. add browser-level tests for all three scenarios;
4. connect a hosted PostgreSQL database through the existing Prisma model;
5. add actual synthetic PDF upload and asynchronous extraction;
6. deploy a stable public portfolio demo.
