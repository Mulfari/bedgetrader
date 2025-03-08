import { Controller, Post, Body, UseGuards, Request, Logger } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Post('execute')
  async executeOrder(
    @Body() orderData: {
      subAccountIds: string[];
      marketType: 'spot' | 'perpetual';
      orderType: 'limit' | 'market';
      side: 'buy' | 'sell';
      symbol: string;
      price?: string;
      qty: string;
      timeInForce?: string;
    },
    @Request() req: any,
  ) {
    this.logger.log(`Recibida solicitud para ejecutar orden en subcuentas: ${orderData.subAccountIds.join(', ')}`);
    this.logger.log(`Parámetros de la orden: ${JSON.stringify(orderData)}`);
    
    const userId = req.user.userId;
    
    // Extraer los IDs de subcuentas y los parámetros de la orden
    const { subAccountIds, ...orderParams } = orderData;
    
    return this.ordersService.executeOrder(subAccountIds, userId, orderParams);
  }
} 