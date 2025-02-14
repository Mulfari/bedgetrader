import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SubaccountsService } from './subaccounts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('subaccounts')
@UseGuards(JwtAuthGuard) // ✅ Protegemos las rutas con autenticación
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  // ✅ Obtener todas las subcuentas del usuario autenticado
  @Get()
  async getUserSubAccounts(@Req() req) {
    const userId = req.user.sub; // Obtenemos el ID del usuario autenticado
    return this.subaccountsService.getSubAccounts(userId);
  }

  // ✅ Crear una nueva subcuenta
  @Post()
  async createSubAccount(
    @Req() req,
    @Body() body: { exchange: string; name: string; apiKey: string; apiSecret: string },
  ) {
    const userId = req.user.sub;
    return this.subaccountsService.createSubAccount(userId, body.exchange, body.name, body.apiKey, body.apiSecret);
  }

  // ✅ Obtener una subcuenta por ID
  @Get(':id')
  async getSubAccount(@Param('id') subAccountId: string) {
    return this.subaccountsService.getSubAccountById(subAccountId);
  }
}
