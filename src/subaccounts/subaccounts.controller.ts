import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SubaccountsService } from './subaccounts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('subaccounts')
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  // ✅ Obtener todas las subcuentas del usuario autenticado
  @UseGuards(JwtAuthGuard)
  @Get()
  async getSubAccounts(@Req() req) {
    try {
      const userId = req.user.sub; // ID del usuario desde el token JWT
      console.log(`🔹 Buscando subcuentas para el usuario: ${userId}`);
      return await this.subaccountsService.getSubAccounts(userId);
    } catch (error) {
      console.error('❌ Error obteniendo subcuentas:', error);
      throw new HttpException('Error al obtener subcuentas', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Crear una nueva subcuenta
  @UseGuards(JwtAuthGuard)
  @Post()
  async createSubAccount(@Req() req, @Body() body) {
    const { exchange, apiKey, apiSecret, name } = body;
    const userId = req.user.sub;

    if (!exchange || !apiKey || !apiSecret || !name) {
      throw new HttpException('Todos los campos son obligatorios', HttpStatus.BAD_REQUEST);
    }

    try {
      console.log(`🆕 Creando subcuenta para usuario ${userId}:`, body);
      return await this.subaccountsService.createSubAccount(userId, exchange, apiKey, apiSecret, name);
    } catch (error) {
      console.error('❌ Error al crear subcuenta:', error);
      throw new HttpException('Error al crear subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Actualizar una subcuenta existente
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateSubAccount(@Req() req, @Param('id') id: string, @Body() body) {
    const { exchange, apiKey, apiSecret, name } = body;
    const userId = req.user.sub;

    if (!exchange || !apiKey || !apiSecret || !name) {
      throw new HttpException('Todos los campos son obligatorios', HttpStatus.BAD_REQUEST);
    }

    try {
      console.log(`✏️ Actualizando subcuenta ${id} para usuario ${userId}`);
      return await this.subaccountsService.updateSubAccount(id, userId, exchange, apiKey, apiSecret, name);
    } catch (error) {
      console.error('❌ Error al actualizar subcuenta:', error);
      throw new HttpException('Error al actualizar subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Eliminar una subcuenta
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteSubAccount(@Req() req, @Param('id') id: string) {
    const userId = req.user.sub;

    try {
      console.log(`🗑️ Eliminando subcuenta ${id} para usuario ${userId}`);
      return await this.subaccountsService.deleteSubAccount(id, userId);
    } catch (error) {
      console.error('❌ Error al eliminar subcuenta:', error);
      throw new HttpException('Error al eliminar subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
