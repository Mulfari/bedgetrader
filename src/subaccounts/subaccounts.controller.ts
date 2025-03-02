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
  Request,
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
      
      // Verificar que el ID de usuario no sea undefined
      if (!userId) {
        console.error('❌ Error: ID de usuario es undefined en el token JWT');
        throw new HttpException('ID de usuario no disponible en el token', HttpStatus.UNAUTHORIZED);
      }
      
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
      console.log(`🔹 Solicitud de API keys para subcuenta: ${id}, usuario: ${userId}`);
      
      // Verificar que el ID de usuario no sea undefined
      if (!userId) {
        console.error('❌ Error: ID de usuario es undefined en el token JWT');
        throw new HttpException('ID de usuario no disponible en el token', HttpStatus.UNAUTHORIZED);
      }
      
      return await this.subaccountsService.getSubAccountKeys(id, userId);
    } catch (error) {
      console.error('❌ Error obteniendo API keys:', error);
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Obtener el balance de una subcuenta desde Bybit
  @UseGuards(JwtAuthGuard)
  @Get(':id/balance')
  async getSubAccountBalance(@Param('id') id: string, @Req() req) {
    try {
      console.log(`🔹 Solicitud de balance para subcuenta: ${id}`);
      
      // Depurar el objeto req.user completo
      console.log('🔹 Objeto req.user completo:', JSON.stringify(req.user));
      
      // Extraer el ID de usuario del token JWT
      const userId = req.user.sub;
      console.log(`🔹 ID de usuario extraído del token: ${userId}`);
      
      // Verificar que el ID de usuario no sea undefined
      if (!userId) {
        console.error('❌ Error: ID de usuario es undefined en el token JWT');
        throw new HttpException('ID de usuario no disponible en el token', HttpStatus.UNAUTHORIZED);
      }
      
      // Intentar obtener el balance
      const balance = await this.subaccountsService.getSubAccountBalance(id, userId);
      
      // Verificar si son datos simulados
      if (balance.isSimulated) {
        console.log(`⚠️ Devolviendo datos simulados para subcuenta: ${id}`);
      } else {
        console.log(`✅ Balance obtenido correctamente para subcuenta: ${id}`);
      }
      
      return balance;
    } catch (error) {
      console.error(`❌ Error obteniendo balance para subcuenta ${id}:`, error.message);
      
      // Proporcionar mensajes de error más descriptivos según el tipo de error
      if (error.message && error.message.includes('No se pudo obtener el balance real')) {
        throw new HttpException({
          message: error.message,
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Error de API de Bybit',
          details: 'Verifica que las credenciales de API sean correctas y tengan permisos de lectura.'
        }, HttpStatus.BAD_REQUEST);
      } else if (error.message && error.message.includes('Tipo de cuenta')) {
        throw new HttpException({
          message: 'Tipo de cuenta no válido para esta API key',
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Error de configuración',
          details: 'La API key proporcionada no tiene acceso al tipo de cuenta UNIFIED.'
        }, HttpStatus.BAD_REQUEST);
      } else {
        // Para otros errores, usar el mensaje y estado originales
        throw new HttpException(
          error.message || 'Error al obtener balance',
          error.status || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  }

  // ✅ Crear una nueva subcuenta
  @UseGuards(JwtAuthGuard)
  @Post()
  async createSubAccount(@Req() req, @Body() body) {
    const { exchange, apiKey, apiSecret, name, isDemo } = body;
    const userId = req.user.sub;
    
    console.log(`🔹 Solicitud para crear subcuenta recibida para usuario: ${userId}`);
    
    // Verificar que el ID de usuario no sea undefined
    if (!userId) {
      console.error('❌ Error: ID de usuario es undefined en el token JWT');
      throw new HttpException('ID de usuario no disponible en el token', HttpStatus.UNAUTHORIZED);
    }
    
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
        name,
        demoStatus
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
    
    console.log(`🔹 Solicitud para actualizar subcuenta: ${id}, usuario: ${userId}`);
    
    // Verificar que el ID de usuario no sea undefined
    if (!userId) {
      console.error('❌ Error: ID de usuario es undefined en el token JWT');
      throw new HttpException('ID de usuario no disponible en el token', HttpStatus.UNAUTHORIZED);
    }

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
    
    console.log(`🔹 Solicitud para eliminar subcuenta: ${id}, usuario: ${userId}`);
    
    // Verificar que el ID de usuario no sea undefined
    if (!userId) {
      console.error('❌ Error: ID de usuario es undefined en el token JWT');
      throw new HttpException('ID de usuario no disponible en el token', HttpStatus.UNAUTHORIZED);
    }

    try {
      return await this.subaccountsService.deleteSubAccount(id, userId);
    } catch (error) {
      console.error('❌ Error al eliminar subcuenta:', error);
      throw new HttpException('Error al eliminar subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
