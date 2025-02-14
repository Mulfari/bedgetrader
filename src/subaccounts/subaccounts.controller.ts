import { Controller, Get, Param, Req, UseGuards, UnauthorizedException } from "@nestjs/common";
import { SubaccountsService } from "./subaccounts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("subaccounts")
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserSubAccounts(@Req() req: any) {
    if (!req.user) throw new UnauthorizedException("Usuario no autenticado");
    return this.subaccountsService.getSubAccounts(req.user.sub);
  }

  // ✅ Nuevo endpoint para obtener API keys de una subcuenta
  @UseGuards(JwtAuthGuard)
  @Get(":id/keys")
  async getSubAccountKeys(@Req() req: any, @Param("id") subAccountId: string) {
    if (!req.user) throw new UnauthorizedException("Usuario no autenticado");
    return this.subaccountsService.getSubAccountKeys(req.user.sub, subAccountId);
  }
}
