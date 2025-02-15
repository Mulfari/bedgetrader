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
      if (!userId) {
        console.error("❌ Error: userId no proporcionado.");
        throw new HttpException('ID de usuario requerido', HttpStatus.BAD_REQUEST);
      }

      console.log(`📡 Buscando cuenta en la base de datos para userId: ${userId}`);

      const account = await this.prisma.subAccount.findFirst({
        where: { userId },
      });

      if (!account) {
        console.error(`❌ No se encontró ninguna cuenta con userId: ${userId}`);
        throw new HttpException('Cuenta no encontrada', HttpStatus.NOT_FOUND);
      }

      console.log(`✅ Cuenta encontrada: ${account.id}`);

      // 🔹 Configurar el proxy con autenticación
      const proxyAgent = new HttpsProxyAgent(
        'http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001'
      );

      // 🔹 Parámetros de autenticación
      const timestamp = Date.now().toString();
      const apiKey = account.apiKey;
      const apiSecret = account.apiSecret;
      const recvWindow = "5000";

      // 🔹 QueryString requerido por Bybit V5
      const queryParams = { accountType: "UNIFIED" }; // Cambiar a "SPOT" si es necesario
      const queryString = new URLSearchParams(queryParams).toString();

      // 🔹 Crear el string para firmar (IMPORTANTE: concatenación sin `&`)
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
      const url = `https://api.bybit.com/v5/account/wallet-balance`;

      console.log("📡 Enviando solicitud a Bybit...");

      // 🔹 Hacer la solicitud a Bybit
      const response = await axios.get(url, {
        headers,
        params: queryParams, // 🔹 Ahora pasamos `accountType=UNIFIED` correctamente
        httpsAgent: proxyAgent, // Usar proxy autenticado
      });

      console.log("✅ Respuesta de Bybit:", JSON.stringify(response.data, null, 2));

      if (!response.data || response.data.retCode !== 0) {
        throw new HttpException(`Error en Bybit: ${response.data.retMsg}`, HttpStatus.BAD_REQUEST);
      }

      // 🔹 Extraer balance en USDT
      const usdtWallet = response.data.result.list.find((wallet: any) =>
        wallet.coin.some((coin: any) => coin.coin === "USDT")
      );

      const usdtBalance = usdtWallet
        ? usdtWallet.coin.find((coin: any) => coin.coin === "USDT").availableToWithdraw
        : 0;

      console.log(`💰 Balance USDT: ${usdtBalance} USDT`);

      return { balance: usdtBalance };
    } catch (error) {
      console.error('❌ Error en getAccountBalance:', error.response?.data || error.message);
      throw new HttpException('Error al obtener balance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
