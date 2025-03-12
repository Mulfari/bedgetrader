import { Module } from '@nestjs/common';
import { OperationsController } from './operations.controller';
import { PositionsModule } from '../positions/positions.module';
import { SubaccountsModule } from '../subaccounts/subaccounts.module';

@Module({
  imports: [PositionsModule, SubaccountsModule],
  controllers: [OperationsController],
})
export class OperationsModule {} 