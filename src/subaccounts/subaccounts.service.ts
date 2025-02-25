import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as crypto from 'crypto';

@Injectable()
export class SubaccountsService {
  constructor(private prisma: PrismaService) {}

  // ✅ Obtener subcuentas del usuario autenticado
  async getSubAccounts(userId: string) {
    try {
      return await this.prisma.subAccount.findMany({ where: { userId } });
    } catch (error) {
      throw new HttpException('Error al obtener subcuentas', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Obtener las API keys de una subcuenta
  async getSubAccountKeys(subAccountId: string, userId: string) {
    try {
      const subAccount = await this.prisma.subAccount.findUnique({
        where: { id: subAccountId },
      });

      if (!subAccount || subAccount.userId !== userId) {
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      return { apiKey: subAccount.apiKey, apiSecret: subAccount.apiSecret };
    } catch (error) {
      throw new HttpException('Error obteniendo API keys', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Obtener el balance de una subcuenta en Bybit
  async getSubAccountBalance(subAccountId: string, userId: string) {
    try {
      const subAccount = await this.prisma.subAccount.findUnique({
        where: { id: subAccountId },
      });

      if (!subAccount || subAccount.userId !== userId) {
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      // Configurar el proxy con autenticación correcta
      const proxyAgent = new HttpsProxyAgent(
        'http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001'
      );

      // Generar firma para la API de Bybit
      const timestamp = Date.now().toString();
      const apiKey = subAccount.apiKey;
      const apiSecret = subAccount.apiSecret;
      const recvWindow = "5000";

      // Ordenar los parámetros correctamente
      const params = `api_key=${apiKey}&recv_window=${recvWindow}&timestamp=${timestamp}`;
      const signature = crypto.createHmac('sha256', apiSecret).update(params).digest('hex');

      // Headers corregidos
      const headers = {
        'X-BYBIT-API-KEY': apiKey,
        'X-BYBIT-TIMESTAMP': timestamp,
        'X-BYBIT-RECV-WINDOW': recvWindow,
        'X-BYBIT-SIGN': signature,
      };

      // URL corregida con "accountType=UNIFIED"
      const url = 'https://api-demo.bybit.com/v5/account/wallet-balance?accountType=UNIFIED';

      // Hacer la solicitud a Bybit
      const response = await axios.get(url, {
        headers,
        httpsAgent: proxyAgent, // Usar proxy autenticado
      });

      console.log("✅ Respuesta de Bybit:", response.data);

      if (!response.data || response.data.retCode !== 0) {
        throw new HttpException('Error al obtener balance de Bybit', HttpStatus.BAD_REQUEST);
      }

      // Extraer balance en USDT
      const usdtBalance = response.data.result.list
        .flatMap((wallet: any) => wallet.coin)
        .find((coin: any) => coin.coin === "USDT");

      return {
        balance: usdtBalance ? usdtBalance.availableToWithdraw : 0,
      };
    } catch (error) {
      console.error('❌ Error en getSubAccountBalance:', error.response?.data || error.message);
      throw new HttpException('Error al obtener balance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Crear una nueva subcuenta
  async createSubAccount(userId: string, exchange: string, apiKey: string, apiSecret: string, name: string) {
    try {
      return await this.prisma.subAccount.create({
        data: { userId, exchange, apiKey, apiSecret, name },
      });
    } catch (error) {
      throw new HttpException('Error al crear subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Actualizar una subcuenta existente
  async updateSubAccount(id: string, userId: string, exchange: string, apiKey: string, apiSecret: string, name: string) {
    try {
      const subAccount = await this.prisma.subAccount.findUnique({ where: { id } });

      if (!subAccount || subAccount.userId !== userId) {
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      return await this.prisma.subAccount.update({
        where: { id },
        data: { exchange, apiKey, apiSecret, name },
      });
    } catch (error) {
      throw new HttpException('Error al actualizar subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Eliminar una subcuenta
  async deleteSubAccount(id: string, userId: string) {
    try {
      const subAccount = await this.prisma.subAccount.findUnique({ where: { id } });

      if (!subAccount || subAccount.userId !== userId) {
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      return await this.prisma.subAccount.delete({ where: { id } });
    } catch (error) {
      throw new HttpException('Error al eliminar subcuenta', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
