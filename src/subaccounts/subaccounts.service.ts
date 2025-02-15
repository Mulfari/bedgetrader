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
      },
    });
  }

  // ✅ Obtener API Keys de una subcuenta específica
  async getSubAccountKeys(userId: string, subAccountId: string) {
    const subAccount = await this.prisma.subAccount.findUnique({
      where: { id: subAccountId },
      select: {
        apiKey: true,
        apiSecret: true,
      },
    });

    if (!subAccount) {
      throw new NotFoundException('Subcuenta no encontrada.');
    }

    return subAccount;
  }
}
