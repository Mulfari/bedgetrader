import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as crypto from 'crypto';

@Injectable()
export class AccountDetailsService {
  private readonly BYBIT_API_URLS = {
    Bybit: 'https://api.bybit.com',     // URL para cuentas reales
    BybitDemo: 'https://api-testnet.bybit.com'  // URL para cuentas demo
  };

  constructor(private prisma: PrismaService) {}

  private getApiUrl(exchange: string): string {
    return this.BYBIT_API_URLS[exchange] || this.BYBIT_API_URLS.Bybit;
  }

  // ✅ Obtener el balance de una subcuenta en Bybit
  async getAccountBalance(subAccountId: string, userId: string) {
    try {
      if (!subAccountId || !userId) {
        console.error("❌ Error: subAccountId o userId no proporcionado.");
        throw new HttpException('ID de subcuenta y usuario requeridos', HttpStatus.BAD_REQUEST);
      }

      console.log(`📡 Buscando subcuenta en la base de datos para subAccountId: ${subAccountId}`);

      // 🔹 Buscar la subcuenta correcta asegurando que pertenece al usuario
      const account = await this.prisma.subAccount.findFirst({
        where: { id: subAccountId, userId },
      });

      if (!account || !account.apiKey || !account.apiSecret) {
        console.error(`❌ No se encontró una API Key válida para subAccountId: ${subAccountId}`);
        throw new HttpException('Subcuenta sin credenciales API', HttpStatus.NOT_FOUND);
      }

      console.log(`✅ Subcuenta encontrada: ${account.id}`);
      console.log(`🔑 API Key usada para subAccountId ${subAccountId}: ${account.apiKey}`);

      // 🔹 Configurar proxy
      const proxyAgent = new HttpsProxyAgent(
        "http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001"
      );

      // 🔹 Parámetros de autenticación
      const timestamp = Date.now().toString();
      const apiKey = account.apiKey;
      const apiSecret = account.apiSecret;
      const recvWindow = "5000";

      // 🔹 QueryString requerido por Bybit V5
      const queryParams = { accountType: "UNIFIED" };
      const queryString = new URLSearchParams(queryParams).toString();

      // 🔹 Crear el string para firmar
      const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString || ""}`;
      const signature = crypto.createHmac('sha256', apiSecret).update(signPayload).digest('hex');

      console.log(`🔍 String para firmar: ${signPayload}`);
      console.log(`🔍 Firma generada: ${signature}`);

      // 🔹 Headers actualizados para Bybit V5
      const headers = {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': signature,
      };

      // 🔹 URL de Bybit para obtener el balance (usando la URL correcta según el tipo de cuenta)
      const baseUrl = this.getApiUrl(account.exchange);
      const url = `${baseUrl}/v5/account/wallet-balance`;

      console.log(`📡 Enviando solicitud a ${account.exchange === 'BybitDemo' ? 'Bybit Demo' : 'Bybit Real'}...`);

      // 🔹 Hacer la solicitud a Bybit con tiempo de espera
      const axiosConfig = {
        headers,
        params: queryParams,
        httpsAgent: proxyAgent,
        timeout: 5000, // 🔹 Timeout de 5 segundos para evitar esperas largas
      };

      const response = await axios.get(url, axiosConfig);

      console.log(`📡 Respuesta de ${account.exchange} para subAccountId ${subAccountId}:`, JSON.stringify(response.data, null, 2));

      if (!response.data || response.data.retCode !== 0) {
        console.error(`❌ Error en ${account.exchange}: ${response.data.retMsg} (Código: ${response.data.retCode})`);

        if (response.data.retCode === 10003) {
          throw new HttpException('❌ API Key inválida o sin permisos', HttpStatus.FORBIDDEN);
        }

        throw new HttpException(`Error en ${account.exchange}: ${response.data.retMsg}`, HttpStatus.BAD_REQUEST);
      }

      // 🔹 Enviar la respuesta completa de Bybit al frontend
      return response.data.result;

    } catch (error) {
      console.error('❌ Error en getAccountBalance:', error.response?.data || error.message);
      throw new HttpException('Error al obtener balance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Obtener las operaciones de una subcuenta en Bybit
  async getAccountTrades(subAccountId: string, userId: string) {
    try {
      if (!subAccountId || !userId) {
        console.error("❌ Error: subAccountId o userId no proporcionado.");
        throw new HttpException('ID de subcuenta y usuario requeridos', HttpStatus.BAD_REQUEST);
      }

      const account = await this.prisma.subAccount.findFirst({
        where: { id: subAccountId, userId },
      });

      if (!account || !account.apiKey || !account.apiSecret) {
        console.error(`❌ No se encontró una API Key válida para subAccountId: ${subAccountId}`);
        throw new HttpException('Subcuenta sin credenciales API', HttpStatus.NOT_FOUND);
      }

      const proxyAgent = new HttpsProxyAgent(
        "http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001"
      );

      const timestamp = Date.now().toString();
      const apiKey = account.apiKey;
      const apiSecret = account.apiSecret;
      const recvWindow = "5000";

      // Parámetros para obtener operaciones
      const queryParams = {
        category: "linear",
        limit: "50"  // Obtener las últimas 50 operaciones
      };
      const queryString = new URLSearchParams(queryParams).toString();

      const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString}`;
      const signature = crypto.createHmac('sha256', apiSecret).update(signPayload).digest('hex');

      const headers = {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': signature,
      };

      // URL para obtener las operaciones (usando la URL correcta según el tipo de cuenta)
      const baseUrl = this.getApiUrl(account.exchange);
      const url = `${baseUrl}/v5/position/list?${queryString}`;

      console.log(`📡 Enviando solicitud a ${account.exchange === 'BybitDemo' ? 'Bybit Demo' : 'Bybit Real'}...`);

      const response = await axios.get(url, {
        headers,
        httpsAgent: proxyAgent,
        timeout: 5000,
      });

      if (!response.data || response.data.retCode !== 0) {
        console.error(`❌ Error en ${account.exchange}: ${response.data.retMsg} (Código: ${response.data.retCode})`);
        throw new HttpException(`Error en ${account.exchange}: ${response.data.retMsg}`, HttpStatus.BAD_REQUEST);
      }

      // Transformar los datos al formato que espera el frontend
      const trades = response.data.result.list.map(position => ({
        id: position.positionIdx,
        userId: userId,
        pair: position.symbol,
        type: position.side.toLowerCase(),
        entryPrice: parseFloat(position.avgPrice),
        amount: parseFloat(position.size),
        status: parseFloat(position.size) > 0 ? "open" : "closed",
        openDate: new Date(position.createdTime).toISOString(),
        market: "futures",
        leverage: parseFloat(position.leverage),
        stopLoss: position.stopLoss ? parseFloat(position.stopLoss) : undefined,
        takeProfit: position.takeProfit ? parseFloat(position.takeProfit) : undefined,
        pnl: parseFloat(position.unrealisedPnl)
      }));

      return trades;

    } catch (error) {
      console.error('❌ Error en getAccountTrades:', error.response?.data || error.message);
      throw new HttpException('Error al obtener operaciones', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
