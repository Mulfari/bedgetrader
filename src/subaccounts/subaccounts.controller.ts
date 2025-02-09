import { Controller, Post, Body, Req, UseGuards } from "@nestjs/common";
import { SubaccountsService } from "./subaccounts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("subaccounts")
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  @UseGuards(JwtAuthGuard) // Protege con JWT
  @Post()
  async createSubAccount(@Req() req, @Body() body) {
    console.log("📥 Recibiendo solicitud en /subaccounts", body);

    const userId = req.user.sub; // Obtener userId desde JWT
    return this.subaccountsService.createSubAccount(userId, body);
  }
}
