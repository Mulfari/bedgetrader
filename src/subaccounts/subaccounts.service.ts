import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  // ✅ Obtener todas las subcuentas del usuario autenticado
  async getSubAccounts(userId: string) {
    return this.prisma.subAccount.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        exchange: true,
        apiKey: true,
        apiSecret: true,
      },
    });
  }

  // ✅ Crear una nueva subcuenta
  async createSubAccount(userId: string, exchange: string, name: string, apiKey: string, apiSecret: string) {
    try {
      const newSubAccount = await this.prisma.subAccount.create({
        data: {
          userId,
          exchange,
          name,
          apiKey,
          apiSecret,
        },
      });

      console.log("✅ Subcuenta creada:", newSubAccount);
      return newSubAccount;
    } catch (error) {
      console.error("❌ Error creando subcuenta:", error);
      throw new Error("No se pudo crear la subcuenta.");
    }
  }

  // ✅ Eliminar una subcuenta (validando el usuario)
  async deleteSubAccount(userId: string, subAccountId: string) {
    // Primero verificamos que la subcuenta existe y pertenece al usuario
    const subAccount = await this.prisma.subAccount.findUnique({
      where: { id: subAccountId },
    });

    if (!subAccount) {
      throw new NotFoundException("Subcuenta no encontrada.");
    }

    if (subAccount.userId !== userId) {
      throw new ForbiddenException("No tienes permiso para eliminar esta subcuenta.");
    }

    // Eliminamos la subcuenta
    await this.prisma.subAccount.delete({
      where: { id: subAccountId },
    });

    return { message: "Subcuenta eliminada correctamente." };
  }
}
