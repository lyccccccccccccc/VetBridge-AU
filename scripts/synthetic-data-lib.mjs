import { readFile } from "node:fs/promises";
import path from "node:path";

export const STATUSES = [
  "DRAFT",
  "READY_FOR_REVIEW",
  "SUBMITTED",
  "MORE_INFORMATION_REQUIRED",
  "ACCEPTED",
  "APPOINTMENT_BOOKED",
  "ADMITTED",
  "TREATMENT_IN_PROGRESS",
  "DISCHARGED",
  "FOLLOW_UP_ACTIVE",
  "CLOSED",
  "DECLINED",
  "CANCELLED",
];

export const ALLOWED_TRANSITIONS = {
  DRAFT: ["READY_FOR_REVIEW", "CANCELLED"],
  READY_FOR_REVIEW: ["DRAFT", "SUBMITTED", "CANCELLED"],
  SUBMITTED: ["MORE_INFORMATION_REQUIRED", "ACCEPTED", "DECLINED", "CANCELLED"],
  MORE_INFORMATION_REQUIRED: ["SUBMITTED", "CANCELLED"],
  ACCEPTED: ["APPOINTMENT_BOOKED", "ADMITTED", "CANCELLED"],
  APPOINTMENT_BOOKED: ["ADMITTED", "CANCELLED"],
  ADMITTED: ["TREATMENT_IN_PROGRESS"],
  TREATMENT_IN_PROGRESS: ["DISCHARGED"],
  DISCHARGED: ["FOLLOW_UP_ACTIVE", "CLOSED"],
  FOLLOW_UP_ACTIVE: ["CLOSED"],
  CLOSED: [],
  DECLINED: [],
  CANCELLED: [],
};

export async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

export async function loadCuratedDataset(root) {
  const directory = path.join(root, "data", "synthetic", "v1");
  const catalog = await readJson(path.join(directory, "catalog.json"));
  const cases = await Promise.all(
    catalog.caseFiles.map((filename) =>
      readJson(path.join(directory, filename)),
    ),
  );
  return { catalog, cases };
}

function ensure(condition, message, errors) {
  if (!condition) errors.push(message);
}

function validDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function collectObjectIds(value, ids, duplicates) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjectIds(item, ids, duplicates);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (typeof value.id === "string") {
    if (ids.has(value.id)) duplicates.push(value.id);
    ids.add(value.id);
  }
  for (const nested of Object.values(value)) {
    collectObjectIds(nested, ids, duplicates);
  }
}

function validateStatusSequence(statusEvents, label, errors) {
  for (let index = 0; index < statusEvents.length; index += 1) {
    const event = statusEvents[index];
    const expectedFrom = index === 0 ? null : statusEvents[index - 1].toStatus;
    ensure(
      event.fromStatus === expectedFrom,
      `${label}: event ${event.id} has fromStatus ${event.fromStatus}; expected ${expectedFrom}`,
      errors,
    );
    if (event.fromStatus !== null) {
      ensure(
        ALLOWED_TRANSITIONS[event.fromStatus]?.includes(event.toStatus),
        `${label}: illegal status transition ${event.fromStatus} -> ${event.toStatus}`,
        errors,
      );
    } else {
      ensure(
        event.toStatus === "DRAFT",
        `${label}: first status must be DRAFT`,
        errors,
      );
    }
    ensure(
      validDate(event.occurredAt),
      `${label}: invalid status timestamp`,
      errors,
    );
    if (index > 0) {
      ensure(
        Date.parse(event.occurredAt) >=
          Date.parse(statusEvents[index - 1].occurredAt),
        `${label}: status timestamps are not chronological`,
        errors,
      );
    }
  }
}

export function validateDataset(catalog, cases) {
  const errors = [];
  ensure(catalog.synthetic === true, "catalog: synthetic must be true", errors);
  ensure(
    catalog.schemaVersion === "1.0.0",
    "catalog: unsupported schemaVersion",
    errors,
  );
  ensure(
    Number.isInteger(catalog.seed),
    "catalog: seed must be an integer",
    errors,
  );

  const organisationIds = new Set(catalog.organisations.map(({ id }) => id));
  const identityIds = new Set(catalog.identities.map(({ id }) => id));
  const globalIds = new Set();

  for (const [index, syntheticCase] of cases.entries()) {
    const label = syntheticCase?.scenario?.code ?? `case-${index + 1}`;
    ensure(
      syntheticCase.schemaVersion === "1.0.0",
      `${label}: unsupported schema`,
      errors,
    );
    ensure(
      syntheticCase.synthetic === true,
      `${label}: synthetic must be true`,
      errors,
    );
    ensure(
      syntheticCase.owner.email.endsWith(".invalid"),
      `${label}: owner email must use .invalid`,
      errors,
    );
    ensure(
      /^\+61 400 000 \d{3}$/.test(syntheticCase.owner.phone),
      `${label}: owner phone must be reserved synthetic format`,
      errors,
    );
    ensure(
      syntheticCase.animal.ownerId === syntheticCase.owner.id,
      `${label}: animal.ownerId does not resolve`,
      errors,
    );
    ensure(
      ["DOG", "CAT"].includes(syntheticCase.animal.species),
      `${label}: invalid species`,
      errors,
    );
    ensure(
      syntheticCase.animal.species === "CAT"
        ? !/Labrador|Collie/i.test(syntheticCase.animal.breed)
        : !/Shorthair/i.test(syntheticCase.animal.breed),
      `${label}: breed and species are inconsistent`,
      errors,
    );
    ensure(
      validDate(syntheticCase.animal.dateOfBirth),
      `${label}: invalid birth date`,
      errors,
    );
    ensure(
      syntheticCase.animal.weightKg > 0,
      `${label}: weight must be positive`,
      errors,
    );
    ensure(
      syntheticCase.referral.animalId === syntheticCase.animal.id,
      `${label}: referral.animalId does not resolve`,
      errors,
    );
    ensure(
      organisationIds.has(syntheticCase.referral.referringOrganisationId) &&
        organisationIds.has(syntheticCase.referral.receivingOrganisationId),
      `${label}: referral organisation does not resolve`,
      errors,
    );
    ensure(
      identityIds.has(syntheticCase.referral.createdById),
      `${label}: referral creator does not resolve`,
      errors,
    );

    const encounterIds = new Set(syntheticCase.encounters.map(({ id }) => id));
    for (const encounter of syntheticCase.encounters) {
      ensure(
        encounter.animalId === syntheticCase.animal.id,
        `${label}: encounter animal mismatch`,
        errors,
      );
      ensure(
        organisationIds.has(encounter.organisationId),
        `${label}: encounter organisation missing`,
        errors,
      );
      ensure(
        validDate(encounter.occurredAt),
        `${label}: invalid encounter date`,
        errors,
      );
      for (const medication of encounter.medicationRecords) {
        ensure(
          validDate(medication.startsAt),
          `${label}: invalid medication start`,
          errors,
        );
        if (medication.endsAt !== null) {
          ensure(
            validDate(medication.endsAt),
            `${label}: invalid medication end`,
            errors,
          );
          ensure(
            Date.parse(medication.endsAt) >= Date.parse(medication.startsAt),
            `${label}: medication ends before it starts`,
            errors,
          );
        }
      }
    }
    ensure(
      syntheticCase.referral.encounterIds.every((id) => encounterIds.has(id)),
      `${label}: referral encounter reference does not resolve`,
      errors,
    );
    ensure(
      STATUSES.includes(syntheticCase.referral.status),
      `${label}: invalid current status`,
      errors,
    );
    validateStatusSequence(syntheticCase.referral.statusEvents, label, errors);
    ensure(
      syntheticCase.referral.statusEvents.at(-1)?.toStatus ===
        syntheticCase.referral.status,
      `${label}: current status does not match status history`,
      errors,
    );

    const target = syntheticCase.scenario.targetStatusPath;
    validateStatusSequence(
      target.map((toStatus, targetIndex) => ({
        id: `target-${targetIndex}`,
        fromStatus: targetIndex === 0 ? null : target[targetIndex - 1],
        toStatus,
        occurredAt: new Date(targetIndex * 1000).toISOString(),
      })),
      `${label} target path`,
      errors,
    );

    for (const document of syntheticCase.documents) {
      ensure(
        document.referralId === syntheticCase.referral.id,
        `${label}: document referral mismatch`,
        errors,
      );
      ensure(
        encounterIds.has(document.encounterId),
        `${label}: document encounter missing`,
        errors,
      );
      ensure(
        document.clinicalText.length >= 40,
        `${label}: document clinical text is too short`,
        errors,
      );
      for (const fact of document.facts) {
        ensure(
          fact.confidence >= 0 && fact.confidence <= 1,
          `${label}: invalid fact confidence`,
          errors,
        );
        ensure(
          fact.sourcePage >= 1,
          `${label}: invalid fact source page`,
          errors,
        );
        if (fact.review?.outcome === "CORRECTED") {
          ensure(
            Boolean(fact.review.correctedValue),
            `${label}: corrected fact has no corrected value`,
            errors,
          );
        }
      }
    }

    const ids = new Set();
    const duplicates = [];
    collectObjectIds(syntheticCase, ids, duplicates);
    ensure(
      duplicates.length === 0,
      `${label}: duplicate local IDs: ${duplicates.join(", ")}`,
      errors,
    );
    for (const id of ids) {
      ensure(
        !globalIds.has(id),
        `${label}: duplicate ID across cases: ${id}`,
        errors,
      );
      globalIds.add(id);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    counts: {
      cases: cases.length,
      animals: cases.length,
      encounters: cases.reduce(
        (count, item) => count + item.encounters.length,
        0,
      ),
      documents: cases.reduce(
        (count, item) => count + item.documents.length,
        0,
      ),
      facts: cases.reduce(
        (count, item) =>
          count +
          item.documents.reduce(
            (subtotal, document) => subtotal + document.facts.length,
            0,
          ),
        0,
      ),
      auditEvents: cases.reduce(
        (count, item) => count + item.auditEvents.length,
        0,
      ),
    },
  };
}
