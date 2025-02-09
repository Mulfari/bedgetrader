import { Controller, Post, Body, Req, UseGuards, UnauthorizedException } from "@nestjs/common";
import { SubaccountsService } from "./subaccounts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("subaccounts")
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  @UseGuards(JwtAuthGuard) // ✅ Protege la ruta con JWT
  @Post()
  async createSubAccount(@Req() req, @Body() body) {
    console.log("🔹 Token recibido en el backend:", req.headers.authorization); // ✅ Verifica si el token llega

    if (!req.user) {
      throw new UnauthorizedException("Usuario no autenticado");
    }

    return this.subaccountsService.createSubAccount(req.user.sub, body);
  }
}
