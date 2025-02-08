import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  // Encriptar contraseña
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  // Comparar contraseñas
  async comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // Generar un token JWT
  async generateToken(userId: string): Promise<string> {
    return this.jwtService.sign({ userId });
  }

  // Registrar usuario en la base de datos
  async registerUser(name: string, email: string, password: string) {
    const hashedPassword = await this.hashPassword(password);
    return prisma.user.create({
      data: { name, email, password: hashedPassword },
    });
  }

  // Validar usuario en la base de datos
  async validateUser(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    const isPasswordValid = await this.comparePasswords(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Credenciales inválidas');

    return { id: user.id, email: user.email, token: await this.generateToken(user.id) };
  }
}
