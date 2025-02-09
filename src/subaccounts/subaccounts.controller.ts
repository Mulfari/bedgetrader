import { Controller, Post, Get, Body, Req, UseGuards, UnauthorizedException } from "@nestjs/common";
import { SubaccountsService } from "./subaccounts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("subaccounts")
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  @UseGuards(JwtAuthGuard) 
  @Post()
  async createSubAccount(@Req() req: any, @Body() body: any) {  // 🔹 Añadir tipo 'any' a req y body
    if (!req.user) {
      throw new UnauthorizedException("Usuario no autenticado");
    }
    return this.subaccountsService.createSubAccount(req.user.sub, body);
  }

  // ✅ Nueva ruta para obtener las cuentas del usuario
  @UseGuards(JwtAuthGuard) 
  @Get()
  async getUserSubAccounts(@Req() req: any) {  // 🔹 Añadir tipo 'any' a req
    if (!req.user) {
      throw new UnauthorizedException("Usuario no autenticado");
    }
    return this.subaccountsService.getSubAccounts(req.user.sub);
  }
}
