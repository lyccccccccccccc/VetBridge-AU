# VetBridge AU — Phase 1 Product Specification

Status: Draft for implementation  
Date: 30 July 2026  
Primary goal: Build a credible, deployable portfolio MVP for Australian software and HealthTech roles.

## 1. Product statement

VetBridge AU is a referral and care-handover platform for general veterinary clinics, specialist or emergency hospitals, and pet owners.

It helps a referring clinic submit a complete referral, allows the receiving hospital to request missing information and report progress, and turns clinician-approved discharge information into an owner-friendly follow-up plan.

VetBridge does not diagnose animals, decide whether a case is an emergency, prescribe treatment, or replace a practice information management system.

## 2. Phase 1 assumptions

- Species: dogs and cats only.
- Geography and terminology: Australia.
- Organisations: one referring general practice and one receiving specialist/emergency hospital in the first demo.
- Data: synthetic longitudinal veterinary records only.
- Integration: a mock PIMS/FHIR adapter; no production clinic integration is required.
- Clinical safety: all AI output is a draft and must be approved by a veterinarian.
- Clinical content: no medication dosing recommendations and no autonomous triage.
- Users: referring veterinarian, receiving veterinarian or nurse, pet owner, and organisation administrator.

## 3. Target users and jobs

| User                         | Main job in the MVP                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Referring veterinarian       | Create a referral, attach records, review the generated summary, respond to information requests, and follow the outcome |
| Receiving veterinarian/nurse | Review incoming referrals, request missing information, update status, and approve discharge material                    |
| Pet owner                    | Give consent, read approved discharge instructions, complete follow-up check-ins, and upload a recovery photo            |
| Organisation administrator   | Manage users and view the audit trail                                                                                    |

## 4. The golden path

1. A referring veterinarian creates a referral for a synthetic patient.
2. The veterinarian uploads a clinical note and diagnostic report.
3. The document pipeline extracts structured facts and generates a draft referral summary.
4. Each extracted fact and summary statement links to its source document and page or section.
5. The referring veterinarian corrects or approves the draft and submits it.
6. The receiving hospital reviews the referral.
7. The hospital either requests missing information or accepts the referral.
8. The hospital advances the case through appointment, admission, treatment, and discharge states.
9. A receiving veterinarian reviews and approves the clinical discharge summary and owner-friendly care plan.
10. The owner reads the plan and submits follow-up check-ins.
11. A deterministic clinic rule flags an abnormal response for human review.
12. The referring clinic can see the outcome, while the audit log records all material actions.

## 5. Referral state model

Allowed states:

1. `DRAFT`
2. `READY_FOR_REVIEW`
3. `SUBMITTED`
4. `MORE_INFORMATION_REQUIRED`
5. `ACCEPTED`
6. `APPOINTMENT_BOOKED`
7. `ADMITTED`
8. `TREATMENT_IN_PROGRESS`
9. `DISCHARGED`
10. `FOLLOW_UP_ACTIVE`
11. `CLOSED`
12. `DECLINED`
13. `CANCELLED`

The backend must enforce legal state transitions. AI cannot change a referral state.

| Current state                     | Allowed next states                                              |
| --------------------------------- | ---------------------------------------------------------------- |
| `DRAFT`                           | `READY_FOR_REVIEW`, `CANCELLED`                                  |
| `READY_FOR_REVIEW`                | `DRAFT`, `SUBMITTED`, `CANCELLED`                                |
| `SUBMITTED`                       | `MORE_INFORMATION_REQUIRED`, `ACCEPTED`, `DECLINED`, `CANCELLED` |
| `MORE_INFORMATION_REQUIRED`       | `SUBMITTED`, `CANCELLED`                                         |
| `ACCEPTED`                        | `APPOINTMENT_BOOKED`, `ADMITTED`, `CANCELLED`                    |
| `APPOINTMENT_BOOKED`              | `ADMITTED`, `CANCELLED`                                          |
| `ADMITTED`                        | `TREATMENT_IN_PROGRESS`                                          |
| `TREATMENT_IN_PROGRESS`           | `DISCHARGED`                                                     |
| `DISCHARGED`                      | `FOLLOW_UP_ACTIVE`, `CLOSED`                                     |
| `FOLLOW_UP_ACTIVE`                | `CLOSED`                                                         |
| `CLOSED`, `DECLINED`, `CANCELLED` | No forward transition                                            |

## 6. MVP capabilities

### 6.1 Identity, tenancy, and access

- Users belong to an organisation.
- A user has one or more roles.
- Referring users can access only referrals their organisation owns or participates in.
- Receiving users can access only referrals sent to their organisation.
- Owners can access only the approved plan and follow-up form for their pet.
- All access to clinical documents uses expiring signed links.

### 6.2 Referral workspace

- Create, edit, submit, accept, decline, and cancel a referral.
- Show a chronological activity timeline.
- Request and supply missing information.
- Display referral completeness checks.
- Show source documents beside the reviewed summary.

### 6.3 Document and AI workflow

- Accept PDF and image uploads.
- Queue document processing asynchronously.
- Extract text and selected structured clinical facts.
- Generate a referral-summary draft.
- Store confidence, source location, model version, and review status for every extracted item.
- Permit a veterinarian to correct, approve, or reject each draft.
- Never silently overwrite a clinician-approved value.
- Support processing failure, retry, and manual review states.

### 6.4 Discharge and owner follow-up

- Create a professional discharge summary for the referring clinic.
- Create a separate owner-friendly care plan.
- Require clinician approval before either is visible outside the receiving hospital.
- Display medication schedules exactly as entered and approved by a clinician.
- Record owner acknowledgement.
- Collect structured recovery check-ins and one image upload.
- Apply preconfigured deterministic escalation rules.
- Show that an alert requires clinic review and is not a diagnosis.

### 6.5 Auditability

Record:

- authentication and material access events;
- document upload, processing, and download;
- AI-generated fields and their sources;
- human edits, approvals, and rejections;
- referral state changes;
- owner consent and acknowledgement;
- follow-up alert creation and resolution.

Audit events are append-only in the application layer.

## 7. First three synthetic end-to-end cases

### Case A — Canine foreign-body referral

Purpose: demonstrate the normal referral-to-discharge path.

Story:

- A dog is seen at a general clinic after vomiting and reduced appetite.
- The referring clinic attaches a consultation note and diagnostic report.
- The extraction pipeline creates a clinical timeline and draft summary.
- The veterinarian approves the referral.
- The receiving hospital accepts the case and records the encounter through discharge.
- The owner receives an approved recovery plan and completes routine follow-up.

Required system behaviour:

- All summary statements have valid citations.
- Referral completeness passes.
- Status changes follow the legal path.
- The owner sees only approved, owner-facing content.
- The referring clinic receives the final handover.

### Case B — Feline urinary obstruction with missing information

Purpose: demonstrate data completeness, collaboration, and correction.

Story:

- A cat is referred with urinary signs.
- The first submission lacks one required diagnostic attachment.
- VetBridge marks the referral incomplete using deterministic rules.
- The receiving hospital requests the missing information.
- The referring clinic uploads it and resubmits.
- A veterinarian corrects one low-confidence extracted value before approval.

Required system behaviour:

- The missing-information request is visible to both organisations.
- Resubmission preserves the earlier version and audit history.
- The corrected value records the AI draft, human correction, user, and timestamp.
- The case cannot advance to `ACCEPTED` until the receiving user explicitly accepts it.

### Case C — Canine fracture recovery with a follow-up alert

Purpose: demonstrate safety boundaries and human escalation.

Story:

- A dog is discharged after specialist treatment for a fracture.
- A veterinarian approves a structured recovery and follow-up plan.
- The owner submits a check-in and uploads a synthetic wound image.
- A predefined answer combination triggers a `REVIEW_REQUIRED` alert.
- A clinic user reviews and resolves the alert.

Required system behaviour:

- The rule engine explains which submitted answers triggered the alert.
- The system does not diagnose the image or recommend treatment.
- The owner is told to follow the clinic-approved contact instructions.
- Alert acknowledgement and resolution are recorded in the audit trail.

## 8. AI and deterministic responsibility boundary

| AI may do                               | Code or clinician must do                                      |
| --------------------------------------- | -------------------------------------------------------------- |
| Extract candidate facts from documents  | Validate types, required fields, ranges, IDs, and dates        |
| Draft a clinical timeline               | Enforce chronological and relational consistency               |
| Draft a referral or discharge summary   | Approve all externally visible clinical content                |
| Produce an owner-friendly rewrite       | Preserve approved meaning and block unapproved publication     |
| Suggest that information may be missing | Determine required fields using explicit clinic rules          |
| Report confidence and source location   | Enforce referral states, permissions, alerts, and audit events |

## 9. Initial screens

1. Sign in and role-aware landing page
2. Referral inbox
3. Create referral
4. Referral workspace with activity timeline
5. Document review with source-linked extracted fields
6. Receiving hospital review and information request
7. Discharge-plan editor and approval
8. Owner care-plan portal
9. Owner follow-up form
10. Alert queue
11. Audit-event viewer

## 10. Data model boundary

Phase 1 needs these core entities:

- `Organisation`
- `User`
- `OrganisationMembership`
- `Owner`
- `Animal`
- `Encounter`
- `Referral`
- `ReferralStatusEvent`
- `ClinicalDocument`
- `DocumentProcessingJob`
- `ExtractedClinicalFact`
- `ReviewDecision`
- `InformationRequest`
- `DiagnosticResult`
- `MedicationRecord`
- `DischargePlan`
- `FollowUpPlan`
- `FollowUpSubmission`
- `FollowUpAlert`
- `Consent`
- `AuditEvent`

FHIR-shaped resources can be exported through an adapter, but the application database remains the source of truth for workflow state, permissions, review state, and audit data.

## 11. Non-goals for the MVP

- AI diagnosis or differential diagnosis
- Autonomous emergency triage
- Medication or dosage recommendations
- Prescription issuing
- Billing, insurance, stock, or appointment management
- Full practice management functionality
- Production integration with ezyVet, Provet, or another PIMS
- Public sharing of clinical records
- Real patient, owner, or clinic data
- Support for species other than cats and dogs
- Native mobile applications

## 12. Phase 1 acceptance criteria

The product specification is ready for implementation when:

- one complete golden path is defined;
- roles and organisation boundaries are explicit;
- legal referral state transitions are named;
- three synthetic cases cover success, correction, and safety escalation;
- AI and deterministic responsibilities are separated;
- every clinical AI output requires human approval;
- initial screens and core entities are listed;
- MVP non-goals prevent scope creep.

## 13. MVP success criteria

The implemented MVP should eventually demonstrate:

- a complete case in under ten minutes during a recruiter demo;
- source citations for 100% of displayed AI-extracted clinical facts;
- no owner access to unapproved clinical drafts;
- no illegal referral state transition through the API;
- full audit coverage for approvals and state changes;
- reproducible synthetic data generated from a fixed seed;
- automated unit, integration, and end-to-end tests for the golden path;
- a deployed application, architecture diagram, English README, and short demo video.

## 14. Decisions intentionally deferred

These choices should be made in Phase 2, after the domain model is expressed as code:

- exact authentication provider;
- AWS deployment service;
- whether the first document parser uses a managed OCR provider or a local abstraction;
- exact FHIR server implementation;
- notification delivery provider;
- final UI design system;
- production PIMS integration strategy.

## 15. Phase 2 entry point

The next phase is technical foundation:

1. Create the monorepo.
2. Add the web app, API, AI/document service, and shared packages.
3. Express the core entities and state machine in code.
4. Create seed data for the three cases only.
5. Implement authentication stubs and role-aware navigation.
6. Build the referral workspace before expanding to 100 synthetic animals.
