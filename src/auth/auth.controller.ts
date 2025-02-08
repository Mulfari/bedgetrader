// auth.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
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
}
