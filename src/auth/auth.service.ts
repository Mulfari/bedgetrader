import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

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

  // Validar usuario (por ahora es un mock)
  async validateUser(email: string, password: string) {
    const mockUser = { id: '1', email: 'test@example.com', password: await this.hashPassword('123456') };

    if (email !== mockUser.email) throw new UnauthorizedException('Usuario no encontrado');
    const isPasswordValid = await this.comparePasswords(password, mockUser.password);
    if (!isPasswordValid) throw new UnauthorizedException('Credenciales inválidas');

    return { id: mockUser.id, email: mockUser.email, token: await this.generateToken(mockUser.id) };
  }
}
