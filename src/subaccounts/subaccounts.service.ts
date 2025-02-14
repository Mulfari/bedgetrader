import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import fetch from 'node-fetch';
import * as crypto from 'crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';

@Injectable()
export class SubaccountsService {
  private readonly proxyUrl = 'http://brd-customer-hl_41a62a42-zone-datacenter_proxy1-country-ar:0emxj5daikfp@brd.superproxy.io:33335';

  constructor(private prisma: PrismaService) {}

  async getSubAccounts(userId: string) {
    try {
      const subAccounts = await this.prisma.subAccount.findMany({
        where: { userId },
        select: { id: true, exchange: true, name: true },
      });

      console.log('✅ Subcuentas obtenidas:', subAccounts);
      return subAccounts;
    } catch (error) {
      console.error('❌ Error obteniendo subcuentas:', error);
      throw new InternalServerErrorException('Error al obtener subcuentas');
    }
  }

  async getBybitBalance(apiKey: string, apiSecret: string): Promise<number | null> {
    const endpoint = 'https://api-testnet.bybit.com/v5/account/wallet-balance?accountType=UNIFIED';
    const timestamp = Date.now().toString();
    const recvWindow = '5000';

    const signaturePayload = `${timestamp}${apiKey}${recvWindow}`;
    const signature = crypto.createHmac('sha256', apiSecret).update(signaturePayload).digest('hex');

    console.log(`🔍 Consultando balance desde Argentina: ${endpoint}`);
    console.log(`🔍 Firma HMAC: ${signature}`);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-SIGN': signature,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': recvWindow,
        },
        agent: new HttpsProxyAgent(this.proxyUrl),
      });

      if (!response.ok) {
        console.error(`❌ Error HTTP: ${response.status} ${response.statusText}`);
        throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🔍 Respuesta completa de Bybit:', JSON.stringify(data, null, 2));

      if (data.retCode !== 0) {
        throw new Error(`Bybit API Error: ${data.retMsg}`);
      }

      const totalBalance = parseFloat(data.result.list[0]?.totalWalletBalance || '0');
      return totalBalance;
    } catch (error) {
      console.error('❌ Error obteniendo balance de Bybit:', error);
      return null;
    }
  }
}
