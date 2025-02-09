// src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import { PrismaService } from "../prisma.service";
import { ConfigService } from "@nestjs/config"; // ✅ Importar ConfigService

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService, private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>("JWT_SECRET"), // ✅ Obtener clave de `.env`
      ignoreExpiration: false,
    });

    const jwtSecret = configService.get<string>("JWT_SECRET");
    if (!jwtSecret) {
      throw new Error("🚨 JWT_SECRET no está definido en .env");
    }
  }

  async validate(payload: any) {
    console.log("🔹 Decodificando Token:", payload);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      console.log("🚨 Usuario no encontrado en la base de datos.");
      throw new UnauthorizedException("Usuario no autorizado");
    }

    return user; // ✅ Adjunta el usuario al request para su uso posterior
  }
}
