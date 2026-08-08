import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ReferralStatus } from "@vetbridge/domain";

export const FIXTURE_DATE = new Date("2026-07-30T00:00:00.000Z");

export const fixtureIds = {
  referringClinic: "org-greville-general",
  receivingHospital: "org-rivercity-specialist",
  referringVet: "user-maya-chen",
  receivingVet: "user-oliver-smith",
  admin: "user-emma-jones",
  caseA: {
    owner: "owner-a",
    animal: "animal-buddy",
    encounter: "encounter-a",
    referral: "referral-a",
  },
  caseB: {
    owner: "owner-b",
    animal: "animal-luna",
    encounter: "encounter-b",
    referral: "referral-b",
  },
  caseC: {
    owner: "owner-c",
    animal: "animal-max",
    encounter: "encounter-c-referring",
    referral: "referral-c",
  },
} as const;

type CanonicalCase = {
  scenario: {
    title: string;
    targetStatusPath: ReferralStatus[];
  };
  owner: {
    id: string;
    displayName: string;
    email: string;
  };
  animal: {
    id: string;
    name: string;
    species: "DOG" | "CAT";
    breed: string;
    sex: string;
    desexed: boolean;
    dateOfBirth: string;
  };
  referral: {
    id: string;
    reason: string;
    statusEvents: Array<{ toStatus: ReferralStatus }>;
  };
};

function dataDirectory(): string {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), "data/synthetic/v1"),
    path.resolve(process.cwd(), "../../data/synthetic/v1"),
    path.resolve(moduleDirectory, "../../../data/synthetic/v1"),
  ];
  const found = candidates.find((candidate) =>
    existsSync(path.join(candidate, "catalog.json")),
  );
  if (!found) throw new Error("Canonical synthetic data directory not found");
  return found;
}

const directory = dataDirectory();
const catalog = JSON.parse(
  readFileSync(path.join(directory, "catalog.json"), "utf8"),
) as { caseFiles: string[] };
const canonicalCases = catalog.caseFiles.map(
  (filename) =>
    JSON.parse(
      readFileSync(path.join(directory, filename), "utf8"),
    ) as CanonicalCase,
);

if (canonicalCases.length !== 3) {
  throw new Error(
    `Expected three curated cases, received ${canonicalCases.length}`,
  );
}

function toFixture(item: CanonicalCase) {
  return {
    id: item.referral.id,
    label: item.scenario.title,
    animal: {
      ...item.animal,
      dateOfBirth: new Date(`${item.animal.dateOfBirth}T00:00:00.000Z`),
    },
    owner: item.owner,
    reason: item.referral.reason,
    statusPath: item.referral.statusEvents.map(({ toStatus }) => toStatus),
  };
}

export const syntheticCases = [
  toFixture(canonicalCases[0]!),
  toFixture(canonicalCases[1]!),
  toFixture(canonicalCases[2]!),
] as const;
