import { Module } from '@nestjs/common';
import { AccountDetailsController } from './account-details.controller';
import { AccountDetailsService } from './account-details.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AccountDetailsController],
  providers: [AccountDetailsService, PrismaService],
})
export class AccountDetailsModule {}
