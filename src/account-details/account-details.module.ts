import { Module } from '@nestjs/common';
import { AccountDetailsController } from './account-details.controller';
import { AccountDetailsService } from './account-details.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AccountDetailsController],
  providers: [AccountDetailsService, PrismaService],
})
export class AccountDetailsModule {}
