import { Controller, Get, Post } from "@nestjs/common";

import { DemoStoreService } from "./demo-store.service.js";

@Controller("demo")
export class DemoController {
  constructor(private readonly store: DemoStoreService) {}

  @Get("identities")
  listIdentities() {
    return this.store.listIdentities();
  }

  @Post("reset")
  reset() {
    return this.store.reset();
  }
}
