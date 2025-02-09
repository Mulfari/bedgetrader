import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtModule } from "@nestjs/jwt";
import { JwtStrategy } from "./jwt.strategy";
import { PrismaModule } from "../prisma.module";
import { ConfigModule } from "@nestjs/config"; // ✅ Importa ConfigModule

@Module({
  imports: [
    ConfigModule.forRoot(), // ✅ Cargar variables de entorno desde `.env`
    JwtModule.register({
      secret: process.env.JWT_SECRET, // ✅ Toma la clave secreta desde `.env`
      signOptions: { expiresIn: "1d" }, // Token válido por 1 día
    }),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule], // ✅ Exportar JwtModule para que lo usen otros módulos
})
export class AuthModule {}
