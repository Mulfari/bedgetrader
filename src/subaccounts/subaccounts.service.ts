import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  async createSubAccount(userId: string, data: any) {
    return await this.prisma.subAccount.create({
      data: {
        userId,
        exchange: data.exchange,
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        name: data.name,
      },
    });
  }

  // ✅ Método corregido para obtener las subcuentas
  async getSubAccounts(userId: string) {
    const subAccounts = await this.prisma.subAccount.findMany({
      where: { userId },
      select: { id: true, name: true, exchange: true }, // ✅ Solo devuelve los datos necesarios
    });

    if (subAccounts.length === 0) {
      throw new NotFoundException("No tienes subcuentas registradas.");
    }

    return subAccounts;
  }
}
