import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  async getSubAccounts(userId: string) {
    return await this.prisma.subAccount.findMany({
      where: { userId },
      select: { id: true, name: true, exchange: true }, // No devolvemos API keys aquí
    });
  }

  // ✅ Obtener API keys de una subcuenta
  async getSubAccountKeys(userId: string, subAccountId: string) {
    const subAccount = await this.prisma.subAccount.findUnique({
      where: { id: subAccountId, userId },
      select: { apiKey: true, apiSecret: true },
    });

    if (!subAccount) throw new NotFoundException("Subcuenta no encontrada");
    return subAccount; // Enviamos las keys al frontend
  }
}
