import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsInt } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ description: 'Tipo de producto', example: 'linear' })
  @IsString()
  @IsEnum(['linear', 'inverse', 'spot', 'option'])
  category: string;

  @ApiProperty({ description: 'Símbolo del par de trading', example: 'BTCUSDT' })
  @IsString()
  symbol: string;

  @ApiPropertyOptional({ description: 'Si se debe pedir prestado (solo para spot trading)', example: 0 })
  @IsOptional()
  @IsInt()
  isLeverage?: number;

  @ApiProperty({ description: 'Lado de la orden', example: 'Buy' })
  @IsString()
  @IsEnum(['Buy', 'Sell'])
  side: string;

  @ApiProperty({ description: 'Tipo de orden', example: 'Limit' })
  @IsString()
  @IsEnum(['Market', 'Limit'])
  orderType: string;

  @ApiProperty({ description: 'Cantidad de la orden', example: '0.01' })
  @IsString()
  qty: string;

  @ApiPropertyOptional({ description: 'Unidad para la cantidad en órdenes de mercado', example: 'baseCoin' })
  @IsOptional()
  @IsString()
  @IsEnum(['baseCoin', 'quoteCoin'])
  marketUnit?: string;

  @ApiPropertyOptional({ description: 'Tipo de tolerancia de deslizamiento', example: 'TickSize' })
  @IsOptional()
  @IsString()
  @IsEnum(['TickSize', 'Percent'])
  slippageToleranceType?: string;

  @ApiPropertyOptional({ description: 'Valor de tolerancia de deslizamiento', example: '5' })
  @IsOptional()
  @IsString()
  slippageTolerance?: string;

  @ApiPropertyOptional({ description: 'Precio de la orden (requerido para órdenes límite)', example: '28000' })
  @IsOptional()
  @IsString()
  price?: string;

  @ApiPropertyOptional({ description: 'Dirección del disparador para órdenes condicionales', example: 1 })
  @IsOptional()
  @IsInt()
  triggerDirection?: number;

  @ApiPropertyOptional({ description: 'Filtro de orden para spot', example: 'Order' })
  @IsOptional()
  @IsString()
  @IsEnum(['Order', 'tpslOrder', 'StopOrder'])
  orderFilter?: string;

  @ApiPropertyOptional({ description: 'Precio de activación para órdenes condicionales', example: '15000' })
  @IsOptional()
  @IsString()
  triggerPrice?: string;

  @ApiPropertyOptional({ description: 'Tipo de precio de activación', example: 'LastPrice' })
  @IsOptional()
  @IsString()
  @IsEnum(['LastPrice', 'IndexPrice', 'MarkPrice'])
  triggerBy?: string;

  @ApiPropertyOptional({ description: 'Volatilidad implícita (solo para opciones)', example: '0.1' })
  @IsOptional()
  @IsString()
  orderIv?: string;

  @ApiPropertyOptional({ description: 'Tiempo en vigor', example: 'GTC' })
  @IsOptional()
  @IsString()
  @IsEnum(['GTC', 'IOC', 'FOK', 'PostOnly', 'RPI'])
  timeInForce?: string;

  @ApiPropertyOptional({ description: 'Índice de posición para modo de cobertura', example: 0 })
  @IsOptional()
  @IsInt()
  positionIdx?: number;

  @ApiPropertyOptional({ description: 'ID de orden personalizado', example: 'my-order-001' })
  @IsOptional()
  @IsString()
  orderLinkId?: string;

  @ApiPropertyOptional({ description: 'Precio de toma de ganancias', example: '35000' })
  @IsOptional()
  @IsString()
  takeProfit?: string;

  @ApiPropertyOptional({ description: 'Precio de stop loss', example: '27000' })
  @IsOptional()
  @IsString()
  stopLoss?: string;

  @ApiPropertyOptional({ description: 'Tipo de precio para activar toma de ganancias', example: 'LastPrice' })
  @IsOptional()
  @IsString()
  @IsEnum(['LastPrice', 'MarkPrice', 'IndexPrice'])
  tpTriggerBy?: string;

  @ApiPropertyOptional({ description: 'Tipo de precio para activar stop loss', example: 'LastPrice' })
  @IsOptional()
  @IsString()
  @IsEnum(['LastPrice', 'MarkPrice', 'IndexPrice'])
  slTriggerBy?: string;

  @ApiPropertyOptional({ description: 'Solo reducir posición', example: false })
  @IsOptional()
  @IsBoolean()
  reduceOnly?: boolean;

  @ApiPropertyOptional({ description: 'Cerrar al activar', example: false })
  @IsOptional()
  @IsBoolean()
  closeOnTrigger?: boolean;

  @ApiPropertyOptional({ description: 'Tipo de ejecución SMP', example: 'CancelMaker' })
  @IsOptional()
  @IsString()
  smpType?: string;

  @ApiPropertyOptional({ description: 'Protección de market maker (solo para opciones)', example: false })
  @IsOptional()
  @IsBoolean()
  mmp?: boolean;

  @ApiPropertyOptional({ description: 'Modo de TP/SL', example: 'Full' })
  @IsOptional()
  @IsString()
  @IsEnum(['Full', 'Partial'])
  tpslMode?: string;

  @ApiPropertyOptional({ description: 'Precio límite para toma de ganancias', example: '36000' })
  @IsOptional()
  @IsString()
  tpLimitPrice?: string;

  @ApiPropertyOptional({ description: 'Precio límite para stop loss', example: '27500' })
  @IsOptional()
  @IsString()
  slLimitPrice?: string;

  @ApiPropertyOptional({ description: 'Tipo de orden para toma de ganancias', example: 'Market' })
  @IsOptional()
  @IsString()
  @IsEnum(['Market', 'Limit'])
  tpOrderType?: string;

  @ApiPropertyOptional({ description: 'Tipo de orden para stop loss', example: 'Market' })
  @IsOptional()
  @IsString()
  @IsEnum(['Market', 'Limit'])
  slOrderType?: string;
} 