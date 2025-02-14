import fetch from 'node-fetch';
import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  async getBybitBalance(apiKey: string, apiSecret: string) {
    const baseUrl = 'https://api-testnet.bybit.com';
    const endpoint = '/v5/account/wallet-balance';
    const timestamp = Date.now().toString();
    const params = `accountType=UNIFIED`; // Ajusta según tu tipo de cuenta
    const recvWindow = '5000';

    // 🔹 Generar firma HMAC SHA256
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(timestamp + apiKey + recvWindow + params)
      .digest('hex');

    try {
      const response = await fetch(`${baseUrl}${endpoint}?${params}`, {
        method: 'GET',
        headers: {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
          'X-BAPI-SIGN': signature,
        },
      });

      const data = await response.json();
      if (data.retCode !== 0) throw new Error(`Error en la API: ${data.retMsg}`);

      return data.result.list[0]?.totalWalletBalance || '0.00';
    } catch (error) {
      console.error('❌ Error obteniendo balance de Bybit:', error);
      return null;
    }
  }

  async getSubAccounts(userId: string) {
    try {
      const subAccounts = await this.prisma.subAccount.findMany({
        where: { userId },
        select: { id: true, name: true, exchange: true, apiKey: true, apiSecret: true },
      });

      // 🔹 Obtener balances para cada subcuenta
      const subAccountsWithBalance = await Promise.all(
        subAccounts.map(async (sub) => ({
          id: sub.id,
          name: sub.name,
          exchange: sub.exchange,
          balance: await this.getBybitBalance(sub.apiKey, sub.apiSecret),
        }))
      );

      return subAccountsWithBalance;
    } catch (error) {
      console.error('❌ Error obteniendo subcuentas:', error);
      throw new Error('Error obteniendo subcuentas');
    }
  }
}
