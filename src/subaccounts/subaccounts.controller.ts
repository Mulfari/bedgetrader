import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { SubaccountsService } from './subaccounts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('subaccounts')
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  // ✅ Obtener todas las subcuentas del usuario
  @UseGuards(JwtAuthGuard)
  @Get()
  async getSubAccounts(@Req() req) {
    const userId = req.user.sub; // ID del usuario autenticado
    return this.subaccountsService.getSubAccounts(userId);
  }

  // ✅ Crear una nueva subcuenta
  @UseGuards(JwtAuthGuard)
  @Post()
  async createSubAccount(@Req() req, @Body() body: { exchange: string; apiKey: string; apiSecret: string; name: string }) {
    const userId = req.user.sub; // ID del usuario autenticado
    return this.subaccountsService.createSubAccount(userId, body.exchange, body.apiKey, body.apiSecret, body.name);
  }

  // ✅ Obtener una subcuenta específica por ID
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getSubAccount(@Req() req, @Param('id') subAccountId: string) {
    const userId = req.user.sub;
    return this.subaccountsService.getSubAccount(userId, subAccountId);
  }

  // ✅ Actualizar una subcuenta
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateSubAccount(
    @Req() req,
    @Param('id') subAccountId: string,
    @Body() body: { exchange: string; apiKey: string; apiSecret: string; name: string }
  ) {
    const userId = req.user.sub;
    return this.subaccountsService.updateSubAccount(userId, subAccountId, body.exchange, body.apiKey, body.apiSecret, body.name);
  }

  // ✅ Eliminar una subcuenta
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteSubAccount(@Req() req, @Param('id') subAccountId: string) {
    const userId = req.user.sub;
    return this.subaccountsService.deleteSubAccount(userId, subAccountId);
  }

  // ✅ Obtener las API Keys de una subcuenta para que el frontend haga la solicitud del balance
  @UseGuards(JwtAuthGuard)
  @Get(':id/keys')
  async getSubAccountKeys(@Req() req, @Param('id') subAccountId: string) {
    const userId = req.user.sub;
    return this.subaccountsService.getSubAccountKeys(userId, subAccountId);
  }
}
