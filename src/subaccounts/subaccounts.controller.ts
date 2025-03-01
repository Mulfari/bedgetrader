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
      const userId = req.user.sub;
      console.log(`🔹 Solicitud para obtener subcuentas del usuario: ${userId}`);
      
      const subAccounts = await this.subaccountsService.getSubAccounts(userId);
      console.log(`✅ Se encontraron ${subAccounts.length} subcuentas para el usuario ${userId}`);
      
      // Filtrar información sensible antes de devolver los datos
      const filteredSubAccounts = subAccounts.map(account => ({
        ...account,
        apiKey: account.apiKey ? `${account.apiKey.substring(0, 5)}...` : null,
        apiSecret: account.apiSecret ? '********' : null,
        user: account.user ? {
          id: account.user.id,
          email: account.user.email,
          name: account.user.name
        } : null
      }));
      
      return filteredSubAccounts;
    } catch (error) {
      console.error('❌ Error detallado al obtener subcuentas:', error);
      
      // Propagar el mensaje de error específico si está disponible
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Error al obtener subcuentas: ${error.message || 'Error desconocido'}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ✅ Obtener API keys de una subcuenta específica
  @UseGuards(JwtAuthGuard)
  @Get(':id/keys')
  async getSubAccountKeys(@Req() req, @Param('id') id: string) {
    try {
      const userId = req.user.sub;
      return await this.subaccountsService.getSubAccountKeys(id, userId);
    } catch (error) {
      console.error('❌ Error obteniendo API keys:', error);
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Obtener el balance de una subcuenta desde Bybit
  @UseGuards(JwtAuthGuard)
  @Get(':id/balance')
  async getSubAccountBalance(@Req() req, @Param('id') id: string) {
    try {
      const userId = req.user.sub;
      return await this.subaccountsService.getSubAccountBalance(id, userId);
    } catch (error) {
      console.error('❌ Error obteniendo balance:', error);
      throw new HttpException('Error al obtener balance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Crear una nueva subcuenta
  @UseGuards(JwtAuthGuard)
  @Post()
  async createSubAccount(@Req() req, @Body() body) {
    const { exchange, apiKey, apiSecret, name, isDemo } = body;
    const userId = req.user.sub;

    console.log(`🔹 Solicitud para crear subcuenta recibida para usuario: ${userId}`);
    
    // Validar campos obligatorios
    if (!exchange || !apiKey || !apiSecret || !name) {
      console.error('❌ Faltan campos obligatorios en la solicitud');
      throw new HttpException('Todos los campos son obligatorios', HttpStatus.BAD_REQUEST);
    }

    try {
      // Incluir isDemo si está presente en la solicitud
      const demoStatus = isDemo !== undefined ? isDemo : false;
      console.log(`🔹 Creando subcuenta con isDemo=${demoStatus}`);
      
      const result = await this.subaccountsService.createSubAccount(
        userId, 
        exchange, 
        apiKey, 
        apiSecret, 
        name
      );
      
      console.log(`✅ Subcuenta creada exitosamente con ID: ${result.id}`);
      return result;
    } catch (error) {
      console.error('❌ Error detallado al crear subcuenta:', error);
      
      // Propagar el mensaje de error específico si está disponible
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Error al crear subcuenta: ${error.message || 'Error desconocido'}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
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
      return await this.subaccountsService.deleteSubAccount(id, userId);
    } catch (error) {
      console.error('❌ Error al eliminar subcuenta:', error);
      throw new HttpException('Error al eliminar subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
