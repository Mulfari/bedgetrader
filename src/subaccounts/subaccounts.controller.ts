import { Controller, Post, Get, Body, Req, UseGuards, UnauthorizedException } from "@nestjs/common";
import { SubaccountsService } from "./subaccounts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("subaccounts")
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  // ✅ Endpoint para crear una nueva subcuenta
  @UseGuards(JwtAuthGuard)
  @Post()
  async createSubAccount(@Req() req: any, @Body() body: any) {
    if (!req.user) {
      throw new UnauthorizedException("Usuario no autenticado");
    }
    return this.subaccountsService.createSubAccount(req.user.sub, body);
  }

  // ✅ Endpoint para obtener las subcuentas del usuario
  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserSubAccounts(@Req() req: any) {
    if (!req.user) {
      throw new UnauthorizedException("Usuario no autenticado");
    }
    return this.subaccountsService.getSubAccounts(req.user.sub);
  }

  // ✅ Nuevo endpoint para obtener balances de subcuentas
  @UseGuards(JwtAuthGuard)
  @Get("balances")
  async getSubAccountBalances(@Req() req: any) {
    if (!req.user) {
      throw new UnauthorizedException("Usuario no autenticado");
    }
    return this.subaccountsService.getSubAccountBalances(req.user.sub);
  }
}
