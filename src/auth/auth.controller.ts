import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { SubaccountsService } from '../subaccounts/subaccounts.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private subaccountsService: SubaccountsService
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
    try {
      // Validar usuario y obtener información básica
      const user = await this.authService.validateUser(body.email, body.password);
      
      if (user) {
        // Generar token JWT
        const payload = { email: user.email, sub: user.id };
        const access_token = this.jwtService.sign(payload);
        
        // Obtener subcuentas del usuario
        const subAccounts = await this.subaccountsService.getSubAccounts(user.id);
        
        // Devolver respuesta completa con token y subcuentas
        return {
          message: 'Autenticación exitosa',
          access_token,
          user: {
            id: user.id,
            email: user.email
          },
          subAccounts
        };
      } else {
        throw new HttpException('Credenciales inválidas', HttpStatus.UNAUTHORIZED);
      }
    } catch (error) {
      console.error("Error en el proceso de login:", error);
      throw new HttpException(
        error.message || 'Error en el proceso de autenticación', 
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
