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
    // Log detallado para depuración
    this.logger.log(`📝 Recibida solicitud de login para: ${body.email}`);
    
    // Validar que se proporcionaron email y password
    if (!body.email || !body.password) {
      this.logger.error('❌ Email o password no proporcionados');
      throw new HttpException('Email y password son requeridos', HttpStatus.BAD_REQUEST);
    }
    
    try {
      // Intentar validar el usuario
      const user = await this.authService.validateUser(body.email, body.password);
      
      // Si no se pudo validar el usuario
      if (!user) {
        this.logger.warn(`❌ Validación fallida para: ${body.email}`);
        throw new HttpException('Credenciales inválidas', HttpStatus.UNAUTHORIZED);
      }
      
      this.logger.log(`✅ Usuario validado: ${user.id}`);
      
      // Generar token JWT
      const payload = { 
        sub: user.id,
        email: user.email
      };
      
      const token = this.jwtService.sign(payload);
      this.logger.log(`✅ Token generado para usuario: ${user.id}`);
      
      // Devolver respuesta exitosa
      return {
        success: true,
        message: 'Autenticación exitosa',
        access_token: token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || ''
        }
      };
    } catch (error) {
      // Log detallado del error
      this.logger.error(`❌ Error en login: ${error.message}`);
      if (error.stack) {
        this.logger.error(error.stack);
      }
      
      // Si es un HttpException, mantener el status code
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Para otros errores, devolver 500
      throw new HttpException(
        'Error interno del servidor',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
