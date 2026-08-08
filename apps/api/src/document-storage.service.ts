import { BadRequestException, Injectable } from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ALLOWED_TYPES = new Map([
  ["application/pdf", ".pdf"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
]);

@Injectable()
export class DocumentStorageService {
  readonly maximumBytes = 5 * 1024 * 1024;

  accepts(mimeType: string): boolean {
    return ALLOWED_TYPES.has(mimeType);
  }

  async save(file: Express.Multer.File): Promise<string> {
    const extension = ALLOWED_TYPES.get(file.mimetype);
    if (!extension) {
      throw new BadRequestException("Only PDF, JPEG and PNG files are allowed");
    }
    const storageKey = `${randomUUID()}${extension}`;
    if (process.env.VETBRIDGE_STORAGE === "s3") {
      const bucket = process.env.S3_BUCKET;
      if (!bucket) throw new Error("S3_BUCKET is required for S3 storage");
      const client = new S3Client({
        region: process.env.S3_REGION ?? "auto",
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      });
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: file.buffer,
          ContentType: file.mimetype,
          ContentLength: file.size,
          Metadata: { synthetic: "true" },
        }),
      );
      return `s3://${bucket}/${storageKey}`;
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Production uploads require VETBRIDGE_STORAGE=s3; local disk is intentionally disabled",
      );
    }
    const uploadRoot =
      process.env.VETBRIDGE_UPLOAD_DIR ??
      path.resolve(process.cwd(), "data/uploads");
    await mkdir(uploadRoot, { recursive: true });
    await writeFile(path.join(uploadRoot, storageKey), file.buffer, {
      flag: "wx",
    });
    return `local://${storageKey}`;
  }
}
