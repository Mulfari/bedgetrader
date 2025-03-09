import { Controller, Post, Body, UseGuards, Request, HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear una nueva orden en Bybit' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'La orden ha sido creada exitosamente',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos de orden inválidos o error en la API de Bybit',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Usuario no autorizado',
  })
  async createOrder(@Request() req, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.createOrder(req.user.id, createOrderDto);
  }
} 