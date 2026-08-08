import { Controller, Get } from "@nestjs/common";

import { DemoStoreService } from "./demo-store.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly store: DemoStoreService) {}

  @Get()
  health(): {
    service: string;
    status: "ok";
    persistence: "postgresql" | "memory";
  } {
    return {
      service: "vetbridge-api",
      status: "ok",
      persistence: this.store.storageMode(),
    };
  }
}
