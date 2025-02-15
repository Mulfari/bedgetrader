import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  // ✅ Obtener todas las subcuentas de un usuario
  async getSubAccounts(userId: string) {
    return this.prisma.subAccount.findMany({ where: { userId } });
  }

  // ✅ Crear una nueva subcuenta
  async createSubAccount(userId: string, exchange: string, apiKey: string, apiSecret: string, name: string) {
    return this.prisma.subAccount.create({
      data: { userId, exchange, apiKey, apiSecret, name },
    });
  }

  // ✅ Obtener una subcuenta específica
  async getSubAccount(userId: string, subAccountId: string) {
    const subAccount = await this.prisma.subAccount.findUnique({ where: { id: subAccountId } });
    if (!subAccount || subAccount.userId !== userId) {
      throw new NotFoundException('Subcuenta no encontrada.');
    }
    return subAccount;
  }

  // ✅ Actualizar una subcuenta
  async updateSubAccount(userId: string, subAccountId: string, exchange: string, apiKey: string, apiSecret: string, name: string) {
    const subAccount = await this.prisma.subAccount.findUnique({ where: { id: subAccountId } });
    if (!subAccount || subAccount.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para modificar esta subcuenta.');
    }

    return this.prisma.subAccount.update({
      where: { id: subAccountId },
      data: { exchange, apiKey, apiSecret, name },
    });
  }

  // ✅ Eliminar una subcuenta
  async deleteSubAccount(userId: string, subAccountId: string) {
    const subAccount = await this.prisma.subAccount.findUnique({ where: { id: subAccountId } });
    if (!subAccount || subAccount.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar esta subcuenta.');
    }

    return this.prisma.subAccount.delete({ where: { id: subAccountId } });
  }

  // ✅ Obtener las API Keys de una subcuenta para el balance
  async getSubAccountKeys(userId: string, subAccountId: string) {
    const subAccount = await this.prisma.subAccount.findUnique({
      where: { id: subAccountId },
      select: { apiKey: true, apiSecret: true },
    });

    if (!subAccount) {
      throw new NotFoundException('Subcuenta no encontrada.');
    }

    return subAccount; // Devolverá las API Keys para que el frontend haga la solicitud a Bybit.
  }
}
