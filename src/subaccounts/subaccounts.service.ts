import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  // ✅ Obtener subcuentas del usuario autenticado
  async getSubAccounts(userId: string) {
    try {
      return await this.prisma.subAccount.findMany({ where: { userId } });
    } catch (error) {
      console.error('❌ Error obteniendo subcuentas:', error);
      throw new HttpException('Error al obtener subcuentas', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Crear una nueva subcuenta
  async createSubAccount(userId: string, exchange: string, apiKey: string, apiSecret: string, name: string) {
    try {
      return await this.prisma.subAccount.create({
        data: { userId, exchange, apiKey, apiSecret, name },
      });
    } catch (error) {
      console.error('❌ Error creando subcuenta:', error);
      throw new HttpException('Error al crear subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Actualizar una subcuenta existente
  async updateSubAccount(id: string, userId: string, exchange: string, apiKey: string, apiSecret: string, name: string) {
    try {
      // Verificar si la subcuenta existe y pertenece al usuario
      const subAccount = await this.prisma.subAccount.findUnique({ where: { id } });
      if (!subAccount || subAccount.userId !== userId) {
        throw new HttpException('Subcuenta no encontrada o no pertenece al usuario', HttpStatus.NOT_FOUND);
      }

      return await this.prisma.subAccount.update({
        where: { id },
        data: { exchange, apiKey, apiSecret, name },
      });
    } catch (error) {
      console.error('❌ Error actualizando subcuenta:', error);
      throw new HttpException('Error al actualizar subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Eliminar una subcuenta
  async deleteSubAccount(id: string, userId: string) {
    try {
      // Verificar si la subcuenta existe y pertenece al usuario
      const subAccount = await this.prisma.subAccount.findUnique({ where: { id } });
      if (!subAccount || subAccount.userId !== userId) {
        throw new HttpException('Subcuenta no encontrada o no pertenece al usuario', HttpStatus.NOT_FOUND);
      }

      return await this.prisma.subAccount.delete({ where: { id } });
    } catch (error) {
      console.error('❌ Error eliminando subcuenta:', error);
      throw new HttpException('Error al eliminar subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
