import { Controller, Post, Get, Req, UseGuards, UnauthorizedException, Body } from "@nestjs/common";
import { SubaccountsService } from "./subaccounts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("subaccounts")
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createSubAccount(@Req() req: any, @Body() body: any) {
    if (!req.user) {
      throw new UnauthorizedException("Usuario no autenticado");
    }
    return this.subaccountsService.createSubAccount(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserSubAccounts(@Req() req: any) {
    if (!req.user) {
      throw new UnauthorizedException("Usuario no autenticado");
    }
    return this.subaccountsService.getSubAccounts(req.user.sub);
  }

  // ✅ Ruta corregida para obtener los balances de las subcuentas
  @UseGuards(JwtAuthGuard)
  @Get("balances")
  async getSubAccountBalances(@Req() req: any) {
    if (!req.user) {
      throw new UnauthorizedException("Usuario no autenticado");
    }
    return this.subaccountsService.getSubAccountBalances(req.user.sub);
  }
}
