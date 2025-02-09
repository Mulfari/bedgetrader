// auth.controller.ts
import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: { name: string; email: string; password: string }) {
    try {
      const user = await this.authService.registerUser(body.name, body.email, body.password);
      console.log("✅ Usuario creado exitosamente:", user);
      return user;
    } catch (error) {
      console.error("❌ Error al crear usuario:", error);
      throw error;
    }
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    try {
      const { email, password } = body;
      const result = await this.authService.validateUser(email, password);
      console.log("✅ Inicio de sesión exitoso:", result);
      return { message: 'Autenticación exitosa', ...result };
    } catch (error) {
      console.error("❌ Error de autenticación:", error);
      throw new HttpException('Credenciales inválidas', HttpStatus.UNAUTHORIZED);
    }
  }
}
