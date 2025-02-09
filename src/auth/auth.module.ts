// src/auth/auth.module.ts
import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtModule } from "@nestjs/jwt";
import { JwtStrategy } from "./jwt.strategy"; // Estrategia JWT
import { JwtAuthGuard } from "./jwt-auth.guard"; // Importamos el guard
import { PrismaModule } from "../prisma.module";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || "default-secret",
      signOptions: { expiresIn: "1h" }, // 🔹 Aumenté el tiempo de expiración a 1h
    }),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard], // Agregamos JwtAuthGuard
  exports: [JwtAuthGuard, JwtModule], // Exportamos para que otros módulos lo usen
})
export class AuthModule {}
