import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as crypto from 'crypto';

@Injectable()
export class AccountDetailsService {
  constructor(private prisma: PrismaService) {}

  // ✅ Obtener el balance de una subcuenta en Bybit
  async getAccountBalance(subAccountId: string, userId: string) {
    try {
      if (!userId || !subAccountId) {
        console.error("❌ Error: userId o subAccountId no proporcionado.");
        throw new HttpException('ID de usuario y subcuenta requeridos', HttpStatus.BAD_REQUEST);
      }

      console.log(`📡 Buscando subcuenta en la base de datos para subAccountId: ${subAccountId}`);

      // 🔹 Buscar la subcuenta específica en la base de datos
      const account = await this.prisma.subAccount.findUnique({
        where: { id: subAccountId, userId },
      });

      if (!account || !account.apiKey || !account.apiSecret) {
        console.error(`❌ No se encontró una API Key válida para subAccountId: ${subAccountId}`);
        throw new HttpException('Subcuenta sin credenciales API', HttpStatus.NOT_FOUND);
      }

      console.log(`✅ Subcuenta encontrada: ${account.id}`);
      console.log(`🔑 API Key usada: ${account.apiKey}`);

      // 🔹 Configurar el proxy correctamente (si es necesario)
      const proxyAgent = new HttpsProxyAgent(
        'http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001'
      );

      // 🔹 Parámetros de autenticación para Bybit V5
      const timestamp = Date.now().toString();
      const apiKey = account.apiKey;
      const apiSecret = account.apiSecret;
      const recvWindow = '5000';

      // 🔹 Query Params requeridos por Bybit
      const queryParams = { accountType: 'UNIFIED' };
      const queryString = new URLSearchParams(queryParams).toString();

      // 🔹 Crear el string para firmar
      const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString}`;
      const signature = crypto.createHmac('sha256', apiSecret).update(signPayload).digest('hex');

      console.log(`🔍 Firma generada: ${signature}`);

      // 🔹 Headers actualizados para Bybit V5
      const headers = {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': signature,
      };

      // 🔹 URL de Bybit para obtener el balance
      const url = `https://api.bybit.com/v5/account/wallet-balance`;

      console.log('📡 Enviando solicitud a Bybit...');

      // 🔹 Configuración de la solicitud a Bybit
      const axiosConfig = {
        headers,
        params: queryParams,
        httpsAgent: proxyAgent,
        timeout: 5000, // Timeout para evitar esperas largas
      };

      const response = await axios.get(url, axiosConfig);

      console.log('✅ Respuesta de Bybit:', JSON.stringify(response.data, null, 2));

      // 🔹 Manejo de errores en la respuesta de Bybit
      if (!response.data || response.data.retCode !== 0) {
        console.error(`❌ Error en Bybit: ${response.data.retMsg} (Código: ${response.data.retCode})`);

        if (response.data.retCode === 10003) {
          throw new HttpException('❌ API Key inválida o sin permisos', HttpStatus.FORBIDDEN);
        }

        throw new HttpException(`Error en Bybit: ${response.data.retMsg}`, HttpStatus.BAD_REQUEST);
      }

      // 🔹 Extraer el balance en USDT
      const usdtBalance = response.data.result.list
        .flatMap((wallet: any) => wallet.coin)
        .find((coin: any) => coin.coin === 'USDT');

      return {
        balance: usdtBalance ? usdtBalance.walletBalance : 0,
        assets: response.data.result.list[0].coin || [],
      };
    } catch (error) {
      console.error('❌ Error en getAccountBalance:', error.response?.data || error.message);
      throw new HttpException('Error al obtener balance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
