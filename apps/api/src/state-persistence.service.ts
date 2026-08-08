import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Prisma, PrismaClient } from "@vetbridge/database";

import type { DemoReferral } from "./synthetic-data.js";

const WORKSPACE_ID = "portfolio-demo";

type WorkspacePayload = {
  referrals: DemoReferral[];
  sequence: number;
};

@Injectable()
export class StatePersistenceService implements OnModuleDestroy {
  private readonly logger = new Logger(StatePersistenceService.name);
  private readonly client =
    process.env.DATABASE_URL && process.env.VETBRIDGE_STORE !== "memory"
      ? new PrismaClient()
      : null;

  get mode(): "postgresql" | "memory" {
    return this.client ? "postgresql" : "memory";
  }

  async load(): Promise<WorkspacePayload | null> {
    if (!this.client) return null;
    const state = await this.client.demoWorkspaceState.findUnique({
      where: { id: WORKSPACE_ID },
    });
    if (!state) return null;
    return state.payload as unknown as WorkspacePayload;
  }

  async save(payload: WorkspacePayload): Promise<void> {
    if (!this.client) return;
    await this.client.$transaction(async (transaction) => {
      const current = await transaction.demoWorkspaceState.findUnique({
        where: { id: WORKSPACE_ID },
        select: { revision: true },
      });
      await transaction.demoWorkspaceState.upsert({
        where: { id: WORKSPACE_ID },
        create: {
          id: WORKSPACE_ID,
          payload: payload as unknown as Prisma.InputJsonValue,
          revision: 1,
        },
        update: {
          payload: payload as unknown as Prisma.InputJsonValue,
          revision: (current?.revision ?? 0) + 1,
        },
      });
    });
  }

  async clear(): Promise<void> {
    if (!this.client) return;
    await this.client.demoWorkspaceState.deleteMany({
      where: { id: WORKSPACE_ID },
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
      this.logger.log("PostgreSQL demo workspace disconnected");
    }
  }
}
