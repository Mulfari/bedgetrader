import { Controller, Post, Body, Req, UseGuards } from "@nestjs/common";
import { SubaccountsService } from "./subaccounts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard"; // Importamos el guard

@Controller("subaccounts")
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  @UseGuards(JwtAuthGuard) // Protege la ruta con JWT
  @Post()
  async createSubAccount(@Req() req, @Body() body) {
    const userId = req.user.sub; // Obtiene el userId del token JWT
    return this.subaccountsService.createSubAccount(userId, body);
  }
}
