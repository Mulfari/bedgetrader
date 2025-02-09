import { Module } from "@nestjs/common";
import { SubaccountsService } from "./subaccounts.service";
import { SubaccountsController } from "./subaccounts.controller";
import { PrismaService } from "../prisma.service";
import { JwtModule } from "@nestjs/jwt"; // ✅ Importar JwtModule
import { JwtAuthGuard } from "../auth/jwt-auth.guard"; // ✅ Asegurar que el guard está aquí

@Module({
  imports: [JwtModule], // ✅ Agregar JwtModule para que funcione JwtService
  controllers: [SubaccountsController],
  providers: [SubaccountsService, PrismaService, JwtAuthGuard],
})
export class SubaccountsModule {}
