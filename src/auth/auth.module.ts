import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtModule } from "@nestjs/jwt";
import { JwtStrategy } from "./jwt.strategy";
import { PrismaModule } from "../prisma.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { UserProfileController } from "./user-profile.controller";

@Module({
  imports: [
    ConfigModule.forRoot(), // ✅ Cargar variables de entorno
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"), // ✅ Obtener clave de Railway
        signOptions: { expiresIn: "1d" }, // ⏳ Configura duración del token
      }),
    }),
    PrismaModule,
  ],
  controllers: [AuthController, UserProfileController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
