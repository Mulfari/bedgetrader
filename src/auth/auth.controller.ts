import { Body, Controller, HttpException, HttpStatus, Post, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService
  ) {}

  @Post('register')
  async register(@Body() body: { name: string; email: string; password: string }) {
    try {
      const user = await this.authService.registerUser(body.name, body.email, body.password);
      return { message: "Usuario creado exitosamente", userId: user.id };
    } catch (error) {
      console.error("Error al crear usuario:", error);
      throw new HttpException('Error registering user', HttpStatus.BAD_REQUEST);
    }
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (user) {
      const payload = { email: user.email, sub: user.id };
      return {
        message: 'Autenticación exitosa',
        access_token: this.jwtService.sign(payload),
      };
    } else {
      throw new HttpException('Credenciales inválidas', HttpStatus.UNAUTHORIZED);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('user')
  async getUserInfo(@Request() req) {
    try {
      const userId = req.user.userId;
      const userInfo = await this.authService.getUserInfo(userId);
      return userInfo;
    } catch (error) {
      console.error("Error al obtener información del usuario:", error);
      throw new HttpException('Error al obtener información del usuario', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
