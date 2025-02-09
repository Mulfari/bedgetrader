import { Module } from '@nestjs/common';
import { SubaccountsService } from './subaccounts.service';
import { SubaccountsController } from './subaccounts.controller';
import { PrismaService } from "../prisma.service";

@Module({
  providers: [SubaccountsService, PrismaService],
  controllers: [SubaccountsController]
})
export class SubaccountsModule {}
