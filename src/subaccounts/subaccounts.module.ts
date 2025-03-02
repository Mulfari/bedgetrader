import { Module } from "@nestjs/common";
import { SubaccountsService } from "./subaccounts.service";
import { SubaccountsController } from "./subaccounts.controller";
import { JwtModule } from "@nestjs/jwt"; // ✅ Importar JwtModule
import { JwtAuthGuard } from "../auth/jwt-auth.guard"; // ✅ Asegurar que el guard está aquí
import { ConfigModule } from "@nestjs/config"; // ✅ Importar ConfigModule
import { PrismaModule } from "../prisma.module"; // ✅ Importar PrismaModule

@Module({
  imports: [
    JwtModule, // ✅ Agregar JwtModule para que funcione JwtService
    ConfigModule.forRoot(), // ✅ Agregar ConfigModule para que funcione ConfigService
    PrismaModule, // ✅ Importar PrismaModule para acceder a PrismaService
  ],
  controllers: [SubaccountsController],
  providers: [SubaccountsService, JwtAuthGuard], // Quitar PrismaService de aquí
})
export class SubaccountsModule {}
