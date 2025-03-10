import { Module } from '@nestjs/common';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { PrismaService } from '../prisma.service';
import { SubaccountsModule } from '../subaccounts/subaccounts.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    SubaccountsModule,
    ConfigModule,
  ],
  controllers: [OperationsController],
  providers: [OperationsService, PrismaService],
  exports: [OperationsService],
})
export class OperationsModule {} 