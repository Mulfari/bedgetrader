import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import tunnel from 'tunnel';

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  // ✅ Obtener todas las subcuentas de un usuario
  async getSubAccounts(userId: string) {
    try {
      return await this.prisma.subAccount.findMany({
        where: { userId },
        select: { id: true, name: true, exchange: true },
      });
    } catch (error) {
      console.error('❌ Error obteniendo subcuentas:', error);
      throw new HttpException('Error al obtener las subcuentas', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Obtener balances de subcuentas
  async getSubAccountBalances(userId: string) {
    try {
      const subAccounts = await this.getSubAccounts(userId);

      const balances = await Promise.all(
        subAccounts.map(async (account) => {
          if (account.exchange !== 'bybit') {
            return { ...account, balance: null };
          }
          const balance = await this.getBybitBalance(account);
          return { ...account, balance };
        })
      );

      return balances;
    } catch (error) {
      console.error('❌ Error obteniendo balances:', error);
      throw new HttpException('Error al obtener los balances de subcuentas', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Obtener balance de una cuenta en Bybit
  private async getBybitBalance(account: any) {
    const API_URL = 'https://api-testnet.bybit.com/v5/account/wallet-balance?accountType=UNIFIED';

    const timestamp = Date.now().toString();
    const signature = this.createSignature(account.apiKey, account.apiSecret, timestamp);

    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'X-BAPI-API-KEY': account.apiKey,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-SIGN': signature,
          'X-BAPI-RECV-WINDOW': '5000',
        },
        agent: tunnel.httpsOverHttp({
          proxy: {
            host: 'brd.superproxy.io',
            port: 33335,
            proxyAuth: 'brd-customer-hl_41a62a42-zone-datacenter_proxy1-country-us:0emxj5daikfp',
          },
        }),
      });

      const data = await response.json();

      if (data.retCode !== 0) {
        throw new Error(`Error en la API de Bybit: ${data.retMsg}`);
      }

      return parseFloat(data.result.list[0].totalWalletBalance) || 0;
    } catch (error) {
      console.error('❌ Error obteniendo balance de Bybit:', error);
      return null;
    }
  }

  // ✅ Generar firma HMAC para la autenticación en Bybit
  private createSignature(apiKey: string, apiSecret: string, timestamp: string): string {
    const params = `accountType=UNIFIED&api_key=${apiKey}&recv_window=5000&timestamp=${timestamp}`;
    return crypto.createHmac('sha256', apiSecret).update(params).digest('hex');
  }
}
