import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubaccountsService } from '../subaccounts/subaccounts.service';
import { Operation } from './operation.interface';
import axios from 'axios';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OperationsService {
  constructor(
    private prisma: PrismaService,
    private subaccountsService: SubaccountsService,
    private configService: ConfigService,
  ) {}

  /**
   * Obtiene las operaciones abiertas para una subcuenta específica
   * @param subAccountId ID de la subcuenta
   * @param userId ID del usuario
   * @returns Lista de operaciones abiertas
   */
  async getOpenOperations(subAccountId: string, userId: string): Promise<Operation[]> {
    try {
      console.log(`🔍 Obteniendo operaciones abiertas para subcuenta ${subAccountId}, usuario ${userId}`);
      
      // Verificar que la subcuenta pertenece al usuario
      const subaccount = await this.subaccountsService.findOne(subAccountId, userId);
      
      if (!subaccount) {
        console.error(`❌ Subcuenta ${subAccountId} no encontrada para usuario ${userId}`);
        throw new HttpException('Subcuenta no encontrada', HttpStatus.NOT_FOUND);
      }
      
      console.log(`✅ Subcuenta encontrada: ${JSON.stringify({
        id: subaccount.id,
        exchange: subaccount.exchange,
        isDemo: subaccount.isDemo,
        apiKey: subaccount.apiKey ? `${subaccount.apiKey.substring(0, 5)}...` : 'no-key'
      })}`);
      
      // Si es una cuenta demo, generar datos simulados
      if (subaccount.isDemo) {
        console.log(`🔹 Generando operaciones simuladas para cuenta demo ${subAccountId}`);
        return this.generateSimulatedOperations(subAccountId, subaccount.exchange);
      }
      
      // Para cuentas reales, obtener operaciones del exchange
      return this.getExchangeOpenOperations(subaccount);
    } catch (error) {
      console.error(`❌ Error al obtener operaciones abiertas:`, error);
      throw new HttpException(
        `Error al obtener operaciones abiertas: ${error.message || 'Error desconocido'}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtiene las operaciones abiertas para todas las subcuentas de un usuario
   * @param userId ID del usuario
   * @returns Lista de operaciones abiertas agrupadas por subcuenta
   */
  async getAllOpenOperations(userId: string): Promise<{ [subAccountId: string]: Operation[] }> {
    try {
      console.log(`🔍 Obteniendo operaciones abiertas para todas las subcuentas del usuario ${userId}`);
      
      // Obtener todas las subcuentas del usuario
      const subAccounts = await this.subaccountsService.getSubAccounts(userId);
      
      if (!subAccounts || subAccounts.length === 0) {
        console.log(`ℹ️ No se encontraron subcuentas para el usuario ${userId}`);
        return {};
      }
      
      console.log(`✅ Se encontraron ${subAccounts.length} subcuentas para el usuario ${userId}`);
      
      // Obtener operaciones para cada subcuenta
      const operationsPromises = subAccounts.map(async (subAccount) => {
        try {
          const operations = await this.getOpenOperations(subAccount.id, userId);
          return { subAccountId: subAccount.id, operations };
        } catch (error) {
          console.error(`❌ Error al obtener operaciones para subcuenta ${subAccount.id}:`, error);
          return { subAccountId: subAccount.id, operations: [] };
        }
      });
      
      const operationsResults = await Promise.all(operationsPromises);
      
      // Convertir el array de resultados a un objeto con subAccountId como clave
      const operationsBySubAccount = operationsResults.reduce((acc, { subAccountId, operations }) => {
        acc[subAccountId] = operations;
        return acc;
      }, {});
      
      return operationsBySubAccount;
    } catch (error) {
      console.error(`❌ Error al obtener operaciones abiertas para todas las subcuentas:`, error);
      throw new HttpException(
        `Error al obtener operaciones abiertas: ${error.message || 'Error desconocido'}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtiene las operaciones abiertas desde el exchange (Bybit)
   * @param subaccount Datos de la subcuenta
   * @returns Lista de operaciones abiertas
   */
  private async getExchangeOpenOperations(subaccount: any): Promise<Operation[]> {
    try {
      console.log(`🔍 Obteniendo operaciones abiertas desde ${subaccount.exchange} para subcuenta ${subaccount.id}`);
      
      // Por ahora solo implementamos Bybit
      if (subaccount.exchange.toLowerCase() === 'bybit') {
        return this.getBybitOpenOperations(subaccount);
      } else {
        console.error(`❌ Exchange ${subaccount.exchange} no soportado`);
        throw new HttpException(`Exchange ${subaccount.exchange} no soportado`, HttpStatus.BAD_REQUEST);
      }
    } catch (error) {
      console.error(`❌ Error al obtener operaciones desde el exchange:`, error);
      throw error;
    }
  }

  /**
   * Obtiene las operaciones abiertas desde Bybit
   * @param subaccount Datos de la subcuenta
   * @returns Lista de operaciones abiertas
   */
  private async getBybitOpenOperations(subaccount: any): Promise<Operation[]> {
    try {
      console.log(`🔍 Obteniendo operaciones abiertas desde Bybit para subcuenta ${subaccount.id}`);
      
      const apiKey = subaccount.apiKey;
      const secretKey = subaccount.secretKey;
      
      if (!apiKey || !secretKey) {
        throw new HttpException('Faltan credenciales de API para la subcuenta', HttpStatus.BAD_REQUEST);
      }
      
      // Parámetros para la solicitud
      const timestamp = Date.now().toString();
      const recvWindow = '5000';
      const queryParams = `category=spot&orderStatus=New,PartiallyFilled`;
      
      // Generar firma
      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(timestamp + apiKey + recvWindow + queryParams)
        .digest('hex');
      
      // Configurar headers
      const headers = {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-SIGN': signature,
        'X-BAPI-SIGN-TYPE': '2',
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'Content-Type': 'application/json'
      };
      
      // Hacer la solicitud a la API de Bybit
      const response = await axios.get(
        `https://api.bybit.com/v5/order/history?${queryParams}`,
        { headers }
      );
      
      // Verificar respuesta
      if (response.data.retCode !== 0) {
        console.error(`❌ Error en la respuesta de Bybit:`, response.data);
        throw new HttpException(`Error en la respuesta de Bybit: ${response.data.retMsg}`, HttpStatus.BAD_REQUEST);
      }
      
      // Mapear la respuesta al formato de Operation
      const operations: Operation[] = response.data.result.list.map(order => ({
        id: order.orderId,
        subAccountId: subaccount.id,
        symbol: order.symbol,
        side: order.side.toLowerCase(),
        type: order.orderType.toLowerCase(),
        status: 'open',
        price: parseFloat(order.price),
        quantity: parseFloat(order.qty),
        filledQuantity: parseFloat(order.cumExecQty),
        remainingQuantity: parseFloat(order.leavesQty),
        openTime: new Date(parseInt(order.createdTime)),
        exchange: 'bybit',
        isDemo: subaccount.isDemo
      }));
      
      console.log(`✅ Se encontraron ${operations.length} operaciones abiertas en Bybit`);
      return operations;
    } catch (error) {
      console.error(`❌ Error al obtener operaciones desde Bybit:`, error);
      
      // Si hay un error de conexión o de API, devolver un array vacío
      if (error.response && error.response.status === 403) {
        console.log(`⚠️ Restricción geográfica detectada, intentando con proxy...`);
        // Aquí podríamos implementar una solución con proxy similar a la de getSubAccountBalance
        return [];
      }
      
      throw error;
    }
  }

  /**
   * Genera operaciones simuladas para cuentas demo
   * @param subAccountId ID de la subcuenta
   * @param exchange Nombre del exchange
   * @returns Lista de operaciones simuladas
   */
  private generateSimulatedOperations(subAccountId: string, exchange: string): Operation[] {
    console.log(`🔹 Generando operaciones simuladas para subcuenta ${subAccountId}`);
    
    // Símbolos comunes para operaciones simuladas
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'];
    
    // Generar un número aleatorio de operaciones (entre 0 y 5)
    const numOperations = Math.floor(Math.random() * 6);
    
    // Generar operaciones simuladas
    const operations: Operation[] = [];
    
    for (let i = 0; i < numOperations; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const type = Math.random() > 0.7 ? 'market' : 'limit';
      
      // Generar precios realistas basados en el símbolo
      let price = 0;
      switch (symbol) {
        case 'BTCUSDT':
          price = 50000 + Math.random() * 10000;
          break;
        case 'ETHUSDT':
          price = 3000 + Math.random() * 500;
          break;
        case 'SOLUSDT':
          price = 100 + Math.random() * 50;
          break;
        case 'BNBUSDT':
          price = 400 + Math.random() * 100;
          break;
        case 'ADAUSDT':
          price = 0.5 + Math.random() * 0.2;
          break;
        default:
          price = 100 + Math.random() * 100;
      }
      
      // Generar cantidad aleatoria
      const quantity = Math.random() * (symbol === 'BTCUSDT' ? 1 : symbol === 'ETHUSDT' ? 10 : 100);
      
      // Generar tiempo de apertura aleatorio (últimas 24 horas)
      const openTime = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
      
      // Generar ID único
      const id = `demo-${subAccountId.substring(0, 5)}-${i}-${Date.now()}`;
      
      // Crear operación simulada
      operations.push({
        id,
        subAccountId,
        symbol,
        side,
        type,
        status: 'open',
        price,
        quantity,
        filledQuantity: type === 'market' ? quantity : quantity * Math.random(),
        remainingQuantity: type === 'market' ? 0 : quantity * Math.random(),
        openTime,
        exchange: exchange.toLowerCase(),
        isDemo: true
      });
    }
    
    console.log(`✅ Generadas ${operations.length} operaciones simuladas`);
    return operations;
  }
} 