import { Controller, Get, Param, Request, UseGuards, HttpException, HttpStatus } from "@nestjs/common";
import { SubaccountsService } from "./subaccounts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("subaccounts")
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getSubAccounts(@Request() req) {
    try {
      return await this.subaccountsService.getSubAccounts(req.user.sub);
    } catch (error) {
      console.error("❌ Error obteniendo subcuentas:", error);
      throw new HttpException("Error al obtener subcuentas", HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/keys")
  async getSubAccountKeys(@Param("id") id: string, @Request() req) {
    try {
      return await this.subaccountsService.getSubAccountKeys(id, req.user.sub);
    } catch (error) {
      console.error("❌ Error obteniendo API Keys:", error);
      throw new HttpException("Error al obtener API Keys", HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/balance")
  async getBalance(@Param("id") id: string) {
    try {
      return await this.subaccountsService.getBybitBalance(id);
    } catch (error) {
      console.error("❌ Error obteniendo balance:", error);
      throw new HttpException("Error al obtener el balance", HttpStatus.BAD_REQUEST);
    }
  }
}
