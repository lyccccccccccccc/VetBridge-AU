import {
  AlertStatus,
  DocumentStatus,
  OrganisationType,
  PrismaClient,
  ReferralStatus,
  ReviewOutcome,
  Species,
  UserRole,
} from "@prisma/client";

import { FIXTURE_DATE, fixtureIds, syntheticCases } from "./fixtures.js";

const prisma = new PrismaClient();

function atDay(day: number): Date {
  return new Date(FIXTURE_DATE.getTime() + day * 86_400_000);
}

async function seedBaseData(): Promise<void> {
  await prisma.organisation.createMany({
    data: [
      {
        id: fixtureIds.referringClinic,
        name: "Greville General Vet (Synthetic)",
        type: OrganisationType.REFERRING_CLINIC,
      },
      {
        id: fixtureIds.receivingHospital,
        name: "River City Specialist Hospital (Synthetic)",
        type: OrganisationType.RECEIVING_HOSPITAL,
      },
    ],
  });

  await prisma.user.createMany({
    data: [
      {
        id: fixtureIds.referringVet,
        email: "maya.chen@example.invalid",
        displayName: "Dr Maya Chen",
      },
      {
        id: fixtureIds.receivingVet,
        email: "oliver.smith@example.invalid",
        displayName: "Dr Oliver Smith",
      },
      {
        id: fixtureIds.admin,
        email: "emma.jones@example.invalid",
        displayName: "Emma Jones",
      },
    ],
  });

  await prisma.organisationMembership.createMany({
    data: [
      {
        id: "membership-referring-vet",
        organisationId: fixtureIds.referringClinic,
        userId: fixtureIds.referringVet,
        role: UserRole.REFERRING_VET,
      },
      {
        id: "membership-receiving-vet",
        organisationId: fixtureIds.receivingHospital,
        userId: fixtureIds.receivingVet,
        role: UserRole.RECEIVING_CLINICIAN,
      },
      {
        id: "membership-admin",
        organisationId: fixtureIds.receivingHospital,
        userId: fixtureIds.admin,
        role: UserRole.ORGANISATION_ADMIN,
      },
    ],
  });
}

async function seedCase(
  data: (typeof syntheticCases)[number],
  index: number,
): Promise<void> {
  const encounterId = [fixtureIds.caseA, fixtureIds.caseB, fixtureIds.caseC][
    index
  ]!.encounter;

  await prisma.owner.create({ data: data.owner });
  await prisma.animal.create({
    data: {
      ...data.animal,
      species: Species[data.animal.species],
      ownerId: data.owner.id,
    },
  });
  await prisma.encounter.create({
    data: {
      id: encounterId,
      animalId: data.animal.id,
      organisationId: fixtureIds.referringClinic,
      occurredAt: atDay(index),
      summary: data.reason,
    },
  });
  await prisma.referral.create({
    data: {
      id: data.id,
      animalId: data.animal.id,
      referringOrganisationId: fixtureIds.referringClinic,
      receivingOrganisationId: fixtureIds.receivingHospital,
      createdById: fixtureIds.referringVet,
      reason: data.reason,
      status: ReferralStatus[data.statusPath.at(-1)!],
      submittedAt: atDay(index + 1),
    },
  });

  for (const [eventIndex, toStatus] of data.statusPath.entries()) {
    const fromStatus = data.statusPath[eventIndex - 1] ?? null;
    const receivingAction = [
      "MORE_INFORMATION_REQUIRED",
      "ACCEPTED",
      "APPOINTMENT_BOOKED",
      "ADMITTED",
      "TREATMENT_IN_PROGRESS",
      "DISCHARGED",
      "FOLLOW_UP_ACTIVE",
    ].includes(toStatus);

    await prisma.referralStatusEvent.create({
      data: {
        id: `${data.id}-status-${eventIndex}`,
        referralId: data.id,
        fromStatus: fromStatus ? ReferralStatus[fromStatus] : null,
        toStatus: ReferralStatus[toStatus],
        changedById: receivingAction
          ? fixtureIds.receivingVet
          : fixtureIds.referringVet,
        occurredAt: atDay(index + eventIndex),
      },
    });
  }

  await prisma.consent.create({
    data: {
      id: `${data.id}-consent`,
      ownerId: data.owner.id,
      referralId: data.id,
      scope: "REFERRAL_AND_FOLLOW_UP",
      grantedAt: atDay(index),
    },
  });
}

async function seedCaseDetails(): Promise<void> {
  await prisma.clinicalDocument.create({
    data: {
      id: "document-a-note",
      referralId: fixtureIds.caseA.referral,
      encounterId: fixtureIds.caseA.encounter,
      uploadedById: fixtureIds.referringVet,
      uploadedByOrganisationId: fixtureIds.referringClinic,
      filename: "buddy-consultation-note.pdf",
      mimeType: "application/pdf",
      storageKey: "synthetic/case-a/buddy-consultation-note.pdf",
      status: DocumentStatus.APPROVED,
    },
  });
  await prisma.extractedClinicalFact.create({
    data: {
      id: "fact-a-vomiting",
      documentId: "document-a-note",
      factType: "CLINICAL_SIGN",
      candidateValue: { value: "vomiting", durationHours: 24 },
      confidence: 0.96,
      sourcePage: 1,
      sourceSection: "Presenting complaint",
      modelVersion: "synthetic-extractor-v1",
    },
  });
  await prisma.reviewDecision.create({
    data: {
      id: "review-a-vomiting",
      extractedFactId: "fact-a-vomiting",
      reviewerId: fixtureIds.referringVet,
      outcome: ReviewOutcome.APPROVED,
    },
  });

  await prisma.clinicalDocument.create({
    data: {
      id: "document-b-lab",
      referralId: fixtureIds.caseB.referral,
      encounterId: fixtureIds.caseB.encounter,
      uploadedById: fixtureIds.referringVet,
      uploadedByOrganisationId: fixtureIds.referringClinic,
      filename: "luna-diagnostic-results.pdf",
      mimeType: "application/pdf",
      storageKey: "synthetic/case-b/luna-diagnostic-results.pdf",
      status: DocumentStatus.APPROVED,
    },
  });
  await prisma.informationRequest.create({
    data: {
      id: "info-request-b",
      referralId: fixtureIds.caseB.referral,
      message: "Please attach the urinalysis results before review.",
      requestedAt: atDay(4),
      resolvedAt: atDay(5),
    },
  });
  await prisma.extractedClinicalFact.create({
    data: {
      id: "fact-b-potassium",
      documentId: "document-b-lab",
      factType: "LAB_RESULT",
      candidateValue: { name: "Potassium", value: 4.1, unit: "mmol/L" },
      confidence: 0.58,
      sourcePage: 1,
      sourceSection: "Biochemistry",
      modelVersion: "synthetic-extractor-v1",
    },
  });
  await prisma.reviewDecision.create({
    data: {
      id: "review-b-potassium",
      extractedFactId: "fact-b-potassium",
      reviewerId: fixtureIds.referringVet,
      outcome: ReviewOutcome.CORRECTED,
      correctedValue: { name: "Potassium", value: 4.7, unit: "mmol/L" },
    },
  });

  await prisma.dischargePlan.create({
    data: {
      id: "discharge-c",
      referralId: fixtureIds.caseC.referral,
      encounterId: fixtureIds.caseC.encounter,
      clinicalSummary:
        "Synthetic post-operative fracture care handover approved for demonstration.",
      ownerInstructions:
        "Follow the clinic-entered activity restriction and contact instructions.",
      approvedAt: atDay(10),
      approvedByName: "Dr Oliver Smith",
    },
  });
  await prisma.followUpPlan.create({
    data: {
      id: "follow-up-c",
      referralId: fixtureIds.caseC.referral,
      contactInstructions:
        "Contact River City Specialist Hospital using the approved discharge instructions.",
      startsAt: atDay(10),
      endsAt: atDay(24),
    },
  });
  await prisma.followUpSubmission.create({
    data: {
      id: "follow-up-submission-c",
      followUpPlanId: "follow-up-c",
      ownerId: fixtureIds.caseC.owner,
      answers: {
        appetite: "REDUCED",
        weightBearing: "WORSE_THAN_YESTERDAY",
        woundDischarge: true,
      },
      imageStorageKey: "synthetic/case-c/wound-check.jpg",
      submittedAt: atDay(12),
    },
  });
  await prisma.followUpAlert.create({
    data: {
      id: "alert-c",
      followUpSubmissionId: "follow-up-submission-c",
      status: AlertStatus.REVIEW_REQUIRED,
      triggerReasons: [
        "weightBearing=WORSE_THAN_YESTERDAY",
        "woundDischarge=true",
      ],
    },
  });
}

async function main(): Promise<void> {
  await prisma.$transaction([
    prisma.auditEvent.deleteMany(),
    prisma.followUpAlert.deleteMany(),
    prisma.followUpSubmission.deleteMany(),
    prisma.followUpPlan.deleteMany(),
    prisma.dischargePlan.deleteMany(),
    prisma.medicationRecord.deleteMany(),
    prisma.diagnosticResult.deleteMany(),
    prisma.informationRequest.deleteMany(),
    prisma.reviewDecision.deleteMany(),
    prisma.extractedClinicalFact.deleteMany(),
    prisma.documentProcessingJob.deleteMany(),
    prisma.clinicalDocument.deleteMany(),
    prisma.referralStatusEvent.deleteMany(),
    prisma.consent.deleteMany(),
    prisma.referral.deleteMany(),
    prisma.encounter.deleteMany(),
    prisma.animal.deleteMany(),
    prisma.owner.deleteMany(),
    prisma.organisationMembership.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organisation.deleteMany(),
  ]);

  await seedBaseData();
  for (const [index, syntheticCase] of syntheticCases.entries()) {
    await seedCase(syntheticCase, index);
  }
  await seedCaseDetails();
  console.log(`Seeded ${syntheticCases.length} synthetic VetBridge cases.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
