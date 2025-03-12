import { IsString, IsOptional, IsBoolean, IsNumber, IsDate, IsUUID } from 'class-validator';

export class CreatePositionDto {
  @IsOptional()
  @IsString()
  externalId?: string;

  @IsUUID()
  subAccountId: string;

  @IsUUID()
  userId: string;

  @IsString()
  symbol: string;

  @IsString()
  positionType: string;

  @IsString()
  side: string;

  @IsString()
  size: string;

  @IsString()
  leverage: string;

  @IsString()
  entryPrice: string;

  @IsOptional()
  @IsString()
  markPrice?: string;

  @IsString()
  status: string;

  @IsDate()
  openedAt: Date;

  @IsOptional()
  @IsDate()
  closedAt?: Date;

  @IsOptional()
  @IsString()
  exitPrice?: string;

  @IsOptional()
  @IsString()
  realisedPnl?: string;

  @IsOptional()
  @IsString()
  unrealisedPnl?: string;

  @IsOptional()
  @IsString()
  commission?: string;

  @IsString()
  settlementCurrency: string;

  @IsOptional()
  @IsString()
  stopLossPrice?: string;

  @IsOptional()
  @IsString()
  takeProfitPrice?: string;

  @IsOptional()
  @IsString()
  liquidationPrice?: string;

  @IsOptional()
  @IsString()
  margin?: string;

  @IsBoolean()
  isDemo: boolean;

  @IsString()
  exchange: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsNumber()
  durationSeconds?: number;

  @IsOptional()
  @IsNumber()
  percentageReturn?: number;

  @IsOptional()
  @IsNumber()
  maxDrawdown?: number;
}

export class UpdatePositionDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDate()
  closedAt?: Date;

  @IsOptional()
  @IsString()
  exitPrice?: string;

  @IsOptional()
  @IsString()
  realisedPnl?: string;

  @IsOptional()
  @IsString()
  unrealisedPnl?: string;

  @IsOptional()
  @IsString()
  markPrice?: string;

  @IsOptional()
  @IsString()
  commission?: string;

  @IsOptional()
  @IsString()
  stopLossPrice?: string;

  @IsOptional()
  @IsString()
  takeProfitPrice?: string;

  @IsOptional()
  @IsNumber()
  durationSeconds?: number;

  @IsOptional()
  @IsNumber()
  percentageReturn?: number;

  @IsOptional()
  @IsNumber()
  maxDrawdown?: number;

  @IsOptional()
  @IsString()
  tags?: string;
} 