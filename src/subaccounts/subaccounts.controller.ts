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
  BadRequestException,
} from '@nestjs/common';
import { SubaccountsService } from './subaccounts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('subaccounts')
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}

  // ✅ Obtener todas las subcuentas del usuario autenticado
  @UseGuards(JwtAuthGuard)
  @Get()
  async getSubAccounts(@Request() req): Promise<any[]> {
    const userId = req.user.id;
    const accounts = await this.subaccountsService.getSubAccounts(userId);
    return accounts.map(account => ({
      ...account,
      apiKey: account.apiKey ? '********' : null,
      secretKey: account.secretKey ? '********' : null,
    }));
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
      
      // Obtener la subcuenta para verificar si es demo o real
      const subaccount = await this.subaccountsService.findOne(id, userId);
      if (!subaccount) {
        console.error(`❌ Subcuenta ${id} no encontrada para usuario ${userId}`);
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }
      
      console.log(`🔹 Tipo de subcuenta: ${subaccount.isDemo ? 'DEMO' : 'REAL'}`);
      
      // Intentar obtener el balance
      const balance = await this.subaccountsService.getSubAccountBalance(id, userId);
      
      // Verificar si son datos simulados
      if (balance.isSimulated) {
        console.log(`⚠️ Devolviendo datos simulados para subcuenta: ${id}`);
      } else {
        console.log(`✅ Balance obtenido correctamente para subcuenta: ${id}`);
      }
      
      // Asegurarse de que el balance tiene el formato correcto
      const formattedBalance = {
        balance: balance.balance || 0,
        assets: Array.isArray(balance.assets) ? balance.assets : [],
        performance: balance.performance || 0,
        isSimulated: !!balance.isSimulated,
        isDemo: !!balance.isDemo,
        isDebug: !!balance.isDebug
      };
      
      console.log(`🔹 Devolviendo balance formateado para subcuenta ${id}:`, 
        JSON.stringify({
          balance: formattedBalance.balance,
          assetsCount: formattedBalance.assets.length,
          isSimulated: formattedBalance.isSimulated,
          isDemo: formattedBalance.isDemo
        })
      );
      
      return formattedBalance;
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
      } else if (error.message && (error.message.includes('CloudFront') || error.message.includes('ubicación geográfica'))) {
        throw new HttpException({
          message: 'La API de Bybit no está disponible en tu ubicación geográfica',
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Restricción geográfica',
          details: 'Considera usar una VPN o contactar con soporte.'
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
  async createSubAccount(@Request() req, @Body() body: any) {
    const userId = req.user.id;
    const { exchange, apiKey, secretKey, name, isDemo } = body;

    if (!exchange || !apiKey || !secretKey || !name) {
      throw new BadRequestException('Faltan campos requeridos');
    }

    return await this.subaccountsService.createSubAccount(
      userId,
      exchange,
      apiKey,
      secretKey,
      name,
      isDemo
    );
  }

  // ✅ Actualizar una subcuenta existente
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateSubAccount(@Param('id') id: string, @Request() req, @Body() body: any) {
    const userId = req.user.id;
    const { exchange, apiKey, secretKey, name } = body;

    if (!exchange || !apiKey || !secretKey || !name) {
      throw new BadRequestException('Faltan campos requeridos');
    }

    return await this.subaccountsService.updateSubAccount(id, userId, exchange, apiKey, secretKey, name);
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
