import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService, private prisma: PrismaService) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async generateToken(userId: string): Promise<string> {
    return this.jwtService.sign({ userId });
  }

  async registerUser(name: string, email: string, password: string) {
    try {
      const hashedPassword = await this.hashPassword(password);
      
      console.log("Intentando crear usuario en la base de datos:", { name, email, password: hashedPassword });
  
      const user = await this.prisma.user.create({
        data: { name, email, password: hashedPassword },
      });
  
      console.log("Usuario creado exitosamente:", user); // ✅ Verifica si Prisma crea el usuario
      return user;
    } catch (error) {
      console.error("Error al crear usuario:", error);
      throw new Error("Error al registrar usuario.");
    }
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    const isPasswordValid = await this.comparePasswords(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Credenciales inválidas');

    return { id: user.id, email: user.email, token: await this.generateToken(user.id) };
  }
}
