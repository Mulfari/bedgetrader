import { Body, Controller, HttpException, HttpStatus, Post, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  
  constructor(
    private authService: AuthService,
    private jwtService: JwtService
  ) {}

  @Post('register')
  async register(@Body() body: { name: string; email: string; password: string }) {
    try {
      this.logger.log(`Registrando usuario: ${body.email}`);
      const user = await this.authService.registerUser(body.name, body.email, body.password);
      this.logger.log(`Usuario registrado exitosamente: ${user.id}`);
      return { message: "Usuario creado exitosamente", userId: user.id };
    } catch (error) {
      this.logger.error(`Error al registrar usuario: ${error.message}`);
      throw new HttpException('Error registering user', HttpStatus.BAD_REQUEST);
    }
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    this.logger.log(`Intento de login para: ${body.email}`);
    
    try {
      const user = await this.authService.validateUser(body.email, body.password);
      
      if (!user) {
        this.logger.warn(`Login fallido para: ${body.email} - Credenciales inválidas`);
        throw new HttpException('Credenciales inválidas', HttpStatus.UNAUTHORIZED);
      }
      
      const payload = { email: user.email, sub: user.id };
      const token = this.jwtService.sign(payload);
      
      this.logger.log(`Login exitoso para: ${body.email}`);
      
      return {
        message: 'Autenticación exitosa',
        access_token: token,
        user: {
          id: user.id,
          email: user.email
        }
      };
    } catch (error) {
      this.logger.error(`Error en login para ${body.email}: ${error.message}`);
      throw new HttpException(
        error.message || 'Credenciales inválidas',
        error.status || HttpStatus.UNAUTHORIZED
      );
    }
  }
}
