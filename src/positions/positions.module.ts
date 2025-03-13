import { Module } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { PositionsController } from './positions.controller';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma.module';
import { SubaccountsModule } from '../subaccounts/subaccounts.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    SubaccountsModule,
  ],
  controllers: [PositionsController],
  providers: [PositionsService],
  exports: [PositionsService],
})
export class PositionsModule {} 