import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";

import { DemoStoreService } from "./demo-store.service.js";
import { DocumentStorageService } from "./document-storage.service.js";

@Controller("referrals")
export class DocumentUploadController {
  constructor(
    private readonly store: DemoStoreService,
    private readonly storage: DocumentStorageService,
  ) {}

  @Post(":referralId/documents")
  @HttpCode(202)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(
    @Headers("x-demo-user") userId: string | undefined,
    @Param("referralId") referralId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("Attach one PDF, JPEG or PNG file");
    }
    if (!this.storage.accepts(file.mimetype)) {
      throw new BadRequestException("Only PDF, JPEG and PNG files are allowed");
    }
    const storageKey = await this.storage.save(file);
    const result = await this.store.addDocument(userId ?? "", referralId, {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storageKey,
    });

    setImmediate(() => {
      void this.store.processDocument(result.documentId);
    });
    return {
      ...result,
      processing: {
        status: "QUEUED",
        message:
          "The document was stored and queued. Any extracted facts require clinician review.",
      },
    };
  }
}
