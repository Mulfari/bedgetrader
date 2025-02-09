import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma.module';
import { SubaccountsModule } from './subaccounts/subaccounts.module';

@Module({
  imports: [AuthModule, PrismaModule, SubaccountsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
