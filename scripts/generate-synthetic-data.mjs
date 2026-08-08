import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCuratedDataset, validateDataset } from "./synthetic-data-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const countArgument = process.argv.find((argument) =>
  argument.startsWith("--count="),
);
const count = countArgument ? Number(countArgument.slice(8)) : 100;
const seedArgument = process.argv.find((argument) =>
  argument.startsWith("--seed="),
);
const seed = seedArgument ? Number(seedArgument.slice(7)) : 2026;

if (!Number.isInteger(count) || count < 3 || count > 10_000) {
  throw new Error("--count must be an integer between 3 and 10000");
}
if (!Number.isInteger(seed)) throw new Error("--seed must be an integer");

function mulberry32(initialSeed) {
  let value = initialSeed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectIds(value, ids) {
  if (Array.isArray(value)) {
    for (const item of value) collectIds(item, ids);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (typeof value.id === "string") ids.add(value.id);
  for (const nested of Object.values(value)) collectIds(nested, ids);
}

function replaceReferences(value, mapping) {
  if (Array.isArray(value))
    return value.map((item) => replaceReferences(item, mapping));
  if (!value || typeof value !== "object") {
    return typeof value === "string" && mapping.has(value)
      ? mapping.get(value)
      : value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      key === "id" && typeof nested === "string"
        ? (mapping.get(nested) ?? nested)
        : replaceReferences(nested, mapping),
    ]),
  );
}

function shiftTimestamps(value, days) {
  if (Array.isArray(value))
    return value.map((item) => shiftTimestamps(item, days));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => {
      if (
        typeof nested === "string" &&
        /(At|Date)$/.test(key) &&
        !Number.isNaN(Date.parse(nested))
      ) {
        return [
          key,
          new Date(Date.parse(nested) + days * 86_400_000).toISOString(),
        ];
      }
      return [key, shiftTimestamps(nested, days)];
    }),
  );
}

const dogNames = [
  "Buddy",
  "Max",
  "Milo",
  "Ruby",
  "Archie",
  "Poppy",
  "Teddy",
  "Daisy",
];
const catNames = [
  "Luna",
  "Leo",
  "Mochi",
  "Cleo",
  "Misty",
  "Nala",
  "Oscar",
  "Pepper",
];
const dogBreeds = [
  "Labrador Retriever",
  "Border Collie",
  "Cavoodle",
  "Australian Kelpie",
];
const catBreeds = [
  "Domestic Shorthair",
  "Domestic Medium Hair",
  "Ragdoll",
  "Burmese",
];
const random = mulberry32(seed);
const { catalog: curatedCatalog, cases: curatedCases } =
  await loadCuratedDataset(root);
const cases = [];

for (let index = 0; index < count; index += 1) {
  if (index < curatedCases.length) {
    cases.push(deepClone(curatedCases[index]));
    continue;
  }

  const number = index + 1;
  const source = deepClone(curatedCases[index % curatedCases.length]);
  const existingIds = new Set();
  collectIds(source, existingIds);
  const suffix = `g${String(number).padStart(3, "0")}`;
  const mapping = new Map(
    [...existingIds].map((id) => [id, `${id}-${suffix}`]),
  );
  let generated = replaceReferences(source, mapping);
  generated = shiftTimestamps(generated, Math.floor(random() * 180) - 90);

  const isDog = generated.animal.species === "DOG";
  const names = isDog ? dogNames : catNames;
  const breeds = isDog ? dogBreeds : catBreeds;
  generated.owner.displayName = `Synthetic Owner ${String(number).padStart(3, "0")}`;
  generated.owner.email = `owner-${String(number).padStart(3, "0")}@example.invalid`;
  generated.owner.phone = `+61 400 000 ${String(number).padStart(3, "0")}`;
  generated.animal.name = names[Math.floor(random() * names.length)];
  generated.animal.breed = breeds[Math.floor(random() * breeds.length)];
  generated.animal.weightKg = Number(
    (isDog ? 8 + random() * 28 : 3.2 + random() * 4.8).toFixed(1),
  );
  generated.animal.microchipNumber = `900000000${String(number).padStart(6, "0")}`;
  generated.referral.displayId = `VB-2026-${String(number).padStart(3, "0")}`;
  generated.scenario.title = `${generated.animal.name} — generated ${generated.scenario.code
    .toLowerCase()
    .replaceAll("_", " ")}`;
  cases.push(generated);
}

const catalog = {
  ...curatedCatalog,
  datasetId: `vetbridge-generated-${count}-seed-${seed}`,
  seed,
  generatedAt: "2026-07-30T00:00:00.000Z",
  description: `${count} deterministic fictional longitudinal veterinary cases generated from three curated scenario templates. Not for clinical use.`,
  caseFiles: undefined,
};
delete catalog.caseFiles;

const dataset = { catalog, cases };
const validation = validateDataset(catalog, cases);
if (!validation.valid) {
  throw new Error(
    `Generated data failed validation:\n${validation.errors.join("\n")}`,
  );
}

const outputDirectory = path.join(root, "data", "synthetic", "v1", "generated");
await mkdir(outputDirectory, { recursive: true });
const outputPath = path.join(
  outputDirectory,
  `dataset-${count}-seed-${seed}.json`,
);
await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
console.log(`Generated ${count} cases at ${path.relative(root, outputPath)}`);
console.log(`Counts: ${JSON.stringify(validation.counts)}`);
