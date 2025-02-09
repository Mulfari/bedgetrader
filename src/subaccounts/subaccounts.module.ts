import { Module } from '@nestjs/common';
import { SubaccountsService } from './subaccounts.service';
import { SubaccountsController } from './subaccounts.controller';

@Module({
  providers: [SubaccountsService],
  controllers: [SubaccountsController]
})
export class SubaccountsModule {}
