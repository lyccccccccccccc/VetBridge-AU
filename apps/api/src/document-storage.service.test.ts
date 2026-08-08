import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DocumentStorageService } from "./document-storage.service.js";

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe("DocumentStorageService", () => {
  it("stores an allowed file locally during development", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "vetbridge-upload-"));
    process.env.NODE_ENV = "test";
    process.env.VETBRIDGE_STORAGE = "local";
    process.env.VETBRIDGE_UPLOAD_DIR = directory;
    const service = new DocumentStorageService();
    const file = {
      mimetype: "application/pdf",
      buffer: Buffer.from("synthetic record"),
      size: 16,
    } as Express.Multer.File;

    const key = await service.save(file);
    const stored = await readFile(
      path.join(directory, key.replace("local://", "")),
    );
    expect(stored.toString()).toBe("synthetic record");
    await rm(directory, { recursive: true, force: true });
  });

  it("refuses ephemeral local storage in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.VETBRIDGE_STORAGE = "local";
    const service = new DocumentStorageService();
    const file = {
      mimetype: "image/png",
      buffer: Buffer.from("synthetic image"),
      size: 15,
    } as Express.Multer.File;

    await expect(service.save(file)).rejects.toThrow(
      "Production uploads require VETBRIDGE_STORAGE=s3",
    );
  });
});
