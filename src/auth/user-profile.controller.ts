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
      // El usuario ya está disponible en req.user gracias al JwtAuthGuard
      const userId = req.user.sub;
      
      // Buscar el usuario en la base de datos para obtener su nombre
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true }
      });

      if (!user) {
        return { error: 'Usuario no encontrado' };
      }

      return {
        success: true,
        data: {
          name: user.name,
          email: user.email
        }
      };
    } catch (error) {
      console.error('Error al obtener el perfil del usuario:', error);
      return {
        success: false,
        error: 'Error al obtener el perfil del usuario'
      };
    }
  }
} 