import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  async getSubAccounts(userId: string) {
    return this.prisma.subAccount.findMany({
      where: { userId },
      select: { id: true, exchange: true, name: true }, // No incluye API keys
    })
  }
}
