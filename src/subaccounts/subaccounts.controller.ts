import { Controller, Post, Body, Req, UseGuards, UnauthorizedException } from "@nestjs/common";
import { SubaccountsService } from "./subaccounts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("subaccounts")
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createSubAccount(@Req() req, @Body() body) {
    console.log("🔹 Encabezado Authorization recibido:", req.headers.authorization); // ✅ Verifica si el token llega
  
    if (!req.user) {
      console.log("🚨 No hay usuario en `req.user`.");
      throw new UnauthorizedException("Usuario no autenticado");
    }
  
    console.log("✅ Usuario autenticado:", req.user);
  
    return this.subaccountsService.createSubAccount(req.user.sub, body);
  }
  
}
