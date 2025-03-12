import { Module } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { PositionsController } from './positions.controller';
import { ConfigModule } from '@nestjs/config';
import { SubaccountsModule } from '../subaccounts/subaccounts.module';

@Module({
  imports: [
    ConfigModule,
    SubaccountsModule,
  ],
  controllers: [PositionsController],
  providers: [PositionsService],
  exports: [PositionsService],
})
export class PositionsModule {} 