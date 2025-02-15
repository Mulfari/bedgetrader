import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { SubaccountsService } from "./subaccounts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("subaccounts")
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  // ✅ Obtener todas las subcuentas del usuario autenticado
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

  // ✅ Crear una nueva subcuenta
  @UseGuards(JwtAuthGuard)
  @Post()
  async createSubAccount(
    @Request() req,
    @Body() body: { exchange: string; apiKey: string; apiSecret: string; name: string }
  ) {
    try {
      return await this.subaccountsService.createSubAccount(req.user.sub, body);
    } catch (error) {
      console.error("❌ Error creando subcuenta:", error);
      throw new HttpException("Error al crear la subcuenta", HttpStatus.BAD_REQUEST);
    }
  }

  // ✅ Obtener API Keys de una subcuenta específica
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

  // ✅ Obtener el balance de una subcuenta
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

  // ✅ Eliminar una subcuenta
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async deleteSubAccount(@Param("id") id: string, @Request() req) {
    try {
      return await this.subaccountsService.deleteSubAccount(id, req.user.sub);
    } catch (error) {
      console.error("❌ Error eliminando subcuenta:", error);
      throw new HttpException("Error al eliminar la subcuenta", HttpStatus.BAD_REQUEST);
    }
  }
}
