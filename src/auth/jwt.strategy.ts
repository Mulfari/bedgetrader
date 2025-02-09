import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import { PrismaService } from "../prisma.service";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService, private configService: ConfigService) {
    const jwtSecret = configService.get<string>("JWT_SECRET");

    console.log("🔹 JWT_SECRET cargado en JwtStrategy:", jwtSecret || "❌ NO DEFINIDO");

    if (!jwtSecret) {
      throw new Error("🚨 JWT_SECRET no está definido en .env o en Railway.");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSecret, // ✅ Usa la clave correcta
      ignoreExpiration: false,
    });
  }

  async validate(payload: any) {
    console.log("🔹 Decodificando Token:", payload);

    if (!payload || !payload.sub) {
      console.log("🚨 Token inválido: falta `sub`.");
      throw new UnauthorizedException("Token inválido o malformado");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      console.log("🚨 Usuario no encontrado en la base de datos. ID esperado:", payload.sub);
      throw new UnauthorizedException("Usuario no autorizado");
    }

    console.log("✅ Usuario autenticado con éxito:", user);
    return user;
  }
}
