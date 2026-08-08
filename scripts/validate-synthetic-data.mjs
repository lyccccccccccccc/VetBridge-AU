import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadCuratedDataset,
  readJson,
  validateDataset,
} from "./synthetic-data-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = process.argv
  .find((argument) => argument.startsWith("--file="))
  ?.slice(7);

const { catalog, cases } = generatedPath
  ? await readJson(path.resolve(root, generatedPath))
  : await loadCuratedDataset(root);

const result = validateDataset(catalog, cases);
if (!result.valid) {
  console.error(
    `Synthetic dataset validation failed with ${result.errors.length} error(s):`,
  );
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Synthetic dataset is valid: ${JSON.stringify(result.counts)}`);
}
