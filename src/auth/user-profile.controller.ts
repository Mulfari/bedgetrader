import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../prisma.service';

@Controller('user')
export class UserProfileController {
  constructor(private prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getUserProfile(@Request() req) {
    try {
      console.log('🔹 Petición recibida en /user/profile');
      console.log('🔹 Usuario en la petición:', req.user);
      
      // El usuario ya está disponible en req.user gracias al JwtAuthGuard
      const userId = req.user.sub;
      console.log('🔹 ID del usuario:', userId);
      
      // Buscar el usuario en la base de datos para obtener su nombre
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true }
      });

      console.log('🔹 Usuario encontrado en la base de datos:', user);

      if (!user) {
        console.log('❌ Usuario no encontrado en la base de datos');
        return { 
          success: false,
          error: 'Usuario no encontrado' 
        };
      }

      const response = {
        success: true,
        data: {
          name: user.name,
          email: user.email
        }
      };
      
      console.log('✅ Respuesta enviada:', response);
      return response;
    } catch (error) {
      console.error('❌ Error al obtener el perfil del usuario:', error);
      return {
        success: false,
        error: 'Error al obtener el perfil del usuario'
      };
    }
  }
} 