import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as crypto from 'crypto';

@Injectable()
export class AccountDetailsService {
  constructor(private prisma: PrismaService) {}

  // ✅ Obtener el balance de una cuenta en Bybit
  async getAccountBalance(userId: string) {
    try {
      const account = await this.prisma.subAccount.findFirst({ where: { userId } });

      if (!account) {
        throw new HttpException('Cuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      // 🔹 Configurar el proxy
      const proxyAgent = new HttpsProxyAgent(
        'http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001'
      );

      // 🔹 Parámetros de autenticación
      const timestamp = Date.now().toString();
      const apiKey = account.apiKey;
      const apiSecret = account.apiSecret;
      const recvWindow = "5000";

      // 🔹 QueryString requerido por Bybit V5
      const queryString = "accountType=UNIFIED"; // Cambiar a "SPOT" si es necesario

      // 🔹 Crear el string para firmar
      const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString}`;
      const signature = crypto.createHmac('sha256', apiSecret).update(signPayload).digest('hex');

      // 🔹 Headers actualizados para Bybit V5
      const headers = {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': signature,
      };

      // 🔹 URL de Bybit para obtener el balance
      const url = `https://api.bybit.com/v5/account/wallet-balance?${queryString}`;

      // 🔹 Hacer la solicitud a Bybit
      const response = await axios.get(url, {
        headers,
        httpsAgent: proxyAgent,
      });

      console.log("✅ Respuesta de Bybit:", response.data);

      if (!response.data || response.data.retCode !== 0) {
        throw new HttpException(`Error en Bybit: ${response.data.retMsg}`, HttpStatus.BAD_REQUEST);
      }

      // 🔹 Extraer balance en USDT
      const usdtBalance = response.data.result.list
        .flatMap((wallet: any) => wallet.coin)
        .find((coin: any) => coin.coin === "USDT");

      return {
        balance: usdtBalance ? usdtBalance.availableToWithdraw : 0,
      };
    } catch (error) {
      console.error('❌ Error en getAccountBalance:', error.response?.data || error.message);
      throw new HttpException('Error al obtener balance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
