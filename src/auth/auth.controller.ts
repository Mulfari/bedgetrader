import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string }) {
    console.log("Received request:", body);
    const hashedPassword = await this.authService.hashPassword(body.password);
    const user = { id: Date.now().toString(), email: body.email, password: hashedPassword };
    return { message: 'Usuario registrado', user };
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.validateUser(body.email, body.password);
  }
}
