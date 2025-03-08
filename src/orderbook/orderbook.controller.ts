import { Controller, Get, Query, Param, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { OrderbookService } from './orderbook.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

// Extender el tipo Request para incluir la propiedad user
interface RequestWithUser extends Request {
  user: {
    sub: string;
    email?: string;
    [key: string]: any;
  };
}

@Controller('orderbook')
export class OrderbookController {
  constructor(private readonly orderbookService: OrderbookService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':symbol')
  async getOrderbook(
    @Param('symbol') symbol: string,
    @Query('depth') depth: string,
    @Req() request: RequestWithUser,
  ) {
    try {
      // Validar parámetros
      if (!symbol) {
        throw new HttpException('Se requiere el símbolo', HttpStatus.BAD_REQUEST);
      }

      // Convertir a mayúsculas para estandarizar
      const normalizedSymbol = symbol.toUpperCase();
      
      // Usar profundidad por defecto si no se proporciona
      const depthValue = depth ? parseInt(depth, 10) : 50;
      
      // Validar profundidad
      const validDepths = [1, 50, 200, 500];
      if (!validDepths.includes(depthValue)) {
        throw new HttpException(
          `Profundidad inválida: ${depthValue}. Valores válidos: ${validDepths.join(', ')}`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Obtener ID del usuario del token JWT
      const userId = request.user.sub;
      if (!userId) {
        throw new HttpException('Usuario no autenticado', HttpStatus.UNAUTHORIZED);
      }

      // Generar un ID de cliente único basado en el ID de usuario
      const clientId = `user_${userId}_${Date.now()}`;

      // Suscribirse al orderbook (esto iniciará la suscripción WebSocket si aún no existe)
      this.orderbookService.subscribeToOrderbook(normalizedSymbol, depthValue, clientId);

      // Obtener los datos actuales del orderbook
      const orderbook = this.orderbookService.getOrderbook(normalizedSymbol);

      // Si no hay datos disponibles todavía, devolver un mensaje informativo
      if (!orderbook) {
        return {
          success: true,
          message: 'Suscripción iniciada. Los datos estarán disponibles en breve.',
          data: null
        };
      }

      // Devolver los datos del orderbook
      return {
        success: true,
        data: {
          symbol: normalizedSymbol,
          depth: depthValue,
          bids: orderbook.b.slice(0, depthValue),
          asks: orderbook.a.slice(0, depthValue),
          timestamp: orderbook.cts,
          updateId: orderbook.u
        }
      };
    } catch (error) {
      console.error('Error al obtener orderbook:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Error al obtener orderbook: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':symbol/summary')
  async getOrderbookSummary(
    @Param('symbol') symbol: string,
    @Req() request: RequestWithUser,
  ) {
    try {
      // Validar parámetros
      if (!symbol) {
        throw new HttpException('Se requiere el símbolo', HttpStatus.BAD_REQUEST);
      }

      // Convertir a mayúsculas para estandarizar
      const normalizedSymbol = symbol.toUpperCase();
      
      // Usar profundidad mínima para el resumen
      const depthValue = 1;
      
      // Obtener ID del usuario del token JWT
      const userId = request.user.sub;
      if (!userId) {
        throw new HttpException('Usuario no autenticado', HttpStatus.UNAUTHORIZED);
      }

      // Generar un ID de cliente único basado en el ID de usuario
      const clientId = `user_${userId}_summary_${Date.now()}`;

      // Suscribirse al orderbook (esto iniciará la suscripción WebSocket si aún no existe)
      this.orderbookService.subscribeToOrderbook(normalizedSymbol, depthValue, clientId);

      // Obtener los datos actuales del orderbook
      const orderbook = this.orderbookService.getOrderbook(normalizedSymbol);

      // Si no hay datos disponibles todavía, devolver un mensaje informativo
      if (!orderbook) {
        return {
          success: true,
          message: 'Suscripción iniciada. Los datos estarán disponibles en breve.',
          data: null
        };
      }

      // Calcular el precio medio y el spread
      const bestBid = orderbook.b.length > 0 ? parseFloat(orderbook.b[0][0]) : 0;
      const bestAsk = orderbook.a.length > 0 ? parseFloat(orderbook.a[0][0]) : 0;
      const midPrice = (bestBid + bestAsk) / 2;
      const spread = bestAsk - bestBid;
      const spreadPercentage = (spread / midPrice) * 100;

      // Devolver un resumen del orderbook
      return {
        success: true,
        data: {
          symbol: normalizedSymbol,
          bestBid,
          bestAsk,
          midPrice,
          spread,
          spreadPercentage,
          timestamp: orderbook.cts
        }
      };
    } catch (error) {
      console.error('Error al obtener resumen del orderbook:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Error al obtener resumen del orderbook: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 