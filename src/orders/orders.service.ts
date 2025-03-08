import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { PrismaService } from '../prisma.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Ejecuta una orden en múltiples subcuentas de Bybit
   * @param subAccountIds IDs de las subcuentas
   * @param userId ID del usuario
   * @param orderParams Parámetros de la orden
   * @returns Resultado de la ejecución de las órdenes
   */
  async executeOrder(subAccountIds: string[], userId: string, orderParams: any) {
    try {
      this.logger.log(`Ejecutando orden para subcuentas: ${subAccountIds.join(', ')}, userId: ${userId}`);
      this.logger.log(`Parámetros de la orden: ${JSON.stringify(orderParams)}`);

      // Obtener todas las subcuentas solicitadas
      const subAccounts = await this.prisma.subAccount.findMany({
        where: {
          id: { in: subAccountIds },
          userId: userId
        },
      });

      if (subAccounts.length === 0) {
        throw new HttpException('No se encontraron subcuentas válidas', HttpStatus.NOT_FOUND);
      }

      // Verificar si todas las subcuentas solicitadas fueron encontradas
      if (subAccounts.length !== subAccountIds.length) {
        const foundIds = subAccounts.map(acc => acc.id);
        const missingIds = subAccountIds.filter(id => !foundIds.includes(id));
        this.logger.warn(`No se encontraron algunas subcuentas: ${missingIds.join(', ')}`);
      }

      // Ejecutar la orden en cada subcuenta
      const results = await Promise.all(
        subAccounts.map(subAccount => this.executeOrderInSubAccount(subAccount, orderParams))
      );

      return {
        success: true,
        message: `Orden ejecutada en ${results.filter(r => r.success).length} de ${subAccounts.length} subcuentas`,
        results: results
      };
    } catch (error) {
      this.logger.error(`Error al ejecutar la orden: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Error al ejecutar la orden: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Ejecuta una orden en una subcuenta específica
   * @param subAccount Datos de la subcuenta
   * @param orderParams Parámetros de la orden
   * @returns Resultado de la ejecución de la orden
   */
  private async executeOrderInSubAccount(subAccount: any, orderParams: any) {
    try {
      this.logger.log(`Ejecutando orden en subcuenta: ${subAccount.id} (${subAccount.name}), Modo: ${subAccount.isDemo ? 'DEMO' : 'REAL'}`);

      // Configurar proxy
      const proxyUrl = "http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001";
      this.logger.log(`Configurando proxy: ${proxyUrl.replace(/:[^:]*@/, ':****@')}`);
      
      const proxyAgent = new HttpsProxyAgent(proxyUrl);

      // Parámetros de autenticación
      const timestamp = Date.now().toString();
      const apiKey = subAccount.apiKey;
      const secretKey = subAccount.secretKey;
      const recvWindow = "5000";

      // Preparar los parámetros de la orden
      const { marketType, orderType, side, symbol, price, qty, timeInForce } = orderParams;
      
      // Determinar la categoría según el tipo de mercado
      const category = marketType === 'spot' ? 'spot' : 'linear';
      
      // Construir los parámetros de la orden
      const orderRequestParams: any = {
        category,
        symbol: `${symbol}USDT`,
        side: side.toUpperCase(),
        orderType: orderType === 'limit' ? 'Limit' : 'Market',
        qty: qty.toString(),
      };

      // Añadir parámetros específicos según el tipo de orden
      if (orderType === 'limit') {
        orderRequestParams.price = price.toString();
        orderRequestParams.timeInForce = timeInForce || 'GTC'; // Good Till Cancel por defecto
      }

      // Convertir los parámetros a formato de consulta
      const queryString = new URLSearchParams(orderRequestParams).toString();

      // Crear el string para firmar
      const signPayload = `${timestamp}${apiKey}${recvWindow}${queryString}`;
      const signature = crypto.createHmac('sha256', secretKey).update(signPayload).digest('hex');

      // Headers para la API de Bybit
      const headers = {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': signature,
      };

      // URL de Bybit para ejecutar órdenes
      // Usar el endpoint de testnet si la subcuenta es demo, o el endpoint real si no lo es
      const baseUrl = subAccount.isDemo 
        ? "https://api-testnet.bybit.com"  // Endpoint de testnet para cuentas demo
        : "https://api.bybit.com";         // Endpoint real para cuentas reales
      
      const url = `${baseUrl}/v5/order/create`;
      
      this.logger.log(`Enviando solicitud a Bybit:
        - URL: ${url}
        - Modo: ${subAccount.isDemo ? 'DEMO (Testnet)' : 'REAL'}
        - Método: POST
        - Params: ${JSON.stringify(orderRequestParams)}`);

      // Hacer la solicitud a Bybit
      const axiosConfig = {
        headers,
        httpsAgent: proxyAgent,
        timeout: 10000, // 10 segundos
      };

      const response = await axios.post(url, orderRequestParams, axiosConfig);
      
      // Verificar la respuesta
      if (!response.data || response.data.retCode !== 0) {
        this.logger.error(`Error en Bybit para subcuenta ${subAccount.id}: ${response.data?.retMsg} (Código: ${response.data?.retCode})`);
        return {
          success: false,
          subAccountId: subAccount.id,
          subAccountName: subAccount.name,
          error: response.data?.retMsg || 'Error desconocido',
          errorCode: response.data?.retCode,
          isDemo: subAccount.isDemo
        };
      }

      return {
        success: true,
        subAccountId: subAccount.id,
        subAccountName: subAccount.name,
        orderId: response.data.result?.orderId,
        orderLinkId: response.data.result?.orderLinkId,
        symbol: `${symbol}USDT`,
        side: side.toUpperCase(),
        orderType: orderType === 'limit' ? 'Limit' : 'Market',
        price: orderType === 'limit' ? parseFloat(price) : null,
        quantity: parseFloat(qty),
        bybitResponse: response.data.result,
        isDemo: subAccount.isDemo
      };
    } catch (error) {
      this.logger.error(`Error al ejecutar orden en subcuenta ${subAccount.id}: ${error.message}`);
      return {
        success: false,
        subAccountId: subAccount.id,
        subAccountName: subAccount.name,
        error: error.message,
        errorCode: error.response?.data?.retCode,
        isDemo: subAccount.isDemo
      };
    }
  }
} 