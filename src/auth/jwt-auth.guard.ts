import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    console.log("🔹 Encabezado Authorization recibido:", authHeader); // ✅ Verifica si el token llega

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("🚨 No se recibió token o formato incorrecto");
      throw new UnauthorizedException("Token no proporcionado o incorrecto");
    }

    const token = authHeader.split(" ")[1];

    try {
      console.log('🔹 Verificando token JWT en JwtAuthGuard');
      
      // Usar directamente el JwtService para verificar el token
      // El JwtService ya tiene configurado el secreto correcto
      const decoded = this.jwtService.verify(token);
      console.log("✅ Token decodificado en el backend:", decoded);
      request.user = decoded;
      return true;
    } catch (error) {
      console.log("🚨 Error verificando token:", error.message);
      throw new UnauthorizedException("Token inválido o expirado");
    }
  }
}
