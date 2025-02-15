import { Controller, Get, Param, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { SubaccountsService } from './subaccounts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('subaccounts')
@UseGuards(JwtAuthGuard) // Protegemos las rutas con autenticación
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  // ✅ Obtener todas las subcuentas del usuario autenticado
  @Get()
  async getUserSubAccounts(@Req() req) {
    const userId = req.user.sub;
    return this.subaccountsService.getSubAccounts(userId);
  }

  // ✅ Obtener API Keys de una subcuenta específica
  @Get(':id/keys')
  async getSubAccountKeys(@Req() req, @Param('id') subAccountId: string) {
    const userId = req.user.sub;
    const keys = await this.subaccountsService.getSubAccountKeys(userId, subAccountId);
    if (!keys) {
      throw new NotFoundException('No se encontraron API Keys para esta subcuenta.');
    }
    return keys;
  }
}
