import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  // ✅ Obtener todas las subcuentas de un usuario
  async getSubAccounts(userId: string) {
    return this.prisma.subAccount.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        exchange: true,
      },
    });
  }

  // ✅ Crear una subcuenta con API Key y Secret
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

  // ✅ Obtener una subcuenta por ID
  async getSubAccountById(subAccountId: string) {
    const subAccount = await this.prisma.subAccount.findUnique({
      where: { id: subAccountId },
    });

    if (!subAccount) {
      throw new NotFoundException("Subcuenta no encontrada");
    }

    return subAccount;
  }
}
