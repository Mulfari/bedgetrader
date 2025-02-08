import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService, private prisma: PrismaService) {}

  async onModuleInit() {
    console.log("🔹 Verificando conexión con Prisma...");
    await this.testPrismaConnection();
  }

  async testPrismaConnection() {
    try {
      const users = await this.prisma.user.findMany();
      console.log("✅ Conexión exitosa con la base de datos. Usuarios existentes:", users);
    } catch (error) {
      console.error("❌ Error conectando con Prisma:", error);
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async generateToken(userId: string): Promise<string> {
    return this.jwtService.sign({ userId });
  }

// auth.service.ts
async registerUser(name: string, email: string, password: string) {
    try {
      const hashedPassword = await this.hashPassword(password);
      const user = await this.prisma.user.create({
        data: { name, email, password: hashedPassword },
      });
      return user;
    } catch (error) {
      console.error("Error al registrar usuario:", error);
      throw new UnauthorizedException('Registro fallido');
    }
  }
  

  async validateUser(email: string, password: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });

      if (!user) {
        console.error("❌ Usuario no encontrado:", email);
        throw new UnauthorizedException('Usuario no encontrado');
      }

      const isPasswordValid = await this.comparePasswords(password, user.password);
      if (!isPasswordValid) {
        console.error("❌ Contraseña incorrecta para el usuario:", email);
        throw new UnauthorizedException('Credenciales inválidas');
      }

      const token = await this.generateToken(user.id);
      console.log("✅ Usuario autenticado:", { id: user.id, email: user.email });

      return { id: user.id, email: user.email, token };
    } catch (error) {
      console.error("❌ Error en la validación del usuario:", error);
      throw new UnauthorizedException('Error en la autenticación.');
    }
  }
}
