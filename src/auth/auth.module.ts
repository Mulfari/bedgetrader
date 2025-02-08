import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_SECRET || 'default-secret' }),
    PrismaModule, // ✅ Importamos PrismaModule
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
