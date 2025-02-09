import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtModule } from "@nestjs/jwt";
import { JwtStrategy } from "./jwt.strategy";
import { PrismaModule } from "../prisma.module";
import { ConfigModule, ConfigService } from "@nestjs/config"; // ✅ Importa ConfigModule y ConfigService

@Module({
  imports: [
    ConfigModule.forRoot(), // ✅ Cargar variables de entorno desde `.env`
    JwtModule.registerAsync({
      imports: [ConfigModule], // ✅ Asegurar que usa ConfigModule
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"), // ✅ Obtener clave desde `.env`
        signOptions: { expiresIn: "1d" },
      }),
    }),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule], // ✅ Exportar JwtModule para otros módulos
})
export class AuthModule {}
