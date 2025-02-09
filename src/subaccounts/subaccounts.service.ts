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
          apiSecret: data.apiSecret, // ⚠️ Considera encriptarlo antes de guardar
          name: data.name,
        },
      });
    } catch (error) {
      throw new Error("Error creando subcuenta: " + error.message);
    }
  }
}
