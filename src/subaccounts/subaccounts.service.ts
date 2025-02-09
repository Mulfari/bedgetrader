import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  async createSubAccount(userId: string, data: any) {
    try {
      return await this.prisma.subAccount.create({
        data: {
          userId,
          exchange: data.exchange,
          apiKey: data.apiKey,
          apiSecret: data.apiSecret, 
          name: data.name,
        },
      });
    } catch (error) {
      throw new Error("Error creando subcuenta: " + error.message);
    }
  }

  // ✅ Nuevo método para obtener las subcuentas del usuario
  async getSubAccounts(userId: string) {
    try {
      return await this.prisma.subAccount.findMany({
        where: { userId },
        select: { id: true, exchange: true, apiKey: true, name: true }, // Evita exponer apiSecret
      });
    } catch (error) {
      throw new Error("Error obteniendo subcuentas: " + error.message);
    }
  }
}
